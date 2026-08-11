import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { useProjectStore } from '../stores/useProjectStore'
import { useSourceStore } from '../stores/useSourceStore'
import { useNodeStore } from '../stores/useNodeStore'
import { BarChart, PieChart, Treemap, Dendrogram, colorFor, type BarDatum, type TreemapNode, type DendroNode } from './charts/Charts'

// Chart component types
type ChartComponentType = 
  | { type: 'bar'; data: BarDatum[]; title: string; description: string }
  | { type: 'pie'; data: BarDatum[]; title: string; description: string; donut?: boolean }
  | { type: 'treemap'; data: TreemapNode[]; title: string; description: string }
  | { type: 'dendrogram'; tree: DendroNode | null; labels: string[]; title: string; description: string }
  | { type: 'wordcloud'; words: {word: string; weight: number}[]; title: string; description: string }

type ChartInstance = {
  id: string
  componentType: ChartComponentType
  isOpen: boolean
  xFilter?: string | null
  yFilter?: string | null
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

// Available chart templates
type ChartTemplate = {
  id: string
  name: string
  description: string
  create: (data: any) => ChartComponentType
}

export function VisualizationDashboard() {
  const { selectedProjectId } = useProjectStore()
  const { sources, loadSources } = useSourceStore()
  const { tree, loadTree } = useNodeStore()
  
  // Layout state
  const [selectedLayout, setSelectedLayout] = useState<string>('2x2')
  const [customRows, setCustomRows] = useState<number>(2)
  const [customCols, setCustomCols] = useState<number>(2)
  
  // Chart instances state
  const [charts, setCharts] = useState<ChartInstance[]>([])
  
  // Filter state
  const [globalFilter, setGlobalFilter] = useState<string | null>(null)
  const [filterSource, setFilterSource] = useState<string | null>(null)
  
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
    }
  }, [selectedProjectId, loadTree, loadSources])

  // Generate unique chart ID
  const generateChartId = useCallback(() => {
    return `chart-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }, [])

  // Get layout preset
  const getLayoutPreset = useCallback((id: string): LayoutPreset => {
    return LAYOUT_PRESETS.find(p => p.id === id) || LAYOUT_PRESETS[3] // Default to 2x2
  }, [])

  // Get current layout
  const currentLayout = getLayoutPreset(selectedLayout)

  // Create a new chart instance
  const addChart = useCallback((chartType: ChartComponentType) => {
    const newChart: ChartInstance = {
      id: generateChartId(),
      componentType: chartType,
      isOpen: true,
    }
    setCharts(prev => [...prev, newChart])
    return newChart.id
  }, [generateChartId])

  // Close a chart
  const closeChart = useCallback((chartId: string) => {
    setCharts(prev => prev.map(c => c.id === chartId ? { ...c, isOpen: false } : c))
  }, [])

  // Restore a closed chart
  const restoreChart = useCallback((chartId: string) => {
    setCharts(prev => prev.map(c => c.id === chartId ? { ...c, isOpen: true } : c))
  }, [])

  // Remove a chart completely
  const removeChart = useCallback((chartId: string) => {
    setCharts(prev => prev.filter(c => c.id !== chartId))
  }, [])

  // Apply filter from chart interaction
  const applyFilter = useCallback((filterValue: string | null, source?: string) => {
    setGlobalFilter(filterValue)
    setFilterSource(source || null)
  }, [])

  // Clear filter
  const clearFilter = useCallback(() => {
    setGlobalFilter(null)
    setFilterSource(null)
  }, [])

  // Export dashboard as PNG
  const exportAsPNG = useCallback(async () => {
    if (!dashboardRef.current) return
    
    try {
      const canvas = await html2canvas(dashboardRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false,
        useCORS: true,
        allowTaint: true
      })
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const filename = `visualizations-${timestamp}.png`
      
      const link = document.createElement('a')
      link.download = filename
      link.href = canvas.toDataURL('image/png', 1.0)
      link.click()
    } catch (err) {
      console.error('Export failed:', err)
      alert('Export failed. Please try again.')
    }
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

  // Load chart data
  const loadChartData = useCallback(async (chartId: string, chartType: ChartComponentType) => {
    if (!selectedProjectId) return
    
    setLoading(prev => ({ ...prev, [chartId]: true }))
    setErrors(prev => ({ ...prev, [chartId]: '' }))
    
    try {
      // For now, we'll use the existing component data structures
      // In a full implementation, we'd fetch fresh data from the API
    } catch (err) {
      setErrors(prev => ({ ...prev, [chartId]: err instanceof Error ? err.message : String(err) }))
    } finally {
      setLoading(prev => ({ ...prev, [chartId]: false }))
    }
  }, [selectedProjectId])

  // Render a single chart
  const renderChart = useCallback((chart: ChartInstance) => {
    if (!chart.isOpen) return null
    
    const { componentType, xFilter, yFilter } = chart
    const isFiltered = xFilter != null || yFilter != null
    
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
        applyFilter(label, componentType.title)
      }
    }
    
    // Filter data if filter is applied
    let filteredData = componentType.data
    if (componentType.type === 'bar' || componentType.type === 'pie') {
      filteredData = globalFilter
        ? componentType.data.filter(d => d.label.includes(globalFilter))
        : componentType.data
    }
    
    return (
      <div 
        className="chart-container"
        style={{
          position: 'relative',
          border: '1px solid var(--border-light)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          background: 'var(--bg-primary)',
          filter: isFiltered ? 'brightness(0.95)' : 'none',
          boxShadow: isFiltered ? '0 0 0 2px var(--brand-500)' : 'var(--shadow-sm)'
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
            <button
              type="button"
              onClick={handleExport}
              title="Export as CSV"
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: 'var(--space-1)',
                fontSize: '1.2em',
                color: 'var(--text-muted)',
                borderRadius: 'var(--radius-sm)',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--brand-600)'; e.currentTarget.style.background = 'var(--bg-hover)' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent' }}
            >
              📥
            </button>
            <button
              type="button"
              onClick={handleClose}
              title="Close chart"
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: 'var(--space-1)',
                fontSize: '1.2em',
                color: 'var(--text-muted)',
                borderRadius: 'var(--radius-sm)',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--error-600)'; e.currentTarget.style.background = 'var(--error-50)' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent' }}
            >
              ✕
            </button>
          </div>
        </div>
        
        {/* Chart content */}
        <div 
          className="chart-content"
          style={{
            padding: 'var(--space-4)',
            minHeight: '200px'
          }}
        >
          {componentType.type === 'bar' && (
            <BarChart data={filteredData} />
          )}
          {componentType.type === 'pie' && (
            <PieChart 
              data={filteredData} 
              donut={componentType.donut}
            />
          )}
          {componentType.type === 'treemap' && (
            <Treemap data={componentType.data} />
          )}
          {componentType.type === 'dendrogram' && (
            <Dendrogram tree={componentType.tree} labels={componentType.labels} />
          )}
          {componentType.type === 'wordcloud' && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', justifyContent: 'center' }}>
              {componentType.words.map((word, index) => (
                <span
                  key={word.word}
                  title={`${word.word}: ${word.weight}`}
                  onClick={() => handleFilterClick(word.word)}
                  style={{
                    fontSize: `${14 + (word.weight / Math.max(...componentType.words.map(w => w.weight)) * 32)}px`,
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
          )}
        </div>
      </div>
    )
  }, [charts, globalFilter, filterSource, closeChart, exportChartDataAsCSV, clearFilter, applyFilter])

  // Get open charts
  const openCharts = useMemo(() => charts.filter(c => c.isOpen), [charts])
  const closedCharts = useMemo(() => charts.filter(c => !c.isOpen), [charts])

  // Calculate grid layout
  const getGridStyle = useCallback((position: { row: number; col: number; spanRow?: number; spanCol?: number }) => {
    return {
      gridRow: `${position.row + 1} / span ${position.spanRow || 1}`,
      gridColumn: `${position.col + 1} / span ${position.spanCol || 1}`
    }
  }, [])

  // Create chart from template
  const createBarChart = useCallback(() => {
    addChart({
      type: 'bar',
      data: [],
      title: 'Coding References',
      description: 'References per node'
    })
  }, [addChart])

  const createPieChart = useCallback(() => {
    addChart({
      type: 'pie',
      data: [],
      title: 'Code Distribution',
      description: 'Distribution of codes',
      donut: true
    })
  }, [addChart])

  const createWordCloud = useCallback(() => {
    addChart({
      type: 'wordcloud',
      words: [],
      title: 'Word Cloud',
      description: 'Most frequent words'
    })
  }, [addChart])

  const createTreemap = useCallback(() => {
    addChart({
      type: 'treemap',
      data: [],
      title: 'Hierarchy Treemap',
      description: 'Node hierarchy visualization'
    })
  }, [addChart])

  const createDendrogram = useCallback(() => {
    addChart({
      type: 'dendrogram',
      tree: null,
      labels: [],
      title: 'Similarity Clustering',
      description: 'Source similarity dendrogram'
    })
  }, [addChart])

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
                display: 'none' // Will be shown on hover/click via CSS
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
              <button 
                type="button"
                onClick={createDendrogram}
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
                Dendrogram
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
          
          {/* Export button */}
          <button
            type="button"
            onClick={exportAsPNG}
            className="secondary-button"
            style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}
          >
            <span>📥 Export Dashboard</span>
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
        Build custom dashboards with draggable charts. Click on chart elements to filter all charts. 
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
            border: '1px dashed var(--border-light)'
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

      {/* Chart catalog / templates */}
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
          <button type="button" onClick={createDendrogram} className="secondary-button">
            Source Clustering
          </button>
        </div>
      </div>
    </section>
  )
}
