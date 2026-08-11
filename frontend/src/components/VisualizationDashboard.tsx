import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { useProjectStore } from '../stores/useProjectStore'
import { useSourceStore } from '../stores/useSourceStore'
import { useNodeStore } from '../stores/useNodeStore'
import { BarChart, PieChart, Treemap, Dendrogram, colorFor, type BarDatum, type TreemapNode, type DendroNode } from './charts/Charts'

// Chart component types
type ChartComponentType = 
  | { type: 'bar'; data: BarDatum[]; title: string; description: string; source: 'coding' }
  | { type: 'pie'; data: BarDatum[]; title: string; description: string; donut?: boolean; source: 'coding' }
  | { type: 'treemap'; data: TreemapNode[]; title: string; description: string; source: 'hierarchy' }
  | { type: 'dendrogram'; tree: DendroNode | null; labels: string[]; title: string; description: string; source: 'similarity' }
  | { type: 'wordcloud'; words: {word: string; weight: number}[]; title: string; description: string; source: 'wordcloud' }

type ChartInstance = {
  id: string
  componentType: ChartComponentType
  isOpen: boolean
  // For charts that support multiple views (bar/pie/table)
  chartKind?: 'bar' | 'pie' | 'table'
}

// Layout presets
type LayoutPreset = {
  id: string
  name: string
  rows: number
  cols: number
  chartPositions: { row: number; col: number; spanRow?: number; spanCol?: number }[]
}

const LAYOUT_PRESETS: LayoutPreset[] = [
  { id: '1x1', name: 'Single', rows: 1, cols: 1, chartPositions: [{ row: 0, col: 0 }] },
  { id: '1x2', name: 'Two Horizontal', rows: 1, cols: 2, chartPositions: [{ row: 0, col: 0 }, { row: 0, col: 1 }] },
  { id: '2x1', name: 'Two Vertical', rows: 2, cols: 1, chartPositions: [{ row: 0, col: 0 }, { row: 1, col: 0 }] },
  { id: '2x2', name: 'Grid 2x2', rows: 2, cols: 2, chartPositions: [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 1, col: 0 }, { row: 1, col: 1 }] },
  { id: '2x3', name: 'Grid 2x3', rows: 2, cols: 3, chartPositions: [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }, { row: 1, col: 0 }, { row: 1, col: 1 }, { row: 1, col: 2 }] },
  { id: '1x4', name: 'Four Horizontal', rows: 1, cols: 4, chartPositions: [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }, { row: 0, col: 3 }] },
  { id: '4x1', name: 'Four Vertical', rows: 4, cols: 1, chartPositions: [{ row: 0, col: 0 }, { row: 1, col: 0 }, { row: 2, col: 0 }, { row: 3, col: 0 }] },
]

export function VisualizationDashboard() {
  const { selectedProjectId } = useProjectStore()
  const { sources, loadSources } = useSourceStore()
  const { tree, loadTree } = useNodeStore()
  
  // Layout state
  const [selectedLayout, setSelectedLayout] = useState<string>('2x2')
  
  // Chart instances state
  const [charts, setCharts] = useState<ChartInstance[]>([])
  
  // Filter state
  const [globalFilter, setGlobalFilter] = useState<string | null>(null)
  
  // Data loading states
  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  
  // Refs for export
  const dashboardRef = useRef<HTMLDivElement>(null)
  
  // Load data on project change
  useEffect(() => {
    if (selectedProjectId) {
      loadTree(selectedProjectId)
      loadSources(selectedProjectId)
      loadDefaultCharts()
    }
  }, [selectedProjectId, loadTree, loadSources])

  // Generate unique chart ID
  const generateChartId = useCallback(() => {
    return `chart-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }, [])

  // Get layout preset
  const getLayoutPreset = useCallback((id: string): LayoutPreset => {
    return LAYOUT_PRESETS.find(p => p.id === id) || LAYOUT_PRESETS[3]
  }, [])

  // Get current layout
  const currentLayout = getLayoutPreset(selectedLayout)

  // Reload all chart data
  const refreshAllData = useCallback(() => {
    charts.forEach(chart => {
      loadChartData(chart)
    })
  }, [charts])

  // Load default charts (2x2 grid with 4 charts)
  const loadDefaultCharts = useCallback(() => {
    if (!selectedProjectId) return
    
    setLoading(prev => ({ ...prev, init: true }))
    
    const newCharts: ChartInstance[] = [
      {
        id: generateChartId(),
        componentType: {
          type: 'bar',
          data: [],
          title: 'Coding References',
          description: 'References per node',
          source: 'coding'
        },
        isOpen: true,
        chartKind: 'bar'
      },
      {
        id: generateChartId(),
        componentType: {
          type: 'pie',
          data: [],
          title: 'Code Distribution',
          description: 'Distribution by sources',
          donut: true,
          source: 'coding'
        },
        isOpen: true,
        chartKind: 'pie'
      },
      {
        id: generateChartId(),
        componentType: {
          type: 'wordcloud',
          words: [],
          title: 'Word Cloud',
          description: 'Most frequent words in sources',
          source: 'wordcloud'
        },
        isOpen: true
      },
      {
        id: generateChartId(),
        componentType: {
          type: 'treemap',
          data: [],
          title: 'Hierarchy Treemap',
          description: 'Node hierarchy visualization',
          source: 'hierarchy'
        },
        isOpen: true
      }
    ]
    setCharts(newCharts)
    
    // Load data for each chart
    newCharts.forEach(chart => {
      loadChartData(chart)
    })
    
    setLoading(prev => ({ ...prev, init: false }))
  }, [selectedProjectId, generateChartId])

  // Load chart data from API
  const loadChartData = useCallback(async (chart: ChartInstance) => {
    if (!selectedProjectId) return
    
    setLoading(prev => ({ ...prev, [chart.id]: true }))
    setErrors(prev => ({ ...prev, [chart.id]: '' }))
    
    try {
      const { componentType } = chart
      
      if (componentType.source === 'coding') {
        const data = await window.api.visualize.codingByNodeChart({ projectId: selectedProjectId }) as Array<{
          nodeId: number; name: string; path: string; references: number; sources: number
        }>
        
        if (componentType.type === 'bar') {
          const barData: BarDatum[] = data
            .map((row, i) => ({ 
              label: row.path || row.name, 
              value: row.references,
              color: colorFor(i) 
            }))
            .filter((row) => row.value > 0)
            .sort((a, b) => b.value - a.value)
          
          setCharts(prev => prev.map(c => 
            c.id === chart.id ? { ...c, componentType: { ...c.componentType, data: barData } } : c
          ))
        } else if (componentType.type === 'pie') {
          const pieData: BarDatum[] = data
            .map((row, i) => ({ 
              label: row.path || row.name, 
              value: row.references,
              color: colorFor(i) 
            }))
            .filter((row) => row.value > 0)
          
          setCharts(prev => prev.map(c => 
            c.id === chart.id ? { ...c, componentType: { ...c.componentType, data: pieData } } : c
          ))
        }
      } 
      
      else if (componentType.source === 'hierarchy') {
        const data = await window.api.visualize.hierarchyChartData({ projectId: selectedProjectId }) as TreemapNode[]
        
        setCharts(prev => prev.map(c => 
          c.id === chart.id ? { ...c, componentType: { ...c.componentType, data } } : c
        ))
      }
      
      else if (componentType.source === 'wordcloud') {
        const sourceIds = sources.map(s => s.id)
        const data = await window.api.visualize.wordCloudData({
          projectId: selectedProjectId,
          sourceIds,
          minLength: 4,
          topN: 80
        }) as { word: string; weight: number }[]
        
        setCharts(prev => prev.map(c => 
          c.id === chart.id ? { ...c, componentType: { ...c.componentType, words: data } } : c
        ))
      }
      
    } catch (err) {
      setErrors(prev => ({ ...prev, [chart.id]: err instanceof Error ? err.message : String(err) }))
    } finally {
      setLoading(prev => ({ ...prev, [chart.id]: false }))
    }
  }, [selectedProjectId, sources])

  // Create a new chart instance
  const addChart = useCallback(async (chartType: ChartComponentType, chartKind?: 'bar' | 'pie' | 'table') => {
    const newChart: ChartInstance = {
      id: generateChartId(),
      componentType: chartType,
      isOpen: true,
      chartKind
    }
    setCharts(prev => [...prev, newChart])
    await loadChartData(newChart)
    return newChart.id
  }, [generateChartId, loadChartData])

  // Close a chart
  const closeChart = useCallback((chartId: string) => {
    setCharts(prev => prev.map(c => c.id === chartId ? { ...c, isOpen: false } : c))
  }, [])

  // Restore a closed chart
  const restoreChart = useCallback((chartId: string) => {
    setCharts(prev => prev.map(c => c.id === chartId ? { ...c, isOpen: true } : c))
    const chart = charts.find(c => c.id === chartId)
    if (chart) {
      loadChartData(chart)
    }
  }, [charts, loadChartData])

  // Change chart kind (bar/pie/table)
  const changeChartKind = useCallback((chartId: string, newKind: 'bar' | 'pie' | 'table') => {
    setCharts(prev => prev.map(c => c.id === chartId ? { ...c, chartKind: newKind } : c))
  }, [])

  // Apply filter
  const applyFilter = useCallback((filterValue: string | null) => {
    setGlobalFilter(filterValue)
  }, [])

  // Clear filter
  const clearFilter = useCallback(() => {
    setGlobalFilter(null)
  }, [])

  // Export chart data as CSV
  const exportChartDataAsCSV = useCallback((chartId: string) => {
    const chart = charts.find(c => c.id === chartId)
    if (!chart) return
    
    let csvContent = ''
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    
    if (chart.componentType.type === 'bar' || chart.componentType.type === 'pie') {
      csvContent = 'Label,Value\n' +
        chart.componentType.data.map(d => `${d.label.replace(/,/g, ';')},${d.value}`).join('\n')
    } else if (chart.componentType.type === 'wordcloud') {
      csvContent = 'Word,Weight\n' +
        chart.componentType.words.map(w => `${w.word.replace(/,/g, ';')},${w.weight}`).join('\n')
    } else if (chart.componentType.type === 'treemap') {
      const flattenData = (nodes: TreemapNode[]): {name: string; value: number; path: string}[] => {
        const result: {name: string; value: number; path: string}[] = []
        const walk = (node: TreemapNode, currentPath: string = '') => {
          const path = currentPath ? `${currentPath} > ${node.name}` : node.name
          result.push({ name: node.name, value: node.value, path })
          node.children?.forEach(child => walk(child, path))
        }
        nodes.forEach(walk)
        return result
      }
      const flatData = flattenData(chart.componentType.data)
      csvContent = 'Name,Value,Path\n' +
        flatData.map(d => `${d.name.replace(/,/g, ';')},${d.value},"${d.path.replace(/>/g, ' > ')}"`).join('\n')
    }
    
    if (csvContent) {
      const filename = `${chart.componentType.title.toLowerCase().replace(/\s+/g, '-')}-${timestamp}.csv`
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      link.click()
      URL.revokeObjectURL(url)
    }
  }, [charts])

  // Chart creation functions
  const createBarChart = useCallback(async () => {
    await addChart({
      type: 'bar',
      data: [],
      title: 'Coding References',
      description: 'References per node',
      source: 'coding'
    }, 'bar')
  }, [addChart])

  const createPieChart = useCallback(async () => {
    await addChart({
      type: 'pie',
      data: [],
      title: 'Code Distribution',
      description: 'Distribution of codes',
      donut: true,
      source: 'coding'
    }, 'pie')
  }, [addChart])

  const createWordCloud = useCallback(async () => {
    await addChart({
      type: 'wordcloud',
      words: [],
      title: 'Word Cloud',
      description: 'Most frequent words',
      source: 'wordcloud'
    })
  }, [addChart])

  const createTreemap = useCallback(async () => {
    await addChart({
      type: 'treemap',
      data: [],
      title: 'Hierarchy Treemap',
      description: 'Node hierarchy visualization',
      source: 'hierarchy'
    })
  }, [addChart])

  const createDendrogram = useCallback(async () => {
    await addChart({
      type: 'dendrogram',
      tree: null,
      labels: [],
      title: 'Similarity Clustering',
      description: 'Source similarity dendrogram',
      source: 'similarity'
    })
  }, [addChart])

  // Get open/closed charts
  const openCharts = useMemo(() => charts.filter(c => c.isOpen), [charts])
  const closedCharts = useMemo(() => charts.filter(c => !c.isOpen), [charts])

  // Calculate grid layout
  const getGridStyle = useCallback((position: { row: number; col: number; spanRow?: number; spanCol?: number }) => {
    return {
      gridRow: `${position.row + 1} / span ${position.spanRow || 1}`,
      gridColumn: `${position.col + 1} / span ${position.spanCol || 1}`
    }
  }, [])

  // Render a single chart
  const renderChart = useCallback((chart: ChartInstance) => {
    if (!chart.isOpen) return null
    
    const { componentType } = chart
    const isLoading = loading[chart.id]
    const error = errors[chart.id]
    
    // Apply filter to data
    let filteredData = componentType.data
    if ((componentType.type === 'bar' || componentType.type === 'pie') && globalFilter) {
      filteredData = componentType.data.filter(d => d.label.toLowerCase().includes(globalFilter.toLowerCase()))
    }
    
    let filteredWords = componentType.words
    if (componentType.type === 'wordcloud' && globalFilter) {
      filteredWords = componentType.words.filter(w => w.word.toLowerCase().includes(globalFilter.toLowerCase()))
    }
    
    const handleClose = (e: React.MouseEvent) => {
      e.stopPropagation()
      closeChart(chart.id)
    }
    
    const handleExport = (e: React.MouseEvent) => {
      e.stopPropagation()
      exportChartDataAsCSV(chart.id)
    }
    
    const handleFilterClick = (label: string) => {
      if (globalFilter === label) {
        clearFilter()
      } else {
        applyFilter(label)
      }
    }
    
    // Check if chart has data
    const hasCodings = componentType.type === 'treemap' && componentType.data.some((node: TreemapNode) => node.value > 0 || (node.children?.length ?? 0) > 0)
    
    const hasData = 
      (componentType.type === 'bar' || componentType.type === 'pie') && componentType.data.length > 0 && filteredData.length > 0
      || componentType.type === 'wordcloud' && componentType.words.length > 0 && filteredWords.length > 0
      || componentType.type === 'treemap' && componentType.data.length > 0 && hasCodings
      || componentType.type === 'dendrogram' && componentType.tree !== null
    
    const isEmpty = !isLoading && !hasData
    
    return (
      <div 
        className="chart-container"
        style={{
          position: 'relative',
          border: '1px solid var(--border-light)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          background: 'var(--bg-primary)',
          height: '100%',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Chart header */}
        <div 
          className="chart-header"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: 'var(--space-3) var(--space-4)',
            background: 'var(--bg-secondary)',
            borderBottom: '1px solid var(--border-light)'
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <h4 style={{ margin: 0, fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)' }}>
              {componentType.title}
            </h4>
            <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
              {componentType.description}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
            {globalFilter && (
              <span 
                className="filter-badge"
                style={{
                  background: 'var(--brand-50)',
                  color: 'var(--brand-700)',
                  padding: 'var(--space-1) var(--space-2)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 'var(--text-xs)',
                  fontWeight: 'var(--font-medium)'
                }}
              >
                Filtered: {globalFilter}
              </span>
            )}
            {componentType.type === 'wordcloud' && (
              <button
                type="button"
                onClick={handleExport}
                title="Export as CSV"
                className="chart-action-btn"
              >
                📥
              </button>
            )}
            {componentType.type === 'bar' && (
              <button
                type="button"
                onClick={handleExport}
                title="Export as CSV"
                className="chart-action-btn"
              >
                📥
              </button>
            )}
            {componentType.type === 'pie' && (
              <button
                type="button"
                onClick={handleExport}
                title="Export as CSV"
                className="chart-action-btn"
              >
                📥
              </button>
            )}
            <button
              type="button"
              onClick={handleClose}
              title="Close chart"
              className="chart-action-btn delete"
            >
              ✕
            </button>
          </div>
        </div>
        
        {/* Chart content */}
        <div 
          className="chart-content"
          style={{
            flex: 1,
            padding: 'var(--space-4)',
            minHeight: '200px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          {isLoading ? (
            <p className="description">Loading data...</p>
          ) : error ? (
            <p className="error-text">{error}</p>
          ) : isEmpty ? (
            <p className="description">
              {componentType.type === 'treemap' 
                ? 'No hierarchy data. Add nodes and code some text first.'
                : 'No data available. Add some coded content to see charts.'}
            </p>
          ) : componentType.type === 'bar' || componentType.type === 'pie' ? (
            <>
              <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                <select 
                  value={chart.chartKind || componentType.type}
                  onChange={(e) => changeChartKind(chart.id, e.target.value as 'bar' | 'pie' | 'table')}
                  style={{
                    padding: 'var(--space-1) var(--space-2)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-light)',
                    background: 'var(--bg-primary)',
                    fontSize: 'var(--text-xs)',
                    cursor: 'pointer'
                  }}
                >
                  <option value="bar">Bar Chart</option>
                  <option value="pie">Pie Chart</option>
                  <option value="table">Table</option>
                </select>
              </div>
              {chart.chartKind === 'table' ? (
                <div className="sheet-table-wrap">
                  <table className="sheet-table">
                    <thead>
                      <tr>
                        <th>Node</th>
                        <th>References</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredData.map((d) => (
                        <tr key={d.label} onClick={() => handleFilterClick(d.label)} style={{ cursor: 'pointer' }}>
                          <td>{d.label}</td>
                          <td>{d.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : chart.chartKind === 'pie' || componentType.type === 'pie' ? (
                <PieChart data={filteredData} donut={componentType.type === 'pie' ? componentType.donut : true} onClick={handleFilterClick} />
              ) : (
                <BarChart data={filteredData} onClick={handleFilterClick} />
              )}
            </>
          ) : componentType.type === 'treemap' ? (
            <div style={{ minHeight: '400px', background: 'var(--bg-secondary)', width: '100%' }}>
              <Treemap data={componentType.data} width={600} height={400} onClick={handleFilterClick} />
            </div>
          ) : componentType.type === 'dendrogram' ? (
            <Dendrogram tree={componentType.tree} labels={componentType.labels} />
          ) : componentType.type === 'wordcloud' ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', justifyContent: 'center' }}>
              {filteredWords.map((word, index) => (
                <span
                  key={word.word}
                  title={`${word.word}: ${word.weight}`}
                  onClick={() => handleFilterClick(word.word)}
                  style={{
                    fontSize: `${14 + (word.weight / Math.max(...componentType.words.map(w => w.weight), 1) * 32)}px`,
                    fontWeight: 700,
                    color: colorFor(index),
                    cursor: 'pointer',
                    padding: 'var(--space-1) var(--space-2)',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(255,255,255,0.8)',
                    transition: 'transform 0.2s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.1)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
                >
                  {word.word}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    )
  }, [charts, globalFilter, loading, errors, closeChart, exportChartDataAsCSV, clearFilter, applyFilter])

  return (
    <section className="page-card" ref={dashboardRef}>
      <div className="page-header">
        <div>
          <p className="eyebrow">Visualizations</p>
          <h2>Interactive Data Dashboard</h2>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
          {/* Add chart dropdown */}
          <div className="dropdown" style={{ position: 'relative' }}>
            <button
              type="button"
              className="primary-button"
              style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}
            >
              <span>➕ Add Chart</span>
            </button>
            <div 
              className="dropdown-menu"
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                zIndex: 100,
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-light)',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-lg)',
                minWidth: '200px',
                padding: 'var(--space-2)',
                display: 'none'
              }}
            >
              <button 
                type="button"
                onClick={createBarChart}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: 'var(--space-2) var(--space-3)',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 'var(--text-sm)'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
              >
                Bar Chart
              </button>
              <button 
                type="button"
                onClick={createPieChart}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: 'var(--space-2) var(--space-3)',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 'var(--text-sm)'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
              >
                Pie Chart
              </button>
              <button 
                type="button"
                onClick={createWordCloud}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: 'var(--space-2) var(--space-3)',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 'var(--text-sm)'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
              >
                Word Cloud
              </button>
              <button 
                type="button"
                onClick={createTreemap}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: 'var(--space-2) var(--space-3)',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 'var(--text-sm)'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
              >
                Treemap
              </button>
            </div>
          </div>
          
          {/* Layout selector */}
          <select
            value={selectedLayout}
            onChange={(e) => setSelectedLayout(e.target.value)}
            style={{
              padding: 'var(--space-2) var(--space-3)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-medium)',
              background: 'var(--bg-primary)',
              fontSize: 'var(--text-sm)',
              cursor: 'pointer'
            }}
          >
            {LAYOUT_PRESETS.map(layout => (
              <option key={layout.id} value={layout.id}>
                {layout.name}
              </option>
            ))}
          </select>
          
          {/* Refresh button */}
          <button
            type="button"
            onClick={refreshAllData}
            className="secondary-button"
            title="Refresh all chart data"
            style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}
          >
            <span>🔄 Refresh</span>
          </button>
          
          {/* Clear filter button */}
          {globalFilter && (
            <button
              type="button"
              onClick={clearFilter}
              className="ghost-button"
              style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}
            >
              <span>🔄 Clear Filter</span>
            </button>
          )}
        </div>
      </div>

      <p className="description">
        Build custom dashboards with interactive charts. Click on chart elements to filter all charts. 
        Use the ➕ button to add charts and the ✕ button to close them.
      </p>

      {/* Closed charts indicator */}
      {closedCharts.length > 0 && (
        <div 
          className="closed-charts-bar"
          style={{
            display: 'flex',
            gap: 'var(--space-2)',
            padding: 'var(--space-3)',
            background: 'var(--bg-secondary)',
            borderRadius: 'var(--radius-md)',
            marginBottom: 'var(--space-4)',
            border: '1px dashed var(--border-light)',
            flexWrap: 'wrap',
            alignItems: 'center'
          }}
        >
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
            Closed charts ({closedCharts.length}):
          </span>
          {closedCharts.map(chart => (
            <button
              key={chart.id}
              type="button"
              onClick={() => restoreChart(chart.id)}
              style={{
                padding: 'var(--space-1) var(--space-2)',
                background: 'transparent',
                border: '1px solid var(--border-light)',
                borderRadius: 'var(--radius-sm)',
                fontSize: 'var(--text-xs)',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            >
              {chart.componentType.title} ✨
            </button>
          ))}
          <button
            type="button"
            onClick={() => closedCharts.forEach(c => restoreChart(c.id))}
            style={{
              marginLeft: 'auto',
              padding: 'var(--space-1) var(--space-2)',
              background: 'transparent',
              border: 'none',
              color: 'var(--brand-600)',
              fontSize: 'var(--text-xs)',
              cursor: 'pointer'
            }}
          >
            Restore All
          </button>
        </div>
      )}

      {/* Dashboard grid */}
      <div
        className="dashboard-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${currentLayout.cols}, 1fr)`,
          gridTemplateRows: `repeat(${currentLayout.rows}, 1fr)`,
          gap: 'var(--space-4)',
          minHeight: '600px'
        }}
      >
        {openCharts.slice(0, currentLayout.chartPositions.length).map((chart, index) => (
          <div
            key={chart.id}
            style={getGridStyle(currentLayout.chartPositions[index])}
          >
            {renderChart(chart)}
          </div>
        ))}
        
        {/* Empty slots */}
        {openCharts.length < currentLayout.chartPositions.length &&
          Array.from({ length: currentLayout.chartPositions.length - openCharts.length }).map((_, i) => (
            <div
              key={`empty-${i}`}
              style={{
                ...getGridStyle(currentLayout.chartPositions[openCharts.length + i]),
                border: '2px dashed var(--border-light)',
                borderRadius: 'var(--radius-lg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-muted)',
                background: 'var(--bg-secondary)',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onClick={createBarChart}
              onMouseEnter={(e) => { 
                e.currentTarget.style.borderColor = 'var(--brand-500)'
                e.currentTarget.style.background = 'var(--brand-50)'
              }}
              onMouseLeave={(e) => { 
                e.currentTarget.style.borderColor = 'var(--border-light)'
                e.currentTarget.style.background = 'var(--bg-secondary)'
              }}
            >
              <span style={{ fontSize: 'var(--text-lg)' }}>➕ Add Chart</span>
            </div>
          ))
        }
      </div>

      {/* Chart catalog */}
      <div style={{ marginTop: 'var(--space-6)' }}>
        <h3>Chart Templates</h3>
        <p className="description">Quick-start with pre-configured visualizations:</p>
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <button type="button" onClick={createBarChart} className="secondary-button">
            Coding Bar Chart
          </button>
          <button type="button" onClick={createPieChart} className="secondary-button">
            Code Distribution Pie
          </button>
          <button type="button" onClick={createWordCloud} className="secondary-button">
            Source Word Cloud
          </button>
          <button type="button" onClick={createTreemap} className="secondary-button">
            Node Hierarchy
          </button>
        </div>
      </div>
    </section>
  )
}
