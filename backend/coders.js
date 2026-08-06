const { getDatabase } = require('./db');

function createCoder({ projectId, name }) {
  const db = getDatabase();
  const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(projectId);
  if (!project) {
    throw new Error('Project not found.');
  }

  const trimmedName = (name || '').trim();
  if (!trimmedName) {
    throw new Error('Coder name is required.');
  }

  const result = db.prepare('INSERT INTO coders (project_id, name) VALUES (?, ?)').run(projectId, trimmedName);
  return { id: result.lastInsertRowid, projectId, name: trimmedName };
}

function listCoders(projectId) {
  const db = getDatabase();
  return db.prepare('SELECT id, project_id, name, created_at FROM coders WHERE project_id = ? ORDER BY id ASC')
    .all(projectId)
    .map((row) => ({ id: row.id, projectId: row.project_id, name: row.name, createdAt: row.created_at }));
}

// Every project needs at least one coder before any coding can be applied
// (codings.coder_id is a required foreign key). Rather than making every
// caller remember to create one first — and rather than the frontend
// guessing at a raw id like `1`, which only happens to exist by accident —
// this returns the project's first coder, creating a default "Primary
// Coder" the first time it's needed. Safe to call repeatedly.
function getOrCreatePrimaryCoder(projectId) {
  const db = getDatabase();
  const existing = db.prepare('SELECT id, project_id, name, created_at FROM coders WHERE project_id = ? ORDER BY id ASC LIMIT 1').get(projectId);
  if (existing) {
    return { id: existing.id, projectId: existing.project_id, name: existing.name, createdAt: existing.created_at };
  }

  return createCoder({ projectId, name: 'Primary Coder' });
}

module.exports = {
  createCoder,
  listCoders,
  getOrCreatePrimaryCoder,
};
