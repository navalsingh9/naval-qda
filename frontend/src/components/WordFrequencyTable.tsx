import { useEffect, useMemo, useState } from 'react'
import { useProjectStore } from '../stores/useProjectStore'
import { useSourceStore } from '../stores/useSourceStore'

type FrequencyRow = {
  token: string
  count: number
}

export function WordFrequencyTable() {
  const { selectedProjectId } = useProjectStore()
  const { sources } = useSourceStore()
  const [rows, setRows] = useState<FrequencyRow[]>([])
  const [minLength, setMinLength] = useState(4)
  const [stemming, setStemming] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sourceIds = useMemo(() => sources.map((source) => source.id), [sources])

  useEffect(() => {
    if (!selectedProjectId) return

    const runQuery = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await window.api.query.wordFrequency({
          projectId: selectedProjectId,
          sourceIds,
          minLength,
          topN: 50,
          stemming,
        }) as FrequencyRow[]
        setRows(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setLoading(false)
      }
    }

    void runQuery()
  }, [minLength, selectedProjectId, sourceIds, stemming])

  return (
    <div className="panel">
      <h3>Word frequency</h3>
      <div className="inline-form">
        <label className="field-label">
          Min length
          <input type="number" min="1" value={minLength} onChange={(event) => setMinLength(Number(event.target.value))} />
        </label>
        <label className="toggle-row">
          <input type="checkbox" checked={stemming} onChange={(event) => setStemming(event.target.checked)} />
          Stemming
        </label>
      </div>
      {loading ? <p className="description">Loading…</p> : null}
      {error ? <p className="error-text">{error}</p> : null}
      <table className="sheet-table">
        <thead>
          <tr>
            <th>Word</th>
            <th>Count</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.token}>
              <td>{row.token}</td>
              <td>{row.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
