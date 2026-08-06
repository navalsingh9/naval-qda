import { useEffect, useState } from 'react'
import { useProjectStore } from '../stores/useProjectStore'

type FrameworkColumn = {
  nodeId: number
  excerptCount: number
  excerpts: Array<{ codingId: number; sourceId: number; sourceTitle: string; text: string }>
  summary: string
  summaryUpdatedAt: string | null
}
type FrameworkRow = { caseId: number; caseName: string; columns: FrameworkColumn[] }
type FrameworkMatrix = {
  rowLabels: Array<{ id: number; name: string }>
  columnLabels: Array<{ id: number; name: string }>
  rows: FrameworkRow[]
}

// NVivo's Framework Matrix: a case x node grid for writing a synthesized
// summary per cell, backed by the raw coded excerpts as evidence. The
// classification sheet already covers case attributes read-only; this is
// the editable analytic layer on top of coding.
export function FrameworkMatrixPanel() {
  const { selectedProjectId } = useProjectStore()
  const [matrix, setMatrix] = useState<FrameworkMatrix | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [openCell, setOpenCell] = useState<{ caseId: number; nodeId: number } | null>(null)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)

  const load = async (projectId: number) => {
    setLoading(true)
    setError(null)
    try {
      const data = await window.api.framework.getMatrix({ projectId })
      setMatrix(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (selectedProjectId) void load(selectedProjectId)
  }, [selectedProjectId])

  const openEditor = (caseId: number, nodeId: number, currentSummary: string) => {
    setOpenCell({ caseId, nodeId })
    setDraft(currentSummary)
  }

  const closeEditor = () => {
    setOpenCell(null)
    setDraft('')
  }

  const saveSummary = async () => {
    if (!openCell || !selectedProjectId) return
    setSaving(true)
    setError(null)
    try {
      await window.api.framework.setSummary({ caseId: openCell.caseId, nodeId: openCell.nodeId, summary: draft })
      closeEditor()
      await load(selectedProjectId)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  const openColumn = matrix && openCell ? matrix.columnLabels.find((c) => c.id === openCell.nodeId) : null
  const openRow = matrix && openCell ? matrix.rows.find((r) => r.caseId === openCell.caseId) : null
  const openCellData = openRow && openCell ? openRow.columns.find((c) => c.nodeId === openCell.nodeId) : null

  return (
    <div className="panel">
      <h3>Framework matrix</h3>
      <p className="description">
        One row per case, one column per node. Each cell shows how many excerpts that case has for that node — click a cell to read the excerpts and write a summary.
      </p>
      {loading ? <p className="description">Loading…</p> : null}
      {error ? <p className="error-text">{error}</p> : null}

      {matrix && matrix.rowLabels.length > 0 && matrix.columnLabels.length > 0 ? (
        <div className="sheet-table-wrap">
          <table className="sheet-table framework-table">
            <thead>
              <tr>
                <th>Case</th>
                {matrix.columnLabels.map((col) => <th key={col.id}>{col.name}</th>)}
              </tr>
            </thead>
            <tbody>
              {matrix.rows.map((row) => (
                <tr key={row.caseId}>
                  <td>{row.caseName}</td>
                  {row.columns.map((cell) => (
                    <td key={cell.nodeId}>
                      <button
                        type="button"
                        className={`framework-cell${cell.summary ? ' framework-cell-filled' : ''}`}
                        onClick={() => openEditor(row.caseId, cell.nodeId, cell.summary)}
                      >
                        <span className="framework-cell-count">{cell.excerptCount} excerpt{cell.excerptCount === 1 ? '' : 's'}</span>
                        {cell.summary ? <span className="framework-cell-summary">{cell.summary}</span> : null}
                      </button>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : !loading ? (
        <p className="description">Add at least one case and one node, then link sources to cases and code them, to build the framework matrix.</p>
      ) : null}

      {openCell && openRow && openColumn ? (
        <div className="framework-editor-backdrop" onClick={closeEditor}>
          <div className="framework-editor" onClick={(event) => event.stopPropagation()}>
            <div className="page-header">
              <h4>{openRow.caseName} &times; {openColumn.name}</h4>
              <button type="button" className="ghost-button" onClick={closeEditor}>Close</button>
            </div>

            <div className="framework-excerpts">
              {openCellData?.excerpts.length ? (
                <ul className="list">
                  {openCellData.excerpts.map((excerpt) => (
                    <li key={excerpt.codingId}>
                      <span className="source-path">{excerpt.sourceTitle}</span>
                      <span>{excerpt.text}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="description">No coded excerpts for this case &amp; node yet.</p>
              )}
            </div>

            <label className="field-label">
              Summary
              <textarea
                className="framework-summary-input"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Synthesize what this case says about this node…"
                rows={5}
              />
            </label>
            <button type="button" onClick={() => void saveSummary()} disabled={saving}>
              {saving ? 'Saving…' : 'Save summary'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
