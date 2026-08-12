const { getDatabase } = require('./db');
const { getNodeTree } = require('./coding');
const { getClassificationSheet } = require('./memos');

// Collects a node's id plus every descendant's id, so a coding report on
// a parent node includes codings applied to its children — matching how
// the node tree's own coding counts already aggregate (see
// backend/coding.js getNodeTree), which is also standard QDA-tool
// behavior (coding at a child is coding "under" its parent too).
function collectNodeAndDescendantIds(db, nodeId) {
  const ids = [nodeId];
  const children = db.prepare('SELECT id FROM nodes WHERE parent_id = ?').all(nodeId);
  for (const child of children) {
    ids.push(...collectNodeAndDescendantIds(db, child.id));
  }
  return ids;
}

function generateCodingReport(nodeId) {
  const db = getDatabase();
  const node = db.prepare('SELECT id, name FROM nodes WHERE id = ?').get(nodeId);
  if (!node) {
    throw new Error('Node not found.');
  }

  const nodeIds = collectNodeAndDescendantIds(db, nodeId);
  const placeholders = nodeIds.map(() => '?').join(', ');

  const codings = db.prepare(`
    SELECT c.id, c.source_id, s.title, c.start_offset, c.end_offset
    FROM codings c
    JOIN sources s ON s.id = c.source_id
    WHERE c.node_id IN (${placeholders})
    ORDER BY c.source_id ASC, c.start_offset ASC
  `).all(...nodeIds);

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
