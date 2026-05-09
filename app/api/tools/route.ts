import { NextResponse } from 'next/server'
import { readScanHistory } from '@/lib/scanner'
import { readRegistry } from '@/lib/registry'
import { TOOL_METADATA, ToolCategory } from '@/lib/tools-metadata'

export interface AggregatedTool {
  service: string
  category: ToolCategory
  description: string
  pricingModel: string
  pricingNotes: string
  competitors: string[]
  envVars: string[]
  mustPurchase: boolean
  endpoint?: string
  usedBy: {
    resourceId: string
    resourceName: string
    skillName: string
    purpose: string
  }[]
}

export async function GET() {
  const history = readScanHistory()
  const registry = readRegistry()

  const toolMap = new Map<string, AggregatedTool>()

  for (const [resourceId, results] of Object.entries(history.results)) {
    const latest = results[0]
    if (!latest?.subResources?.length) continue

    const resource = registry.resources.find((r) => r.id === resourceId)
    if (!resource) continue

    for (const sub of latest.subResources) {
      for (const tool of sub.tools ?? []) {
        if (!toolMap.has(tool.service)) {
          const meta = TOOL_METADATA.get(tool.service)
          toolMap.set(tool.service, {
            service: tool.service,
            category: (meta?.category ?? 'infrastructure') as ToolCategory,
            description: meta?.description ?? '',
            pricingModel: meta?.pricingModel ?? 'usage-based',
            pricingNotes: meta?.pricingNotes ?? '',
            competitors: meta?.competitors ?? [],
            envVars: meta?.envVars ?? [],
            mustPurchase: tool.mustPurchase,
            endpoint: tool.endpoint,
            usedBy: [],
          })
        }

        const entry = toolMap.get(tool.service)!
        const alreadyLogged = entry.usedBy.some(
          (u) => u.resourceId === resourceId && u.skillName === sub.name
        )
        if (!alreadyLogged) {
          entry.usedBy.push({
            resourceId,
            resourceName: resource.name,
            skillName: sub.name,
            purpose: tool.purpose || '',
          })
        }
      }
    }
  }

  // Sort: paid first, then by number of usages desc
  const tools = [...toolMap.values()].sort((a, b) => {
    if (a.mustPurchase !== b.mustPurchase) return a.mustPurchase ? -1 : 1
    return b.usedBy.length - a.usedBy.length
  })

  return NextResponse.json({ tools })
}
