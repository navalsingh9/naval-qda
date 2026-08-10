import { useEffect, useMemo, useState } from 'react'
import { useProjectStore } from '../stores/useProjectStore'
import { useSourceStore } from '../stores/useSourceStore'
import { CHART_COLORS } from './charts/Charts'

type WordCloudRow = { word: string; weight: number }

export function WordCloud() {
  const { selectedProjectId } = useProjectStore()
  const { sources, loadSources } = useSourceStore()
  const [words, setWords] = useState<WordCloudRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (selectedProjectId) {
      void loadSources(selectedProjectId)
    }
  }, [selectedProjectId, loadSources])

  const sourceIds = useMemo(() => sources.map((source) => source.id), [sources])

  useEffect(() => {
    if (!selectedProjectId) return

    const loadData = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await window.api.visualize.wordCloudData({
          projectId: selectedProjectId,
          sourceIds,
          minLength: 4,
          topN: 80,
        }) as WordCloudRow[]
        setWords(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setLoading(false)
      }
    }

    void loadData()
  }, [selectedProjectId, sourceIds])

  const maxWeight = useMemo(() => (words.length ? Math.max(...words.map((word) => word.weight)) : 0), [words])
  const minWeight = useMemo(() => (words.length ? Math.min(...words.map((word) => word.weight)) : 0), [words])

  const sizeFor = (weight: number) => {
    if (maxWeight === minWeight) return 20
    const ratio = (weight - minWeight) / (maxWeight - minWeight)
    return 14 + ratio * 32
  }

  const colorFor = (index: number) => {
    return CHART_COLORS[index % CHART_COLORS.length]
  }

  return (
    <div className="panel">
      <div className="page-header">
        <h3>Word cloud</h3>
      </div>
      {loading ? <p className="description">Loading…</p> : null}
      {error ? <p className="error-text">{error}</p> : null}
      <div
        className="chart-card"
        style={{
          display: 'flex', 
          flexWrap: 'wrap', 
          alignItems: 'center', 
          justifyContent: 'center',
          gap: 'var(--space-4)', 
          padding: 'var(--space-5)', 
          overflow: 'auto',
          minHeight: '200px'
        }}
      >
        {words.length ? (
          words.map((word, index) => (
            <span
              key={word.word}
              title={`${word.word}: ${word.weight}`}
              style={{
                fontSize: `${sizeFor(word.weight)}px`, 
                fontWeight: 700, 
                color: colorFor(index),
                lineHeight: 1.2,
                textShadow: '0 2px 4px rgba(0,0,0,0.1)',
                transition: 'transform 0.2s ease, color 0.2s ease',
                cursor: 'pointer',
                padding: 'var(--space-1) var(--space-2)',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(255,255,255,0.8)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.1)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)'
              }}
            >
              {word.word}
            </span>
          ))
        ) : !loading ? (
          <p className="description">No words to show yet — import and code some sources first.</p>
        ) : null}
      </div>
    </div>
  )
}
