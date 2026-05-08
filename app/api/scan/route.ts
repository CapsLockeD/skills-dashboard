import { NextResponse } from 'next/server'
import { scanAll, readScanHistory } from '@/lib/scanner'

export const maxDuration = 300

export async function GET() {
  return NextResponse.json(readScanHistory())
}

export async function POST() {
  try {
    await scanAll()
    return NextResponse.json({ success: true, scannedAt: new Date().toISOString() })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
