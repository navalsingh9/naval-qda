import { useMemo, useState } from 'react'
import { useNodeStore } from '../stores/useNodeStore'

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

function NodeTreeItem({
  node,
  level,
  onSelectNode,
  selectedNodeId,
  onAddChild,
}: {
  node: ReturnType<typeof useNodeStore.getState>['tree'][number]
  level: number
  onSelectNode?: (nodeId: number) => void
  selectedNodeId?: number | null
  onAddChild: (parentId: number) => void
}) {
  const [expanded, setExpanded] = useState(true)

  return (
    <li className="tree-item">
      <div className={`tree-row${selectedNodeId === node.id ? ' selected' : ''}`} style={{ paddingLeft: `${level * 12 + 8}px` }}>
        <button type="button" className="tree-toggle" onClick={() => setExpanded((value) => !value)}>
          {node.children.length ? (expanded ? '▾' : '▸') : '•'}
        </button>
        <button type="button" className="tree-label" onClick={() => onSelectNode?.(node.id)}>
          {node.name}
          <span className="badge">{node.codingCount}</span>
        </button>
        <button type="button" className="ghost-button tree-add-child" title={`Add child node under "${node.name}"`} onClick={() => onAddChild(node.id)}>
          +
        </button>
      </div>
      {expanded && node.children.length ? (
        <ul className="tree-children">
          {node.children.map((child) => (
            <NodeTreeItem key={child.id} node={child} level={level + 1} onSelectNode={onSelectNode} selectedNodeId={selectedNodeId} onAddChild={onAddChild} />
          ))}
        </ul>
      ) : null}
    </li>
  )
}

export function NodeTreeSidebar({ projectId, selectedNodeId, onSelectNode, sourceId }: NodeTreeSidebarProps) {
  const { tree, loading, error, createNode } = useNodeStore()
  const [newNodeName, setNewNodeName] = useState('')
  // null = new node will be created at the root; a number targets that node as parent.
  const [addingChildOf, setAddingChildOf] = useState<number | null>(null)
  const [creating, setCreating] = useState(false)

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

  const handleSuggest = async () => {
    if (!sourceId || !selectedNodeId) return
    setSuggestLoading(true)
    setSuggestError(null)
    try {
      const result = await window.api.ai.suggestChildCodes({ sourceId, nodeId: selectedNodeId, maxSuggestions: 3 }) as Suggestion[]
      setSuggestions(result)
    } catch (err) {
      setSuggestError(err instanceof Error ? err.message : String(err))
    } finally {
      setSuggestLoading(false)
    }
  }

  // AI suggestions are never applied automatically — accepting one just
  // creates a real node via the normal manual path, under the node the
  // suggestion was generated for.
  const handleAccept = async (suggestion: Suggestion, index: number) => {
    if (!projectId || !selectedNodeId) return
    setAcceptingIndex(index)
    try {
      await createNode({ projectId, name: suggestion.name, parentId: selectedNodeId })
      setSuggestions((current) => current.filter((_, i) => i !== index))
    } finally {
      setAcceptingIndex(null)
    }
  }

  const handleDismiss = (index: number) => {
    setSuggestions((current) => current.filter((_, i) => i !== index))
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
                <NodeTreeItem key={node.id} node={node} level={0} onSelectNode={onSelectNode} selectedNodeId={selectedNodeId} onAddChild={setAddingChildOf} />
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
}
