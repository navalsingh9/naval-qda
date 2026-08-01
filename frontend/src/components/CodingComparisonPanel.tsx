import { useEffect, useMemo, useState } from 'react'
import { useProjectStore } from '../stores/useProjectStore'

type ComparisonData = {
  sourceId: number
  nodeId: number
  paragraphs: number
  contingency: {
    bothCoded: number
    onlyA: number
    onlyB: number
    neither: number
  }
}

export function CodingComparisonPanel() {
  const { selectedProjectId } = useProjectStore()
  const [data, setData] = useState<ComparisonData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedProjectId) return

    const loadData = async () => {
      setLoading(true)
      setError(null)
      try {
        const sources = await window.api.listSources(selectedProjectId)
        const firstSource = Array.isArray(sources) && sources[0] ? sources[0] : null
        if (!firstSource) {
          setData(null)
          return
        }

        const response = await window.api.query.codingComparison({
          sourceId: firstSource.id,
          coderAId: 1,
          coderBId: 2,
          nodeId: 1,
        }) as ComparisonData
        setData(response)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setLoading(false)
      }
    }

    void loadData()
  }, [selectedProjectId])

  const summary = useMemo(() => {
    if (!data) return null
    const total = data.contingency.bothCoded + data.contingency.onlyA + data.contingency.onlyB + data.contingency.neither
    return [
      { label: 'Both', value: data.contingency.bothCoded },
      { label: 'A only', value: data.contingency.onlyA },
      { label: 'B only', value: data.contingency.onlyB },
      { label: 'Neither', value: data.contingency.neither },
      { label: 'Total paragraphs', value: total },
    ]
  }, [data])

  return (
    <div className="panel">
      <h3>Coding comparison</h3>
      {loading ? <p className="description">Loading…</p> : null}
      {error ? <p className="error-text">{error}</p> : null}
      {summary ? (
        <div className="sheet-table-wrap">
          <table className="sheet-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Count</th>
              </tr>
            </thead>
            <tbody>
              {summary.map((row) => (
                <tr key={row.label}>
                  <td>{row.label}</td>
                  <td>{row.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : !loading ? <p className="description">No comparison data yet.</p> : null}
    </div>
  )
}
