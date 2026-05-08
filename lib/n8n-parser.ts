import fs from 'fs'
import path from 'path'
import { N8nNodeInfo, SubResource, ToolUsage } from '../types'

interface N8nWorkflow {
  name?: string
  nodes?: N8nNode[]
}

interface N8nNode {
  name: string
  type: string
  parameters?: Record<string, unknown>
  credentials?: Record<string, unknown>
}

// ── Credential type → service mapping ────────────────────────────────────────
const CREDENTIAL_MAP: Record<string, { service: string; mustPurchase: boolean }> = {
  openAiApi: { service: 'OpenAI', mustPurchase: true },
  openRouterApi: { service: 'OpenRouter', mustPurchase: true },
  googleSheetsOAuth2Api: { service: 'Google Sheets', mustPurchase: false },
  googleDocsOAuth2Api: { service: 'Google Docs', mustPurchase: false },
  googleDriveOAuth2Api: { service: 'Google Drive', mustPurchase: false },
  slackApi: { service: 'Slack', mustPurchase: false },
  slackOAuth2Api: { service: 'Slack', mustPurchase: false },
  redditOAuth2Api: { service: 'Reddit API', mustPurchase: false },
  linkedInOAuth2Api: { service: 'LinkedIn API', mustPurchase: false },
  twitterOAuth2Api: { service: 'Twitter / X', mustPurchase: true },
  anthropicApi: { service: 'Anthropic / Claude', mustPurchase: true },
  cohereApi: { service: 'Cohere', mustPurchase: true },
  groqApi: { service: 'Groq', mustPurchase: true },
  mistralCloudApi: { service: 'Mistral', mustPurchase: true },
  huggingFaceApi: { service: 'Hugging Face', mustPurchase: true },
  airtableTokenApi: { service: 'Airtable', mustPurchase: true },
  notionApi: { service: 'Notion', mustPurchase: false },
  githubApi: { service: 'GitHub', mustPurchase: false },
  mailchimpApi: { service: 'Mailchimp', mustPurchase: true },
  hubspotApi: { service: 'HubSpot', mustPurchase: true },
}

// ── Node type → service mapping (for nodes without credentials) ───────────────
const NODE_TYPE_MAP: Record<string, { service: string; mustPurchase: boolean }> = {
  'n8n-nodes-base.reddit': { service: 'Reddit API', mustPurchase: false },
  'n8n-nodes-base.linkedIn': { service: 'LinkedIn API', mustPurchase: false },
  'n8n-nodes-base.twitter': { service: 'Twitter / X', mustPurchase: true },
  'n8n-nodes-base.slack': { service: 'Slack', mustPurchase: false },
  'n8n-nodes-base.slackTrigger': { service: 'Slack', mustPurchase: false },
  'n8n-nodes-base.googleSheets': { service: 'Google Sheets', mustPurchase: false },
  'n8n-nodes-base.googleDocs': { service: 'Google Docs', mustPurchase: false },
  'n8n-nodes-base.googleDrive': { service: 'Google Drive', mustPurchase: false },
  'n8n-nodes-base.gmail': { service: 'Gmail', mustPurchase: false },
  'n8n-nodes-base.github': { service: 'GitHub', mustPurchase: false },
  'n8n-nodes-base.notion': { service: 'Notion', mustPurchase: false },
  'n8n-nodes-base.airtable': { service: 'Airtable', mustPurchase: true },
  'n8n-nodes-base.mailchimp': { service: 'Mailchimp', mustPurchase: true },
  'n8n-nodes-base.hubspot': { service: 'HubSpot', mustPurchase: true },
}

// ── HTTP URL → service name inference ────────────────────────────────────────
function inferServiceFromUrl(url: string): { service: string; mustPurchase: boolean; endpoint: string } | null {
  const patterns: { re: RegExp; service: string; mustPurchase: boolean; labelFn?: (m: RegExpMatchArray) => string }[] = [
    // Apify — extract actor name from URL for more specific info
    {
      re: /api\.apify\.com\/v2\/acts\/([^/]+)/,
      service: 'Apify',
      mustPurchase: true,
      labelFn: (m) => `Apify: ${m[1].replace('~', ' / ')}`,
    },
    { re: /api\.apify\.com\/v2\/datasets/, service: 'Apify', mustPurchase: true },
    { re: /api\.openai\.com/, service: 'OpenAI', mustPurchase: true },
    { re: /api\.anthropic\.com/, service: 'Anthropic / Claude', mustPurchase: true },
    { re: /fal\.run|fal\.ai/, service: 'fal.ai', mustPurchase: true },
    { re: /replicate\.com/, service: 'Replicate', mustPurchase: true },
    { re: /openrouter\.ai/, service: 'OpenRouter', mustPurchase: true },
    { re: /api\.dataforseo\.com/, service: 'DataForSEO', mustPurchase: true },
    { re: /api\.moz\.com/, service: 'Moz', mustPurchase: true },
    { re: /googleapis\.com\/youtube/, service: 'YouTube Data API', mustPurchase: false },
    { re: /googleapis\.com\/sheets/, service: 'Google Sheets API', mustPurchase: false },
    { re: /searchconsole\.googleapis/, service: 'Google Search Console', mustPurchase: false },
    { re: /analyticsdata\.googleapis/, service: 'Google Analytics', mustPurchase: false },
    { re: /pagespeedonline\.googleapis/, service: 'Google PageSpeed', mustPurchase: false },
    { re: /api\.twitter\.com|api\.x\.com/, service: 'Twitter / X API', mustPurchase: true },
    { re: /api\.linkedin\.com/, service: 'LinkedIn API', mustPurchase: false },
    { re: /hooks\.slack\.com|slack\.com\/api/, service: 'Slack', mustPurchase: false },
    { re: /api\.hubapi\.com/, service: 'HubSpot', mustPurchase: true },
    { re: /api\.mailchimp\.com/, service: 'Mailchimp', mustPurchase: true },
  ]

  for (const p of patterns) {
    const m = url.match(p.re)
    if (m) {
      const service = p.labelFn ? p.labelFn(m) : p.service
      return { service, mustPurchase: p.mustPurchase, endpoint: new URL(url.startsWith('http') ? url : `https://${url}`).hostname }
    }
  }
  return null
}

// ── Public API ────────────────────────────────────────────────────────────────

export function isN8nWorkflow(filePath: string): boolean {
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    const parsed = JSON.parse(content)
    return Array.isArray(parsed.nodes) && parsed.nodes.length > 0
  } catch {
    return false
  }
}

export function parseN8nWorkflow(filePath: string): {
  nodes: N8nNodeInfo[]
  subResource: SubResource
} {
  const content = fs.readFileSync(filePath, 'utf-8')
  const workflow: N8nWorkflow = JSON.parse(content)
  const nodes = workflow.nodes || []

  // Build deduplicated tool list for this workflow
  const toolMap = new Map<string, ToolUsage>()

  function addTool(tool: ToolUsage) {
    if (!toolMap.has(tool.service)) toolMap.set(tool.service, tool)
  }

  const nodeInfos: N8nNodeInfo[] = nodes.map((node) => {
    const info: N8nNodeInfo = { type: node.type, name: node.name }

    // Extract HTTP Request node URLs
    const isHttp = node.type === 'n8n-nodes-base.httpRequest' || node.type.toLowerCase().includes('httprequest')
    if (isHttp && node.parameters) {
      const urls: string[] = []
      const rawUrl = node.parameters.url
      if (typeof rawUrl === 'string' && rawUrl.startsWith('http')) urls.push(rawUrl)
      const baseUrl = node.parameters.baseURL
      if (typeof baseUrl === 'string' && baseUrl.startsWith('http')) urls.push(baseUrl)
      if (urls.length) {
        info.httpUrls = urls
        for (const url of urls) {
          const inferred = inferServiceFromUrl(url)
          if (inferred) {
            addTool({
              service: inferred.service,
              purpose: node.name, // Use the node name as the purpose context
              mustPurchase: inferred.mustPurchase,
              endpoint: inferred.endpoint,
            })
          }
        }
      }
    }

    // Extract credential-based services
    if (node.credentials) {
      const credKeys = Object.keys(node.credentials)
      info.credentials = credKeys
      for (const key of credKeys) {
        const mapped = CREDENTIAL_MAP[key]
        if (mapped) {
          addTool({
            service: mapped.service,
            purpose: node.name,
            mustPurchase: mapped.mustPurchase,
            credentialKey: key,
          })
        }
      }
    }

    // Node type map (for nodes that don't have explicit credentials listed)
    if (!node.credentials) {
      const mapped = NODE_TYPE_MAP[node.type]
      if (mapped) {
        addTool({
          service: mapped.service,
          purpose: node.name,
          mustPurchase: mapped.mustPurchase,
        })
      }
    }

    return info
  })

  const tools = [...toolMap.values()]

  return {
    nodes: nodeInfos,
    subResource: {
      name: workflow.name || path.basename(filePath, '.json'),
      path: filePath,
      type: 'workflow',
      description: `${nodes.length} nodes — ${tools.length} external service${tools.length !== 1 ? 's' : ''}`,
      tools,
    },
  }
}

export function findN8nWorkflows(repoPath: string): string[] {
  const results: string[] = []

  function walk(dir: string) {
    if (!fs.existsSync(dir)) return
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        walk(full)
      } else if (entry.isFile() && entry.name.endsWith('.json') && isN8nWorkflow(full)) {
        results.push(full)
      }
    }
  }

  walk(repoPath)
  return results
}
