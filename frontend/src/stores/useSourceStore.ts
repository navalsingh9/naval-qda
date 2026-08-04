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
  clearError: () => void
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
    // Electron's contextIsolation strips the old `.path` shortcut from
    // File objects handed to the renderer, so the real filesystem path has
    // to come from the preload's webUtils.getPathForFile bridge instead.
    // Falling back to file.name would silently resolve relative to the
    // app's working directory, which is the bug this fixes.
    const filePath = window.api.getPathForFile(file)
    set({ loading: true, error: null })
    try {
      const imported = await window.api.importSource({
        projectId,
        title: file.name,
        filePath,
      })
      set((state) => ({
        sources: [...state.sources, {
          id: imported.id,
          title: imported.title,
          file_path: imported.filePath,
          created_at: new Date().toISOString(),
        }],
        loading: false,
      }))
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error), loading: false })
    }
  },
  clearError: () => {
    set({ error: null })
  },
}))
