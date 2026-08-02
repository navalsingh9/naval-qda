import { useEffect, useMemo, useState } from 'react'
import { useProjectStore } from '../stores/useProjectStore'
import { useNodeStore, type NodeTreeItem } from '../stores/useNodeStore'

type CodingReportRow = {
  id: number
  sourceId: number
  sourceTitle: string
  startOffset: number
  endOffset: number
}

type CodingReportData = {
  nodeId: number
  nodeName: string
  codings: CodingReportRow[]
}

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

export function CodingReportPanel() {
  const { selectedProjectId } = useProjectStore()
  const { tree, loadTree } = useNodeStore()
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null)
  const [report, setReport] = useState<CodingReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (selectedProjectId) {
      void loadTree(selectedProjectId)
    }
  }, [selectedProjectId, loadTree])

  const flattened = useMemo(() => flattenTree(tree), [tree])

  useEffect(() => {
    if (flattened.length > 0 && (selectedNodeId == null || !flattened.some((node) => node.id === selectedNodeId))) {
      setSelectedNodeId(flattened[0].id)
    }
    if (flattened.length === 0) {
      setSelectedNodeId(null)
    }
  }, [flattened, selectedNodeId])

  const handleGenerate = async () => {
    if (!selectedNodeId) return
    setLoading(true)
    setError(null)
    try {
      const data = await window.api.report.coding(selectedNodeId) as CodingReportData
      setReport(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="panel">
      <h3>Coding report</h3>
      {!selectedProjectId ? (
        <p className="description">Create or select a project to generate a coding report.</p>
      ) : !flattened.length ? (
        <p className="description">Create nodes in the Coding workspace first, then generate a report here.</p>
      ) : (
        <>
          <div className="inline-form">
            <label className="field-label" style={{ flex: 1 }}>
              Node
              <select value={selectedNodeId ?? ''} onChange={(event) => setSelectedNodeId(Number(event.target.value))}>
                {flattened.map((node) => (
                  <option key={node.id} value={node.id}>
                    {'—'.repeat(node.depth)} {node.name}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" onClick={handleGenerate} disabled={!selectedNodeId || loading}>
              {loading ? 'Generating…' : 'Generate report'}
            </button>
          </div>

          {error ? <p className="error-text">{error}</p> : null}

          {report ? (
            <div className="sheet-table-wrap">
              <p className="description">
                {report.codings.length} coded excerpt{report.codings.length === 1 ? '' : 's'} under &quot;{report.nodeName}&quot;.
              </p>
              <table className="sheet-table">
                <thead>
                  <tr>
                    <th>Source</th>
                    <th>Start offset</th>
                    <th>End offset</th>
                  </tr>
                </thead>
                <tbody>
                  {report.codings.map((coding) => (
                    <tr key={coding.id}>
                      <td>{coding.sourceTitle}</td>
                      <td>{coding.startOffset}</td>
                      <td>{coding.endOffset}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : !loading ? (
            <p className="description">Select a node and generate a report to list every coded excerpt under it.</p>
          ) : null}
        </>
      )}
    </div>
  )
}
