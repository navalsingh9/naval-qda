// Lightweight, dependency-free SVG chart primitives. The project has no
// charting library installed, and pulling one in isn't worth it for a
// handful of chart types — plain SVG with viewBox-based scaling covers
// bar/pie/treemap/dendrogram cleanly and keeps the bundle small.

// Modern Slack-inspired color palette for charts
// Using a more sophisticated color palette with better contrast and aesthetics
export const CHART_COLORS = [
  '#7c3aed', // Brand purple
  '#3b82f6', // Brand blue
  '#10b981', // Success green
  '#f59e0b', // Warning amber
  '#ef4444', // Error red
  '#06b6d4', // Cyan
  '#ec4899', // Pink
  '#84cc16', // Lime green
  '#1e40af', // Dark blue
  '#db2777', // Magenta
  '#059669', // Emerald
  '#ea580c', // Orange
]

// Lighter versions for better visibility in charts
export const CHART_COLORS_LIGHT = [
  '#a855f7',
  '#60a5fa',
  '#34d399',
  '#fbbf24',
  '#f87171',
  '#22d3ee',
  '#f472b6',
  '#a3e635',
  '#3b82f6',
  '#ec4899',
]

export function colorFor(index: number) {
  return CHART_COLORS[index % CHART_COLORS.length]
}

export function colorForLight(index: number) {
  return CHART_COLORS_LIGHT[index % CHART_COLORS_LIGHT.length]
}

// ---------------------------------------------------------------------
// Horizontal bar chart — one bar per category, proportional to value.
// Horizontal (rather than vertical) so node/case names of any length
// stay readable without rotated axis labels.
// ---------------------------------------------------------------------
export type BarDatum = { label: string; value: number; color?: string }

export function BarChart({ data, height = 24 }: { data: BarDatum[]; height?: number }) {
  const maxValue = Math.max(1, ...data.map((d) => d.value))
  const rowHeight = height
  const gap = 8
  const chartHeight = data.length * (rowHeight + gap)
  const labelWidth = 180
  const chartWidth = 600

  if (!data.length) return null

  return (
    <svg 
      className="chart-svg" 
      viewBox={`0 0 ${labelWidth + chartWidth + 48} ${chartHeight}`} 
      width="100%" 
      style={{ height: chartHeight }}
    >
      {data.map((d, i) => {
        const y = i * (rowHeight + gap)
        const barWidth = (d.value / maxValue) * chartWidth
        const barColor = d.color ?? colorFor(i)
        return (
          <g key={d.label}>
            {/* Label */}
            <text 
              x={labelWidth - 8} 
              y={y + rowHeight * 0.7} 
              textAnchor="end" 
              className="chart-label"
              style={{ fontFamily: 'var(--font-family)' }}
            >
              {d.label}
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
            />
            
            {/* Bar background for better visibility */}
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
              style={{ fontFamily: 'var(--font-family)' }}
            >
              {d.value}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// ---------------------------------------------------------------------
// Pie / donut chart with a side legend showing percentages.
// ---------------------------------------------------------------------
export function PieChart({ data, size = 220, donut = true }: { data: BarDatum[]; size?: number; donut?: boolean }) {
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
      color: d.color ?? colorFor(i), 
      label: d.label, 
      value: d.value, 
      pct: fraction * 100,
      startAngle,
      endAngle,
      fraction
    }
  })

  return (
    <div className="pie-chart-row" style={{ alignItems: 'flex-start' }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
        {/* Donut center text showing total */}
        {donut && (
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
        
        {arcs.map((arc) => (
          <path 
            key={arc.label} 
            d={arc.path} 
            fill={arc.color} 
            stroke="white" 
            strokeWidth={2} 
            opacity={0.9}
            filter="url(#pie-shadow)"
          />
        ))}
        
        {/* Add hover effect definitions */}
        <defs>
          <filter id="pie-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="rgba(0,0,0,0.1)" />
          </filter>
        </defs>
      </svg>
      
      <ul className="chart-legend">
        {arcs.map((arc) => (
          <li key={arc.label}>
            <span className="chart-legend-swatch" style={{ background: arc.color }} />
            <span className="chart-legend-label">{arc.label}</span>
            <span className="chart-legend-value">{arc.value} ({arc.pct.toFixed(0)}%)</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ---------------------------------------------------------------------
// Treemap — slice-and-dice layout (alternating horizontal/vertical
// splits by depth). Not squarified, but proportional area is exact and
// the implementation stays simple and dependency-free.
// ---------------------------------------------------------------------
export type TreemapNode = { name: string; value: number; children?: TreemapNode[] }
type LaidOutRect = { name: string; value: number; depth: number; x: number; y: number; w: number; h: number }

function layoutTreemap(nodes: TreemapNode[], x: number, y: number, w: number, h: number, depth: number, out: LaidOutRect[]) {
  const total = nodes.reduce((sum, n) => sum + Math.max(n.value, 0.0001), 0)
  if (total <= 0 || w <= 0 || h <= 0) return
  const horizontal = w >= h
  let offset = 0

  for (const node of nodes) {
    const share = Math.max(node.value, 0.0001) / total
    if (horizontal) {
      const nodeW = w * share
      out.push({ name: node.name, value: node.value, depth, x: x + offset, y, w: nodeW, h })
      if (node.children?.length) layoutTreemap(node.children, x + offset, y, nodeW, h, depth + 1, out)
      offset += nodeW
    } else {
      const nodeH = h * share
      out.push({ name: node.name, value: node.value, depth, x, y: y + offset, w, h: nodeH })
      if (node.children?.length) layoutTreemap(node.children, x, y + offset, w, nodeH, depth + 1, out)
      offset += nodeH
    }
  }
}

export function Treemap({ data, width = 800, height = 480 }: { data: TreemapNode[]; width?: number; height?: number }) {
  const rects: LaidOutRect[] = []
  layoutTreemap(data, 0, 0, width, height, 0, rects)
  // Only render leaf-most rects (deepest at each position) so parent and
  // child boxes don't visually double-stack; we still use every node for
  // layout so child areas are computed against the full hierarchy.
  const maxDepth = rects.reduce((max, r) => Math.max(max, r.depth), 0)

  if (!rects.length) return null

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" style={{ height, borderRadius: 'var(--radius-lg)' }}>
      <defs>
        <filter id="treemap-shadow" x="0" y="0" width="100%" height="100%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="rgba(0,0,0,0.1)" />
        </filter>
      </defs>
      
      {rects.map((r, i) => {
        const isLeafDepth = r.depth === maxDepth
        const colorIndex = i % CHART_COLORS.length
        const bgColor = isLeafDepth ? colorFor(colorIndex) : 'transparent'
        
        return (
          <g key={`${r.name}-${i}`}>
            {/* Main rectangle */}
            <rect
              x={r.x}
              y={r.y}
              width={Math.max(0, r.w - 1)}
              height={Math.max(0, r.h - 1)}
              fill={bgColor}
              fillOpacity={isLeafDepth ? 0.85 : 0.3}
              stroke="#ffffff"
              strokeWidth={1}
              filter="url(#treemap-shadow)"
              rx={4}
            />
            
            {/* Hover effect area (transparent but clickable) */}
            <rect
              x={r.x}
              y={r.y}
              width={Math.max(0, r.w - 1)}
              height={Math.max(0, r.h - 1)}
              fill="transparent"
              stroke="transparent"
              className="treemap-hover-area"
              style={{ cursor: 'pointer' }}
              rx={4}
            />
            
            {/* Label - improved placement and styling */}
            {r.w > 60 && r.h > 20 ? (
              <text 
                x={r.x + 8} 
                y={r.y + 16} 
                className="treemap-label"
                style={{
                  fontFamily: 'var(--font-family)',
                  fontSize: '11px',
                  fontWeight: '600'
                }}
              >
                {r.name.length > 20 ? `${r.name.substring(0, 17)}...` : r.name}
              </text>
            ) : null}
            
            {/* Value - smaller and positioned below name if space allows */}
            {r.w > 60 && r.h > 30 ? (
              <text 
                x={r.x + 8} 
                y={r.y + 28} 
                style={{
                  fontFamily: 'var(--font-family)',
                  fontSize: '10px',
                  fill: 'rgba(255,255,255,0.8)',
                  fontWeight: '400'
                }}
              >
                {r.value}
              </text>
            ) : null}
          </g>
        )
      })}
    </svg>
  )
}

// ---------------------------------------------------------------------
// Dendrogram — renders the merge tree produced by hierarchical
// clustering (see backend/visualize.js hierarchicalCluster). Leaves are
// listed vertically with labels; the tree grows left→right by distance,
// which keeps source/case names (of any length) readable.
// ---------------------------------------------------------------------
export type DendroNode =
  | { type: 'leaf'; id: number; label: string }
  | { type: 'node'; height: number; left: DendroNode; right: DendroNode }

type Positioned = { x: number; y: number; node: DendroNode }

export function Dendrogram({ tree, width = 700 }: { tree: DendroNode | null; width?: number }) {
  if (!tree) return null

  const leaves: { id: number; label: string }[] = []
  const collectLeaves = (n: DendroNode) => {
    if (n.type === 'leaf') leaves.push({ id: n.id, label: n.label })
    else {
      collectLeaves(n.left)
      collectLeaves(n.right)
    }
  }
  collectLeaves(tree)

  const rowHeight = 28
  const height = Math.max(rowHeight, leaves.length * rowHeight)
  const labelWidth = 200
  const treeWidth = width - labelWidth - 30
  const maxHeight = tree.type === 'node' ? tree.height : 1

  const positions = new Map<DendroNode, Positioned>()
  let leafIndex = 0

  const place = (n: DendroNode): Positioned => {
    if (n.type === 'leaf') {
      const pos: Positioned = { x: 0, y: leafIndex * rowHeight + rowHeight / 2, node: n }
      leafIndex += 1
      positions.set(n, pos)
      return pos
    }
    const left = place(n.left)
    const right = place(n.right)
    const x = maxHeight > 0 ? (n.height / maxHeight) * treeWidth : treeWidth
    const pos: Positioned = { x, y: (left.y + right.y) / 2, node: n }
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
    // vertical connector between the two children at the merge x
    lines.push({ x1: pos.x, y1: left.y, x2: pos.x, y2: right.y })
    // horizontal connector from each child out to the merge point
    lines.push({ x1: left.x, y1: left.y, x2: pos.x, y2: left.y })
    lines.push({ x1: right.x, y1: right.y, x2: pos.x, y2: right.y })
    walkLines(n.left)
    walkLines(n.right)
  }
  walkLines(tree)

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" style={{ height }}>
      <defs>
        <marker 
          id="arrowhead" 
          markerWidth="10" 
          markerHeight="7" 
          refX="9" 
          refY="3.5" 
          orient="auto"
        >
          <polygon points="0 0, 10 3.5, 0 7" fill="var(--border-dark)" />
        </marker>
      </defs>
      
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
      
      {leaves.map((leaf, i) => (
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
            fill={colorFor(i)} 
            stroke="white" 
            strokeWidth={1}
          />
        </g>
      ))}
    </svg>
  )
}
