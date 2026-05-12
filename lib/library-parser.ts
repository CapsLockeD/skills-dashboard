import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { SubResource, ToolUsage } from '../types'
import { NPM_SERVICE_MAP, PY_SERVICE_MAP } from './tool-parser'
import { aiComplete } from './ai-client'

// ── README summary (AI, cached) ───────────────────────────────────────────────

function getDataDir(): string {
  return process.env.DATA_DIR || path.join(process.cwd(), 'data')
}

function getCachePath(): string {
  return path.join(getDataDir(), 'library-cache.json')
}

function readCache(): Record<string, string> {
  try {
    const p = getCachePath()
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf-8'))
  } catch {}
  return {}
}

function writeCache(cache: Record<string, string>): void {
  fs.mkdirSync(getDataDir(), { recursive: true })
  fs.writeFileSync(getCachePath(), JSON.stringify(cache, null, 2) + '\n')
}

function readReadme(repoPath: string): string {
  for (const name of ['README.md', 'readme.md', 'README.txt', 'README']) {
    const p = path.join(repoPath, name)
    if (fs.existsSync(p)) {
      return fs.readFileSync(p, 'utf-8').slice(0, 4000)
    }
  }
  return ''
}

export async function getLibrarySummary(repoPath: string): Promise<string> {
  const readme = readReadme(repoPath)
  if (!readme.trim()) return ''

  const hash = crypto.createHash('md5').update(readme).digest('hex').slice(0, 10)
  const cacheKey = `${path.basename(repoPath)}::${hash}`

  const cache = readCache()
  if (cache[cacheKey]) return cache[cacheKey]

  try {
    const prompt = `/no_think
Read this library/framework README and write 2-3 sentences describing: what it is, what problem it solves, and who would use it. Be concrete and specific — name the technology, not just "a library".

Respond with ONLY the summary text, no JSON, no markdown, no preamble.

${readme}`

    const summary = (await aiComplete(prompt))
      .replace(/<think>[\s\S]*?<\/think>/gi, '')
      .trim()

    cache[cacheKey] = summary
    writeCache(cache)
    return summary
  } catch {
    return ''
  }
}

// ── Dependency → service extraction ──────────────────────────────────────────

function readAllDeps(repoPath: string): Record<string, string> {
  // Node
  const pkgPath = path.join(repoPath, 'package.json')
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
      return { ...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies }
    } catch {}
  }

  // Python
  const reqPath = path.join(repoPath, 'requirements.txt')
  if (fs.existsSync(reqPath)) {
    const deps: Record<string, string> = {}
    for (const line of fs.readFileSync(reqPath, 'utf-8').split('\n')) {
      const pkg = line.split(/[=><~!]/)[0].trim().toLowerCase()
      if (pkg) deps[pkg] = '*'
    }
    return deps
  }

  return {}
}

export function getLibraryServices(repoPath: string): SubResource[] {
  const allDeps = readAllDeps(repoPath)
  const seen = new Set<string>()
  const services: SubResource[] = []

  const combinedMap: Record<string, { service: string; mustPurchase: boolean }> = {
    ...NPM_SERVICE_MAP,
    ...PY_SERVICE_MAP,
  }

  for (const [dep, info] of Object.entries(combinedMap)) {
    if (dep in allDeps && !seen.has(info.service)) {
      seen.add(info.service)
      const tool: ToolUsage = {
        service: info.service,
        purpose: `npm: ${dep}`,
        mustPurchase: info.mustPurchase,
      }
      services.push({
        name: info.service,
        path: '/package.json',
        type: 'module',
        description: '',
        tools: [tool],
      })
    }
  }

  // Sort: paid first, then free
  services.sort((a, b) => {
    const aPaid = a.tools[0]?.mustPurchase ? 0 : 1
    const bPaid = b.tools[0]?.mustPurchase ? 0 : 1
    return aPaid - bPaid
  })

  return services
}
