'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

interface ProgressEvent {
  type: 'log' | 'progress' | 'done' | 'error'
  message?: string
  done?: number
  total?: number
  ts: number
}

interface ScanProgressBarProps {
  resourceId: string
  scanning: boolean
}

const POLL_MS = 500

export default function ScanProgressBar({ resourceId, scanning }: ScanProgressBarProps) {
  const [events, setEvents] = useState<ProgressEvent[]>([])
  const [done, setDone] = useState(0)
  const [total, setTotal] = useState(1)
  const [latestMsg, setLatestMsg] = useState<string>('')
  const [finished, setFinished] = useState(false)
  const [logOpen, setLogOpen] = useState(false)
  const logRef = useRef<HTMLDivElement>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const seenCount = useRef(0)

  useEffect(() => {
    if (!scanning) {
      // Stop polling
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      // Only reset if not finished (keep final state visible)
      if (!finished) {
        setEvents([])
        setDone(0)
        setTotal(1)
        setLatestMsg('')
        seenCount.current = 0
      }
      return
    }

    // New scan starting — reset
    setEvents([])
    setDone(0)
    setTotal(1)
    setLatestMsg('')
    setFinished(false)
    seenCount.current = 0

    const poll = async () => {
      try {
        const res = await fetch(`/api/scan/${resourceId}/progress`)
        if (!res.ok) return
        const all: ProgressEvent[] = await res.json()

        // Only process events we haven't seen yet
        const newEvents = all.slice(seenCount.current)
        if (newEvents.length === 0) return

        seenCount.current = all.length
        setEvents(all)

        for (const ev of newEvents) {
          if (ev.message) setLatestMsg(ev.message)
          if ((ev.type === 'progress' || ev.type === 'done') && ev.total != null) {
            setTotal(ev.total)
          }
          if ((ev.type === 'progress' || ev.type === 'done') && ev.done != null) {
            setDone(ev.done)
          }
          if (ev.type === 'done') {
            setFinished(true)
            if (intervalRef.current) {
              clearInterval(intervalRef.current)
              intervalRef.current = null
            }
          }
        }
      } catch { /* ignore fetch errors during polling */ }
    }

    // Poll immediately, then every POLL_MS
    poll()
    intervalRef.current = setInterval(poll, POLL_MS)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [scanning, resourceId])

  // Auto-scroll log to bottom on new events
  useEffect(() => {
    if (logRef.current && logOpen) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [events, logOpen])

  if (!scanning && events.length === 0) return null

  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  const displayPct = finished ? 100 : pct

  return (
    <div className="border-t border-zinc-800/60 bg-zinc-950/60">
      {/* Main progress row */}
      <div className="px-4 py-2 flex items-center gap-3">
        {/* Progress bar */}
        <div className="w-32 h-1 bg-zinc-800 rounded-full overflow-hidden shrink-0">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              finished ? 'bg-green-500' : 'bg-cyan-500 animate-pulse'
            }`}
            style={{ width: `${displayPct}%` }}
          />
        </div>

        {/* Percentage + count */}
        <span className={`font-mono text-[10px] shrink-0 ${finished ? 'text-green-400' : 'text-cyan-400'}`}>
          {displayPct}%{total > 1 ? ` (${done}/${total})` : ''}
        </span>

        {/* Latest message */}
        <span className="font-mono text-[10px] text-zinc-500 flex-1 truncate min-w-0">
          {latestMsg || (scanning ? 'initializing...' : '')}
        </span>

        {/* Log toggle */}
        <button
          onClick={() => setLogOpen((o) => !o)}
          className="shrink-0 text-zinc-700 hover:text-zinc-400 transition-colors"
          title="Toggle log"
        >
          {logOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
        </button>
      </div>

      {/* Scrollable log dropdown */}
      {logOpen && (
        <div
          ref={logRef}
          className="border-t border-zinc-800/60 px-4 py-2 max-h-40 overflow-y-auto space-y-0.5"
        >
          {events.length === 0 && (
            <p className="font-mono text-[10px] text-zinc-700">waiting for scan to start...</p>
          )}
          {events.map((ev, i) => (
            <p key={i} className={`font-mono text-[10px] leading-relaxed ${
              ev.type === 'done'     ? 'text-green-400' :
              ev.type === 'error'    ? 'text-red-400'   :
              ev.type === 'progress' && ev.message ? 'text-cyan-500' :
              'text-zinc-500'
            }`}>
              {ev.message ?? (ev.type === 'progress' ? `progress ${ev.done}/${ev.total}` : ev.type)}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
