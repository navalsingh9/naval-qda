import { useEffect, useMemo, useState } from 'react'
import { useProjectStore } from '../stores/useProjectStore'
import { stripMarkdown } from '../utils/markdown'

type Suggestion = {
  name: string
  evidence: string
  confidence: number
}

type NodeTreeItem = {
  id: number
  name: string
  children: NodeTreeItem[]
}

// Flatten the coding-node tree so we can pick a real node id to preview
// suggestions against, instead of assuming one exists.
function flattenNodes(nodes: NodeTreeItem[]): NodeTreeItem[] {
  return nodes.flatMap((node) => [node, ...flattenNodes(node.children ?? [])])
}

export function AiSettingsPanel() {
  const { selectedProjectId } = useProjectStore()
  const [provider, setProvider] = useState('gemini')
  const [apiKey, setApiKey] = useState('')
  const [summary, setSummary] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showKey, setShowKey] = useState(false)
  const [keySaved, setKeySaved] = useState(false)

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const storedProvider = await window.api.ai.getSetting('ai.provider') as string | null
        // The saved key is deliberately not readable from here — the main
        // process holds it and makes the provider calls. We only ask whether
        // one exists so the field can say so.
        const saved = await window.api.ai.hasSetting('ai.apiKey') as boolean
        setProvider(storedProvider || 'gemini')
        setKeySaved(Boolean(saved))
        setApiKey('')
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
      // An empty field means "leave the saved key alone", not "erase it" —
      // the field starts empty now that the key can't be read back.
      if (apiKey.trim()) {
        await window.api.ai.setSetting({ key: 'ai.apiKey', value: apiKey.trim() })
        setKeySaved(true)
        setApiKey('')
      }
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

      // Summarizing and suggesting are independent calls — show the summary
      // as soon as it comes back instead of waiting on suggestChildCodes too,
      // so a later failure there doesn't swallow a summary that succeeded.
      const summaryResult = await window.api.ai.summarizeSource({ sourceId: firstSource.id }) as { summary: string }
      setSummary(stripMarkdown(summaryResult.summary))

      // suggestChildCodes needs a real coding node to attach suggestions
      // under — there's no fixed "first" node id, so look up whatever
      // nodes this project actually has instead of guessing one.
      const nodeTree = await window.api.coding.getNodeTree(selectedProjectId) as NodeTreeItem[]
      const [firstNode] = flattenNodes(nodeTree ?? [])
      if (!firstNode) {
        setSuggestions([])
        setError('Create a coding node first to preview AI-suggested child codes.')
        return
      }

      const suggestionResult = await window.api.ai.suggestChildCodes({ sourceId: firstSource.id, nodeId: firstNode.id, maxSuggestions: 3 }) as Suggestion[]
      setSuggestions(suggestionResult.map((s) => ({ ...s, name: stripMarkdown(s.name), evidence: stripMarkdown(s.evidence) })))
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
              <option value="gemini">Gemini</option>
              <option value="mistral">Mistral</option>
            </select>
          </label>
          <label className="field-label">
            API key
            <div className="inline-form" style={{ marginBottom: 0 }}>
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder={
                  keySaved
                    ? 'A key is saved — type a new one to replace it'
                    : provider === 'mistral' ? 'Paste your Mistral API key' : 'Paste your Gemini API key'
                }
                autoComplete="off"
              />
              <button type="button" className="ghost-button" onClick={() => setShowKey((value) => !value)}>
                {showKey ? 'Hide' : 'Show'}
              </button>
              {keySaved && (
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => {
                    void window.api.ai.clearSetting('ai.apiKey').then(() => {
                      setKeySaved(false)
                      setApiKey('')
                      setSummary('Saved key removed.')
                    })
                  }}
                >
                  Remove
                </button>
              )}
            </div>
          </label>
          <p className="description">
            Without a key, AI features fall back to a local offline placeholder so the rest of the app stays usable. Only the specific text you summarize or request suggestions for is ever sent to the provider.
            {' '}Your key is encrypted with your operating system&rsquo;s keychain and is not readable from this screen once saved.
          </p>
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
