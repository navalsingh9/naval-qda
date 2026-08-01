const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { initializeDatabase, closeDatabase } = require('./db');
const { importSourceFile } = require('./sources');
const { applyCoding, createNode } = require('./coding');
const { createCase, createAttribute, setCaseAttributeValue, linkSourceToCase } = require('./memos');
const { textSearch, wordFrequency, codingQuery, matrixCodingQuery, codingComparison, interpretKappa } = require('./query');

function makeTempApp() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'naval-qda-query-'));
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

test('text search, word frequency, and coding query work end to end', () => {
  const { app } = makeTempApp();
  initializeDatabase(app);

  const db = require('./db').getDatabase();
  db.prepare('INSERT INTO projects (name) VALUES (?)').run('Project');
  const projectId = db.prepare('SELECT last_insert_rowid() AS id').get().id;

  const sourceFile = path.join(os.tmpdir(), `query-source-${Date.now()}.txt`);
  fs.writeFileSync(sourceFile, 'Alpha beta gamma alpha delta the epsilon beta.');
  const source = importSourceFile({ projectId, title: 'Source A', filePath: sourceFile });

  db.prepare('INSERT INTO coders (project_id, name) VALUES (?, ?)').run(projectId, 'Coder A');
  const coderId = db.prepare('SELECT last_insert_rowid() AS id').get().id;

  const node = createNode({ projectId, name: 'Theme' });
  applyCoding({ sourceId: source.id, nodeId: node.id, coderId, startOffset: 0, endOffset: 5 });

  const searchResults = textSearch({ projectId, term: 'alpha', sourceIds: [source.id] });
  assert.equal(searchResults.length, 2);
  assert.equal(searchResults[0].sourceId, source.id);
  assert.match(searchResults[0].context, /Alpha/);

  const frequencies = wordFrequency({ projectId, sourceIds: [source.id], minLength: 4, topN: 10 });
  assert.ok(frequencies.some((row) => row.token === 'alpha' && row.count === 2));
  assert.ok(frequencies.every((row) => row.token !== 'the'));

  const caseRecord = createCase({ projectId, name: 'Case 1' });
  const attribute = createAttribute({ projectId, name: 'Group', valueType: 'text' });
  setCaseAttributeValue({ caseId: caseRecord.id, attributeId: attribute.id, value: 'A' });
  linkSourceToCase(source.id, caseRecord.id);

  const codingResults = codingQuery({ projectId, nodeIds: [node.id] });
  assert.equal(codingResults.length, 1);
  assert.equal(codingResults[0].sourceId, source.id);
  assert.equal(codingResults[0].nodeName, 'Theme');

  const filteredCodingResults = codingQuery({
    projectId,
    nodeIds: [node.id],
    caseFilter: { attributeId: attribute.id, value: 'A' },
  });
  assert.equal(filteredCodingResults.length, 1);

  closeDatabase();
});

test('matrix queries and kappa interpretation work for coding comparisons', () => {
  const { app } = makeTempApp();
  initializeDatabase(app);

  const db = require('./db').getDatabase();
  db.prepare('INSERT INTO projects (name) VALUES (?)').run('Project');
  const projectId = db.prepare('SELECT last_insert_rowid() AS id').get().id;

  const sourceFile = path.join(os.tmpdir(), `query-matrix-${Date.now()}.txt`);
  fs.writeFileSync(sourceFile, 'One two three four');
  const source = importSourceFile({ projectId, title: 'Source B', filePath: sourceFile });

  db.prepare('INSERT INTO coders (project_id, name) VALUES (?, ?)').run(projectId, 'Coder A');
  db.prepare('INSERT INTO coders (project_id, name) VALUES (?, ?)').run(projectId, 'Coder B');
  const coderAId = db.prepare('SELECT id FROM coders WHERE project_id = ? AND name = ?').get(projectId, 'Coder A').id;
  const coderBId = db.prepare('SELECT id FROM coders WHERE project_id = ? AND name = ?').get(projectId, 'Coder B').id;

  const node = createNode({ projectId, name: 'Node 1' });
  applyCoding({ sourceId: source.id, nodeId: node.id, coderId: coderAId, startOffset: 0, endOffset: 4 });
  applyCoding({ sourceId: source.id, nodeId: node.id, coderId: coderBId, startOffset: 2, endOffset: 6 });

  const caseRecord = createCase({ projectId, name: 'Case 1' });
  linkSourceToCase(source.id, caseRecord.id);

  const matrix = matrixCodingQuery({ projectId, rows: 'nodes', columns: 'cases' });
  assert.equal(matrix.rowLabels[0], 'Node 1');
  assert.equal(matrix.columnLabels[0], 'Case 1');
  assert.equal(matrix.cells[0][0], 2);

  const comparison = codingComparison({ sourceId: source.id, coderAId, coderBId, nodeId: node.id });
  assert.equal(comparison.contingency.bothCoded, 1);
  assert.equal(comparison.contingency.onlyA, 0);
  assert.equal(comparison.contingency.onlyB, 0);
  assert.equal(comparison.contingency.neither, 0);

  assert.equal(interpretKappa(0.8), 'Substantial');
  closeDatabase();
});
