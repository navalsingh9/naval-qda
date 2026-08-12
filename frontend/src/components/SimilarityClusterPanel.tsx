import { useMemo, useState } from 'react'
import { useProjectStore } from '../stores/useProjectStore'
import { useSourceStore } from '../stores/useSourceStore'
import { useNodeStore, type NodeTreeItem } from '../stores/useNodeStore'
import { Dendrogram, type DendroNode, CHART_COLORS } from './charts/Charts'

type ClusterResult = {
  clusters: Array<{ id: number; children: unknown[] }>
  linkage: number[][]
  tree: DendroNode | null
}

function flattenNodeNames(nodes: NodeTreeItem[]): Map<number, string> {
  const map = new Map<number, string>()
  const walk = (list: NodeTreeItem[]) => {
    for (const node of list) {
      map.set(node.id, node.name)
      if (node.children.length) walk(node.children)
    }
  }
  walk(nodes)
  return map
}

function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[a-z]{4,}/g) || []
}

export function SimilarityClusterPanel() {
  const { selectedProjectId } = useProjectStore()
  const { sources } = useSourceStore()
  const { tree } = useNodeStore()
  const [mode, setMode] = useState<'word' | 'coding'>('word')
  const [result, setResult] = useState<ClusterResult | null>(null)
  const [labels, setLabels] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const runClustering = async () => {
    if (!selectedProjectId || sources.length === 0) return
    setLoading(true)
    setError(null)
    try {
      if (mode === 'word') {
        const items = await Promise.all(
          sources.map(async (source) => {
            const detail = await window.api.getSource(source.id) as { content: string }
            return { id: source.id, terms: tokenize(detail.content || '') }
          })
        )
        const data = await window.api.visualize.clusterByWordSimilarity({ items, mode: 'tf' }) as ClusterResult
        setResult(data)
        setLabels(sources.map((source) => source.title))
      } else {
        const nodeNames = flattenNodeNames(tree)
        const items = await Promise.all(
          sources.map(async (source) => {
            const codings = await window.api.coding.getCodingsForSource(source.id) as Array<{ node_id: number }>
            const terms = codings.map((coding) => nodeNames.get(coding.node_id) ?? `node-${coding.node_id}`)
            return { id: source.id, terms }
          })
        )
        const data = await window.api.visualize.clusterByCodingSimilarity({ items, mode: 'presence' }) as ClusterResult
        setResult(data)
        setLabels(sources.map((source) => source.title))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  const maxDistance = useMemo(() => {
    if (!result?.linkage?.length) return 0
    return Math.max(...result.linkage.flat())
  }, [result])

  // The backend labels dendrogram leaves by array position (see
  // hierarchicalCluster) since it has no idea what a "source title" is —
  // swap in the real titles here for display.
  const displayTree = useMemo((): DendroNode | null => {
    if (!result?.tree) return null
    const relabel = (node: DendroNode): DendroNode =>
      node.type === 'leaf' ? { ...node, label: labels[node.id] ?? node.label } : { ...node, left: relabel(node.left), right: relabel(node.right) }
    return relabel(result.tree)
  }, [result, labels])

  return (
    <div className="panel">
      <div className="page-header">
        <div>
          <h3>Similarity clustering</h3>
        </div>
      </div>
      <p className="description">Compare your sources based on word usage or coding patterns to discover relationships.</p>
      <div className="inline-form">
        <label className="field-label" style={{ flex: 1 }}>
          Compare by
          <select value={mode} onChange={(event) => setMode(event.target.value as 'word' | 'coding')}>
            <option value="word">Word usage</option>
            <option value="coding">Coding pattern</option>
          </select>
        </label>
        <button type="button" onClick={runClustering} disabled={loading || !selectedProjectId || sources.length === 0}>
          {loading ? 'Clustering…' : 'Run clustering'}
        </button>
      </div>

      {error ? <p className="error-text">{error}</p> : null}
      {!sources.length ? <p className="description">Import sources to compare similarity between them.</p> : null}

      {result?.linkage?.length ? (
        <div className="sheet-table-wrap" style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-lg)' }}>
          {displayTree ? (
            <div className="chart-card" style={{ marginBottom: 'var(--space-4)', background: 'var(--bg-secondary)', width: '100%' }}>
              <Dendrogram tree={displayTree} width="100%" colors={CHART_COLORS} />
            </div>
          ) : null}
          <table className="sheet-table">
            <thead>
              <tr>
                <th>Source</th>
                {labels.map((label) => (
                  <th key={label}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {labels.map((label, rowIndex) => (
                <tr key={label}>
                  <td>{label}</td>
                  {result.linkage[rowIndex].map((distance, columnIndex) => {
                    const similarity = 1 - distance
                    const opacity = maxDistance > 0 ? 1 - distance / maxDistance : rowIndex === columnIndex ? 1 : 0
                    return (
                      <td
                        key={`${label}-${labels[columnIndex]}`}
                        style={{ backgroundColor: `rgba(18, 100, 163, ${0.08 + Math.max(0, opacity) * 0.75})` }}
                      >
                        {similarity.toFixed(2)}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="description">
            Cells show similarity (1 − distance) between each pair of sources by {mode === 'word' ? 'shared vocabulary' : 'shared coding pattern'}; darker means more similar.
          </p>
          <details className="similarity-math">
            <summary>How is this number calculated?</summary>
            <div className="similarity-math-body">
              <p>
                Each source is turned into a vector over a shared vocabulary — for <strong>Word usage</strong> mode,
                one slot per distinct word that appears in any source; for <strong>Coding pattern</strong> mode, one
                slot per node, counting how often each source was coded to it.
              </p>
              <p>
                The distance between two sources is the <strong>Jaccard distance</strong>: for every vocabulary slot,
                count it as shared if BOTH sources have a non-zero value there. Then:
              </p>
              <pre className="similarity-formula">distance = 1 − (slots present in both) / (slots present in either)</pre>
              <p>
                The table shows <strong>similarity = 1 − distance</strong>, so 1.00 means the two sources share every
                vocabulary slot either of them uses, and 0.00 means they share none. The diagonal is always 1.00
                because every source is identical to itself. This measures <em>overlap in which terms/nodes are used
                at all</em> — it does not weigh how often, so two sources that each use very different vocabulary
                will always score low even if both are long and detailed.
              </p>
            </div>
          </details>
        </div>
      ) : !loading ? (
        <p className="description">Run clustering to compare sources by shared vocabulary or coding pattern.</p>
      ) : null}
    </div>
  )
}
