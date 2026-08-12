const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { initializeDatabase, getDatabase } = require('../backend/db');
const { getSourceById, importSourceFile } = require('../backend/sources');
const { applyCoding, createNode, deleteNode, getCodingsForSource, getNodeTree, mergeNodes, moveNode, percentCoded, removeCoding, renameNode } = require('../backend/coding');
const {
  createMemo,
  updateMemo,
  listMemos,
  createCase,
  listCases,
  createAttribute,
  listAttributes,
  setCaseAttributeValue,
  linkSourceToCase,
  getClassificationSheet,
} = require('../backend/memos');
const { createCoder, listCoders, getOrCreatePrimaryCoder } = require('../backend/coders');
const { getFrameworkMatrix, setFrameworkSummary } = require('../backend/framework');
const { textSearch, wordFrequency, codingQuery, matrixCodingQuery, codingComparison, interpretKappa } = require('../backend/query');
const { wordCloudData, hierarchyChartData, codingByNodeChart, codingByAttributeChart, buildFeatureVectors, clusterByWordSimilarity, clusterByCodingSimilarity } = require('../backend/visualize');
const { importMedia, createTranscriptionJob, updateTranscriptSegment } = require('../backend/transcribe');
const { generateCodingReport, generateProjectSummary } = require('../backend/report');
const { summarizeSource, suggestChildCodes, setSetting, getSetting } = require('../backend/ai');
const isDev = process.env.NODE_ENV === 'development';

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    title: `NAVAL-QDA v${app.getVersion()}`,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // The page's <title> tag (currently "frontend", Vite's default) would
  // otherwise override the title set above as soon as the page loads.
  mainWindow.on('page-title-updated', (event) => {
    event.preventDefault();
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    // electron-builder copies frontend/dist's contents to the app root
    // (see files: "from: frontend/dist, to: ." in electron-builder.yml),
    // so from electron/main.js the built index.html lives one level up.
    // loadFile (not a hand-built file:// URL) is required here — a manual
    // `file://${path}` string breaks on Windows because path.join uses
    // backslashes and the URL is missing the extra leading slash.
    mainWindow.loadFile(path.join(__dirname, '..', 'index.html'));
  }
}

app.whenReady().then(() => {
  initializeDatabase(app);
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

ipcMain.handle('ping', () => {
  const db = getDatabase();
  const row = db.prepare("SELECT COUNT(*) AS count FROM schema_migrations").get();
  return `pong:${row.count}`;
});

ipcMain.handle('projects:create', (_event, name) => {
  const db = getDatabase();
  const insert = db.prepare('INSERT INTO projects (name) VALUES (?)');
  const result = insert.run(name);
  const projectId = result.lastInsertRowid;
  // Every project needs a coder before anything can be coded — provision
  // the default one now so coding never fails with "Coder not found" on a
  // freshly created project.
  getOrCreatePrimaryCoder(projectId);
  return { id: projectId, name };
});

ipcMain.handle('projects:list', () => {
  const db = getDatabase();
  return db.prepare('SELECT id, name, created_at FROM projects ORDER BY id ASC').all();
});

ipcMain.handle('projects:delete', (_event, projectId) => {
  const db = getDatabase();
  // Every child table (sources, nodes, coders, codings, cases, attributes,
  // memos, ...) declares its project_id foreign key with ON DELETE CASCADE,
  // and initializeDatabase turns on `PRAGMA foreign_keys = ON`, so deleting
  // the project row is enough to clean up everything under it.
  const result = db.prepare('DELETE FROM projects WHERE id = ?').run(projectId);
  return { deleted: result.changes > 0 };
});

ipcMain.handle('sources:list', (_event, projectId) => {
  const db = getDatabase();
  return db.prepare('SELECT id, title, file_path, created_at FROM sources WHERE project_id = ? ORDER BY id ASC').all(projectId);
});
ipcMain.handle('sources:get', (_event, sourceId) => getSourceById(sourceId));
ipcMain.handle('sources:getMediaUrl', (_event, sourceId) => {
  const source = getSourceById(sourceId);
  return source?.mediaPath || null;
});

ipcMain.handle('sources:import', (_event, { projectId, title, filePath }) => importSourceFile({ projectId, title, filePath }));
ipcMain.handle('sources:importMedia', (_event, { projectId, title, filePath }) => importMedia(filePath, projectId, title));

ipcMain.handle('coding:apply', (_event, payload) => applyCoding(payload));
ipcMain.handle('coding:createNode', (_event, payload) => createNode(payload));
ipcMain.handle('coding:deleteNode', (_event, nodeId, options) => deleteNode(nodeId, options));
ipcMain.handle('coding:getCodingsForSource', (_event, sourceId, options) => getCodingsForSource(sourceId, options));
ipcMain.handle('coding:getNodeTree', (_event, projectId, aggregate) => getNodeTree(projectId, aggregate));
ipcMain.handle('coding:mergeNodes', (_event, sourceNodeId, targetNodeId) => mergeNodes(sourceNodeId, targetNodeId));
ipcMain.handle('coding:moveNode', (_event, nodeId, newParentId) => moveNode(nodeId, newParentId));
ipcMain.handle('coding:percentCoded', (_event, sourceId) => percentCoded(sourceId));
ipcMain.handle('coding:remove', (_event, codingId) => removeCoding(codingId));
ipcMain.handle('coding:renameNode', (_event, nodeId, name) => renameNode(nodeId, name));

ipcMain.handle('memos:create', (_event, payload) => createMemo(payload));
ipcMain.handle('memos:update', (_event, memoId, payload) => updateMemo(memoId, payload));
ipcMain.handle('memos:list', (_event, linkedType, linkedId) => listMemos(linkedType, linkedId));
ipcMain.handle('cases:create', (_event, payload) => createCase(payload));
ipcMain.handle('cases:list', (_event, projectId) => listCases(projectId));
ipcMain.handle('attributes:create', (_event, payload) => createAttribute(payload));
ipcMain.handle('attributes:list', (_event, projectId) => listAttributes(projectId));
ipcMain.handle('cases:setAttributeValue', (_event, payload) => setCaseAttributeValue(payload));
ipcMain.handle('cases:linkSource', (_event, sourceId, caseId) => linkSourceToCase(sourceId, caseId));
ipcMain.handle('cases:getClassificationSheet', (_event, projectId) => getClassificationSheet(projectId));

ipcMain.handle('coders:create', (_event, payload) => createCoder(payload));
ipcMain.handle('coders:list', (_event, projectId) => listCoders(projectId));
ipcMain.handle('coders:getOrCreatePrimary', (_event, projectId) => getOrCreatePrimaryCoder(projectId));

ipcMain.handle('framework:getMatrix', (_event, payload) => getFrameworkMatrix(payload));
ipcMain.handle('framework:setSummary', (_event, payload) => setFrameworkSummary(payload));

ipcMain.handle('query:textSearch', (_event, payload) => textSearch(payload));
ipcMain.handle('query:wordFrequency', (_event, payload) => wordFrequency(payload));
ipcMain.handle('query:codingQuery', (_event, payload) => codingQuery(payload));
ipcMain.handle('query:matrixCodingQuery', (_event, payload) => matrixCodingQuery(payload));
ipcMain.handle('query:codingComparison', (_event, payload) => codingComparison(payload));
ipcMain.handle('query:interpretKappa', (_event, k) => interpretKappa(k));

ipcMain.handle('visualize:wordCloudData', (_event, payload) => wordCloudData(payload));
ipcMain.handle('visualize:hierarchyChartData', (_event, payload) => hierarchyChartData(payload));
ipcMain.handle('visualize:codingByNodeChart', (_event, payload) => codingByNodeChart(payload));
ipcMain.handle('visualize:codingByAttributeChart', (_event, payload) => codingByAttributeChart(payload));
ipcMain.handle('visualize:buildFeatureVectors', (_event, payload) => buildFeatureVectors(payload));
ipcMain.handle('visualize:clusterByWordSimilarity', (_event, payload) => clusterByWordSimilarity(payload));
ipcMain.handle('visualize:clusterByCodingSimilarity', (_event, payload) => clusterByCodingSimilarity(payload));

ipcMain.handle('transcribe:importMedia', (_event, payload) => importMedia(payload.filePath, payload.projectId, payload.title));
ipcMain.handle('transcribe:createJob', (event, payload) => {
  // The job's EventEmitter can't cross the IPC boundary (it isn't
  // structured-clonable), so we forward its events over webContents.send
  // and only return a plain, serializable descriptor to the renderer.
  const job = createTranscriptionJob(payload.sourceId, payload.modelSize);
  const sender = event.sender;

  job.emitter.on('progress', (update) => {
    if (!sender.isDestroyed()) {
      sender.send('transcription:progress', update);
    }
  });

  return { sourceId: job.sourceId, modelSize: job.modelSize, status: job.status };
});
ipcMain.handle('transcribe:updateSegment', (_event, payload) => updateTranscriptSegment(payload.sourceId, payload.segmentIndex, payload.newText));

ipcMain.handle('report:coding', (_event, nodeId) => generateCodingReport(nodeId));
ipcMain.handle('report:projectSummary', (_event, projectId) => generateProjectSummary(projectId));
ipcMain.handle('ai:summarizeSource', (_event, payload) => summarizeSource(payload));
ipcMain.handle('ai:suggestChildCodes', (_event, payload) => suggestChildCodes(payload));
ipcMain.handle('ai:setSetting', (_event, payload) => setSetting(payload.key, payload.value));
ipcMain.handle('ai:getSetting', (_event, key) => getSetting(key));
