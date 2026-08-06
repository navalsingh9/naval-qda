/// <reference types="vite/client" />

declare global {
  interface Window {
    api: {
      ping: () => Promise<string>
      getPathForFile: (file: File) => string
      createProject: (name: string) => Promise<{ id: number; name: string }>
      listProjects: () => Promise<Array<{ id: number; name: string; created_at: string }>>
      deleteProject: (projectId: number) => Promise<{ deleted: boolean }>
      importSource: (input: { projectId: number; title: string; filePath: string }) => Promise<{ id: number; title: string; filePath: string }>
      getSource: (sourceId: number) => Promise<{ id: number; projectId: number; title: string; filePath: string; content: string; paragraphOffsets: string; createdAt: string }>
      listSources: (projectId: number) => Promise<Array<{ id: number; title: string; file_path: string; created_at: string }>>
      coding: {
        apply: (payload: unknown) => Promise<unknown>
        createNode: (payload: unknown) => Promise<unknown>
        getCodingsForSource: (sourceId: number, options?: unknown) => Promise<unknown>
        getNodeTree: (projectId: number, aggregate?: boolean) => Promise<unknown>
        mergeNodes: (sourceNodeId: number, targetNodeId: number) => Promise<unknown>
        moveNode: (nodeId: number, newParentId: number | null) => Promise<unknown>
        percentCoded: (sourceId: number) => Promise<unknown>
        remove: (codingId: number) => Promise<unknown>
      }
      memos: {
        create: (payload: unknown) => Promise<unknown>
        update: (memoId: number, payload: unknown) => Promise<unknown>
        list: (linkedType: string, linkedId: number) => Promise<unknown>
      }
      cases: {
        create: (payload: unknown) => Promise<unknown>
        list: (projectId: number) => Promise<unknown>
        createAttribute: (payload: unknown) => Promise<unknown>
        listAttributes: (projectId: number) => Promise<Array<{ id: number; projectId: number; name: string; valueType: string }>>
        setAttributeValue: (payload: unknown) => Promise<unknown>
        linkSource: (sourceId: number, caseId: number) => Promise<unknown>
        getClassificationSheet: (projectId: number) => Promise<unknown>
      }
      coders: {
        create: (payload: { projectId: number; name: string }) => Promise<{ id: number; projectId: number; name: string }>
        list: (projectId: number) => Promise<Array<{ id: number; projectId: number; name: string; createdAt: string }>>
        getOrCreatePrimary: (projectId: number) => Promise<{ id: number; projectId: number; name: string; createdAt: string }>
      }
      framework: {
        getMatrix: (payload: { projectId: number; nodeIds?: number[] | null; caseIds?: number[] | null }) => Promise<{
          rowLabels: Array<{ id: number; name: string }>
          columnLabels: Array<{ id: number; name: string }>
          rows: Array<{
            caseId: number
            caseName: string
            columns: Array<{
              nodeId: number
              excerptCount: number
              excerpts: Array<{ codingId: number; sourceId: number; sourceTitle: string; text: string }>
              summary: string
              summaryUpdatedAt: string | null
            }>
          }>
        }>
        setSummary: (payload: { caseId: number; nodeId: number; summary: string }) => Promise<{ caseId: number; nodeId: number; summary: string; updatedAt: string | null }>
      }
      query: {
        textSearch: (payload: unknown) => Promise<unknown>
        wordFrequency: (payload: unknown) => Promise<unknown>
        codingQuery: (payload: unknown) => Promise<unknown>
        matrixCodingQuery: (payload: unknown) => Promise<unknown>
        codingComparison: (payload: unknown) => Promise<unknown>
        interpretKappa: (k: number) => Promise<unknown>
      }
      visualize: {
        wordCloudData: (payload: unknown) => Promise<unknown>
        hierarchyChartData: (payload: unknown) => Promise<unknown>
        codingByNodeChart: (payload: unknown) => Promise<unknown>
        codingByAttributeChart: (payload: unknown) => Promise<unknown>
        buildFeatureVectors: (payload: unknown) => Promise<unknown>
        clusterByWordSimilarity: (payload: unknown) => Promise<unknown>
        clusterByCodingSimilarity: (payload: unknown) => Promise<unknown>
      }
      transcribe: {
        importMedia: (payload: { filePath: string; projectId: number; title: string }) => Promise<unknown>
        createJob: (payload: { sourceId: number; modelSize: string }) => Promise<unknown>
        updateSegment: (payload: { sourceId: number; segmentIndex: number; newText: string }) => Promise<unknown>
      }
      report: {
        coding: (nodeId: number) => Promise<unknown>
        projectSummary: (projectId: number) => Promise<unknown>
      }
      ai: {
        summarizeSource: (payload: unknown) => Promise<unknown>
        suggestChildCodes: (payload: unknown) => Promise<unknown>
        setSetting: (payload: { key: string; value: string }) => Promise<unknown>
        getSetting: (key: string) => Promise<unknown>
      }
    }
  }
}

export {}
