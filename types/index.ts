export type ResourceType = 'claude-skill' | 'n8n-workflow' | 'reference-kit' | 'mixed'
export type OwnershipStatus = 'external' | 'monitored' | 'vendored' | 'internal'
export type ScanStatus =
  | 'up-to-date'
  | 'update-available'
  | 'security-flag'
  | 'no-upstream'
  | 'error'
  | 'never-scanned'
  | 'scanning'
export type AIRecommendation = 'SAFE_TO_MERGE' | 'HUMAN_REVIEW_NEEDED' | 'DO_NOT_MERGE'

export interface RegistryResource {
  id: string
  name: string
  type: ResourceType
  ownership_status: OwnershipStatus
  author_id: string | null
  upstream_git_url: string | null
  download_origin: string
  category: string
  notes: string
  skip_auto_update: boolean
  sub_resource_ids: string[]
  discovered_from: string | null
}

export interface RegistryAuthorRef {
  name: string
  github?: string
  twitter?: string
  website?: string
}

export interface Registry {
  version: string
  resources: RegistryResource[]
  authors: Record<string, RegistryAuthorRef>
}

export interface EndpointChange {
  type: 'added' | 'removed'
  url: string
}

export interface ToolUsage {
  service: string        // Human-readable service name: "Apify", "OpenAI", "fal.ai"
  purpose: string        // What this sub-skill/workflow does with it
  mustPurchase: boolean  // Paid/credentialed service you'd need to buy when building internally
  credentialKey?: string // n8n credential type or env var name
  endpoint?: string      // API domain/endpoint for reference
}

export interface SubResource {
  name: string
  path: string
  type: 'skill' | 'workflow'
  description?: string
  tools: ToolUsage[]
}

export interface N8nNodeInfo {
  type: string
  name: string
  httpUrls?: string[]
  credentials?: string[]
}

export interface ScanResult {
  resourceId: string
  scannedAt: string
  status: ScanStatus
  commitsAhead: number
  diff: string
  endpointChanges: EndpointChange[]
  aiSummary: string
  aiSecurityAssessment: string
  aiRecommendation: AIRecommendation | null
  aiReasoning: string
  subResources: SubResource[]
  n8nNodes?: N8nNodeInfo[]
  error?: string
}

export interface ScanHistory {
  results: Record<string, ScanResult[]>
  lastGlobalScan: string | null
}

export interface AuthorProfile {
  id: string
  name: string
  github?: string
  twitter?: string
  website?: string
  bio?: string
  authority?: string
  whyTrust?: string
  socials: { platform: string; url: string; handle?: string }[]
  enrichedAt?: string
}

export interface AuthorCache {
  authors: Record<string, AuthorProfile>
}
