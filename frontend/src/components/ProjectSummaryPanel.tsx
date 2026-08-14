import { useState } from 'react'
import { Download } from 'lucide-react'
import { useProjectStore } from '../stores/useProjectStore'
import { buildApa7TableDocx, downloadBlob } from '../utils/apa7Export'

type SummaryNode = {
  id: number
  name: string
  codingCount: number
  children: SummaryNode[]
}

type ClassificationSheet = {
  attributes: Array<{ id: number; name: string; valueType: string }>
  cases: Array<{ id: number; name: string; values: Record<string, string | null> }>
}

type ProjectSummaryData = {
  projectId: number
  projectName: string
  sourceCount: number
  nodeTree: SummaryNode[]
  coders: Array<{ id: number; name: string }>
  classificationSheet: ClassificationSheet
}

function flattenNodes(nodes: SummaryNode[], depth = 0): Array<{ id: number; name: string; depth: number; codingCount: number }> {
  const rows: Array<{ id: number; name: string; depth: number; codingCount: number }> = []
  for (const node of nodes) {
    rows.push({ id: node.id, name: node.name, depth, codingCount: node.codingCount })
    if (node.children?.length) {
      rows.push(...flattenNodes(node.children, depth + 1))
    }
  }
  return rows
}

export function ProjectSummaryPanel() {
  const { selectedProjectId } = useProjectStore()
  const [summary, setSummary] = useState<ProjectSummaryData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleGenerate = async () => {
    if (!selectedProjectId) return
    setLoading(true)
    setError(null)
    try {
      const data = await window.api.report.projectSummary(selectedProjectId) as ProjectSummaryData
      setSummary(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  const flattenedNodes = summary ? flattenNodes(summary.nodeTree) : []

  const handleExportNodeTree = async () => {
    if (!summary) return
    const blob = await buildApa7TableDocx({
      tableNumber: 1,
      title: `Node Tree and Coding Counts for ${summary.projectName}`,
      columns: ['Node', 'Coding Count'],
      rows: flattenedNodes.map((node) => [`${'    '.repeat(node.depth)}${node.name}`, String(node.codingCount)]),
      note: `Indentation reflects node hierarchy (child nodes are indented under their parent). Coding count reflects only that node, not its children.`,
    })
    downloadBlob(blob, `node-tree-${summary.projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.docx`)
  }

  const handleExportClassificationSheet = async () => {
    if (!summary || !summary.classificationSheet.cases.length) return
    const columns = ['Case', ...summary.classificationSheet.attributes.map((a) => a.name)]
    const rows = summary.classificationSheet.cases.map((caseItem) => [
      caseItem.name,
      ...summary.classificationSheet.attributes.map((attribute) => caseItem.values[attribute.name] ?? ''),
    ])
    const blob = await buildApa7TableDocx({
      tableNumber: 1,
      title: `Case Classification Sheet for ${summary.projectName}`,
      columns,
      rows,
    })
    downloadBlob(blob, `classification-sheet-${summary.projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.docx`)
  }

  return (
    <div className="panel">
      <div className="page-header">
        <h3>Project summary</h3>
        <button type="button" onClick={handleGenerate} disabled={!selectedProjectId || loading}>
          {loading ? 'Generating…' : 'Generate summary'}
        </button>
      </div>

      {error ? <p className="error-text">{error}</p> : null}
      {!selectedProjectId ? <p className="description">Create or select a project to generate a summary.</p> : null}

      {summary ? (
        <>
          <ul className="list">
            <li>
              <strong>{summary.projectName}</strong>
              <span>
                {summary.sourceCount} source{summary.sourceCount === 1 ? '' : 's'} · {summary.coders.length} coder{summary.coders.length === 1 ? '' : 's'}
              </span>
            </li>
          </ul>

          <h3 style={{ marginTop: '1rem' }}>Node tree</h3>
          {flattenedNodes.length ? (
            <>
              <ul className="list">
                {flattenedNodes.map((node) => (
                  <li key={node.id}>
                    <strong>{'—'.repeat(node.depth)} {node.name}</strong>
                    <span>coding count: {node.codingCount}</span>
                  </li>
                ))}
              </ul>
              <button type="button" className="ghost-button" onClick={() => void handleExportNodeTree()}>
                <Download size={14} strokeWidth={2} style={{ marginRight: '6px', verticalAlign: '-2px' }} />
                Export as APA 7 table (.docx)
              </button>
            </>
          ) : (
            <p className="description">No nodes yet.</p>
          )}

          <h3 style={{ marginTop: '1rem' }}>Coders</h3>
          {summary.coders.length ? (
            <ul className="list">
              {summary.coders.map((coder) => (
                <li key={coder.id}>
                  <strong>{coder.name}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p className="description">No coders recorded yet.</p>
          )}

          <h3 style={{ marginTop: '1rem' }}>Classification sheet</h3>
          {summary.classificationSheet.cases?.length ? (
            <div className="sheet-table-wrap">
              <table className="sheet-table">
                <thead>
                  <tr>
                    <th>Case</th>
                    {summary.classificationSheet.attributes.map((attribute) => (
                      <th key={attribute.id}>{attribute.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {summary.classificationSheet.cases.map((caseItem) => (
                    <tr key={caseItem.id}>
                      <td>{caseItem.name}</td>
                      {summary.classificationSheet.attributes.map((attribute) => (
                        <td key={attribute.id}>{caseItem.values[attribute.name] ?? ''}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <button type="button" className="ghost-button" style={{ marginTop: 'var(--space-3)' }} onClick={() => void handleExportClassificationSheet()}>
                <Download size={14} strokeWidth={2} style={{ marginRight: '6px', verticalAlign: '-2px' }} />
                Export as APA 7 table (.docx)
              </button>
            </div>
          ) : (
            <p className="description">No cases in the classification sheet yet.</p>
          )}
        </>
      ) : !loading ? (
        <p className="description">Generate a summary to see the source count, full node tree, coder list, and classification sheet.</p>
      ) : null}
    </div>
  )
}
