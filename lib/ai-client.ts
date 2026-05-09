/**
 * Model-agnostic AI client.
 *
 * Configure via environment variables:
 *
 *   AI_PROVIDER   = anthropic | openai | gemini | openrouter | local
 *   AI_API_KEY    = your API key (set to "none" for local models that don't require one)
 *   AI_MODEL      = model name (e.g. claude-sonnet-4-6, gpt-4o, gemini-2.0-flash, etc.)
 *   AI_BASE_URL   = required only for "local" provider (e.g. http://localhost:11434/v1)
 *
 * Provider base URLs (auto-set unless overridden):
 *   anthropic   -> Anthropic SDK (native)
 *   openai      -> https://api.openai.com/v1
 *   gemini      -> https://generativelanguage.googleapis.com/v1beta/openai/
 *   openrouter  -> https://openrouter.ai/api/v1
 *   local       -> AI_BASE_URL (required)
 */

import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'

const PROVIDER_BASE_URLS: Record<string, string> = {
  openai: 'https://api.openai.com/v1',
  gemini: 'https://generativelanguage.googleapis.com/v1beta/openai/',
  openrouter: 'https://openrouter.ai/api/v1',
}

const DEFAULT_MODELS: Record<string, string> = {
  anthropic: 'claude-sonnet-4-6',
  openai: 'gpt-4o',
  gemini: 'gemini-2.0-flash',
  openrouter: 'anthropic/claude-sonnet-4-6',
  local: 'llama3',
}

export async function aiComplete(
  prompt: string,
  systemPrompt?: string
): Promise<string> {
  const provider = (process.env.AI_PROVIDER || 'anthropic').toLowerCase()
  const apiKey = process.env.AI_API_KEY
  const model = process.env.AI_MODEL || DEFAULT_MODELS[provider] || 'gpt-4o'

  if (provider === 'anthropic') {
    const client = new Anthropic({ apiKey })
    const response = await client.messages.create({
      model,
      max_tokens: 2048,
      ...(systemPrompt ? { system: systemPrompt } : {}),
      messages: [{ role: 'user', content: prompt }],
    })
    const block = response.content[0]
    return block.type === 'text' ? block.text : ''
  }

  // All other providers use the OpenAI-compatible interface
  const baseURL =
    PROVIDER_BASE_URLS[provider] ||
    process.env.AI_BASE_URL ||
    (() => {
      throw new Error(
        `AI_BASE_URL is required for provider "${provider}". Set it in your .env file.`
      )
    })()

  const client = new OpenAI({
    apiKey: apiKey || 'not-needed',
    baseURL,
    defaultHeaders:
      provider === 'openrouter'
        ? { 'HTTP-Referer': 'skills-dashboard', 'X-Title': 'Skills Dashboard' }
        : undefined,
  })

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = []
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt })
  messages.push({ role: 'user', content: prompt })

  const response = await client.chat.completions.create({
    model,
    messages,
    max_tokens: 8192,
  })

  return response.choices[0]?.message?.content || ''
}
