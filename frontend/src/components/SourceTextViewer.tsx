import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useProjectStore } from '../stores/useProjectStore'
import { useNodeStore } from '../stores/useNodeStore'
import { MediaPlayer } from './MediaPlayer'

type CodingRecord = {
  id: number
  node_id: number
  start_offset: number
  end_offset: number
}

type SourceRecord = {
  id: number
  title: string
  content: string
  file_path?: string
  created_at?: string
  media_path?: string | null
  transcript_timestamps?: Array<[number, number]> | null
}

type SourceTextViewerProps = {
  sourceId: number
  onSelectionCoded?: (nodeId: number) => void
  highlightOffset?: number | null
  highlightActive?: boolean
}

const nodeColors = ['#4c6ef5', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4']

function getNodeColor(nodeId: number) {
  return nodeColors[nodeId % nodeColors.length]
}

export function SourceTextViewer({ sourceId, onSelectionCoded, highlightOffset, highlightActive = false }: SourceTextViewerProps) {
  const { selectedProjectId } = useProjectStore()
  const { tree } = useNodeStore()
  const [source, setSource] = useState<SourceRecord | null>(null)
  const [codings, setCodings] = useState<CodingRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectionRange, setSelectionRange] = useState<{ start: number; end: number } | null>(null)
  // Where to anchor the floating "pick a node" toolbar, in coordinates
  // relative to the scrollable content frame (so it stays put on scroll).
  const [toolbarPos, setToolbarPos] = useState<{ top: number; left: number; openDownward: boolean } | null>(null)
  const [nodeFilter, setNodeFilter] = useState('')
  const [coderId, setCoderId] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const frameRef = useRef<HTMLDivElement | null>(null)
  const toolbarRef = useRef<HTMLDivElement | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!selectedProjectId) return

    const loadSource = async () => {
      setLoading(true)
      setError(null)
      try {
        const sourceDetail = await window.api.getSource(sourceId) as {
          id: number
          title: string
          content: string
          filePath: string
          createdAt: string
          mediaPath?: string | null
          transcriptTimestamps?: Array<[number, number]> | null
        }
        setSource({
          id: sourceDetail.id,
          title: sourceDetail.title,
          content: sourceDetail.content,
          file_path: sourceDetail.filePath,
          created_at: sourceDetail.createdAt,
          media_path: sourceDetail.mediaPath ?? null,
          transcript_timestamps: sourceDetail.transcriptTimestamps ?? null,
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setLoading(false)
      }
    }

    void loadSource()
  }, [selectedProjectId, sourceId])

  // A project must have a coder before any coding can be saved. Resolve
  // (and, on a brand-new project, silently provision) the project's
  // default coder once here instead of guessing at an id in applySelection.
  useEffect(() => {
    if (!selectedProjectId) return
    setCoderId(null)
    window.api.coders.getOrCreatePrimary(selectedProjectId)
      .then((coder) => setCoderId(coder.id))
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
  }, [selectedProjectId])

  useEffect(() => {
    if (!source?.content) return

    const loadCodings = async () => {
      try {
        const data = await window.api.coding.getCodingsForSource(sourceId, {})
        setCodings((data as CodingRecord[]) ?? [])
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      }
    }

    void loadCodings()
  }, [sourceId])

  const refreshCodings = async () => {
    try {
      const data = await window.api.coding.getCodingsForSource(sourceId, {})
      setCodings((data as CodingRecord[]) ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const spans = useMemo(() => {
    if (!source?.content) return []

    const points = Array.from(new Set([0, source.content.length, ...codings.flatMap((coding) => [coding.start_offset, coding.end_offset])])).sort((a, b) => a - b)
    const segments: Array<{ start: number; end: number; coveringNodes: CodingRecord[] }> = []

    for (let index = 0; index < points.length - 1; index += 1) {
      const start = points[index]
      const end = points[index + 1]
      if (end <= start) continue
      const coveringNodes = codings.filter((coding) => coding.start_offset <= start && coding.end_offset >= end)
      segments.push({ start, end, coveringNodes })
    }

    return segments
  }, [codings, source?.content])

  const closeToolbar = () => {
    setSelectionRange(null)
    setToolbarPos(null)
    setNodeFilter('')
  }

  const handleMouseUp = () => {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      closeToolbar()
      return
    }

    const range = selection.getRangeAt(0)
    const container = containerRef.current
    const frame = frameRef.current
    if (!container || !frame || !source?.content) return

    const contentNode = container.querySelector('[data-content="true"]') as HTMLElement | null
    if (!contentNode || !contentNode.contains(range.commonAncestorContainer)) return

    // range.startOffset/endOffset are only character offsets when the boundary
    // lands inside a text node. When a boundary lands on an element (e.g. the
    // user drags past the last character of a line, or double-clicks a word),
    // the browser reports a child-node index instead, which silently breaks a
    // naive `contentOffset + range.startOffset` calculation. Measure the
    // actual rendered text length up to each boundary instead, which is
    // correct in both cases.
    const measureOffset = (node: Node, offset: number) => {
      const measureRange = document.createRange()
      measureRange.selectNodeContents(contentNode)
      measureRange.setEnd(node, offset)
      return measureRange.toString().length
    }

    const baseOffset = Number(contentNode.dataset.startOffset ?? '0')
    const rawStart = measureOffset(range.startContainer, range.startOffset)
    const rawEnd = measureOffset(range.endContainer, range.endOffset)

    const selectionStart = Math.max(0, Math.min(source.content.length, baseOffset + Math.min(rawStart, rawEnd)))
    const selectionEnd = Math.max(0, Math.min(source.content.length, baseOffset + Math.max(rawStart, rawEnd)))
    if (selectionEnd <= selectionStart) {
      closeToolbar()
      return
    }

    // Anchor the toolbar just above the selection — right where the user is
    // already looking — instead of making them scroll down to a panel
    // fixed at the bottom of the page. But if the selection is near the
    // top of the scrollable frame, there isn't room above it, so flip the
    // popover to open downward instead of letting it clip off-screen.
    const selectionRect = range.getBoundingClientRect()
    const frameRect = frame.getBoundingClientRect()
    const top = selectionRect.top - frameRect.top + frame.scrollTop
    const left = selectionRect.left - frameRect.left + selectionRect.width / 2
    const spaceAbove = selectionRect.top - frameRect.top
    const openDownward = spaceAbove < 220

    setSelectionRange({ start: selectionStart, end: selectionEnd })
    setToolbarPos({ top, left, openDownward })
    setNodeFilter('')
    requestAnimationFrame(() => searchInputRef.current?.focus())
  }

  const applySelection = async (nodeId: number) => {
    if (!source || !selectionRange || coderId == null) return
    try {
      await window.api.coding.apply({
        sourceId,
        nodeId,
        coderId,
        startOffset: selectionRange.start,
        endOffset: selectionRange.end,
      })
      closeToolbar()
      window.getSelection()?.removeAllRanges()
      // The applied coding needs to actually show up as a highlight right
      // away — without this, `codings` (and the highlight spans computed
      // from it) stay stale until the source is reopened, even though the
      // node tree's coding count updates fine since that's a separate fetch.
      await refreshCodings()
      onSelectionCoded?.(nodeId)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const flattenedNodes = useMemo(() => {
    const visit = (items: typeof tree): typeof tree => items.flatMap((item) => [item, ...visit(item.children)])
    return visit(tree)
  }, [tree])

  const filteredNodes = useMemo(() => {
    const query = nodeFilter.trim().toLowerCase()
    if (!query) return flattenedNodes
    return flattenedNodes.filter((node) => node.name.toLowerCase().includes(query))
  }, [flattenedNodes, nodeFilter])

  // Dismiss the toolbar on an outside click or Escape, rather than only
  // ever closing it after a successful code (which left it stranded open
  // if the user changed their mind).
  useEffect(() => {
    if (!selectionRange) return

    const handlePointerDown = (event: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(event.target as Node)) {
        closeToolbar()
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeToolbar()
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [selectionRange])

  return (
    <div className="source-viewer">
      {loading ? <p className="description">Loading source…</p> : null}
      {error ? <p className="error-text">{error}</p> : null}
      {source ? (
        <>
          <div className="source-header">
            <h3>{source.title}</h3>
            <span className="description">Select text to see a node search bar, then pick or search for a node to code it.</span>
          </div>
          <div className="source-content-wrap">
            <MediaPlayer
              src={source.media_path ? `media://${source.media_path}` : null}
              title={source.title}
              transcriptSegments={((source.transcript_timestamps ?? []) as Array<[number, number]>).map((segment, index) => ({
                id: `${segment[0]}-${segment[1]}-${index}`,
                label: `Utterance ${index + 1}`,
                startTime: segment[0],
                endTime: segment[1],
              }))}
            />
            <div ref={frameRef} className="source-content-frame">
              <div ref={containerRef} className="source-content" onMouseUp={handleMouseUp}>
                <div data-content="true" data-start-offset="0" data-end-offset={source.content.length}>
                  {spans.map((segment) => {
                    const isHighlighted = highlightActive && highlightOffset != null && highlightOffset >= segment.start && highlightOffset < segment.end
                    
                    // Better highlighting: use 20% opacity for single node, 30% for multiple
                    const background = segment.coveringNodes.length === 0
                      ? 'transparent'
                      : segment.coveringNodes.length === 1
                        ? `${getNodeColor(segment.coveringNodes[0].node_id)}40`  // 25% opacity
                        : 'repeating-linear-gradient(135deg, transparent 0 4px, rgba(139, 92, 246, 0.2) 4px 8px)'

                    // The active search/navigation highlight (.highlight) used to
                    // always render in a fixed blue regardless of which node the
                    // text belongs to. Pass the node's own color through as a CSS
                    // variable so the highlight accent matches — e.g. a segment
                    // coded under a green node gets a green highlight, not blue.
                    const highlightColor = segment.coveringNodes.length
                      ? getNodeColor(segment.coveringNodes[0].node_id)
                      : undefined

                    return (
                      <span
                        key={`${segment.start}-${segment.end}`}
                        className={`source-span${isHighlighted ? ' highlight' : ''}`}
                        style={{ 
                          background,
                          padding: '0 2px',
                          borderRadius: '2px',
                          transition: 'background 0.2s ease',
                          ...(highlightColor ? { '--highlight-color': highlightColor } as CSSProperties : {})
                        }}
                        title={segment.coveringNodes.length ? segment.coveringNodes.map((c) => flattenedNodes.find((n) => n.id === c.node_id)?.name ?? '').filter(Boolean).join(', ') : undefined}
                      >
                        {source.content.slice(segment.start, segment.end)}
                      </span>
                    )
                  })}
                </div>
              </div>

              {selectionRange && toolbarPos ? (
                <div
                  ref={toolbarRef}
                  className={`code-popover${toolbarPos.openDownward ? ' code-popover-below' : ''}`}
                  style={{ top: toolbarPos.top, left: toolbarPos.left }}
                >
                  <input
                    ref={searchInputRef}
                    className="node-picker-search"
                    placeholder={flattenedNodes.length ? 'Search nodes…' : 'No nodes yet — add one first'}
                    value={nodeFilter}
                    onChange={(event) => setNodeFilter(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && filteredNodes.length === 1) void applySelection(filteredNodes[0].id)
                    }}
                    disabled={!flattenedNodes.length}
                  />
                  <div className="node-picker-list">
                    {filteredNodes.map((node) => (
                      <button key={node.id} type="button" className="node-chip" onClick={() => void applySelection(node.id)}>
                        <span className="node-chip-swatch" style={{ background: getNodeColor(node.id) }} />
                        {node.name}
                      </button>
                    ))}
                    {flattenedNodes.length > 0 && filteredNodes.length === 0 ? (
                      <p className="description node-picker-empty">No nodes match "{nodeFilter}".</p>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </>
      ) : (
        <p className="description">Select a source to begin coding.</p>
      )}
    </div>
  )
}
