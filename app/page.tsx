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
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
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
    await Promise.allSettled(
      registry.resources
        .filter((r) => !r.skip_auto_update)
        .map((r) => fetch(`/api/scan/${r.id}`, { method: 'POST' }))
    )
    await fetchData()
    setScanning(false)
  }

  async function handleRefreshAuthors() {
    await fetch('/api/authors', { method: 'POST' })
    const authors = await fetch('/api/authors').then((r) => r.json())
    setAuthorCache(authors)
  }

  async function handleAuthorRefresh(_authorId: string) {
    await handleRefreshAuthors()
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

  const resources = registry?.resources ?? []

  const filteredResources = resources.filter((r) => {
    if (filter === 'all') return true
    if (filter === 'flagged') {
      const latest = scanHistory?.results[r.id]?.[0]
      return latest?.status === 'security-flag'
    }
    return r.type === filter
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
              {scanHistory?.lastGlobalScan
                ? ` · last_scan=${formatDistanceToNow(new Date(scanHistory.lastGlobalScan), { addSuffix: true })}`
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

        {/* Filter bar */}
        <div className="flex items-center gap-1 mb-4 font-mono text-xs">
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
              />
            ))}
          </div>
        )}
      </main>

      {showAddModal && (
        <AddResourceModal
          onClose={() => setShowAddModal(false)}
          onAdded={() => {
            setShowAddModal(false)
            fetchData()
          }}
        />
      )}
    </div>
  )
}
