'use client'

import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { ChevronDown, ChevronUp, RefreshCw, ExternalLink, ShoppingCart, CheckCircle, Loader2, Trash2 } from 'lucide-react'
import { RegistryResource, ScanResult, AuthorProfile, RegistryAuthorRef, ScanStatus, ResourceType, OwnershipStatus, SubResource } from '@/types'
import UpdatePanel from './UpdatePanel'
import AuthorPanel from './AuthorPanel'
import ScanProgressBar from './ScanProgressBar'

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
                      {paidTools.length} paid
                    </span>
                  )}
                  {freeTools.length > 0 && (
                    <span className="font-mono text-[10px] text-green-600">
                      {freeTools.length} free
                    </span>
                  )}
                  {tools.length === 0 && (
                    <span className="font-mono text-[10px] text-zinc-700">no tools</span>
                  )}
                  {isOpen ? <ChevronUp size={11} className="text-zinc-600" /> : <ChevronDown size={11} className="text-zinc-600" />}
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-zinc-800/60 px-3 pb-3 pt-2 space-y-2.5">
                  {/* Description or AI summary */}
                  {(sr.enrichment?.summary || sr.description) && (
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      {sr.enrichment?.summary || sr.description}
                    </p>
                  )}

                  {/* AI enrichment metadata */}
                  {sr.enrichment && (
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                      {sr.enrichment.useCase && (
                        <div>
                          <p className="font-mono text-[10px] text-zinc-700 uppercase tracking-widest mb-0.5">use_case</p>
                          <p className="text-xs text-zinc-500">{sr.enrichment.useCase}</p>
                        </div>
                      )}
                      {sr.enrichment.output && (
                        <div>
                          <p className="font-mono text-[10px] text-zinc-700 uppercase tracking-widest mb-0.5">output</p>
                          <p className="text-xs text-zinc-500">{sr.enrichment.output}</p>
                        </div>
                      )}
                      <div className="flex items-center gap-3">
                        {sr.enrichment.category && (
                          <span className="font-mono text-[10px] px-1.5 py-0.5 border border-zinc-700 rounded text-zinc-400">
                            {sr.enrichment.category}
                          </span>
                        )}
                        <span className={`font-mono text-[10px] ${
                          sr.enrichment.complexity === 'beginner' ? 'text-green-500' :
                          sr.enrichment.complexity === 'advanced' ? 'text-red-400' :
                          'text-cyan-500'
                        }`}>
                          [{sr.enrichment.complexity}]
                        </span>
                        {!sr.enrichment.standalone && (
                          <span className="font-mono text-[10px] text-zinc-600">chains</span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Tools (from regex + AI-detected) */}
                  {(tools.length > 0 || (sr.enrichment?.detectedTools?.length ?? 0) > 0) && (
                    <div className="space-y-1.5">
                      <p className="font-mono text-[10px] text-zinc-700 uppercase tracking-widest">external_tools</p>
                      {tools.map((tool, j) => (
                        <div key={j} className="flex items-start gap-2">
                          {tool.mustPurchase
                            ? <ShoppingCart size={11} className="text-zinc-500 mt-0.5 shrink-0" />
                            : <CheckCircle size={11} className="text-green-600 mt-0.5 shrink-0" />}
                          <div className="min-w-0">
                            <span className={`font-mono text-xs ${tool.mustPurchase ? 'text-zinc-300' : 'text-green-400'}`}>
                              {tool.service}
                            </span>
                            {tool.mustPurchase && (
                              <span className="font-mono text-[10px] text-zinc-700 ml-1">[paid]</span>
                            )}
                            {tool.purpose && tool.purpose !== sr.name && (
                              <span className="text-zinc-600 text-xs ml-1">— {tool.purpose}</span>
                            )}
                          </div>
                        </div>
                      ))}
                      {sr.enrichment?.detectedTools?.filter(t =>
                        !tools.some(existing => existing.service.toLowerCase().includes(t.toLowerCase()))
                      ).map((t, j) => (
                        <div key={`ai-${j}`} className="flex items-start gap-2">
                          <span className="font-mono text-[10px] text-zinc-700 mt-0.5 shrink-0">?</span>
                          <span className="font-mono text-xs text-zinc-500">{t}</span>
                          <span className="font-mono text-[10px] text-zinc-700">[ai-detected]</span>
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
  onDelete: (id: string) => void
  externalScanning?: boolean
}

export default function ResourceCard({
  resource,
  latestResult,
  authorProfile,
  authorRef,
  onResultUpdate,
  onAuthorRefresh,
  onDelete,
  externalScanning = false,
}: ResourceCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [internalScanning, setInternalScanning] = useState(false)
  const scanning = internalScanning || externalScanning
  const [authorRefreshing, setAuthorRefreshing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function handleDelete() {
    await fetch('/api/registry', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: resource.id }),
    })
    onDelete(resource.id)
  }

  const status: ScanStatus = scanning ? 'scanning' : (latestResult?.status ?? 'never-scanned')
  const hasUpdate = status === 'update-available' || status === 'security-flag'

  async function handleScanNow() {
    setInternalScanning(true)
    try {
      const res = await fetch(`/api/scan/${encodeURIComponent(resource.id)}`, { method: 'POST' })
      if (!res.ok) {
        const text = await res.text()
        console.error(`[scan] ${resource.id} → HTTP ${res.status}:`, text)
        return
      }
      const result = await res.json()
      onResultUpdate(result)
    } catch (err) {
      console.error(`[scan] ${resource.id} → error:`, err)
    } finally {
      setInternalScanning(false)
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
        : scanning
        ? 'border-cyan-900/40'
        : 'border-zinc-800/60'
    }`}>
      {/* Collapsed row — div to avoid invalid button-in-button nesting */}
      <div
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-zinc-800/30 transition-colors cursor-pointer"
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
      </div>

      {/* Scan progress bar — shown when scanning is active */}
      <ScanProgressBar resourceId={resource.id} scanning={scanning} />

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

          {/* Delete */}
          <div className="pt-2 border-t border-zinc-800/60 flex justify-end">
            {confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-zinc-500">confirm delete?</span>
                <button
                  onClick={handleDelete}
                  className="font-mono text-xs text-red-400 hover:text-red-300 px-2 py-1 border border-red-800/60 rounded hover:bg-red-900/20 transition-colors"
                >
                  yes, delete
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="font-mono text-xs text-zinc-600 hover:text-zinc-300 px-2 py-1 border border-zinc-800 rounded hover:bg-zinc-800 transition-colors"
                >
                  cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-1.5 font-mono text-xs text-zinc-700 hover:text-red-400 transition-colors"
              >
                <Trash2 size={11} />
                delete resource
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
