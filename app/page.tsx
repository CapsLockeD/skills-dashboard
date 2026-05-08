'use client'

import { useState, useEffect, useCallback } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { RefreshCw, Plus, Shield, LayoutGrid, BookOpen, Loader2 } from 'lucide-react'
import { Registry, ScanHistory, AuthorCache, ScanResult, ResourceType } from '@/types'
import ResourceCard from '@/components/ResourceCard'
import AddResourceModal from '@/components/AddResourceModal'

type FilterType = 'all' | ResourceType | 'flagged'

const FILTER_OPTIONS: { value: FilterType; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'claude-skill', label: 'Claude Skills' },
  { value: 'n8n-workflow', label: 'n8n Workflows' },
  { value: 'reference-kit', label: 'Reference Kits' },
  { value: 'flagged', label: 'Security Flags' },
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
    // Scan each resource concurrently for better throughput
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

  async function handleAuthorRefresh(authorId: string) {
    // Refresh all authors (simplest approach — the endpoint refreshes all)
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

  // ── Derived data ──────────────────────────────────────────────────────────

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

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 bg-blue-600 rounded-md flex items-center justify-center">
              <LayoutGrid size={15} className="text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white">Skills Dashboard</h1>
              <p className="text-xs text-gray-500">
                {scanHistory?.lastGlobalScan
                  ? `Last scan ${formatDistanceToNow(new Date(scanHistory.lastGlobalScan), { addSuffix: true })}`
                  : 'Never scanned'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRefreshAuthors}
              title="Refresh author profiles"
              className="p-2 text-gray-500 hover:text-gray-200 hover:bg-gray-800 rounded transition-colors"
            >
              <BookOpen size={15} />
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-200 text-xs font-medium rounded transition-colors"
            >
              <Plus size={13} />
              Add Resource
            </button>
            <button
              onClick={handleScanAll}
              disabled={scanning}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-700 hover:bg-blue-600 disabled:opacity-60 text-white text-xs font-medium rounded transition-colors"
            >
              {scanning ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <RefreshCw size={13} />
              )}
              {scanning ? 'Scanning...' : 'Scan All'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Stats bar */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
            <p className="text-xs text-gray-500">Total Resources</p>
            <p className="text-2xl font-bold text-white mt-0.5">{counts.total}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
            <p className="text-xs text-gray-500">Up to Date</p>
            <p className="text-2xl font-bold text-green-400 mt-0.5">{counts.upToDate}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
            <p className="text-xs text-gray-500">Updates Available</p>
            <p className="text-2xl font-bold text-blue-400 mt-0.5">{counts.updates}</p>
          </div>
          <div className={`bg-gray-900 border rounded-lg p-3 ${counts.flags > 0 ? 'border-red-900' : 'border-gray-800'}`}>
            <p className="text-xs text-gray-500 flex items-center gap-1">
              {counts.flags > 0 && <Shield size={11} className="text-red-400" />}
              Security Flags
            </p>
            <p className={`text-2xl font-bold mt-0.5 ${counts.flags > 0 ? 'text-red-400' : 'text-gray-400'}`}>
              {counts.flags}
            </p>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 mb-4 bg-gray-900 border border-gray-800 rounded-lg p-1 w-fit">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                filter === opt.value
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {opt.label}
              {opt.value === 'flagged' && counts.flags > 0 && (
                <span className="ml-1.5 bg-red-900/60 text-red-400 text-xs px-1 py-0.5 rounded">
                  {counts.flags}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Resource grid */}
        {loading ? (
          <div className="flex items-center justify-center py-24 gap-2 text-gray-500">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-sm">Loading...</span>
          </div>
        ) : filteredResources.length === 0 ? (
          <div className="text-center py-24">
            <p className="text-gray-500 text-sm">
              {filter === 'flagged' ? 'No security flags. All clear.' : 'No resources found.'}
            </p>
            {filter === 'all' && resources.length === 0 && (
              <button
                onClick={() => setShowAddModal(true)}
                className="mt-3 text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                Add your first resource →
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-3 grid-cols-1 lg:grid-cols-2">
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

      {/* Add Resource Modal */}
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
