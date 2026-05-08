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
  // Supports both self-hosted Firecrawl (FIRECRAWL_URL) and Firecrawl Cloud (FIRECRAWL_API_KEY)
  const selfHostedUrl = process.env.FIRECRAWL_URL
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

export async function lookupAuthor(
  authorId: string,
  authorRef: RegistryAuthorRef
): Promise<AuthorProfile> {
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
    const gh = await fetchGitHubProfile(authorRef.github)
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
