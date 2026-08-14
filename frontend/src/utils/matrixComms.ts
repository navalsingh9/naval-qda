import { createClient, MsgType, type MatrixClient, type Room } from 'matrix-js-sdk'

// Everything in this file is designed around one hard rule: nothing here
// may run at app startup, and nothing here may throw in a way that
// escapes Comms. NAVAL-QDA is a local-first, fully-offline-capable tool
// for every other feature (sources, coding, queries, reports all work
// against a local SQLite database with zero network dependency) — Comms
// is the one feature that needs the internet, and it must fail
// completely on its own without taking anything else down with it.
//
// That's enforced two ways:
//  1. This module is only ever imported by CommsPage.tsx, which React
//     Router only mounts when the person actually opens the Comms tab —
//     so a fully offline user who never opens Comms never triggers a
//     single network call anywhere in the app.
//  2. Every exported function here catches its own errors and returns a
//     result the UI can render as a friendly "Comms is offline" state,
//     rather than letting a network failure throw past this module.

const HOMESERVER_URL = 'https://matrix.org'
const COMMUNITY_ROOM_ALIAS = '#naval-qda-community:matrix.org'
const SESSION_KEY = 'naval-qda-comms-session'

export type MatrixSession = {
  accessToken: string
  userId: string
  deviceId: string
}

export type CommsMessage = {
  eventId: string
  sender: string
  senderName: string
  body: string
  timestamp: number
  isFile: boolean
  fileUrl?: string
  fileName?: string
}

export function loadSession(): MatrixSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    return JSON.parse(raw) as MatrixSession
  } catch {
    return null
  }
}

function saveSession(session: MatrixSession) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  } catch {
    // Storage can fail (private browsing-style restrictions, quota) —
    // login still works for this run, it just won't persist across
    // restarts. Not worth surfacing as an error.
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(SESSION_KEY)
  } catch {
    // ignore
  }
}

// True whenever the browser thinks there's no network at all — lets the
// UI skip straight to an offline state without even attempting a
// request, and matches how the rest of this module treats connectivity.
export function isOnline(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine
}

export async function loginWithPassword(username: string, password: string): Promise<{ session: MatrixSession } | { error: string }> {
  try {
    const client = createClient({ baseUrl: HOMESERVER_URL })
    const result = await client.login('m.login.password', {
      identifier: { type: 'm.id.user', user: username },
      password,
    })
    const session: MatrixSession = {
      accessToken: result.access_token,
      userId: result.user_id,
      deviceId: result.device_id,
    }
    saveSession(session)
    return { session }
  } catch (err) {
    return { error: describeMatrixError(err) }
  }
}

function describeMatrixError(err: unknown): string {
  if (!isOnline()) {
    return "You're offline — Comms needs an internet connection. Everything else in NAVAL-QDA keeps working normally."
  }
  const message = err instanceof Error ? err.message : String(err)
  if (/M_FORBIDDEN|Invalid password|invalid username/i.test(message)) {
    return 'Incorrect username or password.'
  }
  if (/M_LIMIT_EXCEEDED/i.test(message)) {
    return 'Too many attempts — please wait a moment and try again.'
  }
  return `Could not reach Comms right now (${message}). Everything else in NAVAL-QDA keeps working normally.`
}

// Resumes a session from a saved access token — no password needed, no
// network call required to just construct the client, so this never
// blocks app startup even though it's called eagerly on the Comms page.
export function resumeClient(session: MatrixSession): MatrixClient {
  return createClient({
    baseUrl: HOMESERVER_URL,
    accessToken: session.accessToken,
    userId: session.userId,
    deviceId: session.deviceId,
  })
}

export async function joinCommunityRoom(client: MatrixClient): Promise<{ room: Room } | { error: string }> {
  try {
    const room = await client.joinRoom(COMMUNITY_ROOM_ALIAS)
    return { room }
  } catch (err) {
    return { error: describeMatrixError(err) }
  }
}

export async function sendMessage(client: MatrixClient, roomId: string, body: string): Promise<{ ok: true } | { error: string }> {
  try {
    await client.sendTextMessage(roomId, body)
    return { ok: true }
  } catch (err) {
    return { error: describeMatrixError(err) }
  }
}

export async function sendFile(client: MatrixClient, roomId: string, file: File): Promise<{ ok: true } | { error: string }> {
  try {
    const upload = await client.uploadContent(file, { type: file.type })
    const info = { size: file.size, mimetype: file.type }
    if (file.type.startsWith('image/')) {
      await client.sendMessage(roomId, { msgtype: MsgType.Image, body: file.name, url: upload.content_uri, info })
    } else {
      await client.sendMessage(roomId, { msgtype: MsgType.File, body: file.name, url: upload.content_uri, info })
    }
    return { ok: true }
  } catch (err) {
    return { error: describeMatrixError(err) }
  }
}

export function mxcToHttp(client: MatrixClient, mxcUrl: string | undefined): string | undefined {
  if (!mxcUrl) return undefined
  try {
    return client.mxcUrlToHttp(mxcUrl) ?? undefined
  } catch {
    return undefined
  }
}

export function registerUrl(): string {
  // Registration (including the CAPTCHA step matrix.org requires to stop
  // bot signups) happens in the person's real browser via Element Web —
  // deliberately not reimplemented in-app. That's a well-tested,
  // maintained flow; hand-rolling CAPTCHA handling against a public
  // homeserver we don't control is exactly the kind of thing that
  // silently breaks when the other side changes something.
  return 'https://app.element.io/#/register'
}
