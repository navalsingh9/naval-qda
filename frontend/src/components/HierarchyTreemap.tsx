import { useEffect, useMemo, useState } from 'react'
import { useProjectStore } from '../stores/useProjectStore'

type TreeNode = {
  name: string
  value: number
  children?: TreeNode[]
}

export function HierarchyTreemap() {
  const { selectedProjectId } = useProjectStore()
  const [data, setData] = useState<TreeNode[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedProjectId) return

    const loadData = async () => {
      setLoading(true)
      setError(null)
      try {
        const response = await window.api.visualize.hierarchyChartData({ projectId: selectedProjectId }) as TreeNode[]
        setData(response)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setLoading(false)
      }
    }

    void loadData()
  }, [selectedProjectId])

  const flattened = useMemo(() => {
    const rows: Array<{ name: string; value: number; depth: number }> = []
    const walk = (node: TreeNode, depth: number) => {
      rows.push({ name: node.name, value: node.value, depth })
      if (Array.isArray(node.children)) {
        node.children.forEach((child) => walk(child, depth + 1))
      }
    }
    data.forEach((node) => walk(node, 0))
    return rows
  }, [data])

  return (
    <div className="panel">
      <h3>Hierarchy treemap</h3>
      {loading ? <p className="description">Loading…</p> : null}
      {error ? <p className="error-text">{error}</p> : null}
      <div className="chart-card">
        {flattened.length > 0 ? (
          <ul className="list">
            {flattened.map((row) => (
              <li key={`${row.name}-${row.depth}`}>
                <strong>{' '.repeat(row.depth * 2)}{row.name}</strong>
                <span>coding count: {row.value}</span>
              </li>
            ))}
          </ul>
        ) : !loading ? <p className="description">No hierarchy data yet.</p> : null}
      </div>
    </div>
  )
}
