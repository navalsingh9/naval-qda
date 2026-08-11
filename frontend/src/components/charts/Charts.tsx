// Lightweight, dependency-free SVG chart primitives
// Bar/pie/treemap/dendrogram with click handlers for filtering

// Extended color palette with more options
export const CHART_COLORS = [
  '#7c3aed', '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
  '#06b6d4', '#ec4899', '#84cc16', '#1e40af', '#db2777',
  '#059669', '#ea580c', '#8b5cf6', '#1f2937', '#6366f1',
  '#22c55e', '#f97316', '#eab308', '#f43f5e', '#a855f7'
]

export const CHART_COLORS_LIGHT = [
  '#a855f7', '#60a5fa', '#34d399', '#fbbf24', '#f87171',
  '#22d3ee', '#f472b6', '#a3e635', '#3b82f6', '#ec4899',
  '#10b981', '#fdba74', '#c4b5fd', '#4b5563', '#818cf8'
]

export function colorFor(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length]
}

export function colorForLight(index: number): string {
  return CHART_COLORS_LIGHT[index % CHART_COLORS_LIGHT.length]
}

export type BarDatum = { label: string; value: number; color?: string }

// Enhanced BarChart with responsive sizing and better rendering
export function BarChart({
  data,
  height = 24,
  width: containerWidth,
  onClick,
  colors = CHART_COLORS
}: {
  data: BarDatum[];
  height?: number;
  width?: number | string;
  onClick?: (label: string) => void;
  colors?: string[];
}) {
  const maxValue = Math.max(1, ...data.map(d => d.value))
  const rowHeight = height
  const gap = 8
  const chartHeight = data.length * (rowHeight + gap)
  
  // Calculate available width based on container
  const labelWidth = 180
  const availableWidth = typeof containerWidth === 'number' ? containerWidth : 800
  const chartWidth = availableWidth - labelWidth - 48
  
  if (!data.length) return null
  
  return (
    <svg 
      className="chart-svg" 
      viewBox={`0 0 ${labelWidth + chartWidth + 48} ${chartHeight}`} 
      width="100%" 
      height={chartHeight}
      style={{ 
        cursor: onClick ? 'pointer' : 'default',
        overflow: 'visible'
      }}
    >
      {data.map((d, i) => {
        const y = i * (rowHeight + gap)
        const barWidth = (d.value / maxValue) * chartWidth
        const barColor = d.color ?? colors[i % colors.length]
        
        return (
          <g key={d.label} onClick={() => onClick?.(d.label)} style={{ cursor: onClick ? 'pointer' : 'default' }}>
            {/* Label */}
            <text 
              x={labelWidth - 8} 
              y={y + rowHeight * 0.7} 
              textAnchor="end" 
              className="chart-label" 
              style={{ 
                fontFamily: 'var(--font-family)', 
                cursor: onClick ? 'pointer' : 'default',
                fontSize: '12px'
              }}
            >
              {d.label.length > 30 ? `${d.label.substring(0, 27)}...` : d.label}
            </text>
            
            {/* Bar */}
            <rect 
              x={labelWidth} 
              y={y + 2} 
              width={Math.max(4, barWidth)} 
              height={rowHeight - 4} 
              rx={6} 
              fill={barColor} 
              opacity={0.85}
              onMouseEnter={(e) => {
                e.currentTarget.setAttribute('opacity', '1')
              }}
              onMouseLeave={(e) => {
                e.currentTarget.setAttribute('opacity', '0.85')
              }}
            />
            
            {/* Invisible click area */}
            <rect 
              x={labelWidth} 
              y={y} 
              width={chartWidth} 
              height={rowHeight} 
              rx={6} 
              fill="transparent" 
              stroke="transparent"
            />
            
            {/* Value */}
            <text 
              x={labelWidth + barWidth + 12} 
              y={y + rowHeight * 0.7} 
              className="chart-value" 
              style={{ 
                fontFamily: 'var(--font-family)', 
                cursor: onClick ? 'pointer' : 'default',
                fontSize: '11px'
              }}
            >
              {d.value}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// Enhanced PieChart with better sizing and color support
export function PieChart({
  data,
  size = 220,
  donut = true,
  onClick,
  colors = CHART_COLORS
}: {
  data: BarDatum[];
  size?: number;
  donut?: boolean;
  onClick?: (label: string) => void;
  colors?: string[];
}) {
  const total = data.reduce((sum, d) => sum + d.value, 0)
  const radius = size / 2
  const innerRadius = donut ? radius * 0.55 : 0
  const cx = radius
  const cy = radius
  
  if (!total) return null
  
  let angle = -Math.PI / 2
  const arcs = data.map((d, i) => {
    const fraction = d.value / total
    const startAngle = angle
    const endAngle = angle + fraction * Math.PI * 2
    angle = endAngle
    
    const point = (r: number, a: number) => [cx + r * Math.cos(a), cy + r * Math.sin(a)]
    const [x1, y1] = point(radius, startAngle)
    const [x2, y2] = point(radius, endAngle)
    const [ix1, iy1] = point(innerRadius, endAngle)
    const [ix2, iy2] = point(innerRadius, startAngle)
    const largeArc = fraction > 0.5 ? 1 : 0
    
    const path = innerRadius > 0
      ? `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} L ${ix1} ${iy1} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${ix2} ${iy2} Z`
      : `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`
    
    return { 
      path, 
      color: d.color ?? colors[i % colors.length], 
      label: d.label, 
      value: d.value, 
      pct: fraction * 100 
    }
  })
  
  return (
    <div className="pie-chart-row" style={{ alignItems: 'flex-start', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        <svg 
          viewBox={`0 0 ${size} ${size}`} 
          width={size} 
          height={size}
          style={{ cursor: onClick ? 'pointer' : 'default' }}
        >
          {donut && total > 0 && (
            <text 
              x={cx} 
              y={cy} 
              textAnchor="middle" 
              dominantBaseline="middle" 
              style={{ 
                fontSize: '14px', 
                fontWeight: '700', 
                fill: 'var(--text-primary)', 
                fontFamily: 'var(--font-family)' 
              }}
            >
              {total}
            </text>
          )}
          {arcs.map((arc, index) => (
            <path 
              key={`${arc.label}-${index}`}
              d={arc.path} 
              fill={arc.color} 
              stroke="white" 
              strokeWidth={2} 
              opacity={0.9}
              onClick={() => onClick?.(arc.label)}
              style={{ 
                cursor: onClick ? 'pointer' : 'default',
                transition: 'opacity 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.setAttribute('opacity', '1')
              }}
              onMouseLeave={(e) => {
                e.currentTarget.setAttribute('opacity', '0.9')
              }}
            />
          ))}
          <defs>
            <filter id="pie-shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="rgba(0,0,0,0.1)"/>
            </filter>
          </defs>
        </svg>
        
        {/* Legend */}
        <ul className="chart-legend" style={{ margin: 0 }}>
          {arcs.map((arc, index) => (
            <li 
              key={`${arc.label}-legend`}
              onClick={() => onClick?.(arc.label)}
              style={{ 
                cursor: onClick ? 'pointer' : 'default',
                padding: '4px 0',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <span 
                className="chart-legend-swatch" 
                style={{ 
                  background: arc.color,
                  width: '12px',
                  height: '12px',
                  borderRadius: '3px',
                  display: 'inline-block',
                  border: '1px solid rgba(0,0,0,0.1)'
                }} 
              />
              <span className="chart-legend-label" style={{ fontSize: '12px' }}>
                {arc.label.length > 25 ? `${arc.label.substring(0, 22)}...` : arc.label}
              </span>
              <span className="chart-legend-value" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {arc.value} ({arc.pct.toFixed(0)}%)
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export type TreemapNode = {
  name: string;
  value: number;
  children?: TreemapNode[];
  color?: string;
}

type LaidOutRect = {
  name: string;
  value: number;
  depth: number;
  x: number;
  y: number;
  w: number;
  h: number;
  color?: string;
}

function layoutTreemap(
  nodes: TreemapNode[],
  x: number,
  y: number,
  w: number,
  h: number,
  depth: number,
  out: LaidOutRect[],
  colors: string[]
) {
  const total = nodes.reduce((sum, n) => sum + Math.max(n.value, 0.0001), 0)
  if (total <= 0 || w <= 0 || h <= 0) return
  
  const horizontal = w >= h
  let offset = 0
  
  for (const node of nodes) {
    const share = Math.max(node.value, 0.0001) / total
    const nodeColor = node.color ?? colors[depth % colors.length]
    
    if (horizontal) {
      const nodeW = w * share
      out.push({ 
        name: node.name, 
        value: node.value, 
        depth, 
        x: x + offset, 
        y, 
        w: nodeW, 
        h,
        color: nodeColor
      })
      if (node.children?.length) {
        layoutTreemap(node.children, x + offset, y, nodeW, h, depth + 1, out, colors)
      }
      offset += nodeW
    } else {
      const nodeH = h * share
      out.push({
        name: node.name,
        value: node.value,
        depth,
        x,
        y: y + offset,
        w,
        h: nodeH,
        color: nodeColor
      })
      if (node.children?.length) {
        layoutTreemap(node.children, x, y + offset, w, nodeH, depth + 1, out, colors)
      }
      offset += nodeH
    }
  }
}

// Enhanced Treemap with responsive sizing and better visibility
export function Treemap({
  data,
  width: containerWidth = 800,
  height: containerHeight = 480,
  onClick,
  colors = CHART_COLORS
}: {
  data: TreemapNode[];
  width?: number | string;
  height?: number | string;
  onClick?: (name: string) => void;
  colors?: string[];
}) {
  // Calculate actual dimensions
  const actualWidth = typeof containerWidth === 'number' ? containerWidth : 800
  const actualHeight = typeof containerHeight === 'number' ? containerHeight : 480
  
  const rects: LaidOutRect[] = []
  layoutTreemap(data, 0, 0, actualWidth, actualHeight, 0, rects, colors)
  
  const maxDepth = rects.reduce((max, r) => Math.max(max, r.depth), 0)
  
  if (!rects.length) return null
  
  return (
    <svg 
      viewBox={`0 0 ${actualWidth} ${actualHeight}`} 
      width="100%" 
      height="100%" 
      style={{ 
        minWidth: actualWidth,
        minHeight: actualHeight,
        borderRadius: 'var(--radius-lg)',
        cursor: onClick ? 'pointer' : 'default'
      }}
    >
      <defs>
        <filter id="treemap-shadow" x="0" y="0" width="100%" height="100%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="rgba(0,0,0,0.1)"/>
        </filter>
      </defs>
      {rects.map((r, i) => {
        const isLeafDepth = r.depth === maxDepth
        const bgColor = isLeafDepth ? (r.color || colors[i % colors.length]) : 'transparent'
        const borderColor = isLeafDepth ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.1)'
        
        return (
          <g key={`${r.name}-${i}`} onClick={() => onClick?.(r.name)} style={{ cursor: onClick ? 'pointer' : 'default' }}>
            <rect 
              x={r.x} 
              y={r.y} 
              width={Math.max(0, r.w - 1)} 
              height={Math.max(0, r.h - 1)} 
              fill={bgColor} 
              fillOpacity={isLeafDepth ? 0.85 : 0.3} 
              stroke={borderColor} 
              strokeWidth={1} 
              filter="url(#treemap-shadow)"
              rx={4}
            />
            <rect 
              x={r.x} 
              y={r.y} 
              width={Math.max(0, r.w - 1)} 
              height={Math.max(0, r.h - 1)} 
              fill="transparent" 
              stroke="transparent" 
              className="treemap-hover-area" 
              rx={4}
            />
            {/* Label - adjusted for better visibility */}
            {r.w > 40 && r.h > 20 && (
              <text 
                x={r.x + 8} 
                y={r.y + 16} 
                className="treemap-label" 
                style={{ 
                  fontFamily: 'var(--font-family)', 
                  fontSize: Math.min(11, r.h / 2) + 'px',
                  fontWeight: '600',
                  fill: isLeafDepth ? '#ffffff' : 'var(--text-primary)'
                }}
              >
                {r.name.length > 20 ? `${r.name.substring(0, 17)}...` : r.name}
              </text>
            )}
            {/* Value - adjusted for better visibility */}
            {r.w > 40 && r.h > 30 && (
              <text 
                x={r.x + 8} 
                y={r.y + 28} 
                style={{ 
                  fontFamily: 'var(--font-family)', 
                  fontSize: Math.min(10, r.h / 3) + 'px',
                  fill: isLeafDepth ? 'rgba(255,255,255,0.8)' : 'var(--text-muted)',
                  fontWeight: '400'
                }}
              >
                {r.value}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

export type DendroNode = 
  | { type: 'leaf'; id: number; label: string; color?: string }
  | { type: 'node'; height: number; left: DendroNode; right: DendroNode; color?: string }

// Enhanced Dendrogram with better rendering
export function Dendrogram({
  tree,
  width: containerWidth = 700,
  colors = CHART_COLORS
}: {
  tree: DendroNode | null;
  width?: number | string;
  colors?: string[];
}) {
  if (!tree) return null
  
  const actualWidth = typeof containerWidth === 'number' ? containerWidth : 700
  
  const leaves: { id: number; label: string; color?: string }[] = []
  const collectLeaves = (n: DendroNode) => {
    if (n.type === 'leaf') {
      leaves.push({ id: n.id, label: n.label, color: n.color })
    } else {
      collectLeaves(n.left)
      collectLeaves(n.right)
    }
  }
  collectLeaves(tree)
  
  const rowHeight = 28
  const height = Math.max(rowHeight, leaves.length * rowHeight)
  const labelWidth = 200
  const treeWidth = actualWidth - labelWidth - 30
  
  const maxHeight = tree.type === 'node' ? tree.height : 1
  
  const positions = new Map<DendroNode, { x: number; y: number; node: DendroNode }>()
  let leafIndex = 0
  
  const place = (n: DendroNode): { x: number; y: number; node: DendroNode } => {
    if (n.type === 'leaf') {
      const pos = { x: 0, y: leafIndex * rowHeight + rowHeight / 2, node: n }
      leafIndex++
      positions.set(n, pos)
      return pos
    }
    const left = place(n.left)
    const right = place(n.right)
    const x = maxHeight > 0 ? (n.height / maxHeight) * treeWidth : treeWidth
    const pos = { x, y: (left.y + right.y) / 2, node: n }
    positions.set(n, pos)
    return pos
  }
  
  place(tree)
  
  const lines: Array<{ x1: number; y1: number; x2: number; y2: number }> = []
  const walkLines = (n: DendroNode) => {
    if (n.type === 'leaf') return
    const pos = positions.get(n)!
    const left = positions.get(n.left)!
    const right = positions.get(n.right)!
    lines.push({ x1: pos.x, y1: left.y, x2: pos.x, y2: right.y })
    lines.push({ x1: left.x, y1: left.y, x2: pos.x, y2: left.y })
    lines.push({ x1: right.x, y1: right.y, x2: pos.x, y2: right.y })
    walkLines(n.left)
    walkLines(n.right)
  }
  walkLines(tree)
  
  return (
    <svg 
      viewBox={`0 0 ${actualWidth} ${height}`} 
      width="100%" 
      style={{ height, minWidth: actualWidth }}
    >
      <defs>
        <marker 
          id="arrowhead" 
          markerWidth="10" 
          markerHeight="7" 
          refX="9" 
          refY="3.5" 
          orient="auto"
        >
          <polygon points="0 0, 10 3.5, 0 7" fill="var(--border-dark)"/>
        </marker>
      </defs>
      
      {/* Dendrogram lines */}
      <g transform={`translate(${labelWidth + 10}, 0)`}>
        {lines.map((line, i) => (
          <line 
            key={i} 
            x1={line.x1} 
            y1={line.y1} 
            x2={line.x2} 
            y2={line.y2} 
            stroke="var(--border-medium)" 
            strokeWidth={1.5} 
            strokeLinecap="round" 
            strokeLinejoin="round"
          />
        ))}
      </g>
      
      {/* Leaf labels */}
      {leaves.map((leaf, i) => {
        const leafColor = leaf.color ?? colors[i % colors.length]
        return (
          <g key={leaf.id}>
            <text 
              x={labelWidth - 8} 
              y={i * rowHeight + rowHeight / 2 + 4} 
              textAnchor="end" 
              className="chart-label" 
              style={{ 
                fontFamily: 'var(--font-family)', 
                fontSize: '12px', 
                fill: 'var(--text-secondary)' 
              }}
            >
              {leaf.label.length > 25 ? `${leaf.label.substring(0, 22)}...` : leaf.label}
            </text>
            <circle 
              cx={labelWidth + 5} 
              cy={i * rowHeight + rowHeight / 2} 
              r={4} 
              fill={leafColor} 
              stroke="white" 
              strokeWidth={1}
            />
          </g>
        )
      })}
    </svg>
  )
}

// Export all chart types
export { CHART_COLORS, CHART_COLORS_LIGHT, colorFor, colorForLight }
