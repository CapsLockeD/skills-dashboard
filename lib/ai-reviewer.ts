import { aiComplete } from './ai-client'
import { EndpointChange, AIRecommendation } from '../types'

export interface ReviewResult {
  summary: string
  securityAssessment: string
  recommendation: AIRecommendation
  reasoning: string
}

const SYSTEM_PROMPT = `You are a security-focused code reviewer for a skills and workflow management system.
Your job is to analyze git diffs of AI skills and automation workflows to identify:
- What changed and why it matters
- Security risks from API/endpoint/credential changes
- Whether the update is safe to merge or needs human scrutiny

Respond ONLY with a valid JSON object. No markdown, no explanation outside the JSON.`

export async function reviewDiff(
  resourceName: string,
  resourceType: string,
  diff: string,
  endpointChanges: EndpointChange[]
): Promise<ReviewResult> {
  if (!diff.trim()) {
    return {
      summary: 'No changes detected.',
      securityAssessment: 'No changes to assess.',
      recommendation: 'SAFE_TO_MERGE',
      reasoning: 'Repository is up to date with upstream.',
    }
  }

  const endpointSection =
    endpointChanges.length > 0
      ? `\nEndpoint changes detected:\n${endpointChanges
          .map((e) => `  ${e.type.toUpperCase()}: ${e.url}`)
          .join('\n')}`
      : '\nNo endpoint changes detected.'

  // Truncate very large diffs to avoid token limits
  const truncatedDiff =
    diff.length > 8000 ? diff.slice(0, 8000) + '\n\n[diff truncated — review full diff manually]' : diff

  const prompt = `/no_think
Review this upstream update to a ${resourceType} called "${resourceName}".

DIFF:
${truncatedDiff}
${endpointSection}

Rules for recommendation:
- DO_NOT_MERGE: new unknown/unrelated domains introduced, credentials exposed in plaintext, obfuscated code, suspicious redirects
- HUMAN_REVIEW_NEEDED: API endpoints changing to different domains, significant logic rewrites, unclear intent, new external service dependencies
- SAFE_TO_MERGE: documentation edits, version bumps on known vendors, additive/non-breaking changes, bug fixes with clear intent

Respond with exactly this JSON shape:
{
  "summary": "2-4 sentence plain English description of what changed",
  "securityAssessment": "1-3 sentences on the security implications of any API/endpoint/credential changes specifically",
  "recommendation": "SAFE_TO_MERGE" | "HUMAN_REVIEW_NEEDED" | "DO_NOT_MERGE",
  "reasoning": "1-2 sentences explaining why you chose that recommendation"
}`

  try {
    const raw = await aiComplete(prompt, SYSTEM_PROMPT)
    // Strip <think>...</think> blocks produced by reasoning models (e.g. qwen3)
    const response = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON found in AI response')
    const parsed = JSON.parse(jsonMatch[0])
    return {
      summary: parsed.summary || 'No summary provided.',
      securityAssessment: parsed.securityAssessment || 'No assessment provided.',
      recommendation: (['SAFE_TO_MERGE', 'HUMAN_REVIEW_NEEDED', 'DO_NOT_MERGE'].includes(parsed.recommendation)
        ? parsed.recommendation
        : 'HUMAN_REVIEW_NEEDED') as AIRecommendation,
      reasoning: parsed.reasoning || '',
    }
  } catch (err) {
    return {
      summary: 'AI review failed — manual review required.',
      securityAssessment: 'Could not perform automated security assessment.',
      recommendation: 'HUMAN_REVIEW_NEEDED',
      reasoning: `Review service error: ${err instanceof Error ? err.message : 'unknown error'}`,
    }
  }
}
