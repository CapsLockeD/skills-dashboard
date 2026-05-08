'use client'

import { useState } from 'react'
import { X, Search, Plus, Loader2 } from 'lucide-react'
import { DiscoveredResource } from '@/lib/discovery'
import { RegistryResource, ResourceType, OwnershipStatus } from '@/types'

interface AddResourceModalProps {
  onClose: () => void
  onAdded: () => void
}

type Mode = 'choose' | 'discover' | 'manual'

export default function AddResourceModal({ onClose, onAdded }: AddResourceModalProps) {
  const [mode, setMode] = useState<Mode>('choose')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Discovery state
  const [discoverUrl, setDiscoverUrl] = useState('')
  const [discovered, setDiscovered] = useState<DiscoveredResource[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [downloadOrigin, setDownloadOrigin] = useState('')
  const [authorId, setAuthorId] = useState('')

  // Manual state
  const [manual, setManual] = useState<Partial<RegistryResource>>({
    type: 'claude-skill',
    ownership_status: 'external',
    skip_auto_update: false,
    sub_resource_ids: [],
    discovered_from: null,
  })

  async function handleDiscover() {
    if (!discoverUrl.trim()) return
    setLoading(true)
    setError('')
    setDiscovered([])
    try {
      const res = await fetch('/api/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'discover', repoUrl: discoverUrl.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Discovery failed')
      setDiscovered(data.discovered)
      setSelected(new Set(data.discovered.map((d: DiscoveredResource) => d.id)))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  async function handleConfirmDiscovery() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'confirm',
          repoUrl: discoverUrl.trim(),
          selectedIds: [...selected],
          allDiscovered: discovered,
          authorId: authorId || null,
          downloadOrigin: downloadOrigin || discoverUrl,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Confirm failed')
      onAdded()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  async function handleManualAdd() {
    if (!manual.id || !manual.name) {
      setError('ID and Name are required')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/registry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...manual,
          id: manual.id!.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
          author_id: manual.author_id || null,
          upstream_git_url: manual.upstream_git_url || null,
          local_path: manual.local_path || null,
          download_origin: manual.download_origin || '',
          category: manual.category || 'uncategorized',
          notes: manual.notes || '',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Add failed')
      onAdded()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-white">Add Resource</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Mode picker */}
          {mode === 'choose' && (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setMode('discover')}
                className="flex flex-col items-center gap-2 p-4 bg-gray-800 hover:bg-gray-750 border border-gray-700 rounded-lg text-center transition-colors"
              >
                <Search size={20} className="text-blue-400" />
                <div>
                  <p className="text-sm font-medium text-white">Auto-Discover</p>
                  <p className="text-xs text-gray-500 mt-0.5">Paste a repo URL and scan for skills</p>
                </div>
              </button>
              <button
                onClick={() => setMode('manual')}
                className="flex flex-col items-center gap-2 p-4 bg-gray-800 hover:bg-gray-750 border border-gray-700 rounded-lg text-center transition-colors"
              >
                <Plus size={20} className="text-green-400" />
                <div>
                  <p className="text-sm font-medium text-white">Manual Entry</p>
                  <p className="text-xs text-gray-500 mt-0.5">Add a zip download or reference kit</p>
                </div>
              </button>
            </div>
          )}

          {/* Discovery mode */}
          {mode === 'discover' && (
            <div className="space-y-3">
              <button onClick={() => setMode('choose')} className="text-xs text-gray-500 hover:text-gray-300">
                ← Back
              </button>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Repository URL</label>
                <div className="flex gap-2">
                  <input
                    value={discoverUrl}
                    onChange={(e) => setDiscoverUrl(e.target.value)}
                    placeholder="https://github.com/org/repo.git"
                    className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-600"
                  />
                  <button
                    onClick={handleDiscover}
                    disabled={loading || !discoverUrl.trim()}
                    className="px-3 py-1.5 bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white text-xs font-medium rounded transition-colors flex items-center gap-1.5"
                  >
                    {loading ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
                    Scan
                  </button>
                </div>
              </div>

              {discovered.length > 0 && (
                <>
                  <div>
                    <p className="text-xs text-gray-400 mb-2">
                      Found {discovered.length} resource{discovered.length !== 1 ? 's' : ''}. Select to import:
                    </p>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {discovered.map((d) => (
                        <label key={d.id} className="flex items-start gap-2 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={selected.has(d.id)}
                            onChange={(e) => {
                              const next = new Set(selected)
                              e.target.checked ? next.add(d.id) : next.delete(d.id)
                              setSelected(next)
                            }}
                            className="mt-0.5 accent-blue-500"
                          />
                          <div>
                            <p className="text-xs text-white group-hover:text-blue-300 transition-colors">{d.name}</p>
                            {d.description && <p className="text-xs text-gray-600">{d.description}</p>}
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Download Origin (optional)</label>
                    <input
                      value={downloadOrigin}
                      onChange={(e) => setDownloadOrigin(e.target.value)}
                      placeholder="e.g. Skool community URL, GitHub, etc."
                      className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Author ID (optional)</label>
                    <input
                      value={authorId}
                      onChange={(e) => setAuthorId(e.target.value)}
                      placeholder="e.g. matthew-berman (must exist in registry authors)"
                      className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-600"
                    />
                  </div>

                  <button
                    onClick={handleConfirmDiscovery}
                    disabled={loading || selected.size === 0}
                    className="w-full py-2 bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-medium rounded transition-colors flex items-center justify-center gap-1.5"
                  >
                    {loading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                    Import {selected.size} Selected
                  </button>
                </>
              )}
            </div>
          )}

          {/* Manual mode */}
          {mode === 'manual' && (
            <div className="space-y-3">
              <button onClick={() => setMode('choose')} className="text-xs text-gray-500 hover:text-gray-300">
                ← Back
              </button>

              {(
                [
                  { key: 'id', label: 'ID (slug)', placeholder: 'my-skill-name' },
                  { key: 'name', label: 'Display Name', placeholder: 'My Skill' },
                  { key: 'author_id', label: 'Author ID', placeholder: 'matthew-berman (optional)' },
                  { key: 'upstream_git_url', label: 'Git URL (optional)', placeholder: 'https://github.com/org/repo.git' },
                  { key: 'download_origin', label: 'Download Origin', placeholder: 'Skool community, GitHub, etc.' },
                  { key: 'category', label: 'Category', placeholder: 'marketing, seo, video, etc.' },
                  { key: 'notes', label: 'Notes', placeholder: 'Brief description...' },
                ] as const
              ).map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="block text-xs text-gray-400 mb-1">{label}</label>
                  <input
                    value={(manual[key] as string) || ''}
                    onChange={(e) => setManual((m) => ({ ...m, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-600"
                  />
                </div>
              ))}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Type</label>
                  <select
                    value={manual.type || 'claude-skill'}
                    onChange={(e) => setManual((m) => ({ ...m, type: e.target.value as ResourceType }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-600"
                  >
                    <option value="claude-skill">Claude Skill</option>
                    <option value="n8n-workflow">n8n Workflow</option>
                    <option value="reference-kit">Reference Kit</option>
                    <option value="mixed">Mixed</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Ownership</label>
                  <select
                    value={manual.ownership_status || 'external'}
                    onChange={(e) => setManual((m) => ({ ...m, ownership_status: e.target.value as OwnershipStatus }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-600"
                  >
                    <option value="external">External</option>
                    <option value="monitored">Monitored</option>
                    <option value="vendored">Vendored</option>
                    <option value="internal">Internal</option>
                  </select>
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={manual.skip_auto_update || false}
                  onChange={(e) => setManual((m) => ({ ...m, skip_auto_update: e.target.checked }))}
                  className="accent-blue-500"
                />
                <span className="text-xs text-gray-400">Skip auto-update scans</span>
              </label>

              <button
                onClick={handleManualAdd}
                disabled={loading}
                className="w-full py-2 bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white text-sm font-medium rounded transition-colors flex items-center justify-center gap-1.5"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                Add Resource
              </button>
            </div>
          )}

          {error && (
            <div className="bg-red-900/20 border border-red-800 rounded p-2.5">
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
