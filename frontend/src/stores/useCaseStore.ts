import { create } from 'zustand'

export type CaseRecord = { id: number; name: string; description: string | null }
export type AttributeRecord = { id: number; name: string; valueType: string }

type CaseStore = {
  cases: CaseRecord[]
  attributes: AttributeRecord[]
  loading: boolean
  error: string | null
  loadCases: (projectId: number) => Promise<void>
  createCase: (projectId: number, name: string) => Promise<void>
  createAttribute: (projectId: number, name: string, valueType: string) => Promise<void>
  linkSource: (sourceId: number, caseId: number) => Promise<void>
  clearError: () => void
}

export const useCaseStore = create<CaseStore>((set) => ({
  cases: [],
  attributes: [],
  loading: false,
  error: null,
  loadCases: async (projectId) => {
    set({ loading: true, error: null })
    try {
      const cases = (await window.api.cases.list(projectId)) as CaseRecord[]
      set({ cases, loading: false })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error), loading: false })
    }
  },
  createCase: async (projectId, name) => {
    if (!name.trim()) return
    set({ loading: true, error: null })
    try {
      const created = (await window.api.cases.create({ projectId, name })) as { id: number; name: string }
      set((state) => ({ cases: [...state.cases, { id: created.id, name: created.name, description: null }], loading: false }))
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error), loading: false })
    }
  },
  createAttribute: async (projectId, name, valueType) => {
    if (!name.trim()) return
    set({ loading: true, error: null })
    try {
      const created = (await window.api.cases.createAttribute({ projectId, name, valueType })) as { id: number; name: string; valueType: string }
      set((state) => ({ attributes: [...state.attributes, { id: created.id, name: created.name, valueType: created.valueType }], loading: false }))
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error), loading: false })
    }
  },
  linkSource: async (sourceId, caseId) => {
    set({ error: null })
    try {
      await window.api.cases.linkSource(sourceId, caseId)
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) })
    }
  },
  clearError: () => set({ error: null }),
}))
