import { useEffect } from 'react'
import { WordCloud } from './WordCloud'
import { HierarchyTreemap } from './HierarchyTreemap'
import { SimilarityClusterPanel } from './SimilarityClusterPanel'
import { useProjectStore } from '../stores/useProjectStore'
import { useNodeStore } from '../stores/useNodeStore'
import { useSourceStore } from '../stores/useSourceStore'

export function VisualizationsPage() {
  const { selectedProjectId } = useProjectStore()
  const { loadTree } = useNodeStore()
  const { loadSources } = useSourceStore()

  useEffect(() => {
    if (selectedProjectId) {
      void loadTree(selectedProjectId)
      void loadSources(selectedProjectId)
    }
  }, [selectedProjectId, loadTree, loadSources])

  return (
    <section className="page-card">
      <div className="page-header">
        <div>
          <p className="eyebrow">Visualizations</p>
          <h2>Word cloud, hierarchy, and similarity views</h2>
        </div>
      </div>

      <div className="panel-grid query-grid">
        <WordCloud />
        <HierarchyTreemap />
      </div>

      <div className="panel-grid query-grid">
        <SimilarityClusterPanel />
      </div>
    </section>
  )
}
