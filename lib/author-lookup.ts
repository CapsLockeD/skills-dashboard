import fs from 'fs'
import path from 'path'
import { AuthorProfile, AuthorCache, RegistryAuthorRef } from '../types'
import { aiComplete } from './ai-client'

function getDataDir(): string {
  return process.env.DATA_DIR || path.join(process.cwd(), 'data')
}

function getAuthorsPath(): string {
  return path.join(getDataDir(), 'authors.json')
}

export function readAuthorCache(): AuthorCache {
  const p = getAuthorsPath()
  if (!fs.existsSync(p)) return { authors: {} }
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8'))
  } catch {
    return { authors: {} }
  }
}

export function writeAuthorCache(cache: AuthorCache): void {
  fs.mkdirSync(getDataDir(), { recursive: true })
  fs.writeFileSync(getAuthorsPath(), JSON.stringify(cache, null, 2) + '\n')
}

async function fetchGitHubProfile(username: string): Promise<{
  bio?: string
  website?: string
  twitterUsername?: string
  name?: string
}> {
  const token = process.env.GITHUB_TOKEN
  const headers: Record<string, string> = { 'User-Agent': 'skills-dashboard/1.0' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  try {
    const res = await fetch(`https://api.github.com/users/${username}`, { headers })
    if (!res.ok) return {}
    const data = await res.json()
    return {
      bio: data.bio || undefined,
      website: data.blog || undefined,
      twitterUsername: data.twitter_username || undefined,
      name: data.name || undefined,
    }
  } catch {
    return {}
  }
}

async function firecrawlScrape(url: string): Promise<string> {
  // Supports both self-hosted Firecrawl (FIRECRAWL_API_URL or FIRECRAWL_URL) and Firecrawl Cloud (FIRECRAWL_API_KEY)
  const selfHostedUrl = process.env.FIRECRAWL_API_URL || process.env.FIRECRAWL_URL
  const cloudKey = process.env.FIRECRAWL_API_KEY

  if (!selfHostedUrl && !cloudKey) return ''

  const baseUrl = selfHostedUrl || 'https://api.firecrawl.dev'
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (cloudKey) headers['Authorization'] = `Bearer ${cloudKey}`

  try {
    const res = await fetch(`${baseUrl}/v1/scrape`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ url, formats: ['markdown'] }),
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return ''
    const data = await res.json()
    return (data.data?.markdown || data.markdown || '').slice(0, 4000)
  } catch {
    return ''
  }
}

/**
 * Extract URLs from a block of text (markdown, README, etc.)
 */
function extractUrls(text: string): string[] {
  const pattern = /https?:\/\/[^\s\)\]"'<>,]+/g
  return Array.from(text.matchAll(pattern), (m) => m[0].replace(/[.,;:!?]+$/, ''))
}

/**
 * Brave Search API — real web search, free tier 2000 req/month.
 * Requires BRAVE_SEARCH_API_KEY env var.
 * Returns URLs from top search results.
 */
async function braveSearch(query: string): Promise<string[]> {
  const key = process.env.BRAVE_SEARCH_API_KEY
  if (!key) return []

  try {
    console.log(`[authors] Brave search: "${query}"`)
    const res = await fetch(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=10`,
      {
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip',
          'X-Subscription-Token': key,
        },
        signal: AbortSignal.timeout(8000),
      }
    )
    if (!res.ok) {
      console.log(`[authors] Brave search returned ${res.status}`)
      return []
    }
    const data = await res.json()
    const results = (data.web?.results ?? []) as { url: string; description?: string }[]
    const urls = results.map((r) => r.url).filter(Boolean)
    console.log(`[authors] Brave search found ${urls.length} URLs:`, urls)
    return urls
  } catch (err) {
    console.log(`[authors] Brave search error: ${err}`)
    return []
  }
}

/**
 * Fetch the GitHub profile/org README to find social links.
 * Checks two locations: {username}/{username} repo and {username}/.github repo.
 * Free, uses existing GITHUB_TOKEN if set, no AI tokens.
 */
async function fetchGitHubReadmeLinks(username: string, token?: string): Promise<string[]> {
  const headers: Record<string, string> = { 'User-Agent': 'skills-dashboard/1.0' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const candidates = [
    `https://api.github.com/repos/${username}/${username}/readme`,
    `https://api.github.com/repos/${username}/.github/readme`,
  ]

  const allUrls: string[] = []
  for (const url of candidates) {
    try {
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(6000) })
      if (!res.ok) continue
      const data = await res.json()
      const content = data.encoding === 'base64'
        ? Buffer.from(data.content, 'base64').toString('utf-8')
        : (data.content ?? '')
      const urls = extractUrls(content)
      console.log(`[authors] GitHub README (${url}) found ${urls.length} URLs`)
      allUrls.push(...urls)
    } catch (err) {
      console.log(`[authors] GitHub README fetch error: ${err}`)
    }
  }
  return allUrls
}

/**
 * Scan a list of URLs and categorize into social link buckets.
 */
function categorizeUrls(urls: string[], name: string, github?: string): {
  website?: string; twitter?: string; skool?: string; youtube?: string; linkedin?: string
} {
  const result: { website?: string; twitter?: string; skool?: string; youtube?: string; linkedin?: string } = {}
  const namePart = name.toLowerCase().replace(/[^a-z0-9]/g, '')
  const githubPart = (github ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')

  for (const url of urls) {
    if (!url) continue
    const u = url.toLowerCase()
    if (!result.skool && u.includes('skool.com/')) result.skool = url
    if (!result.twitter && (u.includes('twitter.com/') || u.includes('x.com/'))) result.twitter = url
    if (!result.youtube && u.includes('youtube.com/')) result.youtube = url
    if (!result.linkedin && u.includes('linkedin.com/')) result.linkedin = url
    if (!result.website) {
      const isSocial = ['github.com', 'twitter.com', 'x.com', 'youtube.com', 'skool.com', 'linkedin.com'].some(s => u.includes(s))
      if (!isSocial && (u.includes(namePart) || (githubPart && u.includes(githubPart)))) {
        result.website = url
      }
    }
  }
  return result
}

export async function lookupAuthor(
  authorId: string,
  authorRef: RegistryAuthorRef
): Promise<AuthorProfile> {
  console.log(`[authors] looking up: ${authorId} (${authorRef.name}) github=${authorRef.github ?? 'none'}`)
  const profile: AuthorProfile = {
    id: authorId,
    name: authorRef.name,
    github: authorRef.github,
    twitter: authorRef.twitter,
    website: authorRef.website,
    socials: [],
    enrichedAt: new Date().toISOString(),
  }

  // Build known socials
  if (authorRef.github)
    profile.socials.push({
      platform: 'github',
      url: `https://github.com/${authorRef.github}`,
      handle: authorRef.github,
    })
  if (authorRef.twitter)
    profile.socials.push({
      platform: 'twitter',
      url: `https://x.com/${authorRef.twitter}`,
      handle: authorRef.twitter,
    })
  if (authorRef.website)
    profile.socials.push({ platform: 'website', url: authorRef.website })

  // Enrich from GitHub API (free, no key required for public profiles)
  if (authorRef.github) {
    console.log(`[authors] fetching GitHub profile for ${authorRef.github}`)
    const gh = await fetchGitHubProfile(authorRef.github)
    console.log(`[authors] GitHub result:`, gh)
    if (gh.bio) profile.bio = gh.bio
    if (gh.website && !profile.website) {
      profile.website = gh.website
      profile.socials.push({ platform: 'website', url: gh.website })
    }
    if (gh.twitterUsername && !profile.twitter) {
      profile.twitter = gh.twitterUsername
      profile.socials.push({
        platform: 'twitter',
        url: `https://x.com/${gh.twitterUsername}`,
        handle: gh.twitterUsername,
      })
    }
  }

  console.log(`[authors] after GitHub — website=${profile.website ?? 'none'} twitter=${profile.twitter ?? 'none'}`)
  // Discover social links via web search (Brave) or GitHub README fallback
  if (authorRef.github) {
    const token = process.env.GITHUB_TOKEN
    const hasBrave = !!process.env.BRAVE_SEARCH_API_KEY

    let discoveredUrls: string[] = []
    if (hasBrave) {
      // Real web search — finds skool, website, socials reliably
      const queries = [
        `"${authorRef.name}" skool community`,
        `"${authorRef.name}" site`,
      ]
      for (const q of queries) {
        discoveredUrls.push(...await braveSearch(q))
      }
    } else {
      // Fallback: parse GitHub profile README for social links
      discoveredUrls = await fetchGitHubReadmeLinks(authorRef.github, token)
    }

    const found = categorizeUrls(discoveredUrls, authorRef.name, authorRef.github)
    console.log(`[authors] discovered links (${hasBrave ? 'brave' : 'readme'}):`, found)
    let anyFound = false
    if (found.website && !profile.website) {
      profile.website = found.website
      profile.socials.push({ platform: 'website', url: found.website, aiGuessed: true })
      anyFound = true
    }
    if (found.twitter && !profile.twitter) {
      const handle = found.twitter.replace(/^https?:\/\/(www\.)?(twitter|x)\.com\/?/, '').replace(/\/$/, '')
      profile.twitter = handle
      profile.socials.push({ platform: 'twitter', url: found.twitter, handle, aiGuessed: true })
      anyFound = true
    }
    if (found.skool) {
      profile.socials.push({ platform: 'skool', url: found.skool, aiGuessed: true })
      anyFound = true
    }
    if (found.youtube) {
      profile.socials.push({ platform: 'youtube', url: found.youtube, aiGuessed: true })
      anyFound = true
    }
    if (found.linkedin) {
      profile.socials.push({ platform: 'linkedin', url: found.linkedin, aiGuessed: true })
      anyFound = true
    }
    if (anyFound) profile.aiDiscoveredSocials = true
  }

  // Enrich via Firecrawl scraping
  let scrapedContent = ''
  const scrapeTargets = [authorRef.website, authorRef.twitter ? `https://x.com/${authorRef.twitter}` : null].filter(
    Boolean
  ) as string[]
  for (const url of scrapeTargets) {
    scrapedContent += await firecrawlScrape(url)
  }

  // Generate authority summary via AI
  if (scrapedContent || profile.bio) {
    const prompt = `Based on the following information about ${authorRef.name}, write a brief professional profile.

Bio: ${profile.bio || 'Not available'}
Web content: ${scrapedContent || 'Not available'}

Respond with this exact JSON shape:
{
  "whyTrust": "2-3 sentences on their credibility and authority in the AI/automation/marketing space",
  "authority": "1 sentence summarizing their role and following"
}`
    try {
      const response = await aiComplete(prompt)
      const match = response.match(/\{[\s\S]*\}/)
      if (match) {
        const { whyTrust, authority } = JSON.parse(match[0])
        if (whyTrust) profile.whyTrust = whyTrust
        if (authority) profile.authority = authority
      }
    } catch {
      // Author enrichment is best-effort
    }
  }

  return profile
}

export async function refreshAllAuthors(): Promise<AuthorCache> {
  // Import here to avoid circular deps at module load time
  const { readRegistry } = await import('./registry')
  const registry = readRegistry()
  const cache = readAuthorCache()

  for (const [authorId, authorRef] of Object.entries(registry.authors)) {
    try {
      cache.authors[authorId] = await lookupAuthor(authorId, authorRef)
    } catch (err) {
      console.error(`[authors] Failed to lookup ${authorId}:`, err)
    }
  }

  writeAuthorCache(cache)
  return cache
}
