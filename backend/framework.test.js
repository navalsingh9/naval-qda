const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { initializeDatabase, closeDatabase } = require('./db');
const { importSourceFile } = require('./sources');
const { createNode, applyCoding } = require('./coding');
const { getOrCreatePrimaryCoder } = require('./coders');
const { createCase, linkSourceToCase } = require('./memos');
const { getFrameworkMatrix, setFrameworkSummary } = require('./framework');

function makeTempApp() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'naval-qda-framework-'));
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

test('framework matrix gathers excerpts per case/node and supports editable summaries', async () => {
  const { app } = makeTempApp();
  initializeDatabase(app);

  const db = require('./db').getDatabase();
  db.prepare('INSERT INTO projects (name) VALUES (?)').run('Project');
  const projectId = db.prepare('SELECT last_insert_rowid() AS id').get().id;

  const sourceFile = path.join(os.tmpdir(), `framework-source-${Date.now()}.txt`);
  fs.writeFileSync(sourceFile, 'Managing a remote team requires trust and clear communication.');
  const source = await importSourceFile({ projectId, title: 'P1.docx', filePath: sourceFile });

  const node = createNode({ projectId, name: 'Trust' });
  const coder = getOrCreatePrimaryCoder(projectId);
  applyCoding({ sourceId: source.id, nodeId: node.id, coderId: coder.id, startOffset: 0, endOffset: 17 });

  const caseRow = createCase({ projectId, name: 'P1' });
  linkSourceToCase(source.id, caseRow.id);

  const matrix = getFrameworkMatrix({ projectId });
  assert.equal(matrix.rowLabels.length, 1);
  assert.equal(matrix.columnLabels.length, 1);
  assert.equal(matrix.rows[0].columns[0].excerptCount, 1);
  assert.equal(matrix.rows[0].columns[0].excerpts[0].text, 'Managing a remote');
  assert.equal(matrix.rows[0].columns[0].summary, '');

  const updated = setFrameworkSummary({ caseId: caseRow.id, nodeId: node.id, summary: 'P1 trusts their team.' });
  assert.equal(updated.summary, 'P1 trusts their team.');

  const matrixAfter = getFrameworkMatrix({ projectId });
  assert.equal(matrixAfter.rows[0].columns[0].summary, 'P1 trusts their team.');

  // Overwriting an existing summary should update in place, not duplicate.
  setFrameworkSummary({ caseId: caseRow.id, nodeId: node.id, summary: 'Revised summary.' });
  const summaryCount = db.prepare('SELECT COUNT(*) AS count FROM framework_summaries').get().count;
  assert.equal(summaryCount, 1);

  assert.throws(() => setFrameworkSummary({ caseId: 999999, nodeId: node.id, summary: 'x' }), /not found/);

  closeDatabase();
});
