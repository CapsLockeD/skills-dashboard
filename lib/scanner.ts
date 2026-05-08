import fs from 'fs'
import path from 'path'
import { ScanResult, ScanHistory, SubResource, N8nNodeInfo } from '../types'
import { readRegistry } from './registry'
import { ensureRepo, fetchUpstream, getCommitsAhead, getDiff, getRepoPath } from './git-ops'
import { extractUrlsFromDiff, buildEndpointChanges } from './endpoint-extractor'
import { reviewDiff } from './ai-reviewer'
import { findN8nWorkflows, parseN8nWorkflow } from './n8n-parser'
import { discoverSkillSubResources } from './skill-parser'

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

  // For Claude skills and reference kits: each SKILL.md directory is a sub-skill
  return discoverSkillSubResources(repoPath)
}

export async function scanResource(resourceId: string): Promise<ScanResult> {
  const registry = readRegistry()
  const resource = registry.resources.find((r) => r.id === resourceId)

  const base: Omit<ScanResult, 'status' | 'commitsAhead' | 'diff' | 'endpointChanges' | 'aiSummary' | 'aiSecurityAssessment' | 'aiRecommendation' | 'aiReasoning'> = {
    resourceId,
    scannedAt: new Date().toISOString(),
    subResources: [],
  }

  if (!resource) {
    return { ...base, status: 'error', commitsAhead: 0, diff: '', endpointChanges: [], aiSummary: '', aiSecurityAssessment: '', aiRecommendation: null, aiReasoning: '', error: 'Resource not found in registry' }
  }

  if (!resource.upstream_git_url) {
    return {
      ...base,
      status: 'no-upstream',
      commitsAhead: 0,
      diff: '',
      endpointChanges: [],
      aiSummary: 'No upstream git URL configured.',
      aiSecurityAssessment: 'Cannot perform automated checks without an upstream source.',
      aiRecommendation: null,
      aiReasoning: 'Add upstream_git_url to registry.config.json to enable tracking.',
    }
  }

  try {
    const git = await ensureRepo(resourceId, resource.upstream_git_url)
    await fetchUpstream(git)

    const repoPath = getRepoPath(resourceId)
    const commitsAhead = await getCommitsAhead(git)
    const subResources = discoverSubResources(repoPath, resource.type)

    // For n8n workflows, also keep the flat node list for the detailed panel
    let n8nNodes: N8nNodeInfo[] | undefined
    if (resource.type === 'n8n-workflow' || resource.type === 'mixed') {
      const wfPaths = findN8nWorkflows(repoPath)
      n8nNodes = wfPaths.flatMap((wf) => {
        try { return parseN8nWorkflow(wf).nodes } catch { return [] }
      })
    }

    if (commitsAhead === 0) {
      return {
        ...base,
        status: 'up-to-date',
        commitsAhead: 0,
        diff: '',
        endpointChanges: [],
        aiSummary: 'Repository is up to date with upstream.',
        aiSecurityAssessment: 'No changes to assess.',
        aiRecommendation: null,
        aiReasoning: '',
        subResources,
        n8nNodes,
      }
    }

    const diff = await getDiff(git)

    // Compare endpoint changes against previous scan
    const history = readScanHistory()
    const previousUrls = history.results[resourceId]?.[0]?.endpointChanges?.map((e) => e.url) ?? []
    const { added, removed } = extractUrlsFromDiff(diff)
    const endpointChanges = buildEndpointChanges(previousUrls, added, removed)

    const review = await reviewDiff(resource.name, resource.type, diff, endpointChanges)
    const status = review.recommendation === 'DO_NOT_MERGE' ? 'security-flag' : 'update-available'

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
      error: err instanceof Error ? err.message : String(err),
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

export function saveSingleResult(result: ScanResult): void {
  const history = readScanHistory()
  if (!history.results[result.resourceId]) history.results[result.resourceId] = []
  history.results[result.resourceId].unshift(result)
  history.results[result.resourceId] = history.results[result.resourceId].slice(0, 10)
  writeScanHistory(history)
}
