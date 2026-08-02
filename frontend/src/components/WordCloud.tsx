import { useEffect, useMemo, useState } from 'react'
import { useProjectStore } from '../stores/useProjectStore'
import { useSourceStore } from '../stores/useSourceStore'

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
          topN: 60,
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
    if (maxWeight === minWeight) return 18
    const ratio = (weight - minWeight) / (maxWeight - minWeight)
    return 12 + ratio * 26
  }

  return (
    <div className="panel">
      <h3>Word cloud</h3>
      {loading ? <p className="description">Loading…</p> : null}
      {error ? <p className="error-text">{error}</p> : null}
      <div
        className="chart-card"
        style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem', padding: '1rem', overflow: 'auto' }}
      >
        {words.length ? (
          words.map((word) => (
            <span
              key={word.word}
              title={`${word.word}: ${word.weight}`}
              style={{ fontSize: `${sizeFor(word.weight)}px`, fontWeight: 700, color: '#3730a3', lineHeight: 1 }}
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
