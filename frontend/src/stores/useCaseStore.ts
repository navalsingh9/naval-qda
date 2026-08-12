import { create } from 'zustand'

export type CaseRecord = { id: number; name: string; description: string | null }
export type AttributeRecord = { id: number; name: string; valueType: string }

type CaseStore = {
  cases: CaseRecord[]
  attributes: AttributeRecord[]
  // sourceId -> caseId, so the UI can show which case a source is
  // currently linked to instead of always displaying an unselected picker.
  sourceCaseLinks: Record<number, number>
  loading: boolean
  error: string | null
  loadCases: (projectId: number) => Promise<void>
  loadSourceCaseLinks: (projectId: number) => Promise<void>
  createCase: (projectId: number, name: string) => Promise<void>
  createAttribute: (projectId: number, name: string, valueType: string) => Promise<void>
  linkSource: (sourceId: number, caseId: number) => Promise<void>
  setSourceCase: (sourceId: number, caseId: number | null) => Promise<void>
  clearError: () => void
}

export const useCaseStore = create<CaseStore>((set) => ({
  cases: [],
  attributes: [],
  sourceCaseLinks: {},
  loading: false,
  error: null,
  loadCases: async (projectId) => {
    set({ loading: true, error: null })
    try {
      const cases = await window.api.cases.list(projectId) as CaseRecord[]
      set({ cases, loading: false })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error), loading: false })
    }
  },
  loadSourceCaseLinks: async (projectId) => {
    try {
      const links = await window.api.cases.getSourceCaseLinks(projectId)
      set({ sourceCaseLinks: Object.fromEntries(links.map((link) => [link.sourceId, link.caseId])) })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) })
    }
  },
  createCase: async (projectId, name) => {
    if (!name.trim()) return
    set({ loading: true, error: null })
    try {
      const created = await window.api.cases.create({ projectId, name }) as { id: number; name: string }
      set((state) => ({ cases: [...state.cases, { id: created.id, name: created.name, description: null }], loading: false }))
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error), loading: false })
    }
  },
  createAttribute: async (projectId, name, valueType) => {
    if (!name.trim()) return
    set({ loading: true, error: null })
    try {
      const created = await window.api.cases.createAttribute({ projectId, name, valueType }) as { id: number; name: string; valueType: string }
      set((state) => ({ attributes: [...state.attributes, { id: created.id, name: created.name, valueType: created.valueType }], loading: false }))
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error), loading: false })
    }
  },
  linkSource: async (sourceId, caseId) => {
    set({ error: null })
    try {
      await window.api.cases.linkSource(sourceId, caseId)
      set((state) => ({ sourceCaseLinks: { ...state.sourceCaseLinks, [sourceId]: caseId } }))
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) })
    }
  },
  setSourceCase: async (sourceId, caseId) => {
    set({ error: null })
    try {
      await window.api.cases.setSourceCase(sourceId, caseId)
      set((state) => {
        const next = { ...state.sourceCaseLinks }
        if (caseId == null) {
          delete next[sourceId]
        } else {
          next[sourceId] = caseId
        }
        return { sourceCaseLinks: next }
      })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) })
    }
  },
  clearError: () => set({ error: null }),
}))
