import { useEffect, useMemo, useState } from 'react'
import { useProjectStore } from '../stores/useProjectStore'

type Suggestion = {
  name: string
  evidence: string
  confidence: number
}

export function AiSettingsPanel() {
  const { selectedProjectId } = useProjectStore()
  const [provider, setProvider] = useState('mock')
  const [apiKey, setApiKey] = useState('')
  const [summary, setSummary] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const storedProvider = await window.api.ai.getSetting('ai.provider') as string | null
        const storedApiKey = await window.api.ai.getSetting('ai.apiKey') as string | null
        setProvider(storedProvider || 'mock')
        setApiKey(storedApiKey || '')
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      }
    }

    void loadSettings()
  }, [])

  const canRequest = useMemo(() => Boolean(selectedProjectId), [selectedProjectId])

  const handleSave = async () => {
    setLoading(true)
    setError(null)
    try {
      await window.api.ai.setSetting({ key: 'ai.provider', value: provider })
      await window.api.ai.setSetting({ key: 'ai.apiKey', value: apiKey })
      setSummary('Settings saved. You can now test the AI flow.')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  const handleGenerate = async () => {
    if (!selectedProjectId) return
    setLoading(true)
    setError(null)
    try {
      const sourceList = await window.api.listSources(selectedProjectId)
      const firstSource = Array.isArray(sourceList) && sourceList[0] ? sourceList[0] : null
      if (!firstSource) {
        setSummary('Create a source first to generate an AI summary.')
        return
      }

      const summaryResult = await window.api.ai.summarizeSource({ sourceId: firstSource.id }) as { summary: string }
      const suggestionResult = await window.api.ai.suggestChildCodes({ sourceId: firstSource.id, nodeId: 1, maxSuggestions: 3 }) as Suggestion[]
      setSummary(summaryResult.summary)
      setSuggestions(suggestionResult)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="page-card">
      <div className="page-header">
        <div>
          <p className="eyebrow">AI assistance</p>
          <h2>Settings and review panel</h2>
        </div>
      </div>

      <div className="panel-grid query-grid">
        <div className="panel">
          <h3>Provider</h3>
          <label className="field-label">
            Provider
            <select value={provider} onChange={(event) => setProvider(event.target.value)}>
              <option value="mock">Mock</option>
              <option value="gemini">Gemini</option>
            </select>
          </label>
          <label className="field-label">
            API key
            <input value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="Optional for mock mode" />
          </label>
          <button type="button" onClick={() => void handleSave()} disabled={loading}>Save settings</button>
        </div>

        <div className="panel">
          <h3>Suggestion review</h3>
          <p className="description">AI suggestions are never applied automatically. Review them, then accept or reject them manually.</p>
          <button type="button" onClick={() => void handleGenerate()} disabled={loading || !canRequest}>Generate preview</button>
          {summary ? <p className="description">{summary}</p> : null}
          {suggestions.length > 0 ? (
            <ul className="list">
              {suggestions.map((suggestion, index) => (
                <li key={`${suggestion.name}-${index}`}>
                  <strong>{suggestion.name}</strong>
                  <span>{suggestion.evidence}</span>
                  <span>Confidence: {suggestion.confidence.toFixed(2)}</span>
                  <div className="inline-form">
                    <button type="button" className="ghost-button">Accept</button>
                    <button type="button" className="ghost-button">Reject</button>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
          {error ? <p className="error-text">{error}</p> : null}
        </div>
      </div>
    </section>
  )
}
