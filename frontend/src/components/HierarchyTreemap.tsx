import { useEffect, useState } from 'react'
import { useProjectStore } from '../stores/useProjectStore'
import { Treemap, type TreemapNode, CHART_COLORS } from './charts/Charts'

export function HierarchyTreemap() {
  const { selectedProjectId } = useProjectStore()
  const [data, setData] = useState<TreemapNode[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedProjectId) return

    const loadData = async () => {
      setLoading(true)
      setError(null)
      try {
        const response = await window.api.visualize.hierarchyChartData({ projectId: selectedProjectId }) as TreemapNode[]
        setData(response)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setLoading(false)
      }
    }

    void loadData()
  }, [selectedProjectId])

  const hasCodings = data.some((node) => node.value > 0 || (node.children?.length ?? 0) > 0)

  return (
    <div className="panel">
      <div className="page-header">
        <h3>Hierarchy treemap</h3>
      </div>
      <p className="description">Box area is proportional to coding references — nested boxes show child nodes within their parent.</p>
      {loading ? <p className="description">Loading…</p> : null}
      {error ? <p className="error-text">{error}</p> : null}
      <div className="chart-card" style={{ minHeight: '400px', background: 'var(--bg-secondary)', width: '100%', height: '400px' }}>
        {data.length && hasCodings ? (
          <Treemap data={data} width="100%" height="100%" colors={CHART_COLORS} />
        ) : !loading ? (
          <p className="description">No hierarchy data yet — add nodes and code some text first.</p>
        ) : null}
      </div>
    </div>
  )
}
