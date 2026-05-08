import { EndpointChange } from '../types'

// Matches http/https URLs
const URL_REGEX = /https?:\/\/[^\s"'`\)\]>,;]+/g

// Noise URLs to ignore (docs, shields, example domains)
const IGNORE_PATTERNS = [
  'shields.io',
  'img.shields.io',
  'example.com',
  'localhost',
  '127.0.0.1',
  'schema.org',
  'www.w3.org',
  'json-schema.org',
]

function cleanUrl(url: string): string {
  return url.replace(/[.,;)>\]'"]+$/, '')
}

function isNoise(url: string): boolean {
  return IGNORE_PATTERNS.some((p) => url.includes(p))
}

export function extractUrlsFromText(text: string): string[] {
  const matches = text.match(URL_REGEX) || []
  return [...new Set(matches.map(cleanUrl).filter((u) => !isNoise(u)))]
}

/**
 * Given a unified diff, returns URLs found in added lines vs removed lines
 * so callers can diff them against the previous scan.
 */
export function extractUrlsFromDiff(diff: string): {
  added: string[]
  removed: string[]
} {
  const lines = diff.split('\n')

  const addedText = lines
    .filter((l) => l.startsWith('+') && !l.startsWith('+++'))
    .join('\n')

  const removedText = lines
    .filter((l) => l.startsWith('-') && !l.startsWith('---'))
    .join('\n')

  return {
    added: extractUrlsFromText(addedText),
    removed: extractUrlsFromText(removedText),
  }
}

/**
 * Produces a list of EndpointChange objects by comparing
 * URLs newly introduced in the diff against previously known URLs.
 */
export function buildEndpointChanges(
  previousUrls: string[],
  diffAdded: string[],
  diffRemoved: string[]
): EndpointChange[] {
  const prevSet = new Set(previousUrls)
  const changes: EndpointChange[] = []

  for (const url of diffAdded) {
    if (!prevSet.has(url)) {
      changes.push({ type: 'added', url })
    }
  }

  for (const url of diffRemoved) {
    if (prevSet.has(url)) {
      changes.push({ type: 'removed', url })
    }
  }

  return changes
}
