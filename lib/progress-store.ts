/**
 * In-memory progress store for real-time scan progress streaming.
 * Server-side only — used by scanner/enricher to emit events,
 * and by the SSE endpoint to push them to the browser.
 */

export interface ProgressEvent {
  type: 'log' | 'progress' | 'done' | 'error'
  message?: string
  done?: number
  total?: number
  ts: number
}

// Pin store to `global` so all Next.js route module instances share the same Maps.
// Without this, each API route gets its own module instance and the Maps never overlap.
declare global {
  // eslint-disable-next-line no-var
  var __progressHistory: Map<string, ProgressEvent[]> | undefined
  // eslint-disable-next-line no-var
  var __progressCounters: Map<string, { done: number; total: number }> | undefined
}

const history: Map<string, ProgressEvent[]> =
  global.__progressHistory ?? (global.__progressHistory = new Map())
const counters: Map<string, { done: number; total: number }> =
  global.__progressCounters ?? (global.__progressCounters = new Map())

// Subscribers don't need to be global (they're per-connection, only used with SSE)
const subscribers = new Map<string, Set<(e: ProgressEvent) => void>>()

export function initProgress(resourceId: string, total: number): void {
  history.set(resourceId, [])
  counters.set(resourceId, { done: 0, total })
  emit(resourceId, { type: 'progress', done: 0, total, ts: Date.now() })
}

/** Update the total without resetting history or done count. */
export function setTotal(resourceId: string, total: number): void {
  const c = counters.get(resourceId)
  if (c) {
    c.total = total
    c.done = 0
  } else {
    counters.set(resourceId, { done: 0, total })
  }
  emit(resourceId, { type: 'progress', done: c?.done ?? 0, total, ts: Date.now() })
}

export function emit(resourceId: string, event: ProgressEvent): void {
  const h = history.get(resourceId) ?? []
  h.push(event)
  history.set(resourceId, h)

  const subs = subscribers.get(resourceId)
  if (subs) {
    for (const cb of subs) {
      try { cb(event) } catch { /* ignore dead subscriber */ }
    }
  }
}

export function logProgress(resourceId: string, message: string): void {
  emit(resourceId, { type: 'log', message, ts: Date.now() })
}

export function incrementProgress(resourceId: string, message?: string): void {
  const c = counters.get(resourceId)
  if (!c) return
  c.done = Math.min(c.done + 1, c.total)
  emit(resourceId, { type: 'progress', done: c.done, total: c.total, message, ts: Date.now() })
}

export function doneProgress(resourceId: string, message?: string): void {
  const c = counters.get(resourceId)
  emit(resourceId, {
    type: 'done',
    done: c?.total ?? 0,
    total: c?.total ?? 0,
    message,
    ts: Date.now(),
  })
  // Keep history for a bit so late SSE connections can replay, then clean up
  setTimeout(() => {
    history.delete(resourceId)
    counters.delete(resourceId)
  }, 30_000)
}

export function subscribe(
  resourceId: string,
  callback: (e: ProgressEvent) => void
): () => void {
  if (!subscribers.has(resourceId)) subscribers.set(resourceId, new Set())
  subscribers.get(resourceId)!.add(callback)
  return () => subscribers.get(resourceId)?.delete(callback)
}

export function getHistory(resourceId: string): ProgressEvent[] {
  return history.get(resourceId) ?? []
}
