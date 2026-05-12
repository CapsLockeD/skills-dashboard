import fs from 'fs'
import path from 'path'
import { RegistryResource, ResourceType } from '../types'
import { ensureRepo, getRepoPath } from './git-ops'
import { readRegistry, writeRegistry } from './registry'
import { isN8nWorkflow } from './n8n-parser'
import { isAutomationTool, getSourceFiles } from './tool-parser'

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

  // Check for a root-level SKILL.md (single-skill repos)
  const rootSkillMd = path.join(repoPath, 'SKILL.md')
  if (fs.existsSync(rootSkillMd) && !seen.has('root')) {
    const content = fs.readFileSync(rootSkillMd, 'utf-8')
    const nameMatch = content.match(/^name:\s*(.+)$/m)
    const descMatch = content.match(/^description:\s*["']?(.+?)["']?$/m)
    const rawName = nameMatch?.[1]?.trim() || path.basename(repoPath)
    const id = slugify(rawName)
    if (!seen.has(id)) {
      seen.add(id)
      discovered.push({
        id,
        name: rawName,
        relativePath: '/SKILL.md',
        type: 'claude-skill',
        description: descMatch?.[1]?.trim(),
      })
    }
  }

  walk(repoPath)

  // If nothing was found via SKILL.md / n8n scan, check if it's an automation tool or library
  if (discovered.length === 0 && isAutomationTool(repoPath)) {
    let description = ''
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(repoPath, 'package.json'), 'utf-8'))
      if (pkg.description) description = pkg.description
    } catch { /* no package.json or invalid */ }

    // Large repos (>100 source files) are libraries/frameworks, not runnable tools
    const fileCount = getSourceFiles(repoPath).length
    const isLibrary = fileCount > 100

    const repoName = path.basename(repoPath).replace(/^_discover-[^-]+-[^-]+-/, '')
    discovered.push({
      id: slugify(repoName),
      name: repoName.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      relativePath: '/',
      type: isLibrary ? 'library' : 'automation-tool',
      description: description || (isLibrary ? 'Library / framework' : 'Standalone automation tool'),
    })
  }

  return discovered
}

export function confirmDiscovery(
  repoUrl: string,
  _selectedIds: string[],
  allDiscovered: DiscoveredResource[],
  authorId: string | null,
  downloadOrigin: string
): string {
  const registry = readRegistry()

  // If no authorId was provided but the URL is a GitHub URL, auto-extract the username
  const resolvedAuthorId =
    authorId ||
    repoUrl.match(/github\.com\/([^/]+)/)?.[1]?.toLowerCase() ||
    null

  // Always create ONE resource per repo — sub-skills are discovered at scan time.
  // Derive a stable ID and display name from the repo URL.
  const repoSlug = repoUrl
    .replace(/^https?:\/\//, '')
    .replace(/\.git$/, '')
    .split('/')
    .slice(-2)        // ['owner', 'repo-name']
    .join('/')
  const repoName = repoSlug.split('/').pop() ?? repoSlug
  const id = slugify(repoName)

  // Determine type from discovered items
  const types = new Set(allDiscovered.map((d) => d.type))
  const type: ResourceType =
    types.size === 0 ? 'claude-skill' :
    types.size === 1 ? ([...types][0] as ResourceType) :
    'mixed'

  // Build a notes summary from what was found
  const skillCount = allDiscovered.filter((d) => d.type === 'claude-skill').length
  const workflowCount = allDiscovered.filter((d) => d.type === 'n8n-workflow').length
  const toolItem = allDiscovered.find((d) => d.type === 'automation-tool')
  const noteParts = [
    skillCount > 0 ? `${skillCount} Claude skill${skillCount !== 1 ? 's' : ''}` : '',
    workflowCount > 0 ? `${workflowCount} n8n workflow${workflowCount !== 1 ? 's' : ''}` : '',
  ].filter(Boolean)
  const notes =
    toolItem?.description
      ? toolItem.description
      : noteParts.length > 0
      ? `${noteParts.join(', ')} — sub-skills discovered on scan.`
      : ''

  const resource: RegistryResource = {
    id,
    name: repoName.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    type,
    ownership_status: 'external',
    author_id: resolvedAuthorId,
    upstream_git_url: repoUrl,
    local_path: null,
    download_origin: downloadOrigin || repoUrl,
    category: 'uncategorized',
    notes,
    skip_auto_update: false,
    sub_resource_ids: [],
    discovered_from: repoUrl,
  }

  const idx = registry.resources.findIndex((r) => r.id === id)
  if (idx >= 0) {
    registry.resources[idx] = resource
  } else {
    registry.resources.push(resource)
  }

  // Auto-create a stub author entry if the resolved author is new.
  if (resolvedAuthorId && !registry.authors[resolvedAuthorId]) {
    const githubMatch = repoUrl.match(/github\.com\/([^/]+)/)
    const githubUsername = githubMatch?.[1] ?? resolvedAuthorId
    registry.authors[resolvedAuthorId] = {
      name: githubUsername,
      github: githubUsername,
    }
  }

  writeRegistry(registry)
  return id
}
