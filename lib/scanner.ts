import fs from 'fs'
import path from 'path'
import { ScanResult, ScanHistory, SubResource, N8nNodeInfo } from '../types'
import { readRegistry } from './registry'
import { ensureRepo, fetchUpstream, getCommitsAhead, getDiff, getRepoPath } from './git-ops'
import { extractUrlsFromDiff, buildEndpointChanges } from './endpoint-extractor'
import { reviewDiff } from './ai-reviewer'
import { findN8nWorkflows, parseN8nWorkflow } from './n8n-parser'
import { discoverSkillSubResources } from './skill-parser'
import { isEnrichable, enrichBatch } from './skill-enricher'
import { parseAutomationTool } from './tool-parser'
import { getLibrarySummary, getLibraryServices } from './library-parser'
import { initProgress, setTotal, logProgress, doneProgress } from './progress-store'

function getDataDir(): string {
  return process.env.DATA_DIR || path.join(process.cwd(), 'data')
}

function getResultsPath(): string {
  return path.join(getDataDir(), 'scan-results.json')
}

export function readScanHistory(): ScanHistory {
  const p = getResultsPath()
  if (!fs.existsSync(p)) return { results: {}, lastGlobalScan: null }
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8'))
  } catch {
    return { results: {}, lastGlobalScan: null }
  }
}

export function writeScanHistory(history: ScanHistory): void {
  fs.mkdirSync(getDataDir(), { recursive: true })
  fs.writeFileSync(getResultsPath(), JSON.stringify(history, null, 2) + '\n')
}

export function getLatestResult(resourceId: string): ScanResult | null {
  const history = readScanHistory()
  return history.results[resourceId]?.[0] ?? null
}

/** Resolve the filesystem path for a sub-resource given the repo root. */
function skillDirFromSubResource(repoPath: string, srPath: string): string {
  const full = path.join(repoPath, srPath)
  // Root-level SKILL.md → use repo root so all skill files are included.
  // Any other .md file (e.g. reference-kit docs) → use the file itself directly.
  if (path.basename(srPath) === 'SKILL.md') return path.dirname(full)
  return full
}

/** For claude-skill sub-resources that are thin, enrich them with AI. */
async function enrichThinSubSkills(
  subResources: SubResource[],
  repoPath: string,
  resourceId: string
): Promise<void> {
  const toEnrich = subResources.filter(
    (sr) => (sr.type === 'skill' || sr.type === 'module') && isEnrichable(sr.description, sr.tools.length)
  )
  if (toEnrich.length === 0) {
    doneProgress(resourceId, '[scanner] no thin skills to enrich')
    return
  }

  // Update the total now that we know how many skills we're enriching
  setTotal(resourceId, toEnrich.length)

  const items = toEnrich.map((sr) => ({
    skillDir: skillDirFromSubResource(repoPath, sr.path),
    cacheKey: `${resourceId}:${sr.path}`,
    sr,
  }))

  const enrichmentMap = await enrichBatch(
    items.map(({ skillDir, cacheKey }) => ({ skillDir, cacheKey })),
    5,
    resourceId
  )

  for (const { skillDir, sr } of items) {
    const enrichment = enrichmentMap.get(skillDir)
    if (enrichment) sr.enrichment = enrichment
  }

  doneProgress(resourceId, '[scanner] enrichment complete')
}

function discoverSubResources(repoPath: string, resourceType: string): SubResource[] {
  if (!fs.existsSync(repoPath)) return []

  if (resourceType === 'n8n-workflow' || resourceType === 'mixed') {
    // For n8n: each workflow JSON is a sub-resource with semantic tool info
    return findN8nWorkflows(repoPath).map((wfPath) => {
      try {
        return parseN8nWorkflow(wfPath).subResource
      } catch {
        return null
      }
    }).filter((s): s is SubResource => s !== null)
  }

  if (resourceType === 'reference-kit') {
    // For reference kits: each markdown file is a document sub-resource
    return fs.readdirSync(repoPath, { withFileTypes: true })
      .filter((e) => e.isFile() && /\.(md|mdx)$/i.test(e.name))
      .map((e) => ({
        name: e.name.replace(/\.(md|mdx)$/i, '').replace(/[-_]/g, ' '),
        path: '/' + e.name,
        type: 'skill' as const,
        description: 'Reference document',
        tools: [],
      }))
  }

  if (resourceType === 'automation-tool') {
    const { subResources, tooLarge, totalFiles } = parseAutomationTool(repoPath)
    if (tooLarge) {
      console.log(`[scanner] automation-tool repo has ${totalFiles} files — capped at 100 modules, skipping AI enrichment`)
    }
    return subResources
  }

  if (resourceType === 'library') {
    return getLibraryServices(repoPath)
  }

  // For Claude skills: each SKILL.md directory is a sub-skill
  return discoverSkillSubResources(repoPath)
}

export async function scanResource(resourceId: string): Promise<ScanResult> {
  // Init progress store for this scan (total will be updated once we know skill count)
  initProgress(resourceId, 1)
  logProgress(resourceId, `[scanner] starting scan for ${resourceId}`)

  const registry = readRegistry()
  const resource = registry.resources.find((r) => r.id === resourceId)

  const base: Omit<ScanResult, 'status' | 'commitsAhead' | 'diff' | 'endpointChanges' | 'aiSummary' | 'aiSecurityAssessment' | 'aiRecommendation' | 'aiReasoning'> = {
    resourceId,
    scannedAt: new Date().toISOString(),
    subResources: [],
  }

  if (!resource) {
    doneProgress(resourceId, '[scanner] error: resource not found')
    return { ...base, status: 'error', commitsAhead: 0, diff: '', endpointChanges: [], aiSummary: '', aiSecurityAssessment: '', aiRecommendation: null, aiReasoning: '', error: 'Resource not found in registry' }
  }

  if (!resource.upstream_git_url) {
    // No upstream to track, but still read local files for sub-skill discovery
    const localPath = resource.local_path
    const subResources = localPath ? discoverSubResources(localPath, resource.type) : []
    let n8nNodes: N8nNodeInfo[] | undefined
    if (localPath && (resource.type === 'n8n-workflow' || resource.type === 'mixed')) {
      const wfPaths = findN8nWorkflows(localPath)
      n8nNodes = wfPaths.flatMap((wf) => {
        try { return parseN8nWorkflow(wf).nodes } catch { return [] }
      })
    }
    if (localPath && resource.type !== 'n8n-workflow') {
      await enrichThinSubSkills(subResources, localPath, resourceId)
    } else {
      doneProgress(resourceId, '[scanner] done')
    }

    return {
      ...base,
      subResources,
      n8nNodes,
      status: 'no-upstream',
      commitsAhead: 0,
      diff: '',
      endpointChanges: [],
      aiSummary: localPath
        ? 'No upstream git URL — showing sub-skills from local files.'
        : 'No upstream git URL configured.',
      aiSecurityAssessment: 'Cannot perform automated security checks without an upstream source.',
      aiRecommendation: null,
      aiReasoning: localPath
        ? 'Set upstream_git_url in registry.config.json to enable update tracking.'
        : 'Set local_path in registry.config.json to enable sub-skill discovery.',
    }
  }

  try {
    logProgress(resourceId, '[scanner] cloning / fetching upstream...')
    const git = await ensureRepo(resourceId, resource.upstream_git_url)
    await fetchUpstream(git)

    const repoPath = getRepoPath(resourceId)
    const commitsAhead = await getCommitsAhead(git)
    logProgress(resourceId, `[scanner] ${commitsAhead} commits ahead — discovering sub-resources...`)
    const subResources = discoverSubResources(repoPath, resource.type)
    logProgress(resourceId, `[scanner] found ${subResources.length} sub-resources`)

    // For n8n workflows, also keep the flat node list for the detailed panel
    let n8nNodes: N8nNodeInfo[] | undefined
    if (resource.type === 'n8n-workflow' || resource.type === 'mixed') {
      const wfPaths = findN8nWorkflows(repoPath)
      n8nNodes = wfPaths.flatMap((wf) => {
        try { return parseN8nWorkflow(wf).nodes } catch { return [] }
      })
    }

    const skipEnrich = resource.type === 'n8n-workflow' || resource.type === 'library' || subResources.length > 100
    if (!skipEnrich) {
      await enrichThinSubSkills(subResources, repoPath, resourceId)
    } else if (subResources.length > 100) {
      logProgress(resourceId, `[scanner] ${subResources.length} modules — skipping AI enrichment for large repo`)
      doneProgress(resourceId, '[scanner] done')
    }

    if (commitsAhead === 0) {
      let upToDateSummary = 'Repository is up to date with upstream.'
      if (resource.type === 'library') {
        logProgress(resourceId, '[scanner] generating README summary...')
        const readmeSummary = await getLibrarySummary(repoPath)
        if (readmeSummary) upToDateSummary = readmeSummary
      }
      doneProgress(resourceId, '[scanner] up to date with upstream')
      return {
        ...base,
        status: 'up-to-date',
        commitsAhead: 0,
        diff: '',
        endpointChanges: [],
        aiSummary: upToDateSummary,
        aiSecurityAssessment: 'No changes to assess.',
        aiRecommendation: null,
        aiReasoning: '',
        subResources,
        n8nNodes,
      }
    }

    logProgress(resourceId, `[scanner] ${commitsAhead} commits behind — fetching diff...`)
    const diff = await getDiff(git)

    // Compare endpoint changes against previous scan
    const history = readScanHistory()
    const previousUrls = history.results[resourceId]?.[0]?.endpointChanges?.map((e) => e.url) ?? []
    const { added, removed } = extractUrlsFromDiff(diff)
    const endpointChanges = buildEndpointChanges(previousUrls, added, removed)

    logProgress(resourceId, '[scanner] running AI security review...')
    const review = await reviewDiff(resource.name, resource.type, diff, endpointChanges)
    const status = review.recommendation === 'DO_NOT_MERGE' ? 'security-flag' : 'update-available'
    doneProgress(resourceId, `[scanner] done — ${status}`)

    return {
      ...base,
      status,
      commitsAhead,
      diff,
      endpointChanges,
      aiSummary: review.summary,
      aiSecurityAssessment: review.securityAssessment,
      aiRecommendation: review.recommendation,
      aiReasoning: review.reasoning,
      subResources,
      n8nNodes,
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    doneProgress(resourceId, `[scanner] error: ${errMsg}`)
    return {
      ...base,
      status: 'error',
      commitsAhead: 0,
      diff: '',
      endpointChanges: [],
      aiSummary: '',
      aiSecurityAssessment: '',
      aiRecommendation: null,
      aiReasoning: '',
      error: errMsg,
    }
  }
}

export async function scanAll(): Promise<void> {
  const registry = readRegistry()
  const history = readScanHistory()

  for (const resource of registry.resources) {
    if (resource.skip_auto_update) continue
    const result = await scanResource(resource.id)
    if (!history.results[resource.id]) history.results[resource.id] = []
    history.results[resource.id].unshift(result)
    history.results[resource.id] = history.results[resource.id].slice(0, 10)
  }

  history.lastGlobalScan = new Date().toISOString()
  writeScanHistory(history)
}

// Serialize all writes to prevent race conditions when multiple scans run in parallel
let writeQueue: Promise<void> = Promise.resolve()

export function saveSingleResult(result: ScanResult): void {
  writeQueue = writeQueue
    .then(() => {
      const history = readScanHistory()
      if (!history.results[result.resourceId]) history.results[result.resourceId] = []
      history.results[result.resourceId].unshift(result)
      history.results[result.resourceId] = history.results[result.resourceId].slice(0, 10)
      writeScanHistory(history)
    })
    .catch((err) => {
      // Swallow so the queue never stays permanently rejected
      console.error('[scanner] saveSingleResult failed:', err)
    })
}
