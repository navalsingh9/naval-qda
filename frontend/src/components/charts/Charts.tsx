// Chart primitives built on recharts — gives us real responsive sizing
// (ResponsiveContainer tracks its parent via ResizeObserver internally),
// proper tooltips/legends, and a battle-tested treemap layout instead of
// a hand-rolled one.

import { useMemo } from 'react'
import {
  ResponsiveContainer,
  BarChart as RBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  PieChart as RPieChart,
  Pie,
  Legend,
  Treemap as RTreemap,
} from 'recharts'

// Extended color palette with more options
export const CHART_COLORS = [
  '#1264a3', '#007a5a', '#e01e5a', '#ecb22e', '#36c5f0',
  '#2bac76', '#6b46c1', '#e8912d', '#3f0e40', '#00a0d2',
  '#d94848', '#61b15a', '#a06cd5', '#e0602a', '#4a90d9',
]

export const CHART_COLORS_LIGHT = [
  '#6fbde3', '#5cc7a2', '#ee7099', '#f6d68e', '#8fdcf5',
  '#7ecda6', '#a58ee0', '#f2b876', '#9d6f9e', '#6fd0ec',
]

export function colorFor(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length]
}

export function colorForLight(index: number): string {
  return CHART_COLORS_LIGHT[index % CHART_COLORS_LIGHT.length]
}

export type BarDatum = { label: string; value: number; color?: string }

function ChartTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name?: string; value?: number | string; payload?: { label?: string; name?: string } }> }) {
  if (!active || !payload?.length) return null
  const item = payload[0]
  const label = item.payload?.label ?? item.payload?.name ?? item.name
  return (
    <div
      style={{
        background: 'var(--bg-primary)',
        border: '1px solid var(--border-light)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-2) var(--space-3)',
        boxShadow: 'var(--shadow-md)',
        fontSize: 'var(--text-xs)',
        color: 'var(--text-primary)',
        maxWidth: '260px'
      }}
    >
      <div style={{ fontWeight: 'var(--font-bold)', marginBottom: '2px' }}>{label}</div>
      <div style={{ color: 'var(--text-secondary)' }}>{item.value}</div>
    </div>
  )
}

// Horizontal bar chart — labels read left to right, which is far more
// legible than rotated axis labels once node names get long.
export function BarChart({
  data,
  onClick,
  colors = CHART_COLORS
}: {
  data: BarDatum[];
  height?: number;
  width?: number | string;
  onClick?: (label: string) => void;
  colors?: string[];
}) {
  if (!data.length) return null

  // Sort so the largest bar is on top, matching how most researchers scan
  // a ranked list, and give the chart enough height per row to stay
  // readable instead of squeezing dozens of rows into a fixed box.
  const rowHeight = 32
  const chartHeight = Math.max(240, data.length * rowHeight + 40)

  return (
    <div style={{ width: '100%', height: chartHeight, minWidth: 0, minHeight: 0 }}>
      <ResponsiveContainer width="100%" height="100%">
        <RBarChart
          data={data}
          layout="vertical"
          margin={{ top: 8, right: 24, bottom: 8, left: 8 }}
          barCategoryGap={8}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} allowDecimals={false} />
          <YAxis
            type="category"
            dataKey="label"
            width={Math.min(220, Math.max(90, ...data.map(d => d.label.length * 6.2)))}
            tick={{ fontSize: 12, fill: 'var(--text-secondary)' }}
            tickFormatter={(value: string) => (value.length > 28 ? `${value.slice(0, 25)}...` : value)}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--bg-hover)' }} />
          <Bar
            dataKey="value"
            radius={[0, 6, 6, 0]}
            onClick={(entry: unknown) => {
              const d = entry as BarDatum
              if (d?.label) onClick?.(d.label)
            }}
            cursor={onClick ? 'pointer' : 'default'}
          >
            {data.map((d, i) => (
              <Cell key={d.label} fill={d.color ?? colors[i % colors.length]} />
            ))}
          </Bar>
        </RBarChart>
      </ResponsiveContainer>
    </div>
  )
}

// Pie/donut chart with a legend that shows value + percentage.
export function PieChart({
  data,
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
  const total = useMemo(() => data.reduce((sum, d) => sum + d.value, 0), [data])
  if (!total) return null

  return (
    <div style={{ width: '100%', height: '100%', minHeight: 280, minWidth: 0 }}>
      <ResponsiveContainer width="100%" height="100%">
        <RPieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="label"
            innerRadius={donut ? '50%' : 0}
            outerRadius="80%"
            paddingAngle={data.length > 1 ? 2 : 0}
            onClick={(entry: unknown) => {
              const d = entry as BarDatum
              if (d?.label) onClick?.(d.label)
            }}
            cursor={onClick ? 'pointer' : 'default'}
            label={({ percent }: { percent?: number }) => `${Math.round((percent ?? 0) * 100)}%`}
            labelLine={false}
          >
            {data.map((d, i) => (
              <Cell key={d.label} fill={d.color ?? colors[i % colors.length]} stroke="var(--bg-primary)" strokeWidth={2} />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip />} />
          <Legend
            layout="vertical"
            verticalAlign="middle"
            align="right"
            iconType="circle"
            iconSize={10}
            formatter={(value: string) => {
              const truncated = value.length > 28 ? `${value.slice(0, 25)}...` : value
              return <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{truncated}</span>
            }}
          />
        </RPieChart>
      </ResponsiveContainer>
    </div>
  )
}

export type TreemapNode = {
  name: string;
  value: number;
  children?: TreemapNode[];
  color?: string;
}

// Flatten our nested TreemapNode shape into recharts' expected format,
// assigning each LEAF a color (recharts treemap colors leaves, not
// intermediate groups, which is what avoids the old bug where a parent's
// label was drawn directly under/behind its children's labels).
function toRechartsTree(nodes: TreemapNode[], depth: number, colors: string[]): Array<Record<string, unknown>> {
  return nodes.map((node, i) => {
    if (node.children?.length) {
      return {
        name: node.name,
        children: toRechartsTree(node.children, depth + 1, colors)
      }
    }
    return {
      name: node.name,
      size: Math.max(node.value, 0.0001),
      actualValue: node.value,
      fill: node.color ?? colors[(depth * 3 + i) % colors.length]
    }
  })
}

type TreemapContentProps = {
  x?: number; y?: number; width?: number; height?: number
  name?: string; actualValue?: number; fill?: string; depth?: number
}

function TreemapCell({ x = 0, y = 0, width = 0, height = 0, name, actualValue, fill, depth }: TreemapContentProps) {
  const isLeaf = depth === undefined || depth >= 1
  const showLabel = width > 46 && height > 24
  const showValue = width > 46 && height > 40 && actualValue !== undefined
  return (
    <g>
      <rect
        x={x} y={y} width={width} height={height}
        style={{
          fill: isLeaf ? (fill || 'var(--brand-400)') : 'transparent',
          stroke: 'var(--bg-primary)',
          strokeWidth: 2,
        }}
        rx={3}
      />
      {showLabel && (
        <text
          x={x + 8}
          y={y + 18}
          fontSize={12}
          fontWeight={700}
          fill="#ffffff"
          style={{ fontFamily: 'var(--font-family)', pointerEvents: 'none' }}
        >
          {name && name.length > Math.floor(width / 7) ? `${name.slice(0, Math.max(3, Math.floor(width / 7) - 1))}...` : name}
        </text>
      )}
      {showValue && (
        <text
          x={x + 8}
          y={y + 34}
          fontSize={11}
          fill="rgba(255,255,255,0.85)"
          style={{ fontFamily: 'var(--font-family)', pointerEvents: 'none' }}
        >
          {actualValue}
        </text>
      )}
    </g>
  )
}

// Treemap — delegates layout to recharts (squarified algorithm), which
// only draws leaf rectangles with labels, instead of the old approach
// that drew every ancestor's rectangle AND label on top of its children's.
export function Treemap({
  data,
  onClick,
  colors = CHART_COLORS
}: {
  data: TreemapNode[];
  width?: number | string;
  height?: number | string;
  onClick?: (name: string) => void;
  colors?: string[];
}) {
  const tree = useMemo(() => toRechartsTree(data, 0, colors), [data, colors])
  if (!tree.length) return null

  return (
    <div style={{ width: '100%', height: '100%', minHeight: 320, minWidth: 0 }}>
      <ResponsiveContainer width="100%" height="100%">
        <RTreemap
          data={tree}
          dataKey="size"
          aspectRatio={4 / 3}
          stroke="var(--bg-primary)"
          content={<TreemapCell />}
          onClick={(node: unknown) => {
            const n = node as { name?: string }
            if (n?.name) onClick?.(n.name)
          }}
        />
      </ResponsiveContainer>
    </div>
  )
}

export type DendroNode = 
  | { type: 'leaf'; id: number; label: string; color?: string }
  | { type: 'node'; height: number; left: DendroNode; right: DendroNode; color?: string }

// Dendrogram — recharts has no equivalent, so this stays hand-rolled SVG,
// but wrapped for responsive width the same way the other charts are now.
export function Dendrogram({
  tree,
  colors = CHART_COLORS
}: {
  tree: DendroNode | null;
  width?: number | string;
  colors?: string[];
}) {
  if (!tree) return null

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

  const rowHeight = 32
  const height = Math.max(rowHeight, leaves.length * rowHeight) + 16
  const labelWidth = 200
  const treeWidth = 320

  const maxHeight = tree.type === 'node' ? tree.height : 1

  const positions = new Map<DendroNode, { x: number; y: number }>()
  let leafIndex = 0

  const place = (n: DendroNode): { x: number; y: number } => {
    if (n.type === 'leaf') {
      const pos = { x: 0, y: leafIndex * rowHeight + rowHeight / 2 + 8 }
      leafIndex += 1
      positions.set(n, pos)
      return pos
    }
    const left = place(n.left)
    const right = place(n.right)
    const x = maxHeight > 0 ? (n.height / maxHeight) * treeWidth : treeWidth
    const pos = { x, y: (left.y + right.y) / 2 }
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

  const totalWidth = labelWidth + treeWidth + 30

  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${totalWidth} ${height}`} width="100%" style={{ height, minWidth: totalWidth }}>
        <g transform={`translate(${labelWidth + 10}, 0)`}>
          {lines.map((line, i) => (
            <line
              key={i}
              x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2}
              stroke="var(--border-medium)"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
        </g>
        {leaves.map((leaf, i) => {
          const leafColor = leaf.color ?? colors[i % colors.length]
          return (
            <g key={leaf.id}>
              <text
                x={labelWidth - 8}
                y={i * rowHeight + rowHeight / 2 + 12}
                textAnchor="end"
                style={{ fontFamily: 'var(--font-family)', fontSize: '12px', fill: 'var(--text-secondary)' }}
              >
                {leaf.label.length > 25 ? `${leaf.label.substring(0, 22)}...` : leaf.label}
              </text>
              <circle
                cx={labelWidth + 5}
                cy={i * rowHeight + rowHeight / 2 + 8}
                r={4}
                fill={leafColor}
                stroke="var(--bg-primary)"
                strokeWidth={1}
              />
            </g>
          )
        })}
      </svg>
    </div>
  )
}
