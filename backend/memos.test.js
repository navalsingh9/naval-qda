const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { initializeDatabase, closeDatabase } = require('./db');
const {
  createMemo,
  updateMemo,
  listMemos,
  createCase,
  listCases,
  createAttribute,
  setCaseAttributeValue,
  linkSourceToCase,
  getClassificationSheet,
} = require('./memos');
const { importSourceFile } = require('./sources');
const { createNode } = require('./coding');

function makeTempApp() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'naval-qda-memos-'));
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

test('memo and case classification flows work end to end', () => {
  const { app } = makeTempApp();
  initializeDatabase(app);

  const db = require('./db').getDatabase();
  db.prepare('INSERT INTO projects (name) VALUES (?)').run('Project');
  const projectId = db.prepare('SELECT last_insert_rowid() AS id').get().id;

  const sourceFile = path.join(os.tmpdir(), `memos-source-${Date.now()}.txt`);
  fs.writeFileSync(sourceFile, 'Alpha beta gamma');
  const source = importSourceFile({ projectId, title: 'Source A', filePath: sourceFile });
  const node = createNode({ projectId, name: 'Theme' });

  const memo = createMemo({
    projectId,
    linkedType: 'source',
    linkedId: source.id,
    title: 'Source note',
    content: 'Initial memo',
  });
  assert.equal(memo.title, 'Source note');
  assert.equal(memo.linkedType, 'source');

  const updatedMemo = updateMemo(memo.id, { title: 'Updated note', content: 'Updated memo' });
  assert.equal(updatedMemo.title, 'Updated note');

  const memos = listMemos('source', source.id);
  assert.equal(memos.length, 1);
  assert.equal(memos[0].title, 'Updated note');

  const caseRecord = createCase({ projectId, name: 'Case 1' });
  const attribute = createAttribute({ projectId, name: 'Age', valueType: 'numeric' });
  setCaseAttributeValue({ caseId: caseRecord.id, attributeId: attribute.id, value: '42' });
  linkSourceToCase(source.id, caseRecord.id);

  const sheet = getClassificationSheet(projectId);
  assert.equal(sheet.cases.length, 1);
  assert.equal(sheet.cases[0].name, 'Case 1');
  assert.equal(sheet.cases[0].values.Age, '42');

  const linkedMemos = listMemos('case', caseRecord.id);
  assert.equal(linkedMemos.length, 0);

  closeDatabase();
});
