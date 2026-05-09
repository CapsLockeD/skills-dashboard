'use client'

import { useState, useEffect } from 'react'
import { ShoppingCart, CheckCircle, ChevronDown, ChevronUp, Wrench, Loader2, Terminal } from 'lucide-react'
import { AggregatedTool } from '@/app/api/tools/route'
import { ToolCategory, CATEGORY_LABELS, CATEGORY_COLORS, PRICING_COLORS } from '@/lib/tools-metadata'

const PRICING_LABELS: Record<string, string> = {
  'free': 'free',
  'freemium': 'freemium',
  'usage-based': 'usage-based',
  'subscription': 'subscription',
}

const ALL_CATEGORIES: ToolCategory[] = [
  'ai-llm', 'seo-data', 'scraping', 'google', 'marketing-email', 'social', 'infrastructure',
]

export default function ToolsPage() {
  const [tools, setTools] = useState<AggregatedTool[]>([])
  const [loading, setLoading] = useState(true)
  const [categoryFilter, setCategoryFilter] = useState<ToolCategory | 'all'>('all')
  const [expandedTool, setExpandedTool] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/tools')
      .then((r) => r.json())
      .then((data) => {
        setTools(data.tools ?? [])
        setLoading(false)
      })
  }, [])

  const filtered = categoryFilter === 'all'
    ? tools
    : tools.filter((t) => t.category === categoryFilter)

  const paidCount = tools.filter((t) => t.mustPurchase).length
  const freeCount = tools.length - paidCount

  const categoryCounts = tools.reduce<Record<string, number>>((acc, t) => {
    acc[t.category] = (acc[t.category] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="min-h-screen bg-[#080808]">
      {/* Top bar */}
      <header className="sticky top-0 z-40 bg-[#0a0a0a] border-b border-zinc-800/60">
        <div className="px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-zinc-600">
            <Terminal size={12} />
            <span className="font-mono text-xs">
              tools · {tools.length} services detected
            </span>
          </div>
        </div>
      </header>

      <main className="px-6 py-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mb-6">
          {[
            { label: 'tools_in_use', value: tools.length, color: 'text-zinc-100', sub: 'across all scanned resources' },
            { label: 'paid_or_key_reqd', value: paidCount, color: 'text-zinc-100', sub: 'require purchase or billing' },
            { label: 'free_or_oauth', value: freeCount, color: 'text-green-400', sub: 'free or OAuth-based access' },
          ].map(({ label, value, color, sub }) => (
            <div key={label} className="bg-[#0f0f0f] border border-zinc-800/60 rounded p-3">
              <p className="font-mono text-[10px] text-zinc-600 uppercase tracking-widest mb-1">{label}</p>
              <p className={`font-mono text-2xl font-bold ${color}`}>{value}</p>
              <p className="font-mono text-[10px] text-zinc-700 mt-0.5">{sub}</p>
            </div>
          ))}
        </div>

        {/* Category filter */}
        <div className="flex flex-wrap items-center gap-1 mb-4 font-mono text-xs">
          <span className="text-zinc-700 mr-1">filter:</span>
          <button
            onClick={() => setCategoryFilter('all')}
            className={`px-2.5 py-1 rounded transition-colors ${
              categoryFilter === 'all'
                ? 'bg-zinc-700 text-zinc-100'
                : 'text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800/60'
            }`}
          >
            all ({tools.length})
          </button>
          {ALL_CATEGORIES.filter((c) => categoryCounts[c]).map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-2.5 py-1 rounded transition-colors ${
                categoryFilter === cat
                  ? 'bg-zinc-700 text-zinc-100'
                  : 'text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800/60'
              }`}
            >
              {CATEGORY_LABELS[cat].toLowerCase().replace(/ /g, '-')} ({categoryCounts[cat]})
            </button>
          ))}
        </div>

        {/* Tools list */}
        {loading ? (
          <div className="flex items-center justify-center py-24 gap-2 text-zinc-600">
            <Loader2 size={16} className="animate-spin" />
            <span className="font-mono text-sm">loading...</span>
          </div>
        ) : tools.length === 0 ? (
          <div className="text-center py-24">
            <Wrench size={28} className="text-zinc-800 mx-auto mb-3" />
            <p className="font-mono text-zinc-600 text-sm">// no tools detected</p>
            <p className="font-mono text-zinc-700 text-xs mt-1">run a scan on your resources first</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((tool) => {
              const isExpanded = expandedTool === tool.service
              const catColor = CATEGORY_COLORS[tool.category]
              const pricingColor = PRICING_COLORS[tool.pricingModel] ?? 'text-zinc-400'

              return (
                <div
                  key={tool.service}
                  className="bg-[#0f0f0f] border border-zinc-800/60 rounded overflow-hidden"
                >
                  <button
                    onClick={() => setExpandedTool(isExpanded ? null : tool.service)}
                    className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-zinc-800/30 transition-colors"
                  >
                    {/* paid/free dot */}
                    <div className="shrink-0">
                      {tool.mustPurchase
                        ? <ShoppingCart size={13} className="text-zinc-500" />
                        : <CheckCircle size={13} className="text-green-400" />}
                    </div>

                    {/* Name + badges */}
                    <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-semibold text-zinc-100">{tool.service}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border font-mono ${catColor}`}>
                        {CATEGORY_LABELS[tool.category].toLowerCase().replace(' & ', '/')}
                      </span>
                      <span className={`font-mono text-[10px] ${pricingColor}`}>
                        [{PRICING_LABELS[tool.pricingModel]}]
                      </span>
                    </div>

                    {/* Description preview */}
                    <p className="hidden md:block text-xs text-zinc-600 truncate max-w-xs">
                      {tool.description.split('.')[0]}
                    </p>

                    {/* Usage + expand */}
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-mono text-[10px] text-zinc-700">
                        {tool.usedBy.length} skill{tool.usedBy.length !== 1 ? 's' : ''}
                      </span>
                      {isExpanded
                        ? <ChevronUp size={13} className="text-zinc-600" />
                        : <ChevronDown size={13} className="text-zinc-600" />}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-zinc-800/60 px-4 py-4 space-y-4">
                      {/* Description */}
                      <p className="text-xs text-zinc-400 leading-relaxed">{tool.description}</p>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Pricing */}
                        <div>
                          <p className="font-mono text-[10px] text-zinc-600 uppercase tracking-widest mb-2">pricing</p>
                          <p className={`font-mono text-xs font-medium mb-1.5 ${pricingColor}`}>
                            {PRICING_LABELS[tool.pricingModel]}
                          </p>
                          <p className="text-xs text-zinc-500 leading-relaxed">{tool.pricingNotes}</p>
                        </div>

                        {/* Alternatives */}
                        <div>
                          <p className="font-mono text-[10px] text-zinc-600 uppercase tracking-widest mb-2">alternatives</p>
                          {tool.competitors.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {tool.competitors.map((c) => (
                                <span
                                  key={c}
                                  className="font-mono text-[10px] px-2 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-zinc-400"
                                >
                                  {c}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="font-mono text-xs text-zinc-700">—</p>
                          )}
                        </div>

                        {/* Env vars */}
                        <div>
                          <p className="font-mono text-[10px] text-zinc-600 uppercase tracking-widest mb-2">env_vars</p>
                          {tool.envVars.length > 0 ? (
                            <div className="space-y-1">
                              {tool.envVars.map((v) => (
                                <code
                                  key={v}
                                  className="block text-[11px] font-mono bg-zinc-900 border border-zinc-800 rounded px-2 py-0.5 text-green-400"
                                >
                                  {v}
                                </code>
                              ))}
                            </div>
                          ) : (
                            <p className="font-mono text-xs text-zinc-700">// no key required</p>
                          )}
                        </div>
                      </div>

                      {/* Used in stack */}
                      {tool.usedBy.length > 0 && (
                        <div>
                          <p className="font-mono text-[10px] text-zinc-600 uppercase tracking-widest mb-2">used_in_stack</p>
                          <div className="space-y-1">
                            {tool.usedBy.map((u, i) => (
                              <div key={i} className="flex items-start gap-2 font-mono text-xs">
                                <span className="text-zinc-700 shrink-0">→</span>
                                <span className="text-cyan-400">{u.resourceName}</span>
                                <span className="text-zinc-700">·</span>
                                <span className="text-zinc-500">{u.skillName}</span>
                                {u.purpose && (
                                  <>
                                    <span className="text-zinc-700">·</span>
                                    <span className="text-zinc-600 italic">{u.purpose}</span>
                                  </>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {tool.endpoint && (
                        <p className="font-mono text-[10px] text-zinc-700">
                          endpoint: {tool.endpoint}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
