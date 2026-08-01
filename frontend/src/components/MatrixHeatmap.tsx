import { useEffect, useMemo, useState } from 'react'
import { useProjectStore } from '../stores/useProjectStore'
import { useNodeStore } from '../stores/useNodeStore'
import { useSourceStore } from '../stores/useSourceStore'

type MatrixData = {
  rowLabels: string[]
  columnLabels: string[]
  cells: number[][]
}

export function MatrixHeatmap() {
  const { selectedProjectId } = useProjectStore()
  const { tree } = useNodeStore()
  const { sources } = useSourceStore()
  const [matrix, setMatrix] = useState<MatrixData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedProjectId) return

    const runQuery = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await window.api.query.matrixCodingQuery({ projectId: selectedProjectId }) as MatrixData
        setMatrix(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setLoading(false)
      }
    }

    void runQuery()
  }, [selectedProjectId, tree, sources])

  const maxValue = useMemo(() => {
    if (!matrix?.cells.length) return 0
    return Math.max(...matrix.cells.flat())
  }, [matrix])

  return (
    <div className="panel">
      <h3>Matrix heatmap</h3>
      {loading ? <p className="description">Loading…</p> : null}
      {error ? <p className="error-text">{error}</p> : null}
      {matrix ? (
        <div className="sheet-table-wrap">
          <table className="sheet-table">
            <thead>
              <tr>
                <th>Node / Case</th>
                {matrix.columnLabels.map((label) => <th key={label}>{label}</th>)}
              </tr>
            </thead>
            <tbody>
              {matrix.rowLabels.map((label, rowIndex) => (
                <tr key={label}>
                  <td>{label}</td>
                  {matrix.cells[rowIndex].map((value, columnIndex) => {
                    const opacity = maxValue > 0 ? value / maxValue : 0
                    return <td key={`${label}-${matrix.columnLabels[columnIndex]}`} style={{ backgroundColor: `rgba(76, 110, 245, ${0.15 + opacity * 0.85})` }}>{value}</td>
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : !loading ? <p className="description">No matrix data yet.</p> : null}
    </div>
  )
}
