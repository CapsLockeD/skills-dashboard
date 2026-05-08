// This file runs once when the Next.js server starts.
// It initializes the background scheduler for weekly scans.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startScheduler } = await import('./lib/scheduler')
    startScheduler()
  }
}
