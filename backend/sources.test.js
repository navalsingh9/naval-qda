const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { initializeDatabase, closeDatabase } = require('./db');
const { importSourceFile, buildParagraphIndex } = require('./sources');

test('importSourceFile ingests text files and indexes paragraphs', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'naval-qda-sources-'));

  const db = initializeDatabase({
    getPath: (name) => {
      if (name === 'userData') return tmpDir;
      throw new Error(`Unexpected path request: ${name}`);
    },
  });

  db.prepare('INSERT INTO projects (name) VALUES (?)').run('Test Project');
  const projectId = db.prepare('SELECT last_insert_rowid() AS id').get().id;

  const sourceFile = path.join(tmpDir, 'notes.txt');
  fs.writeFileSync(sourceFile, 'First paragraph.\n\nSecond paragraph.');

  const source = importSourceFile({
    projectId,
    title: 'Imported notes',
    filePath: sourceFile,
  });

  assert.equal(source.title, 'Imported notes');
  assert.equal(source.content, 'First paragraph.\n\nSecond paragraph.');

  const storedSource = db.prepare('SELECT content, paragraph_offsets FROM sources WHERE id = ?').get(source.id);
  assert.equal(storedSource.content, 'First paragraph.\n\nSecond paragraph.');

  const paragraphs = JSON.parse(storedSource.paragraph_offsets);
  assert.equal(paragraphs.length, 2);
  assert.equal(paragraphs[0].text, 'First paragraph.');
  assert.equal(paragraphs[1].text, 'Second paragraph.');
  assert.equal(paragraphs[0].startOffset, 0);
  assert.equal(paragraphs[1].startOffset, 18);

  const indexed = buildParagraphIndex('Alpha\n\nBeta');
  assert.equal(indexed[0].text, 'Alpha');
  assert.equal(indexed[1].text, 'Beta');

  closeDatabase();
});
