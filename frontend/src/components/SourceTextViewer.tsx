import { useEffect, useMemo, useRef, useState } from 'react'
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
  const containerRef = useRef<HTMLDivElement | null>(null)

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

  const handleMouseUp = () => {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return

    const range = selection.getRangeAt(0)
    const container = containerRef.current
    if (!container || !source?.content) return

    const contentNode = container.querySelector('[data-content="true"]') as HTMLElement | null
    if (!contentNode) return

    const startOffset = Number(contentNode.dataset.startOffset ?? '0')
    const selectionStart = Math.max(0, Math.min(source.content.length, startOffset + range.startOffset))
    const selectionEnd = Math.max(0, Math.min(source.content.length, startOffset + range.endOffset))
    if (selectionEnd <= selectionStart) return

    setSelectionRange({ start: selectionStart, end: selectionEnd })
  }

  const applySelection = async (nodeId: number) => {
    if (!source || !selectionRange) return
    try {
      await window.api.coding.apply({
        sourceId,
        nodeId,
        coderId: 1,
        startOffset: selectionRange.start,
        endOffset: selectionRange.end,
      })
      setSelectionRange(null)
      onSelectionCoded?.(nodeId)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const flattenedNodes = useMemo(() => {
    const visit = (items: typeof tree): typeof tree => items.flatMap((item) => [item, ...visit(item.children)])
    return visit(tree)
  }, [tree])

  return (
    <div className="source-viewer">
      {loading ? <p className="description">Loading source…</p> : null}
      {error ? <p className="error-text">{error}</p> : null}
      {source ? (
        <>
          <div className="source-header">
            <h3>{source.title}</h3>
            <span className="description">Select text to code it.</span>
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
            <div ref={containerRef} className="source-content" onMouseUp={handleMouseUp}>
              <div data-content="true" data-start-offset="0" data-end-offset={source.content.length}>
                {spans.map((segment) => {
                  const isHighlighted = highlightActive && highlightOffset != null && highlightOffset >= segment.start && highlightOffset < segment.end
                  const background = segment.coveringNodes.length === 0
                    ? 'transparent'
                    : segment.coveringNodes.length === 1
                      ? `${getNodeColor(segment.coveringNodes[0].node_id)}22`
                      : 'repeating-linear-gradient(135deg, transparent 0 4px, #dbeafe 4px 8px)'

                  return (
                    <span
                      key={`${segment.start}-${segment.end}`}
                      className={`source-span${isHighlighted ? ' highlight' : ''}`}
                      style={{ background }}
                    >
                      {source.content.slice(segment.start, segment.end)}
                    </span>
                  )
                })}
              </div>
            </div>
          </div>
          {selectionRange ? (
            <div className="code-popover">
              <h4>Code selection</h4>
              <div className="node-picker-list">
                {flattenedNodes.map((node: (typeof flattenedNodes)[number]) => (
                  <button key={node.id} type="button" className="node-chip" onClick={() => void applySelection(node.id)}>
                    {node.name}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <p className="description">Select text and choose a node from the popover above to code it.</p>
        </>
      ) : (
        <p className="description">Select a source to begin coding.</p>
      )}
    </div>
  )
}
