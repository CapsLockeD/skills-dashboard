/**
 * AI enrichment for "thin" sub-skills — SKILL.md files with minimal
 * descriptions and no detected external tools. Reads all files in the
 * skill directory, calls the AI model, and returns structured metadata.
 *
 * Results are cached by content hash so rescanning a repo doesn't
 * re-call the API unless the skill content actually changed.
 */

import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { SubResourceEnrichment } from '../types'
import { aiComplete } from './ai-client'
import { logProgress, incrementProgress } from './progress-store'

function getDataDir(): string {
  return process.env.DATA_DIR || path.join(process.cwd(), 'data')
}

function getCachePath(): string {
  return path.join(getDataDir(), 'enrichment-cache.json')
}

function readCache(): Record<string, SubResourceEnrichment> {
  const p = getCachePath()
  try {
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf-8'))
  } catch {}
  return {}
}

function writeCache(cache: Record<string, SubResourceEnrichment>): void {
  fs.mkdirSync(getDataDir(), { recursive: true })
  fs.writeFileSync(getCachePath(), JSON.stringify(cache, null, 2) + '\n')
}

function contentHash(content: string): string {
  return crypto.createHash('md5').update(content).digest('hex').slice(0, 10)
}

/** Read content from a skill path (file or directory), capped to keep prompt size reasonable. */
function readSkillContent(skillPath: string): string {
  const ALLOWED_EXTS = new Set(['.md', '.txt', '.js', '.ts', '.py', '.sh'])
  const MAX_CHARS = 4000

  const parts: string[] = []
  let total = 0

  try {
    const stat = fs.statSync(skillPath)

    if (stat.isFile()) {
      // Single file (e.g. reference-kit document) — read just that file
      const content = fs.readFileSync(skillPath, 'utf-8')
      parts.push(`=== ${path.basename(skillPath)} ===\n${content}`.slice(0, MAX_CHARS))
    } else {
      // Directory — read all relevant files, SKILL.md first
      const entries = fs.readdirSync(skillPath, { withFileTypes: true })
        .filter(e => e.isFile() && !e.name.startsWith('.') && ALLOWED_EXTS.has(path.extname(e.name).toLowerCase()))
        .sort((a, b) => {
          if (a.name === 'SKILL.md') return -1
          if (b.name === 'SKILL.md') return 1
          return a.name.localeCompare(b.name)
        })

      for (const entry of entries) {
        if (total >= MAX_CHARS) break
        try {
          const content = fs.readFileSync(path.join(skillPath, entry.name), 'utf-8')
          const chunk = `=== ${entry.name} ===\n${content}`.slice(0, MAX_CHARS - total)
          parts.push(chunk)
          total += chunk.length
        } catch { /* skip unreadable files */ }
      }
    }
  } catch { /* path not found or unreadable */ }

  return parts.join('\n\n')
}

const PROMPT_TEMPLATE = (content: string) => `/no_think
You are analyzing an AI skill/prompt file to extract useful metadata for a developer dashboard.

Read the following skill content carefully:

${content}

Extract structured information and respond with ONLY valid JSON (no markdown fences, no commentary):

{
  "summary": "2-3 sentences explaining what this skill does, what problem it solves, and when a developer would reach for it",
  "category": "exactly one of: developer-tooling | seo | content-marketing | automation | data-analysis | communication | image-video | email | social-media | research | other",
  "useCase": "one concrete sentence describing the most common or valuable use case",
  "output": "one sentence describing what this skill produces or delivers as output",
  "complexity": "exactly one of: beginner | intermediate | advanced",
  "standalone": true or false (false means it is explicitly designed to chain with or depend on other skills/tools),
  "detectedTools": ["list any external APIs, services, or tools mentioned that would require accounts, credentials, or purchases — empty array if none"]
}`

/** Returns true when a sub-skill is worth enriching with AI */
export function isEnrichable(description: string | undefined, toolCount: number): boolean {
  if (toolCount > 0 && description && description.length >= 100) return false
  return true
}

/**
 * Enrich a single skill directory with AI-extracted metadata.
 * Returns null if the directory has no readable content or the AI call fails.
 * Results are cached keyed by (cacheKey + content hash) to avoid redundant calls.
 */
export async function enrichSkillDir(
  skillDir: string,
  cacheKey: string
): Promise<SubResourceEnrichment | null> {
  const content = readSkillContent(skillDir)
  if (!content.trim()) return null

  const hash = contentHash(content)
  const fullKey = `${cacheKey}::${hash}`

  const cache = readCache()
  if (cache[fullKey]) return cache[fullKey]

  try {
    const raw = await aiComplete(PROMPT_TEMPLATE(content))
    // Strip <think>...</think> blocks produced by reasoning models (e.g. qwen3)
    const response = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
    const match = response.match(/\{[\s\S]*\}/)
    if (!match) {
      console.log(`[enricher] no JSON in response for ${cacheKey} — first 200 chars: ${response.slice(0, 200)}`)
      return null
    }

    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(match[0])
    } catch (parseErr) {
      console.log(`[enricher] JSON parse failed for ${cacheKey}: ${parseErr} — matched: ${match[0].slice(0, 200)}`)
      return null
    }

    const enrichment: SubResourceEnrichment = {
      summary: String(parsed.summary || '').slice(0, 500),
      category: String(parsed.category || 'other'),
      useCase: String(parsed.useCase || '').slice(0, 200),
      output: String(parsed.output || '').slice(0, 200),
      complexity: ['beginner', 'intermediate', 'advanced'].includes(String(parsed.complexity))
        ? String(parsed.complexity)
        : 'intermediate',
      standalone: parsed.standalone !== false,
      detectedTools: Array.isArray(parsed.detectedTools)
        ? parsed.detectedTools.map(String).slice(0, 10)
        : [],
      enrichedAt: new Date().toISOString(),
    }

    cache[fullKey] = enrichment
    writeCache(cache)
    return enrichment
  } catch (err) {
    console.log(`[enricher] exception for ${cacheKey}: ${err}`)
    return null
  }
}

/**
 * Enrich a batch of skill directories concurrently, max CONCURRENCY at a time.
 * Mutates the passed enrichment map in place: skillPath → enrichment result.
 */
export async function enrichBatch(
  items: { skillDir: string; cacheKey: string }[],
  concurrency = 3,
  resourceId?: string
): Promise<Map<string, SubResourceEnrichment>> {
  const results = new Map<string, SubResourceEnrichment>()

  // Read cache up front — count how many are already done
  const cache = readCache()
  const uncached = items.filter(({ skillDir, cacheKey }) => {
    try {
      const content = readSkillContent(skillDir)
      const hash = contentHash(content)
      return !cache[`${cacheKey}::${hash}`]
    } catch {
      return true
    }
  })

  const msg = `[enricher] ${items.length} skills — ${uncached.length} need AI enrichment, ${items.length - uncached.length} cached`
  console.log(msg)
  if (resourceId) logProgress(resourceId, msg)

  let done = 0
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency)
    await Promise.all(
      batch.map(async ({ skillDir, cacheKey }) => {
        const result = await enrichSkillDir(skillDir, cacheKey)
        done++
        const skillName = cacheKey.split(':').pop() ?? skillDir
        if (result) {
          results.set(skillDir, result)
          const enrichMsg = `[enricher] ${done}/${items.length} — ${skillName} → ${result.category}`
          console.log(enrichMsg)
          if (resourceId) incrementProgress(resourceId, enrichMsg)
        } else {
          if (resourceId) incrementProgress(resourceId, `[enricher] ${done}/${items.length} — ${skillName} (skipped)`)
        }
      })
    )
  }

  const doneMsg = `[enricher] done — ${results.size} enriched`
  console.log(doneMsg)
  if (resourceId) logProgress(resourceId, doneMsg)
  return results
}
