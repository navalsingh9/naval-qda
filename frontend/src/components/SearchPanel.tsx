import { useEffect, useMemo, useState } from 'react'
import { useProjectStore } from '../stores/useProjectStore'
import { useSourceStore } from '../stores/useSourceStore'

type SearchResult = {
  sourceId: number
  startOffset: number
  endOffset: number
  context: string
}

export function SearchPanel() {
  const { selectedProjectId } = useProjectStore()
  const { sources } = useSourceStore()
  const [term, setTerm] = useState('')
  const [useRegex, setUseRegex] = useState(false)
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sourceIds = useMemo(() => sources.map((source) => source.id), [sources])

  useEffect(() => {
    if (!selectedProjectId || !term.trim()) {
      setResults([])
      return
    }

    const runSearch = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await window.api.query.textSearch({
          projectId: selectedProjectId,
          term,
          sourceIds,
          useRegex,
          caseSensitive,
        }) as SearchResult[]
        setResults(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setLoading(false)
      }
    }

    const timeout = window.setTimeout(() => { void runSearch() }, 200)
    return () => window.clearTimeout(timeout)
  }, [caseSensitive, selectedProjectId, sourceIds, term, useRegex])

  return (
    <div className="panel">
      <h3>Search</h3>
      <div className="inline-form">
        <input value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Search text" />
        <button type="button" className="ghost-button" onClick={() => setTerm('')}>Clear</button>
      </div>
      <label className="toggle-row">
        <input type="checkbox" checked={useRegex} onChange={(event) => setUseRegex(event.target.checked)} />
        Regex
      </label>
      <label className="toggle-row">
        <input type="checkbox" checked={caseSensitive} onChange={(event) => setCaseSensitive(event.target.checked)} />
        Case sensitive
      </label>
      {loading ? <p className="description">Searching…</p> : null}
      {error ? <p className="error-text">{error}</p> : null}
      <ul className="list">
        {results.map((result, index) => (
          <li key={`${result.sourceId}-${result.startOffset}-${index}`}>
            <strong>{sources.find((source) => source.id === result.sourceId)?.title ?? `Source ${result.sourceId}`}</strong>
            <span>{result.context}</span>
          </li>
        ))}
        {!results.length && !loading && term.trim() ? <li className="empty">No matches.</li> : null}
      </ul>
    </div>
  )
}
