import { useEffect } from 'react'
import { SimilarityClusterPanel } from './SimilarityClusterPanel'
import { useProjectStore } from '../stores/useProjectStore'
import { useNodeStore } from '../stores/useNodeStore'
import { useSourceStore } from '../stores/useSourceStore'

// Similarity clustering (dendrogram + similarity matrix) is a distinct,
// multi-step analysis flow — comparing sources by word usage or coding
// pattern — that doesn't fit the generic single-fetch chart model the
// interactive dashboard uses, so it gets its own page instead.
export function SimilarityPage() {
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
          <h2>Similarity Clustering</h2>
        </div>
      </div>
      <p className="description">
        Compare sources by shared vocabulary or shared coding pattern and see how they cluster together.
      </p>
      <SimilarityClusterPanel />
    </section>
  )
}
