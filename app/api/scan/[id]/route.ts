import { NextResponse } from 'next/server'
import { scanResource, saveSingleResult } from '@/lib/scanner'

export const maxDuration = 120

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const result = await scanResource(id)
    saveSingleResult(result)
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
