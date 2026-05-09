import { NextResponse } from 'next/server'
import { discoverFromRepo, confirmDiscovery } from '@/lib/discovery'

export const maxDuration = 120

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { action, repoUrl } = body

    if (!repoUrl) {
      return NextResponse.json({ error: 'repoUrl is required' }, { status: 400 })
    }

    if (action === 'discover') {
      const discovered = await discoverFromRepo(repoUrl)
      return NextResponse.json({ discovered })
    }

    if (action === 'confirm') {
      const { selectedIds, allDiscovered, authorId, downloadOrigin } = body
      const id = confirmDiscovery(repoUrl, selectedIds, allDiscovered, authorId, downloadOrigin || repoUrl)
      return NextResponse.json({ success: true, added: selectedIds.length, id })
    }

    return NextResponse.json({ error: 'action must be "discover" or "confirm"' }, { status: 400 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
