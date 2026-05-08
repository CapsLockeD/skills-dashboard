/**
 * Parses SKILL.md files to extract sub-skills and the external tools/services
 * each sub-skill requires. Used to build a tool inventory for:
 *   - Planning what to purchase when building a skill internally
 *   - Debugging which service a failing skill depends on
 */

import fs from 'fs'
import path from 'path'
import { SubResource, ToolUsage } from '../types'

// ── Service detection map ────────────────────────────────────────────────────
// Each entry: regex to detect in SKILL.md text, service name, whether it costs money

interface ServicePattern {
  pattern: RegExp
  service: string
  mustPurchase: boolean
  endpoint?: string
}

const SERVICE_PATTERNS: ServicePattern[] = [
  // AI/LLM providers
  { pattern: /fal\.ai|FAL_KEY|fal\.run/i, service: 'fal.ai', mustPurchase: true, endpoint: 'fal.run' },
  { pattern: /replicate\.com|REPLICATE_API_TOKEN/i, service: 'Replicate', mustPurchase: true, endpoint: 'api.replicate.com' },
  { pattern: /openai|gpt-4|gpt-image|OPENAI_API_KEY/i, service: 'OpenAI', mustPurchase: true, endpoint: 'api.openai.com' },
  { pattern: /anthropic|claude\b|ANTHROPIC_API_KEY/i, service: 'Anthropic / Claude', mustPurchase: true, endpoint: 'api.anthropic.com' },
  { pattern: /gemini|google.*genai|GEMINI_API_KEY/i, service: 'Google Gemini', mustPurchase: true, endpoint: 'generativelanguage.googleapis.com' },
  { pattern: /openrouter/i, service: 'OpenRouter', mustPurchase: true, endpoint: 'openrouter.ai' },

  // SEO & data tools
  { pattern: /dataforseo/i, service: 'DataForSEO', mustPurchase: true, endpoint: 'api.dataforseo.com' },
  { pattern: /ahrefs/i, service: 'Ahrefs', mustPurchase: true, endpoint: 'api.ahrefs.com' },
  { pattern: /semrush/i, service: 'SEMrush', mustPurchase: true, endpoint: 'api.semrush.com' },
  { pattern: /moz\b|moz api/i, service: 'Moz', mustPurchase: true, endpoint: 'api.moz.com' },
  { pattern: /firecrawl/i, service: 'Firecrawl', mustPurchase: true, endpoint: 'api.firecrawl.dev' },
  { pattern: /apify/i, service: 'Apify', mustPurchase: true, endpoint: 'api.apify.com' },
  { pattern: /brightdata|bright data/i, service: 'Bright Data', mustPurchase: true },

  // Google services
  { pattern: /google search console|searchconsole\.googleapis|GSC\b/i, service: 'Google Search Console', mustPurchase: false, endpoint: 'searchconsole.googleapis.com' },
  { pattern: /google analytics|GA4\b|analytics\.googleapis/i, service: 'Google Analytics / GA4', mustPurchase: false, endpoint: 'analyticsdata.googleapis.com' },
  { pattern: /google sheets|googlesheets/i, service: 'Google Sheets', mustPurchase: false, endpoint: 'sheets.googleapis.com' },
  { pattern: /google docs/i, service: 'Google Docs', mustPurchase: false, endpoint: 'docs.googleapis.com' },
  { pattern: /google ads|keyword planner/i, service: 'Google Ads / Keyword Planner', mustPurchase: false, endpoint: 'googleads.googleapis.com' },
  { pattern: /youtube.*api|googleapis\.com\/youtube/i, service: 'YouTube Data API', mustPurchase: false, endpoint: 'youtube.googleapis.com' },
  { pattern: /pagespeed|web\.dev\/measure/i, service: 'Google PageSpeed Insights', mustPurchase: false, endpoint: 'pagespeedonline.googleapis.com' },
  { pattern: /bing webmaster/i, service: 'Bing Webmaster Tools', mustPurchase: false, endpoint: 'ssl.bing.com' },
  { pattern: /common crawl/i, service: 'Common Crawl', mustPurchase: false, endpoint: 'commoncrawl.org' },

  // Marketing/email
  { pattern: /mailchimp/i, service: 'Mailchimp', mustPurchase: true, endpoint: 'api.mailchimp.com' },
  { pattern: /convertkit/i, service: 'ConvertKit', mustPurchase: true, endpoint: 'api.convertkit.com' },
  { pattern: /hubspot/i, service: 'HubSpot', mustPurchase: true, endpoint: 'api.hubapi.com' },
  { pattern: /buffer\b/i, service: 'Buffer', mustPurchase: true, endpoint: 'api.bufferapp.com' },
  { pattern: /hootsuite/i, service: 'Hootsuite', mustPurchase: true },

  // Social / comms
  { pattern: /slack/i, service: 'Slack', mustPurchase: false },
  { pattern: /reddit/i, service: 'Reddit API', mustPurchase: false, endpoint: 'oauth.reddit.com' },
  { pattern: /twitter|x\.com|twitter api/i, service: 'Twitter / X API', mustPurchase: true, endpoint: 'api.twitter.com' },
  { pattern: /linkedin/i, service: 'LinkedIn API', mustPurchase: false, endpoint: 'api.linkedin.com' },

  // Infrastructure
  { pattern: /github/i, service: 'GitHub', mustPurchase: false, endpoint: 'api.github.com' },
]

// ── SKILL.md parser ──────────────────────────────────────────────────────────

function extractFrontmatter(content: string): { name?: string; description?: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---/)
  if (!match) return {}
  const fm = match[1]

  const nameMatch = fm.match(/^name:\s*(.+)$/m)

  // Handle three YAML description formats:
  //   1. Inline string:   description: "Some text"  or  description: Some text
  //   2. Folded block:    description: >
  //                         Continued text indented
  //   3. Literal block:   description: |
  //                         Continued text indented
  let description: string | undefined

  // Check for block scalar (> or |) first
  const blockMatch = fm.match(/^description:\s*[>|]\s*\n((?:[ \t]+[^\n]*\n?)+)/m)
  if (blockMatch) {
    description = blockMatch[1]
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean)
      .join(' ')
  } else {
    // Inline — strip leading/trailing quotes if present
    const inlineMatch = fm.match(/^description:\s*["']?(.*?)["']?\s*$/m)
    if (inlineMatch) {
      const val = inlineMatch[1].trim()
      // Ignore bare '>' or '|' that are block scalar indicators with missing body
      if (val && val !== '>' && val !== '|') {
        description = val
      }
    }
  }

  return {
    name: nameMatch?.[1]?.trim(),
    description: description?.replace(/\\"/g, '"').slice(0, 400),
  }
}

function detectTools(content: string): ToolUsage[] {
  const found = new Map<string, ToolUsage>()

  for (const sp of SERVICE_PATTERNS) {
    if (!sp.pattern.test(content)) continue
    if (found.has(sp.service)) continue

    // Get a line of context around the first match
    const match = content.match(sp.pattern)
    let purpose = ''
    if (match?.index !== undefined) {
      const start = content.lastIndexOf('\n', match.index) + 1
      const end = content.indexOf('\n', match.index)
      const line = content.slice(start, end > -1 ? end : start + 120).trim()
      // Use the line as purpose context (strip markdown formatting)
      purpose = line.replace(/^[#\-*>]+\s*/, '').replace(/\*\*/g, '').slice(0, 120)
    }

    found.set(sp.service, {
      service: sp.service,
      purpose: purpose || `Used by this skill`,
      mustPurchase: sp.mustPurchase,
      endpoint: sp.endpoint,
    })
  }

  return [...found.values()]
}

/** Parse a single SKILL.md file and return name, description, tools */
export function parseSkillMd(skillMdPath: string): {
  name: string
  description: string
  tools: ToolUsage[]
} {
  try {
    const content = fs.readFileSync(skillMdPath, 'utf-8')
    const { name, description } = extractFrontmatter(content)
    const tools = detectTools(content)
    return {
      name: name || path.basename(path.dirname(skillMdPath)),
      description: description || '',
      tools,
    }
  } catch {
    return { name: path.basename(path.dirname(skillMdPath)), description: '', tools: [] }
  }
}

/** Walk a repo path and return sub-skills (directories containing SKILL.md) */
export function discoverSkillSubResources(repoPath: string): SubResource[] {
  const results: SubResource[] = []
  const seen = new Set<string>()

  function walk(dir: string) {
    if (!fs.existsSync(dir)) return
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue

      const full = path.join(dir, entry.name)
      const skillMd = path.join(full, 'SKILL.md')

      if (fs.existsSync(skillMd) && !seen.has(full)) {
        seen.add(full)
        const { name, description, tools } = parseSkillMd(skillMd)
        results.push({
          name,
          path: full.replace(repoPath, ''),
          type: 'skill',
          description,
          tools,
        })
        // Don't recurse into skill dirs — their sub-dirs are internal implementation
      } else {
        walk(full)
      }
    }
  }

  walk(repoPath)
  return results
}
