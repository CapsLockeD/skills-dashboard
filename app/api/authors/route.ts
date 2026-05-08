import { NextResponse } from 'next/server'
import { readAuthorCache, refreshAllAuthors } from '@/lib/author-lookup'

export const maxDuration = 120

export async function GET() {
  return NextResponse.json(readAuthorCache())
}

export async function POST() {
  try {
    const cache = await refreshAllAuthors()
    return NextResponse.json({ success: true, count: Object.keys(cache.authors).length })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
