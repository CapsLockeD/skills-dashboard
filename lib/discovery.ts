import fs from 'fs'
import path from 'path'
import { RegistryResource, ResourceType } from '../types'
import { ensureRepo, getRepoPath } from './git-ops'
import { readRegistry, writeRegistry } from './registry'
import { isN8nWorkflow } from './n8n-parser'

export interface DiscoveredResource {
  id: string
  name: string
  relativePath: string
  type: ResourceType
  description?: string
}

function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export async function discoverFromRepo(repoUrl: string): Promise<DiscoveredResource[]> {
  // Use a stable ID derived from the URL for the discovery clone
  const repoId = `_discover-${slugify(repoUrl.replace(/^https?:\/\//, '').replace(/\.git$/, ''))}`
  await ensureRepo(repoId, repoUrl)
  const repoPath = getRepoPath(repoId)

  const discovered: DiscoveredResource[] = []
  const seen = new Set<string>()

  function walk(dir: string) {
    if (!fs.existsSync(dir)) return
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
        const skillMd = path.join(full, 'SKILL.md')
        if (fs.existsSync(skillMd)) {
          const content = fs.readFileSync(skillMd, 'utf-8')
          const nameMatch = content.match(/^name:\s*(.+)$/m)
          const descMatch = content.match(/^description:\s*["']?(.+?)["']?$/m)
          const rawName = nameMatch?.[1]?.trim() || entry.name
          const id = slugify(rawName)
          if (!seen.has(id)) {
            seen.add(id)
            discovered.push({
              id,
              name: rawName,
              relativePath: full.replace(repoPath, ''),
              type: 'claude-skill',
              description: descMatch?.[1]?.trim(),
            })
          }
        }
        walk(full)
      } else if (entry.isFile() && entry.name.endsWith('.json') && isN8nWorkflow(full)) {
        try {
          const workflow = JSON.parse(fs.readFileSync(full, 'utf-8'))
          const rawName = workflow.name || path.basename(entry.name, '.json')
          const id = slugify(rawName)
          if (!seen.has(id)) {
            seen.add(id)
            discovered.push({
              id,
              name: rawName,
              relativePath: full.replace(repoPath, ''),
              type: 'n8n-workflow',
              description: `n8n workflow — ${workflow.nodes?.length ?? 0} nodes`,
            })
          }
        } catch { /* skip invalid JSON */ }
      }
    }
  }

  walk(repoPath)
  return discovered
}

export function confirmDiscovery(
  repoUrl: string,
  selectedIds: string[],
  allDiscovered: DiscoveredResource[],
  authorId: string | null,
  downloadOrigin: string
): void {
  const registry = readRegistry()
  const toAdd = allDiscovered.filter((d) => selectedIds.includes(d.id))

  for (const item of toAdd) {
    const resource: RegistryResource = {
      id: item.id,
      name: item.name,
      type: item.type,
      ownership_status: 'external',
      author_id: authorId,
      upstream_git_url: repoUrl,
      download_origin: downloadOrigin,
      category: 'uncategorized',
      notes: item.description || '',
      skip_auto_update: false,
      sub_resource_ids: [],
      discovered_from: repoUrl,
    }
    const idx = registry.resources.findIndex((r) => r.id === item.id)
    if (idx >= 0) {
      registry.resources[idx] = resource
    } else {
      registry.resources.push(resource)
    }
  }

  writeRegistry(registry)
}
