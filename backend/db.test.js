const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { initializeDatabase, closeDatabase } = require('./db');

test('initializeDatabase creates the expected tables in the userData path', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'naval-qda-db-'));

  const db = initializeDatabase({
    getPath: (name) => {
      if (name === 'userData') return tmpDir;
      throw new Error(`Unexpected path request: ${name}`);
    },
  });

  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
  const tableNames = tables.map((row) => row.name);

  assert.ok(tableNames.includes('projects'));
  assert.ok(tableNames.includes('sources'));
  assert.ok(tableNames.includes('nodes'));
  assert.ok(tableNames.includes('coders'));
  assert.ok(tableNames.includes('codings'));
  assert.ok(tableNames.includes('cases'));
  assert.ok(tableNames.includes('attributes'));
  assert.ok(tableNames.includes('case_attribute_values'));
  assert.ok(tableNames.includes('source_case_links'));
  assert.ok(tableNames.includes('memos'));
  assert.ok(tableNames.includes('schema_migrations'));

  closeDatabase();
});
