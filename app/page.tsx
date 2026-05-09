'use client'

import { useState, useEffect, useCallback } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { RefreshCw, Plus, Shield, BookOpen, Loader2, Terminal } from 'lucide-react'
import { Registry, ScanHistory, AuthorCache, ScanResult, ResourceType } from '@/types'
import ResourceCard from '@/components/ResourceCard'
import AddResourceModal from '@/components/AddResourceModal'

type FilterType = 'all' | ResourceType | 'flagged'

const FILTER_OPTIONS: { value: FilterType; label: string }[] = [
  { value: 'all', label: 'all' },
  { value: 'claude-skill', label: 'claude-skills' },
  { value: 'n8n-workflow', label: 'n8n-workflows' },
  { value: 'reference-kit', label: 'reference-kits' },
  { value: 'flagged', label: 'flagged' },
]

export default function Dashboard() {
  const [registry, setRegistry] = useState<Registry | null>(null)
  const [scanHistory, setScanHistory] = useState<ScanHistory | null>(null)
  const [authorCache, setAuthorCache] = useState<AuthorCache | null>(null)
  const [filter, setFilter] = useState<FilterType>('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [scanningIds, setScanningIds] = useState<Set<string>>(new Set())
  const [showAddModal, setShowAddModal] = useState(false)

  const fetchData = useCallback(async () => {
    const [reg, scans, authors] = await Promise.all([
      fetch('/api/registry').then((r) => r.json()),
      fetch('/api/scan').then((r) => r.json()),
      fetch('/api/authors').then((r) => r.json()),
    ])
    setRegistry(reg)
    setScanHistory(scans)
    setAuthorCache(authors)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  async function handleScanAll() {
    if (!registry) return
    setScanning(true)
    const toScan = registry.resources.filter((r) => !r.skip_auto_update)
    setScanningIds(new Set(toScan.map((r) => r.id)))
    await Promise.allSettled(
      toScan.map(async (r) => {
        await fetch(`/api/scan/${encodeURIComponent(r.id)}`, { method: 'POST' })
        setScanningIds((prev) => {
          const next = new Set(prev)
          next.delete(r.id)
          return next
        })
      })
    )
    await fetchData()
    setScanning(false)
    setScanningIds(new Set())
  }

  async function handleRefreshAuthors() {
    await fetch('/api/authors', { method: 'POST' })
    const authors = await fetch('/api/authors').then((r) => r.json())
    setAuthorCache(authors)
  }

  async function handleAuthorRefresh(authorId: string) {
    const profile = await fetch(`/api/authors/${encodeURIComponent(authorId)}`, { method: 'POST' }).then((r) => r.json())
    setAuthorCache((prev) => {
      if (!prev) return prev
      return { ...prev, authors: { ...prev.authors, [authorId]: profile } }
    })
  }

  function handleResultUpdate(result: ScanResult) {
    setScanHistory((prev) => {
      if (!prev) return prev
      const updated = { ...prev, results: { ...prev.results } }
      const existing = updated.results[result.resourceId] || []
      updated.results[result.resourceId] = [result, ...existing].slice(0, 10)
      return updated
    })
  }

  function handleDelete(id: string) {
    setRegistry((prev) => prev ? { ...prev, resources: prev.resources.filter((r) => r.id !== id) } : prev)
  }

  const resources = registry?.resources ?? []

  const lastScanTime =
    scanHistory?.lastGlobalScan ??
    Object.values(scanHistory?.results ?? {})
      .flat()
      .map((r) => r.scannedAt)
      .sort()
      .at(-1) ??
    null

  const filteredResources = resources.filter((r) => {
    if (filter === 'flagged') {
      const latest = scanHistory?.results[r.id]?.[0]
      if (latest?.status !== 'security-flag') return false
    } else if (filter !== 'all' && r.type !== filter) {
      return false
    }

    if (!search.trim()) return true
    const q = search.toLowerCase()
    if (r.name.toLowerCase().includes(q)) return true
    const subResources = scanHistory?.results[r.id]?.[0]?.subResources ?? []
    return subResources.some(
      (sr) =>
        sr.name.toLowerCase().includes(q) ||
        sr.description?.toLowerCase().includes(q) ||
        sr.enrichment?.summary?.toLowerCase().includes(q) ||
        sr.enrichment?.category?.toLowerCase().includes(q)
    )
  })

  const counts = {
    total: resources.length,
    flags: resources.filter((r) => scanHistory?.results[r.id]?.[0]?.status === 'security-flag').length,
    updates: resources.filter((r) => scanHistory?.results[r.id]?.[0]?.status === 'update-available').length,
    upToDate: resources.filter((r) => scanHistory?.results[r.id]?.[0]?.status === 'up-to-date').length,
  }

  return (
    <div className="min-h-screen bg-[#080808]">
      {/* Top bar */}
      <header className="sticky top-0 z-40 bg-[#0a0a0a] border-b border-zinc-800/60">
        <div className="px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-zinc-600">
            <Terminal size={12} />
            <span className="font-mono text-xs">
              resources
              {lastScanTime
                ? ` · last_scan=${formatDistanceToNow(new Date(lastScanTime), { addSuffix: true })}`
                : ' · never_scanned'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRefreshAuthors}
              title="Refresh author profiles"
              className="p-2 text-zinc-600 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors"
            >
              <BookOpen size={14} />
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 text-xs font-mono rounded transition-colors"
            >
              <Plus size={12} />
              add_resource
            </button>
            <button
              onClick={handleScanAll}
              disabled={scanning}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 disabled:opacity-50 text-cyan-400 text-xs font-mono rounded transition-colors"
            >
              {scanning ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              {scanning ? 'scanning...' : 'scan_all'}
            </button>
          </div>
        </div>
      </header>

      <main className="px-6 py-6">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 mb-6">
          {[
            { label: 'total', value: counts.total, color: 'text-zinc-100' },
            { label: 'up_to_date', value: counts.upToDate, color: 'text-green-400' },
            { label: 'updates_avail', value: counts.updates, color: 'text-cyan-400' },
            { label: 'sec_flags', value: counts.flags, color: counts.flags > 0 ? 'text-red-400' : 'text-zinc-600' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-[#0f0f0f] border border-zinc-800/60 rounded p-3">
              <p className="font-mono text-[10px] text-zinc-600 uppercase tracking-widest mb-1">{label}</p>
              <div className="flex items-end gap-1.5">
                {label === 'sec_flags' && counts.flags > 0 && (
                  <Shield size={12} className="text-red-400 mb-0.5" />
                )}
                <p className={`font-mono text-2xl font-bold ${color}`}>{value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Filter + search bar */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center gap-1 font-mono text-xs">
            <span className="text-zinc-700 mr-1">filter:</span>
            {FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setFilter(opt.value)}
                className={`px-2.5 py-1 rounded transition-colors ${
                  filter === opt.value
                    ? 'bg-zinc-700 text-zinc-100'
                    : 'text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800/60'
                }`}
              >
                {opt.label}
                {opt.value === 'flagged' && counts.flags > 0 && (
                  <span className="ml-1 text-red-400">({counts.flags})</span>
                )}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="search skills..."
            className="ml-auto font-mono text-xs bg-zinc-900 border border-zinc-800 rounded px-3 py-1 text-zinc-300 placeholder-zinc-700 focus:outline-none focus:border-zinc-600 w-52"
          />
        </div>

        {/* Resource list — single column */}
        {loading ? (
          <div className="flex items-center justify-center py-24 gap-2 text-zinc-600">
            <Loader2 size={16} className="animate-spin" />
            <span className="font-mono text-sm">loading...</span>
          </div>
        ) : filteredResources.length === 0 ? (
          <div className="text-center py-24">
            <p className="font-mono text-zinc-600 text-sm">
              {filter === 'flagged' ? '// no security flags · all clear' : '// no resources found'}
            </p>
            {filter === 'all' && resources.length === 0 && (
              <button
                onClick={() => setShowAddModal(true)}
                className="mt-3 font-mono text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                + add_resource →
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredResources.map((resource) => (
              <ResourceCard
                key={resource.id}
                resource={resource}
                latestResult={scanHistory?.results[resource.id]?.[0] ?? null}
                authorProfile={resource.author_id ? (authorCache?.authors[resource.author_id] ?? null) : null}
                authorRef={resource.author_id ? (registry?.authors[resource.author_id] ?? null) : null}
                onResultUpdate={handleResultUpdate}
                onAuthorRefresh={handleAuthorRefresh}
                onDelete={handleDelete}
                externalScanning={scanningIds.has(resource.id)}
              />
            ))}
          </div>
        )}
      </main>

      {showAddModal && (
        <AddResourceModal
          onClose={() => setShowAddModal(false)}
          onAdded={async (newResourceId) => {
            setShowAddModal(false)
            await fetchData()
            // Auto-scan the new resource and refresh authors in parallel
            if (newResourceId) {
              setScanningIds((prev) => new Set([...prev, newResourceId]))
              fetch(`/api/scan/${encodeURIComponent(newResourceId)}`, { method: 'POST' })
                .then((r) => r.json())
                .then((result) => handleResultUpdate(result))
                .finally(() => setScanningIds((prev) => {
                  const next = new Set(prev)
                  next.delete(newResourceId)
                  return next
                }))
              // Enrich the author profile in the background
              fetch('/api/authors', { method: 'POST' })
                .then(() => fetch('/api/authors').then((r) => r.json()))
                .then((authors) => setAuthorCache(authors))
                .catch(() => {/* non-critical */})
            }
          }}
        />
      )}
    </div>
  )
}
