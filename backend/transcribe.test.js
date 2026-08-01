const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { initializeDatabase, closeDatabase } = require('./db');
const { importMedia, createTranscriptionJob, updateTranscriptSegment } = require('./transcribe');

function makeTempApp() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'naval-qda-transcribe-'));
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

test('media import and transcription helpers work end to end', async () => {
  const { app } = makeTempApp();
  initializeDatabase(app);

  const db = require('./db').getDatabase();
  db.prepare('INSERT INTO projects (name) VALUES (?)').run('Project');
  const projectId = db.prepare('SELECT last_insert_rowid() AS id').get().id;

  const sourceFile = path.join(os.tmpdir(), `media-${Date.now()}.txt`);
  fs.writeFileSync(sourceFile, 'sample text');

  const imported = importMedia(sourceFile, projectId, 'Media Source');
  assert.equal(imported.title, 'Media Source');
  assert.ok(imported.mediaPath);

  const job = createTranscriptionJob(imported.id, 'base');
  assert.equal(job.status, 'queued');
  await new Promise((resolve) => job.emitter.once('progress', resolve));
  assert.equal(job.status, 'completed');
  assert.equal(job.result.text, 'Sample transcript for local transcription.');

  const updated = updateTranscriptSegment(imported.id, 0, 'Updated transcript');
  assert.equal(updated.text, 'Updated transcript');

  closeDatabase();
});
