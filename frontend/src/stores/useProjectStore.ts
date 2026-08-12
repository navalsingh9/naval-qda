import { create } from 'zustand'

export type Project = {
  id: number
  name: string
  created_at?: string
}

type ProjectStore = {
  projects: Project[]
  selectedProjectId: number | null
  loading: boolean
  error: string | null
  loadProjects: () => Promise<void>
  createProject: (name: string) => Promise<void>
  deleteProject: (projectId: number) => Promise<void>
  selectProject: (projectId: number | null) => void
  clearError: () => void
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  projects: [],
  selectedProjectId: null,
  loading: false,
  error: null,
  loadProjects: async () => {
    set({ loading: true, error: null })
    try {
      const projects = await window.api.listProjects()
      const nextSelectedProjectId = projects.length > 0 && (get().selectedProjectId == null || !projects.some((project) => project.id === get().selectedProjectId))
        ? projects[0].id
        : get().selectedProjectId

      set({ projects, selectedProjectId: nextSelectedProjectId, loading: false })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error), loading: false })
    }
  },
  createProject: async (name) => {
    const trimmedName = name.trim()
    if (!trimmedName) return

    set({ loading: true, error: null })
    try {
      const created = await window.api.createProject(trimmedName)
      set((state) => ({
        projects: [...state.projects, { ...created, created_at: new Date().toISOString() }],
        // Only auto-activate if nothing was selected yet (e.g. very first
        // project ever created) — otherwise creating a new project
        // shouldn't yank the researcher away from whatever project
        // they're currently working in.
        selectedProjectId: state.selectedProjectId ?? created.id,
        loading: false,
      }))
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error), loading: false })
    }
  },
  deleteProject: async (projectId) => {
    set({ loading: true, error: null })
    try {
      await window.api.deleteProject(projectId)
      set((state) => {
        const projects = state.projects.filter((project) => project.id !== projectId)
        const selectedProjectId = state.selectedProjectId === projectId
          ? (projects[0]?.id ?? null)
          : state.selectedProjectId
        return { projects, selectedProjectId, loading: false }
      })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error), loading: false })
    }
  },
  selectProject: (projectId) => {
    set({ selectedProjectId: projectId })
  },
  clearError: () => {
    set({ error: null })
  },
}))
