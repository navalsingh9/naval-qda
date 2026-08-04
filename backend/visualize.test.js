const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { initializeDatabase, closeDatabase } = require('./db');
const { importSourceFile } = require('./sources');
const { createNode } = require('./coding');
const { wordCloudData, hierarchyChartData, buildFeatureVectors, clusterByWordSimilarity, clusterByCodingSimilarity } = require('./visualize');

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

  const codingClustering = clusterByCodingSimilarity({ items: [{ id: 'a', terms: ['alpha', 'beta'] }, { id: 'b', terms: ['gamma'] }] });
  assert.ok(Array.isArray(codingClustering.linkage));

  closeDatabase();
});
