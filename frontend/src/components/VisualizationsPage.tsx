import { useEffect } from 'react'
import { WordCloud } from './WordCloud'
import { HierarchyTreemap } from './HierarchyTreemap'
import { CodingChartsPanel } from './CodingChartsPanel'
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
          <h2>Explore your data through interactive charts and visualizations</h2>
        </div>
      </div>

      <p className="description">
        Get insights into your qualitative data with various visualization types. 
        Charts update automatically as you code and analyze your sources.
      </p>

      {/* Charts in 2-column layout with better spacing */}
      <div className="panel-grid">
        <CodingChartsPanel />
        <WordCloud />
      </div>

      <div className="panel-grid">
        <HierarchyTreemap />
        <SimilarityClusterPanel />
      </div>

      {/* Visualization Tips */}
      <div className="panel" style={{ marginTop: 'var(--space-6)' }}>
        <h3>Tips</h3>
        <ul className="list">
          <li>
            <span><strong>Coding Charts:</strong> Visualize how your codes are distributed across sources</span>
          </li>
          <li>
            <span><strong>Word Cloud:</strong> See the most frequent terms in your imported sources</span>
          </li>
          <li>
            <span><strong>Hierarchy Treemap:</strong> Understand the structure of your coding framework</span>
          </li>
          <li>
            <span><strong>Similarity Clustering:</strong> Discover patterns and relationships between your sources</span>
          </li>
        </ul>
      </div>
    </section>
  )
}
