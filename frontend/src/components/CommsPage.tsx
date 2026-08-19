import { useEffect, useRef, useState } from 'react'
import { ClientEvent, RoomEvent, type MatrixClient, type Room, type MatrixEvent } from 'matrix-js-sdk'
import { Send, Paperclip, LogOut, WifiOff } from 'lucide-react'
import {
  loadSession, clearSession, isOnline, loginWithPassword, resumeClient,
  joinCommunityRoom, sendMessage, sendFile, mxcToHttp, registerUrl,
  type CommsMessage,
} from '../utils/matrixComms'

// This whole page is intentionally the only place in NAVAL-QDA that
// touches the network for a non-optional-AI feature. Every other page
// (Sources, Coding, Query, Visualizations, Reports...) works fully
// offline against the local SQLite database — nothing about Comms being
// unreachable should ever block or slow down any of them, because this
// component is only mounted when the person navigates here.
export function CommsPage() {
  const [phase, setPhase] = useState<'checking' | 'loggedOut' | 'connecting' | 'ready' | 'error'>('checking')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState<string | null>(null)
  const [loggingIn, setLoggingIn] = useState(false)
  const [online, setOnline] = useState(isOnline())

  const [messages, setMessages] = useState<CommsMessage[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [roomError, setRoomError] = useState<string | null>(null)

  const clientRef = useRef<MatrixClient | null>(null)
  const roomRef = useRef<Room | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const messageListRef = useRef<HTMLDivElement | null>(null)

  // Track real connectivity so the UI can show "you're offline" the
  // instant it happens, and quietly stop trying rather than spinning.
  useEffect(() => {
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      const session = await loadSession()
      if (cancelled) return
      if (!session) {
        setPhase('loggedOut')
        return
      }
      if (!isOnline()) {
        setPhase('error')
        setRoomError("You're offline — Comms will reconnect automatically once you're back online.")
        return
      }

      setPhase('connecting')

      const client = resumeClient(session)
      const result = await joinCommunityRoom(client)
      if (cancelled) return
      if ('error' in result) {
        setPhase('error')
        setRoomError(result.error)
        return
      }
      clientRef.current = client
      roomRef.current = result.room
      client.startClient({ initialSyncLimit: 30 })
      client.once(ClientEvent.Sync, (state: string) => {
        if (cancelled) return
        if (state === 'PREPARED') {
          loadHistory(result.room)
          setPhase('ready')
        }
      })
      client.on(RoomEvent.Timeline, (event: MatrixEvent, room?: Room) => {
        if (cancelled || !room || room.roomId !== result.room.roomId) return
        appendMessage(client, event)
      })
    }

    void run()

    return () => {
      cancelled = true
      clientRef.current?.stopClient()
    }
  }, [])

  useEffect(() => {
    messageListRef.current?.scrollTo({ top: messageListRef.current.scrollHeight })
  }, [messages])

  function eventToMessage(client: MatrixClient, event: MatrixEvent): CommsMessage | null {
    if (event.getType() !== 'm.room.message') return null
    const content = event.getContent()
    const isFile = content.msgtype === 'm.file' || content.msgtype === 'm.image'
    return {
      eventId: event.getId() ?? `${event.getTs()}-${event.getSender()}`,
      sender: event.getSender() ?? 'unknown',
      senderName: event.sender?.name ?? event.getSender() ?? 'unknown',
      body: typeof content.body === 'string' ? content.body : '',
      timestamp: event.getTs(),
      isFile,
      fileUrl: isFile ? mxcToHttp(client, content.url as string | undefined) : undefined,
      fileName: isFile ? (content.body as string | undefined) : undefined,
    }
  }

  function loadHistory(room: Room) {
    const client = clientRef.current
    if (!client) return
    const history = room.getLiveTimeline().getEvents()
    const parsed = history.map((e) => eventToMessage(client, e)).filter((m): m is CommsMessage => m !== null)
    setMessages(parsed)
  }

  function appendMessage(client: MatrixClient, event: MatrixEvent) {
    const message = eventToMessage(client, event)
    if (!message) return
    setMessages((prev) => (prev.some((m) => m.eventId === message.eventId) ? prev : [...prev, message]))
  }

  const handleLogin = async () => {
    if (!username.trim() || !password) return
    setLoggingIn(true)
    setLoginError(null)
    const result = await loginWithPassword(username.trim(), password)
    setLoggingIn(false)
    if ('error' in result) {
      setLoginError(result.error)
      return
    }
    setPassword('')
    setPhase('checking')
    // Re-run the connect effect by forcing a session reload path.
    window.location.reload()
  }

  const handleLogout = () => {
    clientRef.current?.stopClient()
    clearSession()
    clientRef.current = null
    roomRef.current = null
    setMessages([])
    setPhase('loggedOut')
  }

  const handleSend = async () => {
    const client = clientRef.current
    const room = roomRef.current
    if (!client || !room || !draft.trim()) return
    setSending(true)
    const result = await sendMessage(client, room.roomId, draft.trim())
    setSending(false)
    if ('error' in result) {
      setRoomError(result.error)
      return
    }
    setDraft('')
  }

  const handleFilePick = () => fileInputRef.current?.click()

  const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    const client = clientRef.current
    const room = roomRef.current
    if (!file || !client || !room) return
    setSending(true)
    const result = await sendFile(client, room.roomId, file)
    setSending(false)
    if ('error' in result) {
      setRoomError(result.error)
    }
  }

  return (
    <section className="page-card">
      <div className="page-header">
        <div>
          <p className="eyebrow">Comms</p>
          <h2>NAVAL-QDA Community</h2>
          <p className="description">
            A shared space to ask for help, compare notes, or just not do qualitative coding entirely alone.
          </p>
        </div>
        {phase === 'ready' && (
          <button type="button" className="ghost-button" onClick={handleLogout}>
            <LogOut size={15} strokeWidth={2} style={{ marginRight: '6px', verticalAlign: '-2px' }} />
            Log out of Comms
          </button>
        )}
      </div>

      {!online && (
        <div className="comms-offline-banner">
          <WifiOff size={15} strokeWidth={2} />
          You're offline. Comms will reconnect automatically — everything else in NAVAL-QDA keeps working normally.
        </div>
      )}

      {phase === 'checking' && <p className="description">Checking Comms session…</p>}

      {phase === 'loggedOut' && (
        <div className="panel comms-auth-panel">
          <h3>Sign in to Comms</h3>
          <p className="description">
            Comms uses a free, open community account (powered by Matrix, an open messaging protocol — not tied to your NAVAL-QDA project data, which stays fully local either way).
          </p>
          <div className="comms-auth-form">
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              autoComplete="username"
              onKeyDown={(e) => { if (e.key === 'Enter') void handleLogin() }}
            />
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              type="password"
              autoComplete="current-password"
              onKeyDown={(e) => { if (e.key === 'Enter') void handleLogin() }}
            />
            <button type="button" onClick={() => void handleLogin()} disabled={loggingIn || !username.trim() || !password}>
              {loggingIn ? 'Signing in…' : 'Sign in'}
            </button>
          </div>
          {loginError && <p className="error-text">{loginError}</p>}
          <p className="description">
            Don't have an account yet?{' '}
            <a href={registerUrl()} target="_blank" rel="noreferrer">Create one</a> (opens in your browser — a
            one-time step, including a quick human-verification check to keep the community spam-free), then come
            back here and sign in.
          </p>
        </div>
      )}

      {phase === 'connecting' && <p className="description">Connecting to Comms…</p>}

      {phase === 'error' && (
        <div className="panel">
          <p className="error-text">{roomError}</p>
          <button type="button" className="ghost-button" onClick={() => window.location.reload()}>
            Try again
          </button>
        </div>
      )}

      {phase === 'ready' && (
        <div className="panel comms-room-panel">
          {roomError && <p className="error-text">{roomError}</p>}
          <div className="comms-message-list" ref={messageListRef}>
            {messages.length === 0 ? (
              <p className="description">No messages yet — say hello.</p>
            ) : (
              messages.map((message) => (
                <div key={message.eventId} className="comms-message">
                  <div className="comms-message-meta">
                    <span className="comms-message-sender">{message.senderName}</span>
                    <span className="comms-message-time">{new Date(message.timestamp).toLocaleString()}</span>
                  </div>
                  {message.isFile && message.fileUrl ? (
                    <a href={message.fileUrl} target="_blank" rel="noreferrer" className="comms-message-file">
                      <Paperclip size={14} strokeWidth={2} /> {message.fileName ?? 'Attachment'}
                    </a>
                  ) : (
                    <div className="comms-message-body">{message.body}</div>
                  )}
                </div>
              ))
            )}
          </div>
          <div className="comms-composer">
            <input type="file" ref={fileInputRef} hidden onChange={(e) => void handleFileSelected(e)} />
            <button type="button" className="chart-action-btn" title="Attach a file" onClick={handleFilePick} disabled={sending}>
              <Paperclip size={16} strokeWidth={2} />
            </button>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Message the community…"
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSend() } }}
              disabled={sending}
            />
            <button type="button" className="primary-button" onClick={() => void handleSend()} disabled={sending || !draft.trim()}>
              <Send size={15} strokeWidth={2} />
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
