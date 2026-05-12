import fs from 'fs'
import path from 'path'
import { SubResource, ToolUsage } from '../types'

// ── npm package → service mapping ────────────────────────────────────────────

export const NPM_SERVICE_MAP: Record<string, { service: string; mustPurchase: boolean }> = {
  '@anthropic-ai/sdk':             { service: 'Anthropic / Claude', mustPurchase: true },
  'openai':                        { service: 'OpenAI', mustPurchase: true },
  '@google-ai/generativelanguage': { service: 'Google Gemini', mustPurchase: true },
  '@google-cloud/vertexai':        { service: 'Google Vertex AI', mustPurchase: true },
  '@google-analytics/data':        { service: 'Google Analytics 4 API', mustPurchase: false },
  'apify-client':                  { service: 'Apify', mustPurchase: true },
  'resend':                        { service: 'Resend', mustPurchase: false },
  'nodemailer':                    { service: 'SMTP / Nodemailer', mustPurchase: false },
  '@sendgrid/mail':                { service: 'SendGrid', mustPurchase: true },
  'mailchimp-marketing':           { service: 'Mailchimp', mustPurchase: true },
  'twilio':                        { service: 'Twilio', mustPurchase: true },
  'stripe':                        { service: 'Stripe', mustPurchase: true },
  'puppeteer':                     { service: 'Puppeteer (browser)', mustPurchase: false },
  'puppeteer-core':                { service: 'Puppeteer (browser)', mustPurchase: false },
  'playwright':                    { service: 'Playwright (browser)', mustPurchase: false },
  '@playwright/test':              { service: 'Playwright (browser)', mustPurchase: false },
  'cheerio':                       { service: 'HTML Scraper (cheerio)', mustPurchase: false },
  'slack-bolt':                    { service: 'Slack', mustPurchase: false },
  '@slack/web-api':                { service: 'Slack', mustPurchase: false },
  'discord.js':                    { service: 'Discord', mustPurchase: false },
  'airtable':                      { service: 'Airtable', mustPurchase: true },
  '@notionhq/client':              { service: 'Notion', mustPurchase: false },
  'googleapis':                    { service: 'Google APIs', mustPurchase: false },
  'twitter-api-v2':                { service: 'Twitter / X', mustPurchase: true },
  'youtube-transcript':            { service: 'YouTube', mustPurchase: false },
  'rss-parser':                    { service: 'RSS Feeds', mustPurchase: false },
  'node-cron':                     { service: 'Cron Scheduler', mustPurchase: false },
  'firecrawl-js':                  { service: 'Firecrawl', mustPurchase: true },
  '@mendable/firecrawl-js':        { service: 'Firecrawl', mustPurchase: true },
  'langchain':                     { service: 'LangChain', mustPurchase: false },
  '@langchain/core':               { service: 'LangChain', mustPurchase: false },
  '@langchain/anthropic':          { service: 'LangChain + Claude', mustPurchase: true },
  '@langchain/openai':             { service: 'LangChain + OpenAI', mustPurchase: true },
  'yt-dlp-wrap':                   { service: 'yt-dlp (YouTube download)', mustPurchase: false },
  'aws-sdk':                       { service: 'AWS', mustPurchase: true },
  '@aws-sdk/client-s3':            { service: 'AWS S3', mustPurchase: true },
  '@aws-sdk/client-ses':           { service: 'AWS SES', mustPurchase: true },
  'hubspot':                       { service: 'HubSpot', mustPurchase: true },
  '@hubspot/api-client':           { service: 'HubSpot', mustPurchase: true },
  'replicate':                     { service: 'Replicate', mustPurchase: true },
  'fal-client':                    { service: 'fal.ai', mustPurchase: true },
}

// Python package → service mapping (pip)
export const PY_SERVICE_MAP: Record<string, { service: string; mustPurchase: boolean }> = {
  'anthropic':    { service: 'Anthropic / Claude', mustPurchase: true },
  'openai':       { service: 'OpenAI', mustPurchase: true },
  'google-generativeai': { service: 'Google Gemini', mustPurchase: true },
  'apify-client': { service: 'Apify', mustPurchase: true },
  'boto3':        { service: 'AWS', mustPurchase: true },
  'twilio':       { service: 'Twilio', mustPurchase: true },
  'stripe':       { service: 'Stripe', mustPurchase: true },
  'slack-sdk':    { service: 'Slack', mustPurchase: false },
  'discord.py':   { service: 'Discord', mustPurchase: false },
  'notion-client':{ service: 'Notion', mustPurchase: false },
  'requests':     { service: 'HTTP Client', mustPurchase: false },
  'httpx':        { service: 'HTTP Client', mustPurchase: false },
  'playwright':   { service: 'Playwright (browser)', mustPurchase: false },
  'selenium':     { service: 'Selenium (browser)', mustPurchase: false },
  'praw':         { service: 'Reddit API', mustPurchase: false },
  'tweepy':       { service: 'Twitter / X', mustPurchase: true },
  'yt-dlp':       { service: 'yt-dlp (YouTube download)', mustPurchase: false },
  'feedparser':   { service: 'RSS Feeds', mustPurchase: false },
}

// ── Next.js / framework special filenames that get their name from parent dir ─

const FRAMEWORK_SPECIAL_FILES = new Set([
  'route', 'page', 'layout', 'loading', 'error', 'not-found', 'template', 'middleware',
])

// ── Source file name → human role ─────────────────────────────────────────────

const FILE_ROLE_MAP: Record<string, string> = {
  'reddit':     'Reddit scraper',
  'twitter':    'Twitter/X scraper',
  'youtube':    'YouTube scraper',
  'instagram':  'Instagram scraper',
  'linkedin':   'LinkedIn scraper',
  'tiktok':     'TikTok scraper',
  'email':      'Email delivery',
  'file':       'File output',
  'summarizer': 'AI summarizer',
  'formatter':  'Content formatter',
  'index':      'Main orchestrator',
  'main':       'Main orchestrator',
  'app':        'Application entry',
  'setup':      'Setup wizard',
  'config':     'Configuration',
  'scheduler':  'Scheduler',
  'scraper':    'Web scraper',
  'parser':     'Content parser',
  'enricher':   'Data enricher',
  'webhook':    'Webhook handler',
  'server':     'HTTP server',
  'worker':     'Background worker',
  'cli':        'CLI interface',
  'api':        'API client',
  'db':         'Database client',
  'storage':    'Storage handler',
  'auth':       'Authentication',
  'utils':      'Utilities',
  'helpers':    'Helpers',
}

// ── Readers ───────────────────────────────────────────────────────────────────

interface PackageJson {
  name?: string
  description?: string
  version?: string
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  scripts?: Record<string, string>
}

function readPackageJson(repoPath: string): PackageJson | null {
  const p = path.join(repoPath, 'package.json')
  if (!fs.existsSync(p)) return null
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')) } catch { return null }
}

function readRequirementsTxt(repoPath: string): string[] {
  for (const name of ['requirements.txt', 'requirements-prod.txt']) {
    const p = path.join(repoPath, name)
    if (!fs.existsSync(p)) continue
    return fs.readFileSync(p, 'utf-8')
      .split('\n')
      .map(l => l.split(/[=><~!]/)[0].trim().toLowerCase())
      .filter(Boolean)
  }
  return []
}

function readEnvExampleKeys(repoPath: string): string[] {
  for (const name of ['.env.example', '.env.sample', '.env.template']) {
    const p = path.join(repoPath, name)
    if (!fs.existsSync(p)) continue
    return fs.readFileSync(p, 'utf-8')
      .split('\n')
      .filter(l => /^[A-Z_]+=/.test(l) && !l.startsWith('#'))
      .map(l => l.split('=')[0].trim())
  }
  return []
}

function readGitHubCron(repoPath: string): string | null {
  const wfDir = path.join(repoPath, '.github', 'workflows')
  if (!fs.existsSync(wfDir)) return null
  for (const file of fs.readdirSync(wfDir)) {
    if (!file.endsWith('.yml') && !file.endsWith('.yaml')) continue
    const content = fs.readFileSync(path.join(wfDir, file), 'utf-8')
    const match = content.match(/cron:\s*['"]?([^'"\n]+)['"]?/)
    if (match) return match[1].trim()
  }
  return null
}

// ── Limits ────────────────────────────────────────────────────────────────────

/** Max source files to surface as modules. Repos over this are frameworks/libraries, not tools. */
const MAX_MODULES = 100

// ── Source file discovery ─────────────────────────────────────────────────────

export function getSourceFiles(repoPath: string): string[] {
  const results: string[] = []
  // Prefer src/ if it exists, otherwise fall back to root-level scripts
  const scanRoot = fs.existsSync(path.join(repoPath, 'src'))
    ? path.join(repoPath, 'src')
    : repoPath

  function walk(dir: string, depth = 0) {
    if (depth > 4) return
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === '__pycache__') continue
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(full, depth + 1)
      } else if (/\.(js|ts|mjs|cjs|py)$/.test(entry.name)) {
        // Skip test files and type declarations
        if (/\.(test|spec|d)\.\w+$/.test(entry.name)) continue
        results.push(full)
      }
    }
  }

  if (fs.existsSync(scanRoot)) walk(scanRoot)
  return results
}

// ── Per-file import analysis ──────────────────────────────────────────────────

function inferToolsFromFile(
  filePath: string,
  serviceMap: Record<string, { service: string; mustPurchase: boolean }>
): ToolUsage[] {
  let content: string
  try { content = fs.readFileSync(filePath, 'utf-8') } catch { return [] }

  const tools: ToolUsage[] = []
  const seen = new Set<string>()

  for (const [pkg, info] of Object.entries(serviceMap)) {
    // Match both ESM and CJS import patterns
    const patterns = [
      `from '${pkg}'`, `from "${pkg}"`,
      `require('${pkg}')`, `require("${pkg}")`,
      `import ${pkg}`, // Python: import pkg / from pkg import
      `from ${pkg} import`,
    ]
    if (patterns.some(p => content.includes(p))) {
      if (!seen.has(info.service)) {
        seen.add(info.service)
        tools.push({ service: info.service, purpose: '', mustPurchase: info.mustPurchase })
      }
    }
  }

  return tools
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface AutomationToolMeta {
  subResources: SubResource[]
  description: string
  cron: string | null
  envKeys: string[]
  runtime: 'node' | 'python' | 'unknown'
  tooLarge: boolean
  totalFiles: number
}

export function parseAutomationTool(repoPath: string): AutomationToolMeta {
  const pkg = readPackageJson(repoPath)
  const pyDeps = readRequirementsTxt(repoPath)
  const envKeys = readEnvExampleKeys(repoPath)
  const cron = readGitHubCron(repoPath)

  const runtime: AutomationToolMeta['runtime'] =
    pkg ? 'node' : pyDeps.length > 0 ? 'python' : 'unknown'

  // Build service lookup from installed dependencies
  const serviceMap: Record<string, { service: string; mustPurchase: boolean }> = {}

  if (pkg) {
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies }
    for (const dep of Object.keys(allDeps ?? {})) {
      if (dep in NPM_SERVICE_MAP) serviceMap[dep] = NPM_SERVICE_MAP[dep]
    }
  }

  for (const dep of pyDeps) {
    if (dep in PY_SERVICE_MAP) serviceMap[dep] = PY_SERVICE_MAP[dep]
  }

  // Parse each source file into a SubResource (module), capped at MAX_MODULES
  const allSourceFiles = getSourceFiles(repoPath)
  const tooLarge = allSourceFiles.length > MAX_MODULES
  const sourceFiles = tooLarge ? allSourceFiles.slice(0, MAX_MODULES) : allSourceFiles
  const subResources: SubResource[] = []

  for (const filePath of sourceFiles) {
    const rawBasename = path.basename(filePath, path.extname(filePath))
    const lowerBasename = rawBasename.toLowerCase()
    const relPath = '/' + path.relative(repoPath, filePath)
    const tools = inferToolsFromFile(filePath, serviceMap)

    let moduleName: string
    if (FRAMEWORK_SPECIAL_FILES.has(lowerBasename)) {
      // Use parent directory name(s) to disambiguate — e.g. audience/route.ts → "Audience route"
      const parentDir = path.basename(path.dirname(filePath)).replace(/[-_]/g, ' ')
      moduleName = parentDir.charAt(0).toUpperCase() + parentDir.slice(1) + ' ' + lowerBasename
    } else if (FILE_ROLE_MAP[lowerBasename]) {
      const role = FILE_ROLE_MAP[lowerBasename]
      moduleName = role.charAt(0).toUpperCase() + role.slice(1)
    } else {
      // Preserve original casing for PascalCase component names etc.
      moduleName = rawBasename
    }

    subResources.push({
      name: moduleName,
      path: relPath,
      type: 'module',
      description: '',
      tools,
    })
  }

  return {
    subResources,
    description: pkg?.description ?? '',
    cron,
    envKeys,
    runtime,
    tooLarge,
    totalFiles: allSourceFiles.length,
  }
}

export function isAutomationTool(repoPath: string): boolean {
  return (
    fs.existsSync(path.join(repoPath, 'package.json')) ||
    fs.existsSync(path.join(repoPath, 'requirements.txt')) ||
    fs.existsSync(path.join(repoPath, 'pyproject.toml'))
  )
}
