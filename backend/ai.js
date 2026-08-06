const { getDatabase } = require('./db');

function ensureSettingsTable() {
  const db = getDatabase();
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);
}

function setSetting(key, value) {
  ensureSettingsTable();
  const db = getDatabase();
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, String(value));
  return { key, value };
}

function getSetting(key) {
  ensureSettingsTable();
  const db = getDatabase();
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row?.value ?? null;
}

function getAiConfig() {
  const provider = getSetting('ai.provider') || 'gemini';
  const apiKey = getSetting('ai.apiKey') || process.env.GEMINI_API_KEY || null;
  return { provider, apiKey };
}

// ---- Provider calls ----
// NOTE: this hits the REST endpoint directly (no @google/genai SDK dependency,
// Electron's Node runtime already has global fetch).
//
// gemini-3.5-flash is a reasoning model — its "thinking" tokens count against
// maxOutputTokens, so without an explicit generationConfig, longer prompts
// can silently come back empty (the whole budget gets consumed by reasoning
// before any output text is produced). thinkingLevel: 'low' keeps latency/
// cost down for the short, non-analytical tasks this app uses it for
// (summaries, code suggestions) — thinking can't be fully disabled on this
// model family, only reduced.
async function callGemini({ apiKey, prompt, responseMimeType }) {
  const model = 'gemini-3.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const generationConfig = {
    maxOutputTokens: 2048,
    thinkingConfig: { thinkingLevel: 'low' },
  };
  if (responseMimeType) {
    generationConfig.responseMimeType = responseMimeType;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig }),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Gemini request failed (${response.status}): ${body.slice(0, 200)}`);
  }
  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('Gemini returned no content.');
  }
  return text.trim();
}

async function callMistral({ apiKey, prompt, jsonMode }) {
  const url = 'https://api.mistral.ai/v1/chat/completions';
  const body = {
    model: 'mistral-small-latest',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 1024,
  };
  if (jsonMode) {
    body.response_format = { type: 'json_object' };
  }
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Mistral request failed (${response.status}): ${errText.slice(0, 200)}`);
  }
  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error('Mistral returned no content.');
  }
  return text.trim();
}

// Add a new provider by adding one entry here (and one <option> in
// AiSettingsPanel.tsx) — everything else (settings storage, fallback,
// error handling) is shared.
const PROVIDERS = {
  gemini: {
    label: 'Gemini',
    async summarize({ apiKey, text }) {
      const prompt = `Summarize the following qualitative research source in 2-3 sentences, focused on what a researcher coding it would want to know:\n\n${text.slice(0, 6000)}`;
      return callGemini({ apiKey, prompt });
    },
    async suggestCodes({ apiKey, text, nodeName, maxSuggestions }) {
      const prompt = `You are assisting qualitative coding under the parent code "${nodeName}". Suggest up to ${maxSuggestions} child codes for the text below. Respond with ONLY strict JSON: an array of {"name": string, "evidence": string, "confidence": number 0-1}. No prose, no markdown fences.\n\nText:\n${text.slice(0, 6000)}`;
      const raw = await callGemini({ apiKey, prompt, responseMimeType: 'application/json' });
      const cleaned = raw.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      if (!Array.isArray(parsed)) {
        throw new Error('Gemini response was not a JSON array.');
      }
      return parsed.slice(0, maxSuggestions);
    },
  },
  mistral: {
    label: 'Mistral',
    async summarize({ apiKey, text }) {
      const prompt = `Summarize the following qualitative research source in 2-3 sentences, focused on what a researcher coding it would want to know:\n\n${text.slice(0, 6000)}`;
      return callMistral({ apiKey, prompt });
    },
    async suggestCodes({ apiKey, text, nodeName, maxSuggestions }) {
      const prompt = `You are assisting qualitative coding under the parent code "${nodeName}". Suggest up to ${maxSuggestions} child codes for the text below. Respond with ONLY strict JSON: an array of {"name": string, "evidence": string, "confidence": number 0-1}. No prose, no markdown fences.\n\nText:\n${text.slice(0, 6000)}`;
      const raw = await callMistral({ apiKey, prompt, jsonMode: true });
      const cleaned = raw.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      if (!Array.isArray(parsed)) {
        throw new Error('Mistral response was not a JSON array.');
      }
      return parsed.slice(0, maxSuggestions);
    },
  },
};

// ---- Offline fallback ----
// Used automatically whenever no key/provider is configured, or a live call
// fails. Not user-selectable — it's a graceful degradation path, not a
// product option, so it never appears in the frontend provider dropdown.
function offlineSummary(source, maxChars) {
  const text = (source.content || '').trim();
  return `Offline placeholder summary for ${source.title} (no AI key configured): ${text.slice(0, Math.min(maxChars, 240))}`;
}

function offlineSuggestions(text, node, maxSuggestions) {
  const keywords = Array.from(new Set(text.toLowerCase().match(/\b[a-z]{4,}\b/g) || [])).slice(0, 8);
  return keywords.slice(0, maxSuggestions).map((keyword) => ({
    name: `${node.name} :: ${keyword}`,
    evidence: `Evidence appears around the term "${keyword}" (offline placeholder, no AI key configured).`,
    confidence: 0.4,
  }));
}

async function summarizeSource({ sourceId, maxChars = 800 }) {
  const db = getDatabase();
  const source = db.prepare('SELECT id, title, content FROM sources WHERE id = ?').get(sourceId);
  if (!source) {
    throw new Error('Source not found.');
  }

  const text = (source.content || '').trim();
  if (!text) {
    return { title: 'Empty source', summary: 'No content available for summarization.' };
  }

  const { provider, apiKey } = getAiConfig();
  const impl = PROVIDERS[provider];
  if (!impl || !apiKey) {
    return { title: `Draft summary for ${source.title}`, summary: offlineSummary(source, maxChars) };
  }

  try {
    const summary = await impl.summarize({ apiKey, text });
    return { title: `AI summary for ${source.title}`, summary };
  } catch (err) {
    return {
      title: `Draft summary for ${source.title}`,
      summary: `${offlineSummary(source, maxChars)} (${impl.label} call failed: ${err.message})`,
    };
  }
}

async function suggestChildCodes({ sourceId, nodeId, maxSuggestions = 3 }) {
  const db = getDatabase();
  const source = db.prepare('SELECT id, content FROM sources WHERE id = ?').get(sourceId);
  const node = db.prepare('SELECT id, name FROM nodes WHERE id = ?').get(nodeId);
  if (!source || !node) {
    throw new Error('Source or node not found.');
  }

  const text = (source.content || '').trim();
  if (!text) {
    return [];
  }

  const { provider, apiKey } = getAiConfig();
  const impl = PROVIDERS[provider];
  if (!impl || !apiKey) {
    return offlineSuggestions(text, node, maxSuggestions);
  }

  try {
    return await impl.suggestCodes({ apiKey, text, nodeName: node.name, maxSuggestions });
  } catch (err) {
    return offlineSuggestions(text, node, maxSuggestions).map((s) => ({
      ...s,
      evidence: `${s.evidence} (${impl.label} call failed: ${err.message})`,
    }));
  }
}

module.exports = {
  ensureSettingsTable,
  setSetting,
  getSetting,
  summarizeSource,
  suggestChildCodes,
};
