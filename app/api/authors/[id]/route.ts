import { NextResponse } from 'next/server'
import { lookupAuthor, readAuthorCache, writeAuthorCache } from '@/lib/author-lookup'
import { readRegistry } from '@/lib/registry'

export const maxDuration = 60

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const registry = readRegistry()
  const authorRef = registry.authors[id]
  if (!authorRef) {
    return NextResponse.json({ error: `Author ${id} not found in registry` }, { status: 404 })
  }

  try {
    const profile = await lookupAuthor(id, authorRef)
    const cache = readAuthorCache()
    cache.authors[id] = profile
    writeAuthorCache(cache)
    return NextResponse.json(profile)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
