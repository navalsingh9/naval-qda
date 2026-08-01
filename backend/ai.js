const fs = require('node:fs');
const path = require('node:path');
const { getDatabase } = require('./db');

function getSettings() {
  const db = getDatabase();
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('ai.provider');
  return {
    provider: row?.value || 'mock',
    apiKey: process.env.GEMINI_API_KEY || null,
  };
}

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

function summarizeSource({ sourceId, maxChars = 800 }) {
  const db = getDatabase();
  const source = db.prepare('SELECT id, title, content FROM sources WHERE id = ?').get(sourceId);
  if (!source) {
    throw new Error('Source not found.');
  }

  const text = (source.content || '').trim();
  if (!text) {
    return { title: 'Empty source', summary: 'No content available for summarization.' };
  }

  const provider = getSettings().provider;
  if (provider === 'gemini' && process.env.GEMINI_API_KEY) {
    return {
      title: `AI summary for ${source.title}`,
      summary: `Gemini-style summary for ${source.title}: ${text.slice(0, maxChars)}`,
    };
  }

  return {
    title: `Draft summary for ${source.title}`,
    summary: `Auto-generated summary placeholder for ${source.title}. ${text.slice(0, Math.min(maxChars, 240))}`,
  };
}

function suggestChildCodes({ sourceId, nodeId, maxSuggestions = 3 }) {
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

  const keywords = Array.from(new Set(text.toLowerCase().match(/\b[a-z]{4,}\b/g) || [])).slice(0, 8);
  return keywords.slice(0, maxSuggestions).map((keyword) => ({
    name: `${node.name} :: ${keyword}`,
    evidence: `Evidence appears around the term “${keyword}”.`,
    confidence: 0.6,
  }));
}

module.exports = {
  ensureSettingsTable,
  setSetting,
  getSetting,
  summarizeSource,
  suggestChildCodes,
};
