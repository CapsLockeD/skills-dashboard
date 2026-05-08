import cron from 'node-cron'
import { scanAll } from './scanner'

let started = false

export function startScheduler(): void {
  if (started) return
  started = true

  // Default: every Sunday at 02:00
  // Override with SCAN_SCHEDULE env var (cron syntax)
  const schedule = process.env.SCAN_SCHEDULE || '0 2 * * 0'

  if (!cron.validate(schedule)) {
    console.error(`[scheduler] Invalid SCAN_SCHEDULE: "${schedule}". Scheduler not started.`)
    return
  }

  cron.schedule(schedule, async () => {
    console.log('[scheduler] Starting weekly scan...')
    try {
      await scanAll()
      console.log('[scheduler] Weekly scan complete.')
    } catch (err) {
      console.error('[scheduler] Scan failed:', err)
    }
  })

  console.log(`[scheduler] Weekly scan scheduled — cron: "${schedule}"`)
}
