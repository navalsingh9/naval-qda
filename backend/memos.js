const { getDatabase } = require('./db');

function validateLinkedReference(db, projectId, linkedType, linkedId) {
  if (!['source', 'node', 'case'].includes(linkedType)) {
    throw new Error('linkedType must be one of: source, node, case');
  }

  if (!Number.isInteger(linkedId) || linkedId <= 0) {
    throw new Error('linkedId must be a positive integer.');
  }

  let row;
  if (linkedType === 'source') {
    row = db.prepare('SELECT id, project_id FROM sources WHERE id = ?').get(linkedId);
  } else if (linkedType === 'node') {
    row = db.prepare('SELECT id, project_id FROM nodes WHERE id = ?').get(linkedId);
  } else {
    row = db.prepare('SELECT id, project_id FROM cases WHERE id = ?').get(linkedId);
  }

  if (!row) {
    throw new Error(`${linkedType} not found.`);
  }

  if (row.project_id !== projectId) {
    throw new Error('Linked record does not belong to the provided project.');
  }
}

function createMemo({ projectId, linkedType, linkedId, title, content }) {
  const db = getDatabase();
  const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(projectId);
  if (!project) {
    throw new Error('Project not found.');
  }

  validateLinkedReference(db, projectId, linkedType, linkedId);

  const timestamp = new Date().toISOString();
  const result = db.prepare(`
    INSERT INTO memos (project_id, title, linked_type, linked_id, content, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(projectId, title || '', linkedType, linkedId, content, timestamp, timestamp);

  const memo = db.prepare('SELECT id, project_id, title, linked_type, linked_id, content, created_at, updated_at FROM memos WHERE id = ?').get(result.lastInsertRowid);
  return {
    id: memo.id,
    projectId: memo.project_id,
    linkedType: memo.linked_type,
    linkedId: memo.linked_id,
    title: memo.title,
    content: memo.content,
    createdAt: memo.created_at,
    updatedAt: memo.updated_at,
  };
}

function updateMemo(memoId, { title, content }) {
  const db = getDatabase();
  const existing = db.prepare('SELECT id FROM memos WHERE id = ?').get(memoId);
  if (!existing) {
    throw new Error('Memo not found.');
  }

  const timestamp = new Date().toISOString();
  db.prepare(`
    UPDATE memos
    SET title = ?, content = ?, updated_at = ?
    WHERE id = ?
  `).run(title ?? '', content ?? '', timestamp, memoId);

  const memo = db.prepare('SELECT id, project_id, title, linked_type, linked_id, content, created_at, updated_at FROM memos WHERE id = ?').get(memoId);
  return {
    id: memo.id,
    projectId: memo.project_id,
    linkedType: memo.linked_type,
    linkedId: memo.linked_id,
    title: memo.title,
    content: memo.content,
    createdAt: memo.created_at,
    updatedAt: memo.updated_at,
  };
}

function listMemos(linkedType, linkedId) {
  const db = getDatabase();
  if (!['source', 'node', 'case'].includes(linkedType)) {
    throw new Error('linkedType must be one of: source, node, case');
  }

  return db.prepare(`
    SELECT id, project_id, title, linked_type, linked_id, content, created_at, updated_at
    FROM memos
    WHERE linked_type = ? AND linked_id = ?
    ORDER BY updated_at DESC, created_at DESC
  `).all(linkedType, linkedId);
}

function createCase({ projectId, name }) {
  const db = getDatabase();
  const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(projectId);
  if (!project) {
    throw new Error('Project not found.');
  }

  const result = db.prepare('INSERT INTO cases (project_id, name) VALUES (?, ?)').run(projectId, name);
  return { id: result.lastInsertRowid, projectId, name };
}

function listCases(projectId) {
  const db = getDatabase();
  return db.prepare('SELECT id, project_id, name, description, created_at FROM cases WHERE project_id = ? ORDER BY id ASC').all(projectId);
}

function createAttribute({ projectId, name, valueType = 'text' }) {
  const db = getDatabase();
  const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(projectId);
  if (!project) {
    throw new Error('Project not found.');
  }

  if (!['categorical', 'numeric', 'text'].includes(valueType)) {
    throw new Error('valueType must be one of: categorical, numeric, text');
  }

  const result = db.prepare('INSERT INTO attributes (project_id, name, value_type) VALUES (?, ?, ?)').run(projectId, name, valueType);
  return { id: result.lastInsertRowid, projectId, name, valueType };
}

function listAttributes(projectId) {
  const db = getDatabase();
  return db.prepare('SELECT id, project_id, name, value_type FROM attributes WHERE project_id = ? ORDER BY id ASC')
    .all(projectId)
    .map((row) => ({ id: row.id, projectId: row.project_id, name: row.name, valueType: row.value_type }));
}

function setCaseAttributeValue({ caseId, attributeId, value }) {
  const db = getDatabase();
  const caseRow = db.prepare('SELECT id, project_id FROM cases WHERE id = ?').get(caseId);
  const attributeRow = db.prepare('SELECT id, project_id, value_type FROM attributes WHERE id = ?').get(attributeId);
  if (!caseRow || !attributeRow) {
    throw new Error('Case or attribute not found.');
  }

  if (attributeRow.project_id !== caseRow.project_id) {
    throw new Error('Attribute does not belong to the same project as the case.');
  }

  const normalizedValue = value === '' || value === null || value === undefined ? null : String(value);

  if (attributeRow.value_type === 'numeric' && normalizedValue !== null) {
    if (!/^[-+]?\d+(?:\.\d+)?$/.test(normalizedValue)) {
      throw new Error('Numeric attributes require a numeric value.');
    }
  }

  const result = db.prepare(`
    INSERT INTO case_attribute_values (case_id, attribute_id, value)
    VALUES (?, ?, ?)
    ON CONFLICT(case_id, attribute_id) DO UPDATE SET value = excluded.value
  `).run(caseId, attributeId, normalizedValue);

  return {
    id: result.lastInsertRowid,
    caseId,
    attributeId,
    value: normalizedValue,
  };
}

function linkSourceToCase(sourceId, caseId) {
  const db = getDatabase();
  const source = db.prepare('SELECT id, project_id FROM sources WHERE id = ?').get(sourceId);
  const caseRow = db.prepare('SELECT id, project_id FROM cases WHERE id = ?').get(caseId);
  if (!source || !caseRow) {
    throw new Error('Source or case not found.');
  }

  if (source.project_id !== caseRow.project_id) {
    throw new Error('Source and case do not belong to the same project.');
  }

  db.prepare(`
    INSERT OR IGNORE INTO source_case_links (source_id, case_id)
    VALUES (?, ?)
  `).run(sourceId, caseId);

  return { sourceId, caseId, linked: true };
}

function getClassificationSheet(projectId) {
  const db = getDatabase();
  const cases = db.prepare('SELECT id, name, description FROM cases WHERE project_id = ? ORDER BY id ASC').all(projectId);
  const attributes = db.prepare('SELECT id, name, value_type FROM attributes WHERE project_id = ? ORDER BY id ASC').all(projectId);
  const values = db.prepare(`
    SELECT cav.case_id, cav.attribute_id, cav.value
    FROM case_attribute_values cav
    JOIN attributes a ON a.id = cav.attribute_id
    WHERE a.project_id = ?
    ORDER BY cav.case_id, cav.attribute_id
  `).all(projectId);

  const valuesByCase = new Map();
  for (const row of values) {
    if (!valuesByCase.has(row.case_id)) {
      valuesByCase.set(row.case_id, {});
    }
    valuesByCase.get(row.case_id)[row.attribute_id] = row.value;
  }

  return {
    projectId,
    attributes: attributes.map((attribute) => ({ id: attribute.id, name: attribute.name, valueType: attribute.value_type })),
    cases: cases.map((caseRow) => ({
      id: caseRow.id,
      name: caseRow.name,
      description: caseRow.description,
      values: Object.fromEntries(
        attributes.map((attribute) => [attribute.name, valuesByCase.get(caseRow.id)?.[attribute.id] ?? null])
      ),
    })),
  };
}

module.exports = {
  createMemo,
  updateMemo,
  listMemos,
  createCase,
  listCases,
  createAttribute,
  listAttributes,
  setCaseAttributeValue,
  linkSourceToCase,
  getClassificationSheet,
};
