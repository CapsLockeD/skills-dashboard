import { NextResponse } from 'next/server'
import { getHistory } from '@/lib/progress-store'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return NextResponse.json(getHistory(id))
}
