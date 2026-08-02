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

module.exports = {
  createCoder,
  listCoders,
};
