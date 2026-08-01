const { getDatabase } = require('./db');
const { getNodeTree } = require('./coding');
const { getClassificationSheet } = require('./memos');

function generateCodingReport(nodeId) {
  const db = getDatabase();
  const node = db.prepare('SELECT id, name FROM nodes WHERE id = ?').get(nodeId);
  if (!node) {
    throw new Error('Node not found.');
  }

  const codings = db.prepare(`
    SELECT c.id, c.source_id, s.title, c.start_offset, c.end_offset
    FROM codings c
    JOIN sources s ON s.id = c.source_id
    WHERE c.node_id = ?
    ORDER BY c.source_id ASC, c.start_offset ASC
  `).all(nodeId);

  return {
    nodeId: node.id,
    nodeName: node.name,
    codings: codings.map((coding) => ({
      id: coding.id,
      sourceId: coding.source_id,
      sourceTitle: coding.title,
      startOffset: coding.start_offset,
      endOffset: coding.end_offset,
    })),
  };
}

function generateProjectSummary(projectId) {
  const db = getDatabase();
  const project = db.prepare('SELECT id, name FROM projects WHERE id = ?').get(projectId);
  if (!project) {
    throw new Error('Project not found.');
  }

  const sourceCount = db.prepare('SELECT COUNT(*) AS count FROM sources WHERE project_id = ?').get(projectId).count;
  const nodeTree = getNodeTree(projectId, true);
  const coders = db.prepare('SELECT id, name FROM coders WHERE project_id = ? ORDER BY id ASC').all(projectId);
  const classificationSheet = getClassificationSheet(projectId);

  return {
    projectId: project.id,
    projectName: project.name,
    sourceCount,
    nodeTree,
    coders,
    classificationSheet,
  };
}

module.exports = {
  generateCodingReport,
  generateProjectSummary,
};
