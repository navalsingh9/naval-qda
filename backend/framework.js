const { getDatabase } = require('./db');

const EXCERPT_PREVIEW_LENGTH = 280;

// NVivo's Framework Matrix: a case x node grid where each cell shows the
// case's coded excerpts for that node, plus an editable summary the
// researcher writes by hand (the actual analytic output — the excerpts
// are just the evidence backing it). This mirrors that: gather excerpts
// per (case, node) pair from the coding + source_case_links tables, and
// layer the freeform summary from framework_summaries on top.
function getFrameworkMatrix({ projectId, nodeIds = null, caseIds = null }) {
  const db = getDatabase();
  const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(projectId);
  if (!project) {
    throw new Error('Project not found.');
  }

  const allNodes = db.prepare('SELECT id, name FROM nodes WHERE project_id = ? ORDER BY id ASC').all(projectId);
  const nodes = Array.isArray(nodeIds) && nodeIds.length > 0 ? allNodes.filter((n) => nodeIds.includes(n.id)) : allNodes;

  const allCases = db.prepare('SELECT id, name FROM cases WHERE project_id = ? ORDER BY id ASC').all(projectId);
  const cases = Array.isArray(caseIds) && caseIds.length > 0 ? allCases.filter((c) => caseIds.includes(c.id)) : allCases;

  const summaryRows = db.prepare(`
    SELECT fs.case_id, fs.node_id, fs.summary, fs.updated_at
    FROM framework_summaries fs
    JOIN cases c ON c.id = fs.case_id
    WHERE c.project_id = ?
  `).all(projectId);
  const summaryByKey = new Map(summaryRows.map((row) => [`${row.case_id}:${row.node_id}`, row]));

  const excerptStmt = db.prepare(`
    SELECT c.id, c.source_id, s.title AS source_title, s.content, c.start_offset, c.end_offset
    FROM codings c
    JOIN source_case_links scl ON scl.source_id = c.source_id
    JOIN sources s ON s.id = c.source_id
    WHERE scl.case_id = ? AND c.node_id = ?
    ORDER BY c.source_id ASC, c.start_offset ASC
  `);

  const rows = cases.map((caseRow) => {
    const columns = nodes.map((node) => {
      const excerptRows = excerptStmt.all(caseRow.id, node.id);
      const excerpts = excerptRows.map((row) => {
        const raw = (row.content || '').slice(row.start_offset, row.end_offset);
        const preview = raw.length > EXCERPT_PREVIEW_LENGTH ? `${raw.slice(0, EXCERPT_PREVIEW_LENGTH)}\u2026` : raw;
        return {
          codingId: row.id,
          sourceId: row.source_id,
          sourceTitle: row.source_title,
          text: preview,
        };
      });

      const summaryRow = summaryByKey.get(`${caseRow.id}:${node.id}`);

      return {
        nodeId: node.id,
        excerptCount: excerpts.length,
        excerpts,
        summary: summaryRow?.summary ?? '',
        summaryUpdatedAt: summaryRow?.updated_at ?? null,
      };
    });

    return { caseId: caseRow.id, caseName: caseRow.name, columns };
  });

  return {
    rowLabels: cases.map((c) => ({ id: c.id, name: c.name })),
    columnLabels: nodes.map((n) => ({ id: n.id, name: n.name })),
    rows,
  };
}

function setFrameworkSummary({ caseId, nodeId, summary }) {
  const db = getDatabase();
  const caseRow = db.prepare('SELECT id, project_id FROM cases WHERE id = ?').get(caseId);
  const nodeRow = db.prepare('SELECT id, project_id FROM nodes WHERE id = ?').get(nodeId);
  if (!caseRow || !nodeRow) {
    throw new Error('Case or node not found.');
  }
  if (caseRow.project_id !== nodeRow.project_id) {
    throw new Error('Case and node do not belong to the same project.');
  }

  const normalized = summary == null ? '' : String(summary);

  db.prepare(`
    INSERT INTO framework_summaries (case_id, node_id, summary, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(case_id, node_id) DO UPDATE SET summary = excluded.summary, updated_at = CURRENT_TIMESTAMP
  `).run(caseId, nodeId, normalized);

  const row = db.prepare('SELECT updated_at FROM framework_summaries WHERE case_id = ? AND node_id = ?').get(caseId, nodeId);

  return { caseId, nodeId, summary: normalized, updatedAt: row?.updated_at ?? null };
}

module.exports = {
  getFrameworkMatrix,
  setFrameworkSummary,
};
