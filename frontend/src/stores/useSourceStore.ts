import { create } from 'zustand'

export type SourceRecord = {
  id: number
  title: string
  file_path: string
  created_at: string
}

type SourceStore = {
  sources: SourceRecord[]
  loading: boolean
  error: string | null
  loadSources: (projectId: number) => Promise<void>
  importSource: (projectId: number, file: File) => Promise<void>
  importSources: (projectId: number, files: FileList | File[]) => Promise<void>
  clearError: () => void
}

async function importOneFile(projectId: number, file: File) {
  // Electron's contextIsolation strips the old `.path` shortcut from
  // File objects handed to the renderer, so the real filesystem path has
  // to come from the preload's webUtils.getPathForFile bridge instead.
  // Falling back to file.name would silently resolve relative to the
  // app's working directory, which is the bug this fixes.
  const filePath = window.api.getPathForFile(file)
  const imported = await window.api.importSource({
    projectId,
    title: file.name,
    filePath,
  })
  return {
    id: imported.id,
    title: imported.title,
    file_path: imported.filePath,
    created_at: new Date().toISOString(),
  }
}

export const useSourceStore = create<SourceStore>((set) => ({
  sources: [],
  loading: false,
  error: null,
  loadSources: async (projectId) => {
    set({ loading: true, error: null })
    try {
      const sources = await window.api.listSources(projectId)
      set({ sources, loading: false })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error), loading: false })
    }
  },
  importSource: async (projectId, file) => {
    set({ loading: true, error: null })
    try {
      const record = await importOneFile(projectId, file)
      set((state) => ({ sources: [...state.sources, record], loading: false }))
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error), loading: false })
    }
  },
  // Imports each file one at a time (rather than Promise.all) so a bad
  // file in the middle of a batch doesn't abort the ones after it, and so
  // sqlite writes don't race each other. Failures are collected and
  // reported together instead of the whole batch silently stopping at the
  // first error.
  importSources: async (projectId, files) => {
    const fileArray = Array.from(files)
    if (fileArray.length === 0) return

    set({ loading: true, error: null })
    const imported: SourceRecord[] = []
    const failures: string[] = []

    for (const file of fileArray) {
      try {
        imported.push(await importOneFile(projectId, file))
      } catch (error) {
        failures.push(`${file.name}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }

    set((state) => ({
      sources: [...state.sources, ...imported],
      loading: false,
      error: failures.length > 0 ? failures.join('; ') : null,
    }))
  },
  clearError: () => {
    set({ error: null })
  },
}))
