const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { initializeDatabase, closeDatabase } = require('./db');
const { importSourceFile } = require('./sources');
const { createNode, applyCoding } = require('./coding');
const { getOrCreatePrimaryCoder } = require('./coders');
const { createCase, createAttribute, setCaseAttributeValue, linkSourceToCase } = require('./memos');
const {
  wordCloudData,
  hierarchyChartData,
  codingByNodeChart,
  codingByAttributeChart,
  buildFeatureVectors,
  hierarchicalCluster,
  clusterByWordSimilarity,
  clusterByCodingSimilarity,
} = require('./visualize');

function makeTempApp() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'naval-qda-visualize-'));
  return {
    tmpDir,
    app: {
      getPath: (name) => {
        if (name === 'userData') return tmpDir;
        throw new Error(`Unexpected path request: ${name}`);
      },
    },
  };
}

test('visualization helpers produce word-cloud, hierarchy, and clustering data', async () => {
  const { app } = makeTempApp();
  initializeDatabase(app);

  const db = require('./db').getDatabase();
  db.prepare('INSERT INTO projects (name) VALUES (?)').run('Project');
  const projectId = db.prepare('SELECT last_insert_rowid() AS id').get().id;

  const sourceFile = path.join(os.tmpdir(), `visualize-source-${Date.now()}.txt`);
  fs.writeFileSync(sourceFile, 'Alpha beta gamma alpha delta beta.');
  await importSourceFile({ projectId, title: 'Source A', filePath: sourceFile });

  const child = createNode({ projectId, name: 'Child' });
  createNode({ projectId, name: 'Parent' });

  const wordCloud = wordCloudData({ projectId, minLength: 4, topN: 10 });
  assert.ok(wordCloud.some((row) => row.word === 'alpha' && row.weight === 2));

  const hierarchy = hierarchyChartData({ projectId });
  assert.equal(hierarchy.length, 2);
  assert.ok(hierarchy.some((node) => node.name === 'Parent'));
  assert.ok(hierarchy.some((node) => node.name === 'Child'));

  const vectors = buildFeatureVectors({ items: [{ id: 'a', terms: ['alpha', 'beta'] }, { id: 'b', terms: ['gamma'] }], mode: 'presence' });
  assert.deepEqual(vectors[0].vector, [1, 1, 0]);
  assert.deepEqual(vectors[1].vector, [0, 0, 1]);

  const clustering = clusterByWordSimilarity({ items: [{ id: 'a', terms: ['alpha', 'beta'] }, { id: 'b', terms: ['alpha'] }] });
  assert.equal(clustering.clusters.length, 2);
  assert.ok(Array.isArray(clustering.linkage));
  assert.equal(clustering.tree.type, 'node');

  const codingClustering = clusterByCodingSimilarity({ items: [{ id: 'a', terms: ['alpha', 'beta'] }, { id: 'b', terms: ['gamma'] }] });
  assert.ok(Array.isArray(codingClustering.linkage));

  closeDatabase();
});

test('hierarchicalCluster builds a merge tree with increasing heights toward the root', () => {
  const labels = ['a', 'b', 'c'];
  // a & b are identical (distance 0), c is far from both.
  const distanceMatrix = [
    [0, 0, 1],
    [0, 0, 1],
    [1, 1, 0],
  ];
  const tree = hierarchicalCluster(distanceMatrix, labels);
  assert.equal(tree.type, 'node');
  assert.equal(tree.height, 1);
  // The first merge (a & b, distance 0) should be nested inside the root.
  const inner = tree.left.type === 'node' ? tree.left : tree.right;
  assert.equal(inner.height, 0);
});

test('codingByNodeChart and codingByAttributeChart summarize codings for charting', async () => {
  const { app } = makeTempApp();
  initializeDatabase(app);

  const db = require('./db').getDatabase();
  db.prepare('INSERT INTO projects (name) VALUES (?)').run('Project');
  const projectId = db.prepare('SELECT last_insert_rowid() AS id').get().id;

  const sourceFile = path.join(os.tmpdir(), `visualize-attr-source-${Date.now()}.txt`);
  fs.writeFileSync(sourceFile, 'Some interview text about flexibility and workload.');
  const source = await importSourceFile({ projectId, title: 'Source A', filePath: sourceFile });

  const node = createNode({ projectId, name: 'Flexibility' });
  const coder = getOrCreatePrimaryCoder(projectId);
  applyCoding({ sourceId: source.id, nodeId: node.id, coderId: coder.id, startOffset: 0, endOffset: 4 });

  const byNode = codingByNodeChart({ projectId });
  assert.equal(byNode.length, 1);
  assert.equal(byNode[0].references, 1);
  assert.equal(byNode[0].sources, 1);

  const caseRow = createCase({ projectId, name: 'P1' });
  const attribute = createAttribute({ projectId, name: 'Role', valueType: 'text' });
  setCaseAttributeValue({ caseId: caseRow.id, attributeId: attribute.id, value: 'Manager' });
  linkSourceToCase(source.id, caseRow.id);

  const byAttribute = codingByAttributeChart({ projectId, attributeId: attribute.id });
  assert.equal(byAttribute.attributeName, 'Role');
  assert.deepEqual(byAttribute.columnLabels, ['Manager']);
  assert.equal(byAttribute.cells[0][0], 1);

  closeDatabase();
});
