const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { initializeDatabase, closeDatabase } = require('./db');
const { createCoder, listCoders } = require('./coders');

function makeTempApp() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'naval-qda-coders-'));
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

test('createCoder and listCoders work end to end', () => {
  const { app } = makeTempApp();
  initializeDatabase(app);

  const db = require('./db').getDatabase();
  db.prepare('INSERT INTO projects (name) VALUES (?)').run('Project');
  const projectId = db.prepare('SELECT last_insert_rowid() AS id').get().id;

  const coderA = createCoder({ projectId, name: 'Coder A' });
  const coderB = createCoder({ projectId, name: 'Coder B' });
  assert.equal(coderA.name, 'Coder A');
  assert.ok(coderB.id > coderA.id);

  const coders = listCoders(projectId);
  assert.equal(coders.length, 2);
  assert.deepEqual(coders.map((coder) => coder.name), ['Coder A', 'Coder B']);

  assert.throws(() => createCoder({ projectId, name: '   ' }), /Coder name is required/);
  assert.throws(() => createCoder({ projectId: 999999, name: 'Ghost' }), /Project not found/);

  closeDatabase();
});
