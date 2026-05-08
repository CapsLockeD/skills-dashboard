import { NextResponse } from 'next/server'
import { readRegistry, writeRegistry, upsertResource } from '@/lib/registry'
import { RegistryResource } from '@/types'

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
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
