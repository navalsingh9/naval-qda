const fs = require('node:fs');
const path = require('node:path');
const { getDatabase } = require('./db');

function normalizeText(text) {
  return text.replace(/\r\n/g, '\n').trim();
}

function splitParagraphs(text) {
  const normalized = normalizeText(text);
  if (!normalized) return [];
  return normalized
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function buildParagraphIndex(content) {
  const paragraphs = splitParagraphs(content);
  const offsets = [];
  let cursor = 0;

  for (let index = 0; index < paragraphs.length; index += 1) {
    const text = paragraphs[index];
    const startOffset = content.indexOf(text, cursor);
    if (startOffset !== -1) {
      offsets.push({ index, text, startOffset });
      cursor = startOffset + text.length;
    } else {
      offsets.push({ index, text, startOffset: cursor });
      cursor += text.length;
    }
  }

  return offsets;
}

function extractTextFromTxt(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function extractTextFromDocx(filePath) {
  const zip = require('yauzl');
  const xml = [];

  return new Promise((resolve, reject) => {
    zip.open(filePath, (error, zipFile) => {
      if (error) {
        reject(error);
        return;
      }

      zipFile.on('entry', (entry) => {
        if (entry.isDirectory) return;
        if (entry.fileName === 'word/document.xml') {
          zipFile.openReadStream(entry, (streamError, stream) => {
            if (streamError) {
              reject(streamError);
              return;
            }

            let content = '';
            stream.on('data', (chunk) => {
              content += chunk.toString('utf8');
            });
            stream.on('end', () => {
              const text = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
              resolve(text);
              zipFile.close();
            });
            stream.on('error', reject);
          });
        }
      });

      zipFile.on('error', reject);
    });
  });
}

function extractTextFromPdf(filePath) {
  return new Promise((resolve, reject) => {
    const pdf = require('pdf-parse');
    pdf(filePath)
      .then((data) => resolve(data.text))
      .catch(reject);
  });
}

async function extractTextFromFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.txt') {
    return extractTextFromTxt(filePath);
  }

  if (ext === '.docx') {
    return extractTextFromDocx(filePath);
  }

  if (ext === '.pdf') {
    return extractTextFromPdf(filePath);
  }

  throw new Error(`Unsupported source format: ${ext}`);
}

function getSourceById(sourceId) {
  const db = getDatabase();
  const source = db.prepare('SELECT id, project_id, title, file_path, content, paragraph_offsets, created_at FROM sources WHERE id = ?').get(sourceId);
  if (!source) {
    throw new Error('Source not found.');
  }

  return {
    id: source.id,
    projectId: source.project_id,
    title: source.title,
    filePath: source.file_path,
    content: source.content,
    paragraphOffsets: source.paragraph_offsets,
    createdAt: source.created_at,
  };
}

function importSourceFile({ projectId, title, filePath }) {
  const db = getDatabase();
  const content = fs.readFileSync(filePath, 'utf8');
  const paragraphs = splitParagraphs(content);
  const paragraphOffsets = JSON.stringify(buildParagraphIndex(content));

  const insert = db.prepare(`
    INSERT INTO sources (project_id, title, file_path, content, paragraph_offsets)
    VALUES (?, ?, ?, ?, ?)
  `);

  const result = insert.run(projectId, title, filePath, content, paragraphOffsets);

  return {
    id: result.lastInsertRowid,
    projectId,
    title,
    filePath,
    content,
    paragraphOffsets,
  };
}

module.exports = {
  buildParagraphIndex,
  extractTextFromFile,
  getSourceById,
  importSourceFile,
  splitParagraphs,
};
