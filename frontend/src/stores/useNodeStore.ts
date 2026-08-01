import { create } from 'zustand'

export type NodeTreeItem = {
  id: number
  projectId: number
  name: string
  parentId: number | null
  children: NodeTreeItem[]
  codingCount: number
}

type NodeStore = {
  tree: NodeTreeItem[]
  loading: boolean
  error: string | null
  loadTree: (projectId: number) => Promise<void>
  createNode: (payload: { projectId: number; name: string; parentId?: number | null }) => Promise<void>
  moveNode: (nodeId: number, newParentId: number | null) => Promise<void>
  mergeNodes: (sourceNodeId: number, targetNodeId: number) => Promise<void>
  clearError: () => void
}

export const useNodeStore = create<NodeStore>((set) => ({
  tree: [],
  loading: false,
  error: null,
  loadTree: async (projectId) => {
    set({ loading: true, error: null })
    try {
      const tree = await window.api.coding.getNodeTree(projectId, true) as NodeTreeItem[]
      set({ tree, loading: false })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error), loading: false })
    }
  },
  createNode: async (payload) => {
    set({ loading: true, error: null })
    try {
      await window.api.coding.createNode(payload)
      await useNodeStore.getState().loadTree(payload.projectId)
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error), loading: false })
    }
  },
  moveNode: async (nodeId, newParentId) => {
    set({ loading: true, error: null })
    try {
      await window.api.coding.moveNode(nodeId, newParentId)
      const projectId = useNodeStore.getState().tree[0]?.projectId
      if (projectId) {
        await useNodeStore.getState().loadTree(projectId)
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error), loading: false })
    }
  },
  mergeNodes: async (sourceNodeId, targetNodeId) => {
    set({ loading: true, error: null })
    try {
      await window.api.coding.mergeNodes(sourceNodeId, targetNodeId)
      const projectId = useNodeStore.getState().tree[0]?.projectId
      if (projectId) {
        await useNodeStore.getState().loadTree(projectId)
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error), loading: false })
    }
  },
  clearError: () => {
    set({ error: null })
  },
}))
