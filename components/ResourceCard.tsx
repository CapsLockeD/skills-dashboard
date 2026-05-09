'use client'

import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { ChevronDown, ChevronUp, RefreshCw, ExternalLink, ShoppingCart, CheckCircle, Loader2 } from 'lucide-react'
import { RegistryResource, ScanResult, AuthorProfile, RegistryAuthorRef, ScanStatus, ResourceType, OwnershipStatus, SubResource } from '@/types'
import UpdatePanel from './UpdatePanel'
import AuthorPanel from './AuthorPanel'

// ── Sub-skill / Workflow breakdown ────────────────────────────────────────────

function SubResourceList({ subResources, type }: { subResources: SubResource[]; type: ResourceType }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null)
  const label = type === 'n8n-workflow' ? 'workflows' : 'sub_skills'

  return (
    <div>
      <p className="font-mono text-[10px] text-zinc-600 uppercase tracking-widest mb-2">
        {label} ({subResources.length})
      </p>
      <div className="space-y-1">
        {subResources.map((sr, i) => {
          const isOpen = openIdx === i
          const tools = sr.tools ?? []
          const paidTools = tools.filter(t => t.mustPurchase)
          const freeTools = tools.filter(t => !t.mustPurchase)

          return (
            <div key={i} className="bg-zinc-900 border border-zinc-800/60 rounded">
              <button
                onClick={() => setOpenIdx(isOpen ? null : i)}
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-zinc-800/30 transition-colors"
              >
                <span className="font-mono text-[10px] text-zinc-700 shrink-0">
                  {type === 'n8n-workflow' ? '⚙' : '→'}
                </span>
                <span className="font-mono text-xs text-zinc-300 flex-1 truncate">{sr.name}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  {paidTools.length > 0 && (
                    <span className="font-mono text-[10px] text-amber-500">
                      {paidTools.length}p
                    </span>
                  )}
                  {freeTools.length > 0 && (
                    <span className="font-mono text-[10px] text-green-600">
                      {freeTools.length}f
                    </span>
                  )}
                  {tools.length === 0 && (
                    <span className="font-mono text-[10px] text-zinc-700">no_tools</span>
                  )}
                  {isOpen ? <ChevronUp size={11} className="text-zinc-600" /> : <ChevronDown size={11} className="text-zinc-600" />}
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-zinc-800/60 px-3 pb-3 pt-2 space-y-2">
                  {sr.description && (
                    <p className="text-xs text-zinc-500 leading-relaxed">{sr.description}</p>
                  )}
                  {tools.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="font-mono text-[10px] text-zinc-700 uppercase tracking-widest">external_tools</p>
                      {tools.map((tool, j) => (
                        <div key={j} className="flex items-start gap-2">
                          {tool.mustPurchase
                            ? <ShoppingCart size={11} className="text-amber-500 mt-0.5 shrink-0" />
                            : <CheckCircle size={11} className="text-green-600 mt-0.5 shrink-0" />}
                          <div className="min-w-0">
                            <span className={`font-mono text-xs ${tool.mustPurchase ? 'text-amber-400' : 'text-green-400'}`}>
                              {tool.service}
                            </span>
                            {tool.mustPurchase && (
                              <span className="font-mono text-[10px] text-zinc-700 ml-1">[paid]</span>
                            )}
                            {tool.purpose && tool.purpose !== sr.name && (
                              <span className="text-zinc-600 text-xs ml-1">— {tool.purpose}</span>
                            )}
                            {tool.endpoint && (
                              <span className="block font-mono text-[10px] text-zinc-700 truncate">{tool.endpoint}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Badge configs ─────────────────────────────────────────────────────────────

const TYPE_BADGES: Record<ResourceType, string> = {
  'claude-skill':  'border-purple-700 text-purple-400',
  'n8n-workflow':  'border-orange-700 text-orange-400',
  'reference-kit': 'border-cyan-700 text-cyan-400',
  'mixed':         'border-zinc-700 text-zinc-400',
}

const TYPE_LABELS: Record<ResourceType, string> = {
  'claude-skill':  'claude-skill',
  'n8n-workflow':  'n8n-workflow',
  'reference-kit': 'ref-kit',
  'mixed':         'mixed',
}

const OWNERSHIP_LABELS: Record<OwnershipStatus, string> = {
  external:  'external',
  monitored: 'monitored',
  vendored:  'vendored',
  internal:  'internal',
}

const OWNERSHIP_COLORS: Record<OwnershipStatus, string> = {
  external:  'text-zinc-500 border-zinc-700',
  monitored: 'text-amber-500 border-amber-800',
  vendored:  'text-blue-400 border-blue-800',
  internal:  'text-green-400 border-green-800',
}

const STATUS_COLORS: Record<ScanStatus, string> = {
  'up-to-date':       'text-green-400',
  'update-available': 'text-cyan-400',
  'security-flag':    'text-red-400 animate-pulse',
  'no-upstream':      'text-zinc-600',
  'error':            'text-red-400',
  'never-scanned':    'text-zinc-700',
  'scanning':         'text-cyan-400',
}

const STATUS_LABELS: Record<ScanStatus, string> = {
  'up-to-date':       'up-to-date',
  'update-available': 'update-avail',
  'security-flag':    'sec-flag',
  'no-upstream':      'no-upstream',
  'error':            'error',
  'never-scanned':    'never-scanned',
  'scanning':         'scanning...',
}

// ── Component ─────────────────────────────────────────────────────────────────

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
    <div className={`bg-[#0f0f0f] border rounded overflow-hidden transition-colors ${
      status === 'security-flag'
        ? 'border-red-800/60'
        : hasUpdate
        ? 'border-cyan-800/40'
        : 'border-zinc-800/60'
    }`}>
      {/* Collapsed row */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-zinc-800/30 transition-colors"
      >
        {/* Type + ownership badges */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded border ${TYPE_BADGES[resource.type]}`}>
            {TYPE_LABELS[resource.type]}
          </span>
          <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded border ${OWNERSHIP_COLORS[resource.ownership_status]}`}>
            {OWNERSHIP_LABELS[resource.ownership_status]}
          </span>
        </div>

        {/* Name */}
        <span className="font-mono text-sm font-semibold text-zinc-100 flex-1 truncate min-w-0">
          {resource.name}
        </span>

        {/* Status */}
        <span className={`font-mono text-[10px] shrink-0 ${STATUS_COLORS[status]}`}>
          [{STATUS_LABELS[status]}]
        </span>

        {/* Meta */}
        <span className="hidden lg:block text-xs text-zinc-700 shrink-0 truncate max-w-[200px]">
          {[
            authorRef?.name,
            resource.category?.replace(/-/g, ' '),
            latestResult ? `${formatDistanceToNow(new Date(latestResult.scannedAt), { addSuffix: true })}` : null,
          ].filter(Boolean).join(' · ')}
        </span>

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={handleScanNow}
            disabled={scanning}
            title="Scan now"
            className="p-1.5 text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 rounded transition-colors disabled:opacity-40"
          >
            {scanning
              ? <Loader2 size={13} className="animate-spin" />
              : <RefreshCw size={13} />}
          </button>
        </div>

        {expanded
          ? <ChevronUp size={13} className="text-zinc-600 shrink-0" />
          : <ChevronDown size={13} className="text-zinc-600 shrink-0" />}
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-zinc-800/60 px-4 py-4 space-y-4">
          {/* Author */}
          <AuthorPanel
            authorRef={authorRef}
            profile={authorProfile}
            onRefresh={resource.author_id ? handleAuthorRefresh : undefined}
            refreshing={authorRefreshing}
          />

          {/* Sub-skills / Workflows */}
          {latestResult?.subResources && latestResult.subResources.length > 0 && (
            <SubResourceList subResources={latestResult.subResources} type={resource.type} />
          )}

          {/* Source */}
          <div>
            <p className="font-mono text-[10px] text-zinc-600 uppercase tracking-widest mb-1.5">source</p>
            <p className="text-xs text-zinc-500">{resource.download_origin || 'Not specified'}</p>
            {resource.upstream_git_url && (
              <a
                href={resource.upstream_git_url.replace(/\.git$/, '')}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-mono text-xs text-cyan-500 hover:text-cyan-400 mt-1 transition-colors"
              >
                <ExternalLink size={11} />
                view_repo
              </a>
            )}
          </div>

          {/* Notes */}
          {resource.notes && (
            <div>
              <p className="font-mono text-[10px] text-zinc-600 uppercase tracking-widest mb-1.5">notes</p>
              <p className="text-xs text-zinc-500 leading-relaxed">{resource.notes}</p>
            </div>
          )}

          {/* Error */}
          {latestResult?.error && (
            <div className="bg-red-950/30 border border-red-900/50 rounded p-2.5">
              <p className="font-mono text-[10px] text-red-400 mb-1 uppercase tracking-widest">scan_error</p>
              <p className="font-mono text-xs text-red-300">{latestResult.error}</p>
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
