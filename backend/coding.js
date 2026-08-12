const { getDatabase } = require('./db');

function validateSpan(source, { startOffset, endOffset }) {
  if (!Number.isInteger(startOffset) || !Number.isInteger(endOffset)) {
    throw new Error('Offsets must be integers.');
  }

  if (startOffset < 0 || endOffset < startOffset) {
    throw new Error('Invalid offset range.');
  }

  if (endOffset > source.content.length) {
    throw new Error('Offset range exceeds source content length.');
  }
}

function applyCoding({ sourceId, nodeId, coderId, startOffset, endOffset, timestampStart = null, timestampEnd = null }) {
  const db = getDatabase();
  const source = db.prepare('SELECT id, content FROM sources WHERE id = ?').get(sourceId);
  if (!source) {
    throw new Error('Source not found.');
  }

  const node = db.prepare('SELECT id FROM nodes WHERE id = ?').get(nodeId);
  if (!node) {
    throw new Error('Node not found.');
  }

  const coder = db.prepare('SELECT id FROM coders WHERE id = ?').get(coderId);
  if (!coder) {
    throw new Error('Coder not found.');
  }

  validateSpan(source, { startOffset, endOffset });

  const existing = db.prepare(`
    SELECT id FROM codings
    WHERE source_id = ? AND coder_id = ? AND node_id = ? AND start_offset = ? AND end_offset = ?
  `).get(sourceId, coderId, nodeId, startOffset, endOffset);

  if (existing) {
    return { id: existing.id, sourceId, nodeId, coderId, startOffset, endOffset, duplicate: true };
  }

  const result = db.prepare(`
    INSERT INTO codings (project_id, source_id, coder_id, node_id, start_offset, end_offset, timestamp_start, timestamp_end)
    VALUES ((SELECT project_id FROM sources WHERE id = ?), ?, ?, ?, ?, ?, ?, ?)
  `).run(sourceId, sourceId, coderId, nodeId, startOffset, endOffset, timestampStart, timestampEnd);

  return {
    id: result.lastInsertRowid,
    sourceId,
    nodeId,
    coderId,
    startOffset,
    endOffset,
    timestampStart,
    timestampEnd,
    duplicate: false,
  };
}

function removeCoding(codingId) {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM codings WHERE id = ?').run(codingId);
  return { deleted: result.changes > 0, codingId };
}

function getCodingsForSource(sourceId, { nodeId = null } = {}) {
  const db = getDatabase();
  const query = `
    SELECT id, project_id, source_id, coder_id, node_id, start_offset, end_offset, timestamp_start, timestamp_end
    FROM codings
    WHERE source_id = ?
    ${nodeId ? 'AND node_id = ?' : ''}
    ORDER BY start_offset ASC, end_offset ASC
  `;

  const params = nodeId ? [sourceId, nodeId] : [sourceId];
  return db.prepare(query).all(...params);
}

function createNode({ projectId, name, parentId = null }) {
  const db = getDatabase();
  const result = db.prepare(`
    INSERT INTO nodes (project_id, name, parent_id)
    VALUES (?, ?, ?)
  `).run(projectId, name, parentId);

  return { id: result.lastInsertRowid, projectId, name, parentId };
}

function moveNode(nodeId, newParentId) {
  const db = getDatabase();
  const node = db.prepare('SELECT id, parent_id FROM nodes WHERE id = ?').get(nodeId);
  if (!node) {
    throw new Error('Node not found.');
  }

  if (newParentId !== null) {
    let current = db.prepare('SELECT id, parent_id FROM nodes WHERE id = ?').get(newParentId);
    while (current) {
      if (current.id === nodeId) {
        throw new Error('Cannot move node into its own subtree.');
      }
      current = current.parent_id == null ? null : db.prepare('SELECT id, parent_id FROM nodes WHERE id = ?').get(current.parent_id);
    }
  }

  db.prepare('UPDATE nodes SET parent_id = ? WHERE id = ?').run(newParentId, nodeId);
  return { id: nodeId, parentId: newParentId };
}

function getNodeTree(projectId, aggregate = true) {
  const db = getDatabase();
  const rows = db.prepare('SELECT id, project_id, name, parent_id FROM nodes WHERE project_id = ? ORDER BY id ASC').all(projectId);
  const byId = new Map(rows.map((row) => [row.id, { id: row.id, projectId: row.project_id, name: row.name, parentId: row.parent_id, children: [], codingCount: 0 }]));

  for (const row of rows) {
    const entry = byId.get(row.id);
    if (row.parent_id !== null && byId.has(row.parent_id)) {
      byId.get(row.parent_id).children.push(entry);
    }
  }

  const roots = Array.from(byId.values()).filter((row) => row.parentId === null);

  const walk = (node) => {
    let codingCount = 0;
    for (const child of node.children) {
      walk(child);
      codingCount += child.codingCount;
    }

    const ownCount = db.prepare('SELECT COUNT(*) AS count FROM codings WHERE node_id = ?').get(node.id).count;
    if (aggregate) {
      node.codingCount = ownCount + codingCount;
    } else {
      node.codingCount = ownCount;
    }

    return node;
  };

  return roots.map((root) => walk(root));
}

function mergeNodes(sourceNodeId, targetNodeId) {
  const db = getDatabase();
  const sourceNode = db.prepare('SELECT id FROM nodes WHERE id = ?').get(sourceNodeId);
  const targetNode = db.prepare('SELECT id FROM nodes WHERE id = ?').get(targetNodeId);
  if (!sourceNode || !targetNode) {
    throw new Error('Node not found.');
  }

  try {
    db.prepare('UPDATE codings SET node_id = ? WHERE node_id = ?').run(targetNodeId, sourceNodeId);
    db.prepare('UPDATE nodes SET parent_id = ? WHERE parent_id = ?').run(targetNodeId, sourceNodeId);
    db.prepare('DELETE FROM nodes WHERE id = ?').run(sourceNodeId);
  } catch (error) {
    throw new Error(`Failed to merge nodes: ${error.message}`);
  }

  return { deletedNodeId: sourceNodeId, targetNodeId };
}

function percentCoded(sourceId) {
  const db = getDatabase();
  const source = db.prepare('SELECT content FROM sources WHERE id = ?').get(sourceId);
  if (!source) {
    throw new Error('Source not found.');
  }

  const contentLength = source.content.length;
  if (contentLength === 0) return 0;

  const codings = db.prepare('SELECT start_offset, end_offset FROM codings WHERE source_id = ? ORDER BY start_offset ASC, end_offset ASC').all(sourceId);
  const merged = [];

  for (const coding of codings) {
    if (merged.length === 0) {
      merged.push({ start: coding.start_offset, end: coding.end_offset });
      continue;
    }

    const last = merged[merged.length - 1];
    if (coding.start_offset <= last.end) {
      last.end = Math.max(last.end, coding.end_offset);
    } else {
      merged.push({ start: coding.start_offset, end: coding.end_offset });
    }
  }

  const covered = merged.reduce((total, span) => total + Math.max(0, span.end - span.start), 0);
  return covered / contentLength;
}

function renameNode(nodeId, name) {
  const db = getDatabase();
  const trimmed = typeof name === 'string' ? name.trim() : '';
  if (!trimmed) {
    throw new Error('Node name cannot be empty.');
  }

  const node = db.prepare('SELECT id FROM nodes WHERE id = ?').get(nodeId);
  if (!node) {
    throw new Error('Node not found.');
  }

  db.prepare('UPDATE nodes SET name = ? WHERE id = ?').run(trimmed, nodeId);
  return { id: nodeId, name: trimmed };
}

function deleteNode(nodeId, { cascade = false } = {}) {
  const db = getDatabase();
  const node = db.prepare('SELECT id FROM nodes WHERE id = ?').get(nodeId);
  if (!node) {
    throw new Error('Node not found.');
  }

  const collectDescendantIds = (id) => {
    const children = db.prepare('SELECT id FROM nodes WHERE parent_id = ?').all(id);
    return children.reduce((ids, child) => [...ids, child.id, ...collectDescendantIds(child.id)], []);
  };
  const descendantIds = collectDescendantIds(nodeId);

  if (descendantIds.length > 0 && !cascade) {
    throw new Error(
      `This node has ${descendantIds.length} child node(s). Delete or move them first, or pass cascade to delete the whole subtree.`
    );
  }

  const idsToDelete = [nodeId, ...descendantIds];
  // Delete children before their parent — collectDescendantIds always lists
  // a node before its own descendants, so reversing guarantees every child
  // is removed before the parent row it points to via parent_id.
  const deletionOrder = [...idsToDelete].reverse();
  const deleteMany = db.transaction((ids) => {
    for (const id of ids) {
      db.prepare('DELETE FROM codings WHERE node_id = ?').run(id);
      db.prepare('DELETE FROM nodes WHERE id = ?').run(id);
    }
  });
  deleteMany(deletionOrder);

  return { deletedNodeIds: idsToDelete };
}

module.exports = {
  applyCoding,
  createNode,
  deleteNode,
  getCodingsForSource,
  getNodeTree,
  mergeNodes,
  moveNode,
  percentCoded,
  removeCoding,
  renameNode,
};
