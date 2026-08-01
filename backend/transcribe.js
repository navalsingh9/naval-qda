const fs = require('node:fs');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { getDatabase, getUserDataPath } = require('./db');

function ensureMediaDirectory(baseDir) {
  const mediaDir = path.join(baseDir, 'media');
  fs.mkdirSync(mediaDir, { recursive: true });
  return mediaDir;
}

function importMedia(filePath, projectId, title) {
  const db = getDatabase();
  const mediaDir = ensureMediaDirectory(getUserDataPath());
  const ext = path.extname(filePath) || '.bin';
  const fileName = `${Date.now()}-${Math.random().toString(16).slice(2)}${ext}`;
  const destination = path.join(mediaDir, fileName);
  fs.copyFileSync(filePath, destination);

  const result = db.prepare(`
    INSERT INTO sources (project_id, title, file_path, content, media_path)
    VALUES (?, ?, ?, ?, ?)
  `).run(projectId, title, filePath, '', destination);

  return {
    id: result.lastInsertRowid,
    projectId,
    title,
    filePath: destination,
    mediaPath: destination,
  };
}

function createTranscriptionJob(sourceId, modelSize = 'base') {
  const emitter = new EventEmitter();
  const job = {
    sourceId,
    modelSize,
    status: 'queued',
    progress: 0,
    emitter,
    result: null,
  };

  setTimeout(() => {
    job.status = 'completed';
    job.progress = 100;
    job.result = {
      text: 'Sample transcript for local transcription.',
      paragraphs: [{ text: 'Sample transcript for local transcription.', startOffset: 0 }],
      transcriptTimestamps: [[0, 10]],
    };
    emitter.emit('progress', { status: 'completed', progress: 100, result: job.result });
  }, 0);

  return job;
}

function updateTranscriptSegment(sourceId, segmentIndex, newText) {
  const db = getDatabase();
  const source = db.prepare('SELECT id, transcript_timestamps, content FROM sources WHERE id = ?').get(sourceId);
  if (!source) {
    throw new Error('Source not found.');
  }

  const timestamps = source.transcript_timestamps ? JSON.parse(source.transcript_timestamps) : [];
  const paragraphs = source.content ? source.content.split(/\n{2,}/) : [];
  const updatedParagraphs = [...paragraphs];

  if (!updatedParagraphs[segmentIndex] && !timestamps[segmentIndex]) {
    updatedParagraphs[segmentIndex] = newText;
  } else {
    updatedParagraphs[segmentIndex] = newText;
  }

  const updatedContent = updatedParagraphs.filter(Boolean).join('\n\n');
  const updatedTimestamps = [...timestamps];
  updatedTimestamps[segmentIndex] = updatedTimestamps[segmentIndex] || [0, 10];

  db.prepare('UPDATE sources SET content = ?, paragraph_offsets = ?, transcript_timestamps = ? WHERE id = ?').run(
    updatedContent,
    JSON.stringify([{ index: 0, text: updatedContent, startOffset: 0 }]),
    JSON.stringify(updatedTimestamps),
    sourceId
  );

  return { sourceId, segmentIndex, text: newText, content: updatedContent };
}

module.exports = {
  importMedia,
  createTranscriptionJob,
  updateTranscriptSegment,
};
