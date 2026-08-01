import { useEffect, useMemo, useRef, useState } from 'react'

type MediaPlayerProps = {
  src: string | null
  title?: string
  transcriptSegments?: Array<{ id: string; label: string; startTime: number; endTime: number }>
  activeSegmentId?: string | null
  onSeek?: (time: number) => void
  onSegmentClick?: (segmentId: string) => void
}

export function MediaPlayer({ src, title, transcriptSegments = [], activeSegmentId, onSeek, onSegmentClick }: MediaPlayerProps) {
  const mediaRef = useRef<HTMLAudioElement | HTMLVideoElement | null>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  useEffect(() => {
    setCurrentTime(0)
    setDuration(0)
  }, [src])

  const isAudio = useMemo(() => src?.match(/\.(mp3|wav|m4a|ogg)$/i) != null, [src])

  const handleSeek = (time: number) => {
    if (!mediaRef.current) return
    mediaRef.current.currentTime = time
    setCurrentTime(time)
    onSeek?.(time)
  }

  const mediaElement = (
    <div className="media-shell">
      {isAudio ? (
        <audio
          ref={mediaRef as React.RefObject<HTMLAudioElement>}
          controls
          src={src ?? undefined}
          onTimeUpdate={(event) => setCurrentTime((event.currentTarget as HTMLMediaElement).currentTime)}
          onLoadedMetadata={(event) => setDuration((event.currentTarget as HTMLMediaElement).duration)}
        />
      ) : (
        <video
          ref={mediaRef as React.RefObject<HTMLVideoElement>}
          controls
          src={src ?? undefined}
          onTimeUpdate={(event) => setCurrentTime((event.currentTarget as HTMLMediaElement).currentTime)}
          onLoadedMetadata={(event) => setDuration((event.currentTarget as HTMLMediaElement).duration)}
        />
      )}
      <div className="media-meta">
        <span>{title ?? 'Media playback'}</span>
        <span>{duration > 0 ? `${Math.floor(currentTime)}s / ${Math.floor(duration)}s` : 'Loading media…'}</span>
      </div>
    </div>
  )

  return (
    <div className="media-panel">
      {src ? mediaElement : <p className="description">No media attached to this source yet.</p>}
      {transcriptSegments.length > 0 ? (
        <div className="transcript-list">
          {transcriptSegments.map((segment) => (
            <button
              key={segment.id}
              type="button"
              className={`transcript-chip${activeSegmentId === segment.id ? ' active' : ''}`}
              onClick={() => {
                handleSeek(segment.startTime)
                onSegmentClick?.(segment.id)
              }}
            >
              <strong>{segment.label}</strong>
              <span>{segment.startTime}s → {segment.endTime}s</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
