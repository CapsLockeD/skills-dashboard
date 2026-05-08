import { NextResponse } from 'next/server'
import { ensureRepo, mergeUpstream } from '@/lib/git-ops'
import { getResource } from '@/lib/registry'
import { scanResource, saveSingleResult } from '@/lib/scanner'

export const maxDuration = 120

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const resource = getResource(id)

  if (!resource) {
    return NextResponse.json({ error: 'Resource not found' }, { status: 404 })
  }
  if (!resource.upstream_git_url) {
    return NextResponse.json({ error: 'No upstream_git_url configured for this resource' }, { status: 400 })
  }

  try {
    const git = await ensureRepo(id, resource.upstream_git_url)
    await mergeUpstream(git)

    // Re-scan to confirm it's now up to date
    const result = await scanResource(id)
    saveSingleResult(result)

    return NextResponse.json({ success: true, result })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
