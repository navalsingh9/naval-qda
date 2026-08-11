import { useEffect, useMemo, useState } from 'react'
import { useProjectStore } from '../stores/useProjectStore'
import { BarChart, PieChart, colorFor, CHART_COLORS, type BarDatum } from './charts/Charts'

type NodeChartRow = { nodeId: number; name: string; path: string; references: number; sources: number }
type AttributeChartData = { attributeName: string; rowLabels: string[]; columnLabels: string[]; cells: number[][] }
type Attribute = { id: number; projectId: number; name: string; valueType: string }
type ChartKind = 'bar' | 'pie'
type Measure = 'references' | 'sources'

// NVivo's "Charts" view off the node list (coding references / sources
// coded per node) plus a coding-by-attribute crosstab chart — the two
// most commonly used chart types that weren't covered by the raw tables
// on the Query page.
export function CodingChartsPanel() {
  const { selectedProjectId } = useProjectStore()
  const [nodeRows, setNodeRows] = useState<NodeChartRow[]>([])
  const [measure, setMeasure] = useState<Measure>('references')
  const [chartKind, setChartKind] = useState<ChartKind>('bar')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [attributes, setAttributes] = useState<Attribute[]>([])
  const [attributeId, setAttributeId] = useState<number | null>(null)
  const [attributeData, setAttributeData] = useState<AttributeChartData | null>(null)
  const [attributeLoading, setAttributeLoading] = useState(false)
  const [attributeError, setAttributeError] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedProjectId) return
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const rows = await window.api.visualize.codingByNodeChart({ projectId: selectedProjectId }) as NodeChartRow[]
        setNodeRows(rows)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [selectedProjectId])

  useEffect(() => {
    if (!selectedProjectId) return
    window.api.cases.listAttributes(selectedProjectId)
      .then((list) => {
        const typed = list as Attribute[]
        setAttributes(typed)
        setAttributeId((current) => (current != null && typed.some((a) => a.id === current) ? current : typed[0]?.id ?? null))
      })
      .catch((err) => setAttributeError(err instanceof Error ? err.message : String(err)))
  }, [selectedProjectId])

  useEffect(() => {
    if (!selectedProjectId || attributeId == null) {
      setAttributeData(null)
      return
    }
    setAttributeLoading(true)
    setAttributeError(null)
    window.api.visualize.codingByAttributeChart({ projectId: selectedProjectId, attributeId })
      .then((data) => setAttributeData(data as AttributeChartData))
      .catch((err) => setAttributeError(err instanceof Error ? err.message : String(err)))
      .finally(() => setAttributeLoading(false))
  }, [selectedProjectId, attributeId])

  const barData: BarDatum[] = useMemo(
    () => nodeRows
      .map((row, i) => ({ label: row.path, value: row[measure], color: colorFor(i) }))
      .filter((row) => row.value > 0)
      .sort((a, b) => b.value - a.value),
    [nodeRows, measure],
  )

  // Per-attribute-value totals across all nodes, for the crosstab pie —
  // "how much coding falls under each Role", say.
  const attributeTotals: BarDatum[] = useMemo(() => {
    if (!attributeData) return []
    return attributeData.columnLabels.map((label, columnIndex) => ({
      label,
      value: attributeData.cells.reduce((sum, row) => sum + row[columnIndex], 0),
      color: colorFor(columnIndex),
    })).filter((d) => d.value > 0)
  }, [attributeData])

  return (
    <div className="panel">
      <div className="page-header">
        <div>
          <h3>Coding charts</h3>
        </div>
        <div className="chart-controls">
          <select value={measure} onChange={(event) => setMeasure(event.target.value as Measure)}>
            <option value="references">References</option>
            <option value="sources">Sources coded</option>
          </select>
          <select value={chartKind} onChange={(event) => setChartKind(event.target.value as ChartKind)}>
            <option value="bar">Bar</option>
            <option value="pie">Pie</option>
          </select>
        </div>
      </div>
      <p className="description">Coding {measure === 'references' ? 'references' : 'distinct sources coded'} per node.</p>
      {loading ? <p className="description">Loading…</p> : null}
      {error ? <p className="error-text">{error}</p> : null}
      <div className="chart-card" style={{ minHeight: '300px', background: 'var(--bg-secondary)' }}>
        {barData.length ? (
          chartKind === 'bar' ? <BarChart data={barData} colors={CHART_COLORS} /> : <PieChart data={barData} donut={true} colors={CHART_COLORS} />
        ) : !loading ? (
          <p className="description">No coded text yet — code some sources to see coding charts.</p>
        ) : null}
      </div>

      {/* Coding by attribute - separate section */}
      <div className="node-ai-suggest" style={{ marginTop: 'var(--space-6)' }}>
        <div className="page-header">
          <h4>Coding by attribute</h4>
        </div>
        {!attributes.length ? (
          <p className="description">Add a case attribute (in Sources → Cases) to break coding down by it, e.g. by Role or Team size.</p>
        ) : (
          <>
            <div className="inline-form">
              <label className="field-label" style={{ flex: 1 }}>
                Attribute
                <select value={attributeId ?? ''} onChange={(event) => setAttributeId(Number(event.target.value))}>
                  {attributes.map((attribute) => (
                    <option key={attribute.id} value={attribute.id}>{attribute.name}</option>
                  ))}
                </select>
              </label>
            </div>
            {attributeLoading ? <p className="description">Loading…</p> : null}
            {attributeError ? <p className="error-text">{attributeError}</p> : null}
            {attributeTotals.length ? (
              <div className="chart-card">
                <PieChart data={attributeTotals} donut={false} colors={CHART_COLORS} />
              </div>
            ) : !attributeLoading ? (
              <p className="description">No coded sources have a case with this attribute set yet.</p>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}
