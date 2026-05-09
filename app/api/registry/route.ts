import { NextResponse } from 'next/server'
import { readRegistry, writeRegistry, upsertResource } from '@/lib/registry'
import { deleteRepo } from '@/lib/git-ops'
import { RegistryResource } from '@/types'

export async function DELETE(req: Request) {
  try {
    const { id } = await req.json()
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const registry = readRegistry()
    registry.resources = registry.resources.filter((r) => r.id !== id)
    writeRegistry(registry)
    deleteRepo(id)
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json(readRegistry())
}

export async function PUT(req: Request) {
  try {
    const body = await req.json()
    writeRegistry(body)
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const resource: RegistryResource = await req.json()
    upsertResource(resource)
    return NextResponse.json({ success: true, id: resource.id })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
