'use client'

import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { ChevronDown, ChevronUp, RefreshCw, ExternalLink } from 'lucide-react'
import { RegistryResource, ScanResult, AuthorProfile, RegistryAuthorRef, ScanStatus, ResourceType, OwnershipStatus } from '@/types'
import UpdatePanel from './UpdatePanel'
import AuthorPanel from './AuthorPanel'

// ── Badge configs ────────────────────────────────────────────────────────────

const TYPE_BADGES: Record<ResourceType, string> = {
  'claude-skill': 'bg-purple-900/50 text-purple-300 border border-purple-800',
  'n8n-workflow': 'bg-orange-900/50 text-orange-300 border border-orange-800',
  'reference-kit': 'bg-cyan-900/50 text-cyan-300 border border-cyan-800',
  'mixed': 'bg-gray-800 text-gray-300 border border-gray-700',
}

const TYPE_LABELS: Record<ResourceType, string> = {
  'claude-skill': 'Claude Skill',
  'n8n-workflow': 'n8n Workflow',
  'reference-kit': 'Reference Kit',
  'mixed': 'Mixed',
}

const OWNERSHIP_BADGES: Record<OwnershipStatus, string> = {
  external: 'bg-rose-900/50 text-rose-300 border border-rose-800',
  monitored: 'bg-amber-900/50 text-amber-300 border border-amber-800',
  vendored: 'bg-blue-900/50 text-blue-300 border border-blue-800',
  internal: 'bg-green-900/50 text-green-300 border border-green-800',
}

const OWNERSHIP_LABELS: Record<OwnershipStatus, string> = {
  external: 'External',
  monitored: 'Monitored',
  vendored: 'Vendored',
  internal: 'Internal',
}

const STATUS_BADGES: Record<ScanStatus, string> = {
  'up-to-date': 'bg-green-900/40 text-green-400 border border-green-900',
  'update-available': 'bg-blue-900/40 text-blue-400 border border-blue-900',
  'security-flag': 'bg-red-900/40 text-red-400 border border-red-900 animate-pulse',
  'no-upstream': 'bg-gray-800 text-gray-500 border border-gray-700',
  'error': 'bg-red-900/40 text-red-400 border border-red-900',
  'never-scanned': 'bg-gray-800 text-gray-500 border border-gray-700',
  'scanning': 'bg-blue-900/40 text-blue-400 border border-blue-900',
}

const STATUS_LABELS: Record<ScanStatus, string> = {
  'up-to-date': 'Up to Date',
  'update-available': 'Update Available',
  'security-flag': 'Security Flag',
  'no-upstream': 'No Upstream',
  'error': 'Error',
  'never-scanned': 'Never Scanned',
  'scanning': 'Scanning...',
}

// ── Component ────────────────────────────────────────────────────────────────

interface ResourceCardProps {
  resource: RegistryResource
  latestResult: ScanResult | null
  authorProfile: AuthorProfile | null
  authorRef: RegistryAuthorRef | null
  onResultUpdate: (result: ScanResult) => void
  onAuthorRefresh: (authorId: string) => Promise<void>
}

export default function ResourceCard({
  resource,
  latestResult,
  authorProfile,
  authorRef,
  onResultUpdate,
  onAuthorRefresh,
}: ResourceCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [authorRefreshing, setAuthorRefreshing] = useState(false)

  const status: ScanStatus = scanning ? 'scanning' : (latestResult?.status ?? 'never-scanned')
  const hasUpdate = status === 'update-available' || status === 'security-flag'

  async function handleScanNow() {
    setScanning(true)
    try {
      const res = await fetch(`/api/scan/${resource.id}`, { method: 'POST' })
      const result = await res.json()
      onResultUpdate(result)
    } finally {
      setScanning(false)
    }
  }

  async function handleMerge() {
    const res = await fetch(`/api/merge/${resource.id}`, { method: 'POST' })
    const data = await res.json()
    if (data.result) onResultUpdate(data.result)
  }

  async function handleAuthorRefresh() {
    if (!resource.author_id) return
    setAuthorRefreshing(true)
    await onAuthorRefresh(resource.author_id)
    setAuthorRefreshing(false)
  }

  return (
    <div
      className={`bg-gray-900 border rounded-lg transition-all duration-200 ${
        status === 'security-flag'
          ? 'border-red-800'
          : hasUpdate
          ? 'border-blue-900'
          : 'border-gray-800'
      }`}
    >
      {/* ── Compact header ── */}
      <div
        className="flex items-start gap-3 p-4 cursor-pointer select-none"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex-1 min-w-0">
          {/* Top row: badges */}
          <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${TYPE_BADGES[resource.type]}`}>
              {TYPE_LABELS[resource.type]}
            </span>
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${OWNERSHIP_BADGES[resource.ownership_status]}`}>
              {OWNERSHIP_LABELS[resource.ownership_status]}
            </span>
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${STATUS_BADGES[status]}`}>
              {STATUS_LABELS[status]}
            </span>
          </div>

          {/* Name */}
          <h3 className="text-base font-semibold text-white truncate">{resource.name}</h3>

          {/* Meta row */}
          <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
            {authorRef && <span>{authorRef.name}</span>}
            {authorRef && resource.category && <span>·</span>}
            {resource.category && <span className="capitalize">{resource.category.replace(/-/g, ' ')}</span>}
            {latestResult && (
              <>
                <span>·</span>
                <span>
                  scanned{' '}
                  {formatDistanceToNow(new Date(latestResult.scannedAt), { addSuffix: true })}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 mt-0.5">
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleScanNow()
            }}
            disabled={scanning}
            title="Check for updates now"
            className="p-1.5 text-gray-500 hover:text-gray-200 hover:bg-gray-800 rounded transition-colors disabled:opacity-40"
          >
            <RefreshCw size={14} className={scanning ? 'animate-spin' : ''} />
          </button>
          {expanded ? (
            <ChevronUp size={16} className="text-gray-500" />
          ) : (
            <ChevronDown size={16} className="text-gray-500" />
          )}
        </div>
      </div>

      {/* ── Expanded content ── */}
      {expanded && (
        <div className="border-t border-gray-800 p-4 space-y-4">
          {/* Author */}
          <AuthorPanel
            authorRef={authorRef}
            profile={authorProfile}
            onRefresh={resource.author_id ? handleAuthorRefresh : undefined}
            refreshing={authorRefreshing}
          />

          {/* Sub-resources */}
          {latestResult?.subResources && latestResult.subResources.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Sub-Resources ({latestResult.subResources.length})
              </p>
              <div className="space-y-1">
                {latestResult.subResources.map((sr, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="text-gray-500 font-mono">{sr.type === 'skill' ? '⚡' : sr.type === 'workflow' ? '⚙' : '📄'}</span>
                    <span className="text-gray-300">{sr.name}</span>
                    {sr.description && <span className="text-gray-600">— {sr.description}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* n8n Nodes */}
          {latestResult?.n8nNodes && latestResult.n8nNodes.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                n8n Nodes ({latestResult.n8nNodes.length})
              </p>
              <div className="space-y-1">
                {latestResult.n8nNodes.map((node, i) => (
                  <div key={i} className="text-xs text-gray-400">
                    <span className="text-gray-300">{node.name}</span>
                    <span className="text-gray-600 ml-1">({node.type})</span>
                    {node.httpUrls?.map((url, j) => (
                      <span key={j} className="block ml-4 text-gray-600 font-mono truncate">{url}</span>
                    ))}
                    {node.credentials?.map((c, j) => (
                      <span key={j} className="block ml-4 text-amber-700">{c}</span>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Source info */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Source</p>
            <p className="text-xs text-gray-400">{resource.download_origin || 'Not specified'}</p>
            {resource.upstream_git_url && (
              <a
                href={resource.upstream_git_url.replace(/\.git$/, '')}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 mt-1 transition-colors"
              >
                <ExternalLink size={11} />
                View repository
              </a>
            )}
          </div>

          {/* Notes */}
          {resource.notes && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Notes</p>
              <p className="text-xs text-gray-400 leading-relaxed">{resource.notes}</p>
            </div>
          )}

          {/* Error */}
          {latestResult?.error && (
            <div className="bg-red-900/20 border border-red-900 rounded p-2.5">
              <p className="text-xs font-semibold text-red-400 mb-0.5">Scan Error</p>
              <p className="text-xs text-red-300 font-mono">{latestResult.error}</p>
            </div>
          )}

          {/* Update panel */}
          {latestResult && hasUpdate && (
            <UpdatePanel
              result={latestResult}
              onMerge={handleMerge}
              onCheckNow={handleScanNow}
            />
          )}
        </div>
      )}
    </div>
  )
}
