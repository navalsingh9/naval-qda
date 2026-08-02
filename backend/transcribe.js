const fs = require('node:fs');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStaticPath = require('ffmpeg-static');
const { nodewhisper } = require('nodejs-whisper');
const { getDatabase, getUserDataPath } = require('./db');

// ffmpeg-static resolves to the bundled binary; without this fluent-ffmpeg
// falls back to whatever `ffmpeg` is on the user's PATH, which most users
// won't have installed. This is what makes transcription work with zero
// setup on the user's machine.
if (ffmpegStaticPath) {
  ffmpeg.setFfmpegPath(ffmpegStaticPath);
}

function ensureMediaDirectory(baseDir) {
  const mediaDir = path.join(baseDir, 'media');
  fs.mkdirSync(mediaDir, { recursive: true });
  return mediaDir;
}

function ensureTranscriptWorkDirectory(baseDir) {
  const dir = path.join(baseDir, 'transcripts', '.work');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function ensureModelDirectory(baseDir) {
  const dir = path.join(baseDir, 'whisper-models');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// Probes the source file so we know its duration up front (used by the UI
// to show a sane progress estimate, and to catch unreadable/corrupt files
// early instead of failing deep inside whisper).
function probeMedia(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err) return reject(new Error(`Could not read media file: ${err.message}`));
      resolve({
        durationSeconds: data?.format?.duration ?? null,
        hasVideo: (data?.streams || []).some((s) => s.codec_type === 'video'),
        hasAudio: (data?.streams || []).some((s) => s.codec_type === 'audio'),
      });
    });
  });
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

// whisper.cpp requires 16kHz mono WAV input. This works for both audio-only
// files and video (ffmpeg just pulls the audio stream and discards video).
function extractAudioTrack(sourceMediaPath, outputWavPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(sourceMediaPath)
      .noVideo()
      .audioChannels(1)
      .audioFrequency(16000)
      .format('wav')
      .on('error', (err) => reject(new Error(`Audio extraction failed: ${err.message}`)))
      .on('end', () => resolve(outputWavPath))
      .save(outputWavPath);
  });
}

function parseTimestampToSeconds(value) {
  if (typeof value === 'number') {
    // nodejs-whisper's JSON output gives offsets in milliseconds
    return value / 1000;
  }
  if (typeof value !== 'string') return 0;
  const match = value.match(/(\d+):(\d+):(\d+)[.,](\d+)/);
  if (!match) return 0;
  const [, h, m, s, ms] = match;
  return Number(h) * 3600 + Number(m) * 60 + Number(s) + Number(ms) / 1000;
}

// Turns whisper's segment-level JSON output into the shape sources.content /
// paragraph_offsets / transcript_timestamps expect: one paragraph per
// segment, offsets tracked as the paragraphs are joined with '\n\n'.
function parseWhisperSegments(segments) {
  const paragraphOffsets = [];
  const transcriptTimestamps = [];
  const paragraphs = [];
  let runningOffset = 0;

  for (const segment of segments) {
    const text = (segment.text || '').trim();
    if (!text) continue;

    const start = parseTimestampToSeconds(segment.offsets?.from ?? segment.start);
    const end = parseTimestampToSeconds(segment.offsets?.to ?? segment.end);

    paragraphOffsets.push({ index: paragraphs.length, text, startOffset: runningOffset });
    transcriptTimestamps.push([start, end]);
    paragraphs.push(text);
    runningOffset += text.length + 2; // '\n\n' joiner
  }

  return {
    content: paragraphs.join('\n\n'),
    paragraphOffsets,
    transcriptTimestamps,
  };
}

// Runs the actual whisper.cpp binary via nodejs-whisper and reads back its
// JSON sidecar output. Kept as its own function (rather than inlined) so
// tests can substitute a fake runner instead of needing a real model +
// several-hundred-MB download in CI.
async function defaultWhisperRunner({ wavPath, modelSize, modelRootPath }) {
  await nodewhisper(wavPath, {
    modelName: modelSize,
    autoDownloadModelName: modelSize,
    modelRootPath,
    whisperOptions: {
      outputInJson: true,
      outputInText: false,
      outputInSrt: false,
      outputInVtt: false,
      wordTimestamps: false,
    },
  });

  const jsonPath = `${wavPath}.json`;
  const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const segments = raw.transcription || raw.segments || [];
  safeUnlink(jsonPath);
  return segments;
}

function safeUnlink(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    // best-effort cleanup only — leftover temp files aren't fatal
  }
}

// Spawns transcription work off the caller's turn (setImmediate) so the IPC
// handler returns instantly with a serializable job descriptor; progress and
// the final result are delivered exclusively through `emitter` events. The
// EventEmitter itself must never cross the IPC boundary — main.js is
// responsible for forwarding its events over webContents.send.
function createTranscriptionJob(sourceId, modelSize = 'base', options = {}) {
  const emitter = new EventEmitter();
  const job = {
    sourceId,
    modelSize,
    status: 'queued',
    progress: 0,
    emitter,
    result: null,
    error: null,
  };

  const runner = options.runner || defaultWhisperRunner;

  const emit = (status, extra = {}) => {
    job.status = status;
    Object.assign(job, extra);
    emitter.emit('progress', { sourceId, status, progress: job.progress, ...extra });
  };

  const run = async () => {
    let wavPath = null;
    try {
      const db = getDatabase();
      const source = db.prepare('SELECT id, media_path FROM sources WHERE id = ?').get(sourceId);
      if (!source || !source.media_path) {
        throw new Error(`Source ${sourceId} has no media file to transcribe.`);
      }

      emit('probing', { progress: 5 });
      await probeMedia(source.media_path);

      emit('extracting_audio', { progress: 15 });
      const userDataPath = getUserDataPath();
      const workDir = ensureTranscriptWorkDirectory(userDataPath);
      wavPath = path.join(workDir, `${sourceId}-${Date.now()}.wav`);
      await extractAudioTrack(source.media_path, wavPath);

      emit('transcribing', { progress: 40 });
      const modelRootPath = ensureModelDirectory(userDataPath);
      const segments = await runner({ wavPath, modelSize, modelRootPath });

      emit('parsing', { progress: 85 });
      const { content, paragraphOffsets, transcriptTimestamps } = parseWhisperSegments(segments);

      db.prepare(`
        UPDATE sources
        SET content = ?, paragraph_offsets = ?, transcript_timestamps = ?
        WHERE id = ?
      `).run(content, JSON.stringify(paragraphOffsets), JSON.stringify(transcriptTimestamps), sourceId);

      job.result = { text: content, paragraphs: paragraphOffsets, transcriptTimestamps };
      emit('completed', { progress: 100, result: job.result });
    } catch (error) {
      job.error = error.message;
      emit('error', { error: job.error });
    } finally {
      if (wavPath) safeUnlink(wavPath);
    }
  };

  setImmediate(run);
  return job;
}

// Edits a single paragraph without re-running transcription. Rebuilds
// content/paragraph_offsets from the full paragraph list so indices for
// every OTHER paragraph stay correct — not just the one being edited.
function updateTranscriptSegment(sourceId, segmentIndex, newText) {
  const db = getDatabase();
  const source = db.prepare('SELECT id, content, transcript_timestamps FROM sources WHERE id = ?').get(sourceId);
  if (!source) {
    throw new Error('Source not found.');
  }

  const paragraphs = source.content ? source.content.split(/\n{2,}/) : [];
  while (paragraphs.length <= segmentIndex) paragraphs.push('');
  paragraphs[segmentIndex] = newText;

  const paragraphOffsets = [];
  let runningOffset = 0;
  for (const text of paragraphs) {
    paragraphOffsets.push({ index: paragraphOffsets.length, text, startOffset: runningOffset });
    runningOffset += text.length + 2;
  }

  const updatedContent = paragraphs.join('\n\n');
  const timestamps = source.transcript_timestamps ? JSON.parse(source.transcript_timestamps) : [];
  while (timestamps.length <= segmentIndex) timestamps.push([0, 0]);

  db.prepare(`
    UPDATE sources
    SET content = ?, paragraph_offsets = ?, transcript_timestamps = ?
    WHERE id = ?
  `).run(updatedContent, JSON.stringify(paragraphOffsets), JSON.stringify(timestamps), sourceId);

  return { sourceId, segmentIndex, text: newText, content: updatedContent };
}

module.exports = {
  importMedia,
  createTranscriptionJob,
  updateTranscriptSegment,
  // exported for advanced callers / tests
  probeMedia,
  extractAudioTrack,
  parseWhisperSegments,
};
