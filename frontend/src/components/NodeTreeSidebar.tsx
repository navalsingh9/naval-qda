import { useMemo, useState } from 'react'
import { useNodeStore } from '../stores/useNodeStore'

type NodeTreeSidebarProps = {
  projectId: number
  selectedNodeId?: number | null
  onSelectNode?: (nodeId: number) => void
}

function NodeTreeItem({ node, level, onSelectNode, selectedNodeId }: { node: ReturnType<typeof useNodeStore.getState>['tree'][number]; level: number; onSelectNode?: (nodeId: number) => void; selectedNodeId?: number | null }) {
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
      </div>
      {expanded && node.children.length ? (
        <ul className="tree-children">
          {node.children.map((child) => (
            <NodeTreeItem key={child.id} node={child} level={level + 1} onSelectNode={onSelectNode} selectedNodeId={selectedNodeId} />
          ))}
        </ul>
      ) : null}
    </li>
  )
}

export function NodeTreeSidebar({ projectId, selectedNodeId, onSelectNode }: NodeTreeSidebarProps) {
  const { tree, loading, error } = useNodeStore()

  const flattened = useMemo(() => tree, [tree])

  return (
    <div className="panel">
      <h3>Node tree</h3>
      {loading ? <p className="description">Loading nodes…</p> : null}
      {error ? <p className="error-text">{error}</p> : null}
      {projectId ? (
        <ul className="tree-list">
          {flattened.map((node) => (
            <NodeTreeItem key={node.id} node={node} level={0} onSelectNode={onSelectNode} selectedNodeId={selectedNodeId} />
          ))}
        </ul>
      ) : (
        <p className="description">Select a project to inspect nodes.</p>
      )}
    </div>
  )
}
