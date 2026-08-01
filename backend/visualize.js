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

function clusterByWordSimilarity({ items, mode = 'tf' }) {
  const vectors = buildFeatureVectors({ items, mode });
  if (vectors.length <= 1) {
    return { clusters: vectors.map((item) => ({ id: item.id, children: [] })), linkage: [] };
  }

  const distanceMatrix = [];
  for (let i = 0; i < vectors.length; i += 1) {
    distanceMatrix[i] = [];
    for (let j = 0; j < vectors.length; j += 1) {
      if (i === j) {
        distanceMatrix[i][j] = 0;
      } else {
        const a = vectors[i].vector;
        const b = vectors[j].vector;
        const union = new Set([...a, ...b]);
        const intersection = a.filter((value, index) => value > 0 && b[index] > 0).length;
        const unionSize = union.size;
        distanceMatrix[i][j] = unionSize === 0 ? 0 : 1 - intersection / unionSize;
      }
    }
  }

  return {
    clusters: vectors.map((item) => ({ id: item.id, children: [] })),
    linkage: distanceMatrix,
  };
}

function clusterByCodingSimilarity({ items, mode = 'presence' }) {
  const vectors = buildFeatureVectors({ items, mode });
  if (vectors.length <= 1) {
    return { clusters: vectors.map((item) => ({ id: item.id, children: [] })), linkage: [] };
  }

  const distanceMatrix = [];
  for (let i = 0; i < vectors.length; i += 1) {
    distanceMatrix[i] = [];
    for (let j = 0; j < vectors.length; j += 1) {
      if (i === j) {
        distanceMatrix[i][j] = 0;
      } else {
        const a = vectors[i].vector;
        const b = vectors[j].vector;
        const union = new Set([...a, ...b]);
        const intersection = a.filter((value, index) => value > 0 && b[index] > 0).length;
        const unionSize = union.size;
        distanceMatrix[i][j] = unionSize === 0 ? 0 : 1 - intersection / unionSize;
      }
    }
  }

  return {
    clusters: vectors.map((item) => ({ id: item.id, children: [] })),
    linkage: distanceMatrix,
  };
}

module.exports = {
  wordCloudData,
  hierarchyChartData,
  buildFeatureVectors,
  clusterByWordSimilarity,
  clusterByCodingSimilarity,
};
