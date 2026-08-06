import { useEffect, useMemo, useState } from 'react'
import { NodeTreeSidebar } from './NodeTreeSidebar'
import { SourceTextViewer } from './SourceTextViewer'
import { useNodeStore } from '../stores/useNodeStore'
import { useProjectStore } from '../stores/useProjectStore'
import { useSourceStore } from '../stores/useSourceStore'

export function CodingWorkspacePage() {
  const { selectedProjectId } = useProjectStore()
  const { loadTree } = useNodeStore()
  const { sources, loadSources } = useSourceStore()
  const [selectedSourceId, setSelectedSourceId] = useState<number | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null)
  const [highlightOffset, setHighlightOffset] = useState<number | null>(null)

  useEffect(() => {
    if (selectedProjectId) {
      void loadTree(selectedProjectId)
      void loadSources(selectedProjectId)
    }
  }, [selectedProjectId, loadTree, loadSources])

  const selectedSource = useMemo(() => sources.find((source) => source.id === selectedSourceId) ?? null, [selectedSourceId, sources])

  return (
    <section className="page-card">
      <div className="page-header">
        <div>
          <p className="eyebrow">Coding workspace</p>
          <h2>Code text to nodes</h2>
        </div>
      </div>

      <div className="panel-grid coding-grid">
        <div className="panel">
          <h3>Sources</h3>
          <ul className="list">
            {sources.map((source) => (
              <li key={source.id} className={selectedSourceId === source.id ? 'selected' : ''} onClick={() => setSelectedSourceId(source.id)}>
                <strong>{source.title}</strong>
                <span>{source.file_path}</span>
              </li>
            ))}
          </ul>
        </div>

        <NodeTreeSidebar projectId={selectedProjectId ?? 0} selectedNodeId={selectedNodeId} onSelectNode={setSelectedNodeId} sourceId={selectedSourceId} />
      </div>

      <div className="panel coding-panel">
        {selectedSource ? (
          <SourceTextViewer
            sourceId={selectedSource.id}
            onSelectionCoded={() => {
              setHighlightOffset(null)
              void loadTree(selectedProjectId ?? 0)
            }}
            highlightOffset={highlightOffset}
            highlightActive={highlightOffset != null}
          />
        ) : (
          <p className="description">Choose a source from the panel to begin coding.</p>
        )}
      </div>
    </section>
  )
}
