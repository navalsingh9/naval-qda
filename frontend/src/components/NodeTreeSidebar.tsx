import { useMemo, useState } from 'react'
import { Pencil, Trash2, Check, X, AlertTriangle } from 'lucide-react'
import { useNodeStore } from '../stores/useNodeStore'
import { stripMarkdown } from '../utils/markdown'

type Suggestion = {
  name: string
  evidence: string
  confidence: number
}

type NodeTreeSidebarProps = {
  projectId: number
  selectedNodeId?: number | null
  onSelectNode?: (nodeId: number) => void
  // Needed to ask the AI for child-code suggestions grounded in an actual
  // source's text. Omit (or pass null) when no source is open yet — the
  // "Suggest with AI" action stays disabled in that case.
  sourceId?: number | null
}

type TreeNode = ReturnType<typeof useNodeStore.getState>['tree'][number]

function NodeTreeItem({
  node,
  level,
  onSelectNode,
  selectedNodeId,
  onAddChild,
  editingId,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  deleteState,
  onStartDelete,
  onCancelDelete,
  onConfirmDelete,
}: {
  node: TreeNode
  level: number
  onSelectNode?: (nodeId: number) => void
  selectedNodeId?: number | null
  onAddChild: (parentId: number) => void
  editingId: number | null
  onStartEdit: (nodeId: number, currentName: string) => void
  onCancelEdit: () => void
  onSaveEdit: (nodeId: number, value: string) => void
  deleteState: { nodeId: number; error: string | null; needsCascade: boolean } | null
  onStartDelete: (nodeId: number) => void
  onCancelDelete: () => void
  onConfirmDelete: (nodeId: number, cascade: boolean) => void
}) {
  const [expanded, setExpanded] = useState(true)
  const [editValue, setEditValue] = useState(node.name)
  const isEditing = editingId === node.id
  const isDeleting = deleteState?.nodeId === node.id

  return (
    <li className="tree-item">
      {isDeleting ? (
        <div className="tree-delete-confirm" style={{ marginLeft: `${level * 12 + 8}px` }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontWeight: 'var(--font-semibold)' }}>
            <AlertTriangle size={15} strokeWidth={2} />
            {deleteState.needsCascade
              ? `"${node.name}" has child nodes. Delete it and ALL its children?`
              : `Delete "${node.name}"? This removes its codings too.`}
          </span>
          {deleteState.error && !deleteState.needsCascade ? (
            <p className="error-text" style={{ margin: 0 }}>{deleteState.error}</p>
          ) : null}
          <div className="inline-form">
            <button
              type="button"
              className="ghost-button"
              style={{ background: 'var(--error-50)', color: 'var(--error-700)', borderColor: 'var(--error-200)' }}
              onClick={() => onConfirmDelete(node.id, deleteState.needsCascade)}
            >
              {deleteState.needsCascade ? 'Yes, delete node and children' : 'Yes, delete'}
            </button>
            <button type="button" className="ghost-button" onClick={onCancelDelete}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className={`tree-row${selectedNodeId === node.id ? ' selected' : ''}`} style={{ paddingLeft: `${level * 12 + 8}px` }}>
          <button type="button" className="tree-toggle" onClick={() => setExpanded((value) => !value)}>
            {node.children.length ? (expanded ? '▾' : '▸') : '•'}
          </button>

          {isEditing ? (
            <>
              <input
                className="tree-edit-input"
                value={editValue}
                autoFocus
                onChange={(event) => setEditValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') onSaveEdit(node.id, editValue)
                  if (event.key === 'Escape') onCancelEdit()
                }}
              />
              <button type="button" className="tree-icon-btn" title="Save" onClick={() => onSaveEdit(node.id, editValue)}>
                <Check size={14} strokeWidth={2.5} />
              </button>
              <button type="button" className="tree-icon-btn" title="Cancel" onClick={onCancelEdit}>
                <X size={14} strokeWidth={2} />
              </button>
            </>
          ) : (
            <>
              <button type="button" className="tree-label" onClick={() => onSelectNode?.(node.id)}>
                {node.name}
                <span className="badge">{node.codingCount}</span>
              </button>
              <button
                type="button"
                className="tree-icon-btn"
                title={`Rename "${node.name}"`}
                onClick={() => { setEditValue(node.name); onStartEdit(node.id, node.name) }}
              >
                <Pencil size={13} strokeWidth={2} />
              </button>
              <button
                type="button"
                className="tree-icon-btn tree-icon-btn-danger"
                title={`Delete "${node.name}"`}
                onClick={() => onStartDelete(node.id)}
              >
                <Trash2 size={13} strokeWidth={2} />
              </button>
              <button type="button" className="ghost-button tree-add-child" title={`Add child node under "${node.name}"`} onClick={() => onAddChild(node.id)}>
                +
              </button>
            </>
          )}
        </div>
      )}
      {expanded && node.children.length ? (
        <ul className="tree-children">
          {node.children.map((child) => (
            <NodeTreeItem
              key={child.id}
              node={child}
              level={level + 1}
              onSelectNode={onSelectNode}
              selectedNodeId={selectedNodeId}
              onAddChild={onAddChild}
              editingId={editingId}
              onStartEdit={onStartEdit}
              onCancelEdit={onCancelEdit}
              onSaveEdit={onSaveEdit}
              deleteState={deleteState}
              onStartDelete={onStartDelete}
              onCancelDelete={onCancelDelete}
              onConfirmDelete={onConfirmDelete}
            />
          ))}
        </ul>
      ) : null}
    </li>
  )
}

export function NodeTreeSidebar({ projectId, selectedNodeId, onSelectNode, sourceId }: NodeTreeSidebarProps) {
  const { tree, loading, error, createNode, renameNode, deleteNode } = useNodeStore()
  const [newNodeName, setNewNodeName] = useState('')
  // null = new node will be created at the root; a number targets that node as parent.
  const [addingChildOf, setAddingChildOf] = useState<number | null>(null)
  const [creating, setCreating] = useState(false)

  const [editingId, setEditingId] = useState<number | null>(null)
  const [deleteState, setDeleteState] = useState<{ nodeId: number; error: string | null; needsCascade: boolean } | null>(null)

  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [suggestLoading, setSuggestLoading] = useState(false)
  const [suggestError, setSuggestError] = useState<string | null>(null)
  const [acceptingIndex, setAcceptingIndex] = useState<number | null>(null)

  const flattened = useMemo(() => tree, [tree])

  const findNodeName = (nodeId: number): string | null => {
    const visit = (items: typeof tree): string | null => {
      for (const item of items) {
        if (item.id === nodeId) return item.name
        const found = visit(item.children)
        if (found) return found
      }
      return null
    }
    return visit(tree)
  }

  const handleCreate = async () => {
    const name = newNodeName.trim()
    if (!name || !projectId) return
    setCreating(true)
    try {
      await createNode({ projectId, name, parentId: addingChildOf })
      setNewNodeName('')
      setAddingChildOf(null)
    } finally {
      setCreating(false)
    }
  }

  const handleSaveEdit = async (nodeId: number, name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    await renameNode(nodeId, trimmed)
    setEditingId(null)
  }

  const handleStartDelete = (nodeId: number) => {
    setEditingId(null)
    setDeleteState({ nodeId, error: null, needsCascade: false })
  }

  const handleConfirmDelete = async (nodeId: number, cascade: boolean) => {
    try {
      await deleteNode(nodeId, { cascade })
      setDeleteState(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      // The backend refuses to delete a node with children unless cascade
      // is explicitly requested — surface that as a second confirmation
      // step instead of a dead-end error.
      const needsCascade = /child node/i.test(message)
      setDeleteState({ nodeId, error: needsCascade ? null : message, needsCascade })
    }
  }

  const selectedNodeName = selectedNodeId != null ? findNodeName(selectedNodeId) : null

  return (
    <div className="panel">
      <h3>Node tree</h3>
      {loading ? <p className="description">Loading nodes…</p> : null}
      {error ? <p className="error-text">{error}</p> : null}
      {projectId ? (
        <>
          <div className="inline-form">
            <input
              value={newNodeName}
              onChange={(event) => setNewNodeName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void handleCreate()
              }}
              placeholder={addingChildOf != null ? `New child under "${findNodeName(addingChildOf) ?? ''}"` : 'New node name'}
            />
            <button type="button" onClick={() => void handleCreate()} disabled={creating || !newNodeName.trim()}>
              {addingChildOf != null ? 'Add child' : 'Add node'}
            </button>
            {addingChildOf != null ? (
              <button type="button" className="ghost-button" onClick={() => setAddingChildOf(null)}>
                Cancel
              </button>
            ) : null}
          </div>

          {flattened.length === 0 ? (
            <p className="description">No nodes yet. Add one above to start coding.</p>
          ) : (
            <ul className="tree-list">
              {flattened.map((node) => (
                <NodeTreeItem
                  key={node.id}
                  node={node}
                  level={0}
                  onSelectNode={onSelectNode}
                  selectedNodeId={selectedNodeId}
                  onAddChild={setAddingChildOf}
                  editingId={editingId}
                  onStartEdit={(nodeId) => setEditingId(nodeId)}
                  onCancelEdit={() => setEditingId(null)}
                  onSaveEdit={(nodeId, value) => void handleSaveEdit(nodeId, value)}
                  deleteState={deleteState}
                  onStartDelete={handleStartDelete}
                  onCancelDelete={() => setDeleteState(null)}
                  onConfirmDelete={(nodeId, cascade) => void handleConfirmDelete(nodeId, cascade)}
                />
              ))}
            </ul>
          )}

          <div className="node-ai-suggest">
            <h4>AI-suggested child codes</h4>
            {selectedNodeId == null ? (
              <p className="description">Select a node above to get AI-suggested child codes for it.</p>
            ) : !sourceId ? (
              <p className="description">Open a source to generate suggestions for "{selectedNodeName}".</p>
            ) : (
              <>
                <button type="button" className="ghost-button" onClick={() => void handleSuggest()} disabled={suggestLoading}>
                  {suggestLoading ? 'Thinking…' : `Suggest children for "${selectedNodeName}"`}
                </button>
                <p className="description">AI suggestions are never applied automatically. Review each one, then accept or dismiss it.</p>
                {suggestError ? <p className="error-text">{suggestError}</p> : null}
                {suggestions.length > 0 ? (
                  <ul className="list">
                    {suggestions.map((suggestion, index) => (
                      <li key={`${suggestion.name}-${index}`}>
                        <strong>{suggestion.name}</strong>
                        <span>{suggestion.evidence}</span>
                        <span>Confidence: {suggestion.confidence.toFixed(2)}</span>
                        <div className="inline-form">
                          <button type="button" className="ghost-button" onClick={() => void handleAccept(suggestion, index)} disabled={acceptingIndex === index}>
                            Accept
                          </button>
                          <button type="button" className="ghost-button" onClick={() => handleDismiss(index)} disabled={acceptingIndex === index}>
                            Dismiss
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </>
            )}
          </div>
        </>
      ) : (
        <p className="description">Select a project to inspect nodes.</p>
      )}
    </div>
  )

  async function handleSuggest() {
    if (!sourceId || !selectedNodeId) return
    setSuggestLoading(true)
    setSuggestError(null)
    try {
      const result = await window.api.ai.suggestChildCodes({ sourceId, nodeId: selectedNodeId, maxSuggestions: 3 }) as Suggestion[]
      setSuggestions(result.map((s) => ({ ...s, name: stripMarkdown(s.name), evidence: stripMarkdown(s.evidence) })))
    } catch (err) {
      setSuggestError(err instanceof Error ? err.message : String(err))
    } finally {
      setSuggestLoading(false)
    }
  }

  // AI suggestions are never applied automatically — accepting one just
  // creates a real node via the normal manual path, under the node the
  // suggestion was generated for.
  async function handleAccept(suggestion: Suggestion, index: number) {
    if (!projectId || !selectedNodeId) return
    setAcceptingIndex(index)
    try {
      await createNode({ projectId, name: suggestion.name, parentId: selectedNodeId })
      setSuggestions((current) => current.filter((_, i) => i !== index))
    } finally {
      setAcceptingIndex(null)
    }
  }

  function handleDismiss(index: number) {
    setSuggestions((current) => current.filter((_, i) => i !== index))
  }
}
