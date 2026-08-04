const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('api', {
  ping: () => ipcRenderer.invoke('ping'),
  // With contextIsolation/sandbox enabled, File objects handed to the
  // renderer by <input type="file"> no longer carry a filesystem `.path`
  // (Electron removed that for security reasons). webUtils.getPathForFile
  // is the supported replacement, but it must be called from the preload
  // script — it can't be exposed as a plain value, only as a function that
  // takes the File object itself.
  getPathForFile: (file) => webUtils.getPathForFile(file),
  createProject: (name) => ipcRenderer.invoke('projects:create', name),
  listProjects: () => ipcRenderer.invoke('projects:list'),
  importSource: ({ projectId, title, filePath }) => ipcRenderer.invoke('sources:import', { projectId, title, filePath }),
  importMedia: ({ projectId, title, filePath }) => ipcRenderer.invoke('sources:importMedia', { projectId, title, filePath }),
  getSource: (sourceId) => ipcRenderer.invoke('sources:get', sourceId),
  getMediaUrl: (sourceId) => ipcRenderer.invoke('sources:getMediaUrl', sourceId),
  listSources: (projectId) => ipcRenderer.invoke('sources:list', projectId),
  coding: {
    apply: (payload) => ipcRenderer.invoke('coding:apply', payload),
    createNode: (payload) => ipcRenderer.invoke('coding:createNode', payload),
    getCodingsForSource: (sourceId, options) => ipcRenderer.invoke('coding:getCodingsForSource', sourceId, options),
    getNodeTree: (projectId, aggregate) => ipcRenderer.invoke('coding:getNodeTree', projectId, aggregate),
    mergeNodes: (sourceNodeId, targetNodeId) => ipcRenderer.invoke('coding:mergeNodes', sourceNodeId, targetNodeId),
    moveNode: (nodeId, newParentId) => ipcRenderer.invoke('coding:moveNode', nodeId, newParentId),
    percentCoded: (sourceId) => ipcRenderer.invoke('coding:percentCoded', sourceId),
    remove: (codingId) => ipcRenderer.invoke('coding:remove', codingId),
  },
  memos: {
    create: (payload) => ipcRenderer.invoke('memos:create', payload),
    update: (memoId, payload) => ipcRenderer.invoke('memos:update', memoId, payload),
    list: (linkedType, linkedId) => ipcRenderer.invoke('memos:list', linkedType, linkedId),
  },
  cases: {
    create: (payload) => ipcRenderer.invoke('cases:create', payload),
    list: (projectId) => ipcRenderer.invoke('cases:list', projectId),
    createAttribute: (payload) => ipcRenderer.invoke('attributes:create', payload),
    setAttributeValue: (payload) => ipcRenderer.invoke('cases:setAttributeValue', payload),
    linkSource: (sourceId, caseId) => ipcRenderer.invoke('cases:linkSource', sourceId, caseId),
    getClassificationSheet: (projectId) => ipcRenderer.invoke('cases:getClassificationSheet', projectId),
  },
  coders: {
    create: (payload) => ipcRenderer.invoke('coders:create', payload),
    list: (projectId) => ipcRenderer.invoke('coders:list', projectId),
  },
  query: {
    textSearch: (payload) => ipcRenderer.invoke('query:textSearch', payload),
    wordFrequency: (payload) => ipcRenderer.invoke('query:wordFrequency', payload),
    codingQuery: (payload) => ipcRenderer.invoke('query:codingQuery', payload),
    matrixCodingQuery: (payload) => ipcRenderer.invoke('query:matrixCodingQuery', payload),
    codingComparison: (payload) => ipcRenderer.invoke('query:codingComparison', payload),
    interpretKappa: (k) => ipcRenderer.invoke('query:interpretKappa', k),
  },
  visualize: {
    wordCloudData: (payload) => ipcRenderer.invoke('visualize:wordCloudData', payload),
    hierarchyChartData: (payload) => ipcRenderer.invoke('visualize:hierarchyChartData', payload),
    buildFeatureVectors: (payload) => ipcRenderer.invoke('visualize:buildFeatureVectors', payload),
    clusterByWordSimilarity: (payload) => ipcRenderer.invoke('visualize:clusterByWordSimilarity', payload),
    clusterByCodingSimilarity: (payload) => ipcRenderer.invoke('visualize:clusterByCodingSimilarity', payload),
  },
  transcribe: {
    importMedia: (payload) => ipcRenderer.invoke('transcribe:importMedia', payload),
    createJob: (payload) => ipcRenderer.invoke('transcribe:createJob', payload),
    updateSegment: (payload) => ipcRenderer.invoke('transcribe:updateSegment', payload),
    // Subscribe to progress updates for a running job. Returns an
    // unsubscribe function; call it (e.g. on component unmount) to avoid
    // leaking listeners across job runs.
    onProgress: (callback) => {
      const listener = (_event, update) => callback(update);
      ipcRenderer.on('transcription:progress', listener);
      return () => ipcRenderer.removeListener('transcription:progress', listener);
    },
  },
  report: {
    coding: (nodeId) => ipcRenderer.invoke('report:coding', nodeId),
    projectSummary: (projectId) => ipcRenderer.invoke('report:projectSummary', projectId),
  },
  ai: {
    summarizeSource: (payload) => ipcRenderer.invoke('ai:summarizeSource', payload),
    suggestChildCodes: (payload) => ipcRenderer.invoke('ai:suggestChildCodes', payload),
    setSetting: (payload) => ipcRenderer.invoke('ai:setSetting', payload),
    getSetting: (key) => ipcRenderer.invoke('ai:getSetting', key),
  },
});
