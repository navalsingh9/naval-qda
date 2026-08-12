const { getDatabase } = require('./db');
const { getNodeTree } = require('./coding');
const { wordFrequency } = require('./query');

function wordCloudData({ projectId, sourceIds = null, minLength = 4, topN = 100 }) {
  const rows = wordFrequency({ projectId, sourceIds, minLength, topN });
  return rows.map((row) => ({ word: row.token, weight: row.count }));
}

function hierarchyChartData({ projectId }) {
  const db = getDatabase();
  const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(projectId);
  if (!project) {
    throw new Error('Project not found.');
  }

  const nodes = getNodeTree(projectId, true);
  const toTree = (node) => ({
    name: node.name,
    value: node.codingCount,
    children: (node.children || []).map((child) => toTree(child)),
  });

  return nodes.map((node) => toTree(node));
}

// Coding-by-node summary (NVivo calls this a "Chart" off the node list):
// how many coding references each node has, and how many distinct
// sources contributed at least one of them. Powers the bar/pie charts
// on the Visualizations page.
function codingByNodeChart({ projectId }) {
  const db = getDatabase();
  const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(projectId);
  if (!project) {
    throw new Error('Project not found.');
  }

  const nodes = db.prepare('SELECT id, name, parent_id FROM nodes WHERE project_id = ? ORDER BY id ASC').all(projectId);
  const nameById = new Map(nodes.map((n) => [n.id, n.name]));

  const pathName = (node) => {
    const parts = [node.name];
    let parentId = node.parent_id;
    while (parentId != null) {
      const parent = nodes.find((n) => n.id === parentId);
      if (!parent) break;
      parts.unshift(parent.name);
      parentId = parent.parent_id;
    }
    return parts.join(' \u203a ');
  };

  return nodes.map((node) => {
    const stats = db.prepare(`
      SELECT COUNT(*) AS references_count, COUNT(DISTINCT source_id) AS sources_count
      FROM codings WHERE node_id = ?
    `).get(node.id);
    return {
      nodeId: node.id,
      name: nameById.get(node.id) ?? node.name,
      path: pathName(node),
      references: stats.references_count,
      sources: stats.sources_count,
    };
  });
}

// Crosstab of coding references: nodes (rows) x the distinct values of a
// chosen case attribute (columns) — e.g. "Manager flexibility" coding
// broken down by the "Role" attribute. This is NVivo's Matrix Coding
// Query when one axis is set to a classification attribute rather than
// individual cases.
function codingByAttributeChart({ projectId, attributeId }) {
  const db = getDatabase();
  const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(projectId);
  if (!project) {
    throw new Error('Project not found.');
  }

  const attribute = db.prepare('SELECT id, name FROM attributes WHERE id = ? AND project_id = ?').get(attributeId, projectId);
  if (!attribute) {
    throw new Error('Attribute not found.');
  }

  const nodes = db.prepare('SELECT id, name FROM nodes WHERE project_id = ? ORDER BY id ASC').all(projectId);
  const values = db.prepare(`
    SELECT DISTINCT value FROM case_attribute_values
    WHERE attribute_id = ? AND value IS NOT NULL AND value != ''
    ORDER BY value ASC
  `).all(attributeId).map((row) => row.value);

  const cells = nodes.map((node) => values.map((value) => {
    const count = db.prepare(`
      SELECT COUNT(*) AS count
      FROM codings c
      JOIN source_case_links scl ON scl.source_id = c.source_id
      JOIN case_attribute_values cav ON cav.case_id = scl.case_id
      WHERE c.project_id = ? AND c.node_id = ? AND cav.attribute_id = ? AND cav.value = ?
    `).get(projectId, node.id, attributeId, value).count;
    return count;
  }));

  return {
    attributeName: attribute.name,
    rowLabels: nodes.map((n) => n.name),
    columnLabels: values,
    cells,
  };
}

function buildFeatureVectors({ items, mode = 'tf' }) {
  if (!Array.isArray(items) || items.length === 0) {
    return [];
  }

  const vocabulary = new Set();
  for (const item of items) {
    const terms = Array.isArray(item.terms) ? item.terms : [];
    for (const term of terms) {
      vocabulary.add(term);
    }
  }

  const terms = Array.from(vocabulary).sort();
  const vectors = [];

  for (const item of items) {
    const values = [];
    const itemTerms = Array.isArray(item.terms) ? item.terms : [];
    const counts = new Map();
    for (const term of itemTerms) {
      counts.set(term, (counts.get(term) || 0) + 1);
    }

    for (const term of terms) {
      if (mode === 'presence') {
        values.push(counts.has(term) ? 1 : 0);
      } else {
        values.push(counts.get(term) || 0);
      }
    }

    vectors.push({ id: item.id, terms: itemTerms, vector: values });
  }

  return vectors;
}

function buildDistanceMatrix(vectors) {
  const distanceMatrix = [];
  for (let i = 0; i < vectors.length; i += 1) {
    distanceMatrix[i] = [];
    for (let j = 0; j < vectors.length; j += 1) {
      if (i === j) {
        distanceMatrix[i][j] = 0;
      } else {
        const a = vectors[i].vector;
        const b = vectors[j].vector;
        // Jaccard distance over the shared vocabulary: a and b are
        // per-term counts/presence flags in the SAME term order, so
        // "union"/"intersection" must be computed positionally (which
        // vocabulary slots are non-zero in either vector) — not via
        // `new Set([...a, ...b])`, which collapses the raw numeric
        // values instead (e.g. counts of 0/1/2/3) and has nothing to
        // do with how many terms the two items actually share.
        let intersection = 0;
        let union = 0;
        for (let k = 0; k < a.length; k += 1) {
          const inA = a[k] > 0;
          const inB = b[k] > 0;
          if (inA && inB) intersection += 1;
          if (inA || inB) union += 1;
        }
        distanceMatrix[i][j] = union === 0 ? 0 : 1 - intersection / union;
      }
    }
  }
  return distanceMatrix;
}

// Average-linkage agglomerative hierarchical clustering. Repeatedly
// merges the two closest remaining clusters (average distance between
// all member pairs) until a single tree remains, recording each merge's
// height (distance) so the frontend can draw a real dendrogram instead
// of just a flat similarity matrix.
function hierarchicalCluster(distanceMatrix, labels) {
  const n = distanceMatrix.length;
  if (n === 0) return null;
  if (n === 1) return { type: 'leaf', id: 0, label: labels[0] };

  let clusters = labels.map((label, index) => ({
    node: { type: 'leaf', id: index, label },
    members: [index],
  }));

  while (clusters.length > 1) {
    let best = { i: 0, j: 1, distance: Infinity };
    for (let i = 0; i < clusters.length; i += 1) {
      for (let j = i + 1; j < clusters.length; j += 1) {
        let total = 0;
        let count = 0;
        for (const a of clusters[i].members) {
          for (const b of clusters[j].members) {
            total += distanceMatrix[a][b];
            count += 1;
          }
        }
        const avg = count > 0 ? total / count : 0;
        if (avg < best.distance) {
          best = { i, j, distance: avg };
        }
      }
    }

    const merged = {
      node: { type: 'node', height: best.distance, left: clusters[best.i].node, right: clusters[best.j].node },
      members: [...clusters[best.i].members, ...clusters[best.j].members],
    };

    clusters = clusters.filter((_, index) => index !== best.i && index !== best.j);
    clusters.push(merged);
  }

  return clusters[0].node;
}

function clusterByWordSimilarity({ items, mode = 'tf' }) {
  const vectors = buildFeatureVectors({ items, mode });
  if (vectors.length <= 1) {
    return { clusters: vectors.map((item) => ({ id: item.id, children: [] })), linkage: [], tree: vectors.length === 1 ? { type: 'leaf', id: 0, label: String(vectors[0].id) } : null };
  }

  const distanceMatrix = buildDistanceMatrix(vectors);
  const tree = hierarchicalCluster(distanceMatrix, vectors.map((v) => String(v.id)));

  return {
    clusters: vectors.map((item) => ({ id: item.id, children: [] })),
    linkage: distanceMatrix,
    tree,
  };
}

function clusterByCodingSimilarity({ items, mode = 'presence' }) {
  const vectors = buildFeatureVectors({ items, mode });
  if (vectors.length <= 1) {
    return { clusters: vectors.map((item) => ({ id: item.id, children: [] })), linkage: [], tree: vectors.length === 1 ? { type: 'leaf', id: 0, label: String(vectors[0].id) } : null };
  }

  const distanceMatrix = buildDistanceMatrix(vectors);
  const tree = hierarchicalCluster(distanceMatrix, vectors.map((v) => String(v.id)));

  return {
    clusters: vectors.map((item) => ({ id: item.id, children: [] })),
    linkage: distanceMatrix,
    tree,
  };
}

module.exports = {
  wordCloudData,
  hierarchyChartData,
  codingByNodeChart,
  codingByAttributeChart,
  buildFeatureVectors,
  hierarchicalCluster,
  clusterByWordSimilarity,
  clusterByCodingSimilarity,
};
