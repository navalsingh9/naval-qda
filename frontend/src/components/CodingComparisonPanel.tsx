import { useEffect, useMemo, useState } from 'react'
import { useProjectStore } from '../stores/useProjectStore'
import { useSourceStore } from '../stores/useSourceStore'
import { useNodeStore, type NodeTreeItem } from '../stores/useNodeStore'

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

type Coder = { id: number; projectId: number; name: string }

function flattenTree(nodes: NodeTreeItem[], depth = 0): Array<{ id: number; name: string; depth: number }> {
  const rows: Array<{ id: number; name: string; depth: number }> = []
  for (const node of nodes) {
    rows.push({ id: node.id, name: node.name, depth })
    if (node.children.length) {
      rows.push(...flattenTree(node.children, depth + 1))
    }
  }
  return rows
}

export function CodingComparisonPanel() {
  const { selectedProjectId } = useProjectStore()
  const { sources, loadSources } = useSourceStore()
  const { tree, loadTree } = useNodeStore()

  const [coders, setCoders] = useState<Coder[]>([])
  const [coderLoading, setCoderLoading] = useState(false)
  const [newCoderName, setNewCoderName] = useState('')

  const [sourceId, setSourceId] = useState<number | null>(null)
  const [nodeId, setNodeId] = useState<number | null>(null)
  const [coderAId, setCoderAId] = useState<number | null>(null)
  const [coderBId, setCoderBId] = useState<number | null>(null)

  const [data, setData] = useState<ComparisonData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const flattenedNodes = useMemo(() => flattenTree(tree), [tree])

  const refreshCoders = async (projectId: number) => {
    setCoderLoading(true)
    try {
      const list = await window.api.coders.list(projectId) as Coder[]
      setCoders(list)
      return list
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      return []
    } finally {
      setCoderLoading(false)
    }
  }

  useEffect(() => {
    if (!selectedProjectId) return
    void loadSources(selectedProjectId)
    void loadTree(selectedProjectId)
    void refreshCoders(selectedProjectId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProjectId, loadSources, loadTree])

  useEffect(() => {
    if (sources.length > 0 && (sourceId == null || !sources.some((source) => source.id === sourceId))) {
      setSourceId(sources[0].id)
    }
    if (sources.length === 0) {
      setSourceId(null)
    }
  }, [sources, sourceId])

  useEffect(() => {
    if (flattenedNodes.length > 0 && (nodeId == null || !flattenedNodes.some((node) => node.id === nodeId))) {
      setNodeId(flattenedNodes[0].id)
    }
    if (flattenedNodes.length === 0) {
      setNodeId(null)
    }
  }, [flattenedNodes, nodeId])

  useEffect(() => {
    if (coders.length === 0) {
      setCoderAId(null)
      setCoderBId(null)
      return
    }
    if (coderAId == null || !coders.some((coder) => coder.id === coderAId)) {
      setCoderAId(coders[0].id)
    }
    if (coderBId == null || !coders.some((coder) => coder.id === coderBId)) {
      setCoderBId(coders.length > 1 ? coders[1].id : coders[0].id)
    }
  }, [coders, coderAId, coderBId])

  const handleAddCoder = async () => {
    const trimmedName = newCoderName.trim()
    if (!selectedProjectId || !trimmedName) return
    setError(null)
    try {
      await window.api.coders.create({ projectId: selectedProjectId, name: trimmedName })
      setNewCoderName('')
      await refreshCoders(selectedProjectId)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const handleCompare = async () => {
    if (!sourceId || !nodeId || !coderAId || !coderBId) return
    setLoading(true)
    setError(null)
    try {
      const response = await window.api.query.codingComparison({
        sourceId,
        coderAId,
        coderBId,
        nodeId,
      }) as ComparisonData
      setData(response)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

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

  const kappa = useMemo(() => {
    if (!data) return null
    const { bothCoded, onlyA, onlyB, neither } = data.contingency
    const total = bothCoded + onlyA + onlyB + neither
    if (total === 0) return null

    const observed = (bothCoded + neither) / total
    const pYesA = (bothCoded + onlyA) / total
    const pYesB = (bothCoded + onlyB) / total
    const pNoA = (onlyB + neither) / total
    const pNoB = (onlyA + neither) / total
    const expected = pYesA * pYesB + pNoA * pNoB
    if (expected === 1) return { value: 1, observed, expected }

    const value = (observed - expected) / (1 - expected)
    return { value, observed, expected }
  }, [data])

  const [kappaLabel, setKappaLabel] = useState<string | null>(null)

  useEffect(() => {
    if (kappa == null) {
      setKappaLabel(null)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const label = await window.api.query.interpretKappa(kappa.value) as string
        if (!cancelled) setKappaLabel(label)
      } catch {
        if (!cancelled) setKappaLabel(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [kappa])

  const coderName = (id: number | null) => coders.find((coder) => coder.id === id)?.name ?? ''

  return (
    <div className="panel">
      <h3>Coding comparison</h3>

      {!selectedProjectId ? <p className="description">Create or select a project to compare coders.</p> : null}
      {selectedProjectId && !sources.length ? <p className="description">Import a source before running a coding comparison.</p> : null}
      {selectedProjectId && sources.length > 0 && !flattenedNodes.length ? (
        <p className="description">Create a node in the Coding workspace before running a coding comparison.</p>
      ) : null}

      {selectedProjectId && sources.length > 0 && flattenedNodes.length > 0 ? (
        <>
          <div className="inline-form">
            <label className="field-label" style={{ flex: 1 }}>
              Source
              <select value={sourceId ?? ''} onChange={(event) => setSourceId(Number(event.target.value))}>
                {sources.map((source) => (
                  <option key={source.id} value={source.id}>{source.title}</option>
                ))}
              </select>
            </label>
            <label className="field-label" style={{ flex: 1 }}>
              Node
              <select value={nodeId ?? ''} onChange={(event) => setNodeId(Number(event.target.value))}>
                {flattenedNodes.map((node) => (
                  <option key={node.id} value={node.id}>{'—'.repeat(node.depth)} {node.name}</option>
                ))}
              </select>
            </label>
          </div>

          {coders.length < 2 ? (
            <p className="description">
              {coderLoading ? 'Loading coders…' : 'Add at least two coders below to compare their coding.'}
            </p>
          ) : (
            <div className="inline-form">
              <label className="field-label" style={{ flex: 1 }}>
                Coder A
                <select value={coderAId ?? ''} onChange={(event) => setCoderAId(Number(event.target.value))}>
                  {coders.map((coder) => (
                    <option key={coder.id} value={coder.id}>{coder.name}</option>
                  ))}
                </select>
              </label>
              <label className="field-label" style={{ flex: 1 }}>
                Coder B
                <select value={coderBId ?? ''} onChange={(event) => setCoderBId(Number(event.target.value))}>
                  {coders.map((coder) => (
                    <option key={coder.id} value={coder.id}>{coder.name}</option>
                  ))}
                </select>
              </label>
            </div>
          )}

          <div className="inline-form">
            <label className="field-label" style={{ flex: 1 }}>
              Add coder
              <input
                value={newCoderName}
                onChange={(event) => setNewCoderName(event.target.value)}
                placeholder="Coder name"
              />
            </label>
            <button type="button" className="ghost-button" onClick={handleAddCoder} disabled={!newCoderName.trim()}>
              Add
            </button>
          </div>

          <button
            type="button"
            onClick={handleCompare}
            disabled={loading || !sourceId || !nodeId || !coderAId || !coderBId || coderAId === coderBId}
          >
            {loading ? 'Comparing…' : 'Run comparison'}
          </button>
          {coderAId != null && coderBId != null && coderAId === coderBId ? (
            <p className="error-text">Choose two different coders to compare.</p>
          ) : null}
        </>
      ) : null}

      {error ? <p className="error-text">{error}</p> : null}

      {summary ? (
        <div className="sheet-table-wrap">
          <p className="description">
            Comparing {coderName(coderAId)} and {coderName(coderBId)} on &quot;{flattenedNodes.find((node) => node.id === data?.nodeId)?.name ?? ''}&quot;.
          </p>
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
          {kappa ? (
            <p className="description">
              Cohen&apos;s kappa &asymp; {kappa.value.toFixed(2)}{kappaLabel ? ` (${kappaLabel})` : ''} &mdash; observed agreement {(kappa.observed * 100).toFixed(0)}%, expected by chance {(kappa.expected * 100).toFixed(0)}%.
            </p>
          ) : null}
        </div>
      ) : !loading ? <p className="description">Select a source, node, and two coders, then run the comparison.</p> : null}
    </div>
  )
}
