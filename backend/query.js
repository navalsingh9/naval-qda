const { getDatabase } = require('./db');

const STOPWORDS_EN = new Set([
  'a','about','above','after','again','against','all','am','an','and','any','are','as','at','be','because','been','before','being','below','between','both','but','by','can','could','did','do','does','doing','down','during','each','few','for','from','further','had','has','have','having','he','her','here','hers','herself','him','himself','his','how','i','if','in','into','is','it','its','itself','just','me','more','most','my','myself','no','nor','not','now','of','off','on','once','only','or','other','our','ours','ourselves','out','over','own','same','she','should','so','some','such','than','that','the','their','theirs','them','themselves','then','there','these','they','this','those','through','to','too','under','until','up','very','was','wasn','we','were','what','when','where','which','while','who','whom','why','with','would','you','your','yours','yourself','yourselves'
]);

function textSearch({ projectId, term, sourceIds = null, useRegex = false, caseSensitive = false }) {
  const db = getDatabase();
  const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(projectId);
  if (!project) {
    throw new Error('Project not found.');
  }

  const sourceIdList = Array.isArray(sourceIds) && sourceIds.length > 0 ? sourceIds : null;
  const whereClause = sourceIdList ? `AND id IN (${sourceIdList.map(() => '?').join(',')})` : '';
  const params = [projectId];
  if (sourceIdList) {
    params.push(...sourceIdList);
  }
  const sources = db.prepare(`
    SELECT id, content FROM sources
    WHERE project_id = ? ${whereClause}
    ORDER BY id ASC
  `).all(...params);

  if (!term || term.length === 0) {
    return [];
  }

  const pattern = useRegex
    ? new RegExp(term, caseSensitive ? 'g' : 'gi')
    : null;
  const normalizedTerm = caseSensitive ? term : term.toLowerCase();

  const results = [];
  for (const source of sources) {
    const content = source.content || '';
    if (useRegex) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const startOffset = match.index;
        const endOffset = startOffset + match[0].length;
        results.push({
          sourceId: source.id,
          startOffset,
          endOffset,
          context: content.slice(Math.max(0, startOffset - 60), Math.min(content.length, endOffset + 60)),
        });
        if (match[0].length === 0) {
          pattern.lastIndex += 1;
        }
      }
    } else {
      const searchTerm = caseSensitive ? term : term.toLowerCase();
      let index = 0;
      while (index < content.length) {
        const foundIndex = caseSensitive
          ? content.indexOf(searchTerm, index)
          : content.toLowerCase().indexOf(searchTerm, index);
        if (foundIndex === -1) break;
        results.push({
          sourceId: source.id,
          startOffset: foundIndex,
          endOffset: foundIndex + searchTerm.length,
          context: content.slice(Math.max(0, foundIndex - 60), Math.min(content.length, foundIndex + searchTerm.length + 60)),
        });
        index = foundIndex + searchTerm.length;
      }
    }
  }

  return results;
}

function wordFrequency({ projectId, sourceIds = null, minLength = 4, topN = 100, stemming = false }) {
  const db = getDatabase();
  const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(projectId);
  if (!project) {
    throw new Error('Project not found.');
  }

  const sourceIdList = Array.isArray(sourceIds) && sourceIds.length > 0 ? sourceIds : null;
  const whereClause = sourceIdList ? `AND id IN (${sourceIdList.map(() => '?').join(',')})` : '';
  const params = [projectId];
  if (sourceIdList) {
    params.push(...sourceIdList);
  }
  const sources = db.prepare(`
    SELECT id, content FROM sources
    WHERE project_id = ? ${whereClause}
    ORDER BY id ASC
  `).all(...params).filter((row) => row.content != null);

  const combined = sources.map((source) => source.content || '').join(' ');
  const tokens = combined.toLowerCase().match(/\w+/g) || [];

  const map = new Map();
  for (const token of tokens) {
    if (token.length < minLength || STOPWORDS_EN.has(token)) continue;
    const normalized = stemming ? token : token;
    const key = stemming ? token : token;
    if (!map.has(key)) {
      map.set(key, { token: normalized, count: 0 });
    }
    map.get(key).count += 1;
  }

  return Array.from(map.values())
    .sort((a, b) => b.count - a.count || a.token.localeCompare(b.token))
    .slice(0, topN)
    .map((row) => ({ token: row.token, count: row.count }));
}

function codingQuery({ projectId, nodeIds, caseFilter = null }) {
  const db = getDatabase();
  const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(projectId);
  if (!project) {
    throw new Error('Project not found.');
  }

  if (!Array.isArray(nodeIds) || nodeIds.length === 0) {
    return [];
  }

  const nodePlaceholders = nodeIds.map(() => '?').join(',');
  let query = `
    SELECT c.id, c.source_id, c.node_id, s.title AS source_title, n.name AS node_name, c.start_offset, c.end_offset
    FROM codings c
    JOIN sources s ON s.id = c.source_id
    JOIN nodes n ON n.id = c.node_id
    WHERE c.project_id = ? AND c.node_id IN (${nodePlaceholders})
  `;

  const params = [projectId, ...nodeIds];

  if (caseFilter && typeof caseFilter === 'object') {
    query += `
      AND EXISTS (
        SELECT 1
        FROM source_case_links scl
        JOIN case_attribute_values cav ON cav.case_id = scl.case_id
        WHERE scl.source_id = c.source_id AND cav.attribute_id = ? AND cav.value = ?
      )
    `;
    params.push(caseFilter.attributeId, caseFilter.value);
  }

  query += ' ORDER BY c.start_offset ASC';

  return db.prepare(query).all(...params).map((row) => ({
    id: row.id,
    sourceId: row.source_id,
    sourceTitle: row.source_title,
    nodeId: row.node_id,
    nodeName: row.node_name,
    startOffset: row.start_offset,
    endOffset: row.end_offset,
  }));
}

function matrixCodingQuery({ projectId, rows = 'nodes', columns = 'cases', metric = 'count' }) {
  const db = getDatabase();
  const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(projectId);
  if (!project) {
    throw new Error('Project not found.');
  }

  const nodes = db.prepare('SELECT id, name FROM nodes WHERE project_id = ? ORDER BY id ASC').all(projectId);
  const cases = db.prepare('SELECT id, name FROM cases WHERE project_id = ? ORDER BY id ASC').all(projectId);

  if (rows !== 'nodes' || columns !== 'cases') {
    return { rowLabels: nodes.map((node) => node.name), columnLabels: cases.map((caseRow) => caseRow.name), cells: [] };
  }

  const cells = [];
  for (const node of nodes) {
    const row = [];
    for (const caseRow of cases) {
      const count = db.prepare(`
        SELECT COUNT(*) AS count
        FROM codings c
        JOIN source_case_links scl ON scl.source_id = c.source_id
        WHERE c.project_id = ? AND c.node_id = ? AND scl.case_id = ?
      `).get(projectId, node.id, caseRow.id).count;
      row.push(count);
    }
    cells.push(row);
  }

  return {
    rowLabels: nodes.map((node) => node.name),
    columnLabels: cases.map((caseRow) => caseRow.name),
    cells,
  };
}

const KAPPA_BANDS = [
  { max: 0, label: 'Poor' },
  { max: 0.20, label: 'Slight' },
  { max: 0.40, label: 'Fair' },
  { max: 0.60, label: 'Moderate' },
  { max: 0.80, label: 'Substantial' },
  { max: 1.01, label: 'Almost Perfect' },
];

function interpretKappa(k) {
  return KAPPA_BANDS.find((band) => k <= band.max)?.label ?? 'Almost Perfect';
}

function codingComparison({ sourceId, coderAId, coderBId, nodeId }) {
  const db = getDatabase();
  const source = db.prepare('SELECT id, content FROM sources WHERE id = ?').get(sourceId);
  if (!source) {
    throw new Error('Source not found.');
  }

  const content = source.content || '';
  const paragraphs = [];
  let start = 0;
  const regex = /\n\n+/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    if (match.index > start) {
      paragraphs.push({ start, end: match.index });
    }
    start = match.index + match[0].length;
  }
  if (content.length > start) {
    paragraphs.push({ start, end: content.length });
  }
  if (paragraphs.length === 0) {
    paragraphs.push({ start: 0, end: content.length });
  }

  const codingRows = db.prepare(`
    SELECT start_offset, end_offset, coder_id
    FROM codings
    WHERE source_id = ? AND node_id = ?
    ORDER BY start_offset ASC
  `).all(sourceId, nodeId);

  let bothCoded = 0;
  let onlyA = 0;
  let onlyB = 0;
  let neither = 0;

  for (const paragraph of paragraphs) {
    const aCoded = codingRows.some((row) => row.coder_id === coderAId && row.start_offset < paragraph.end && row.end_offset > paragraph.start);
    const bCoded = codingRows.some((row) => row.coder_id === coderBId && row.start_offset < paragraph.end && row.end_offset > paragraph.start);

    if (aCoded && bCoded) bothCoded += 1;
    else if (aCoded) onlyA += 1;
    else if (bCoded) onlyB += 1;
    else neither += 1;
  }

  return {
    sourceId,
    nodeId,
    paragraphs: paragraphs.length,
    contingency: { bothCoded, onlyA, onlyB, neither },
  };
}

module.exports = {
  STOPWORDS_EN,
  textSearch,
  wordFrequency,
  codingQuery,
  matrixCodingQuery,
  KAPPA_BANDS,
  interpretKappa,
  codingComparison,
};
