const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { initializeDatabase, closeDatabase } = require('./db');
const { importSourceFile } = require('./sources');
const { applyCoding, createNode } = require('./coding');
const { createCase, createAttribute, setCaseAttributeValue, linkSourceToCase } = require('./memos');
const { generateCodingReport, generateProjectSummary } = require('./report');

function makeTempApp() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'naval-qda-report-'));
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

test('report helpers assemble coding and project summaries', () => {
  const { app } = makeTempApp();
  initializeDatabase(app);

  const db = require('./db').getDatabase();
  db.prepare('INSERT INTO projects (name) VALUES (?)').run('Project');
  const projectId = db.prepare('SELECT last_insert_rowid() AS id').get().id;

  const sourceFile = path.join(os.tmpdir(), `report-source-${Date.now()}.txt`);
  fs.writeFileSync(sourceFile, 'Alpha beta gamma');
  const source = importSourceFile({ projectId, title: 'Source A', filePath: sourceFile });

  db.prepare('INSERT INTO coders (project_id, name) VALUES (?, ?)').run(projectId, 'Coder A');
  const coderId = db.prepare('SELECT last_insert_rowid() AS id').get().id;

  const node = createNode({ projectId, name: 'Theme' });
  applyCoding({ sourceId: source.id, nodeId: node.id, coderId, startOffset: 0, endOffset: 5 });

  const caseRecord = createCase({ projectId, name: 'Case 1' });
  const attribute = createAttribute({ projectId, name: 'Group', valueType: 'text' });
  setCaseAttributeValue({ caseId: caseRecord.id, attributeId: attribute.id, value: 'A' });
  linkSourceToCase(source.id, caseRecord.id);

  const report = generateCodingReport(node.id);
  assert.equal(report.nodeName, 'Theme');
  assert.equal(report.codings.length, 1);

  const summary = generateProjectSummary(projectId);
  assert.equal(summary.sourceCount, 1);
  assert.equal(summary.classificationSheet.cases[0].name, 'Case 1');

  closeDatabase();
});
