'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { LayoutGrid, Wrench, ChevronDown, ChevronUp, ShoppingCart, CheckCircle, ArrowLeft, Loader2 } from 'lucide-react'
import { AggregatedTool } from '@/app/api/tools/route'
import { ToolCategory, CATEGORY_LABELS, CATEGORY_COLORS, PRICING_COLORS } from '@/lib/tools-metadata'

const PRICING_LABELS: Record<string, string> = {
  'free': 'Free',
  'freemium': 'Freemium',
  'usage-based': 'Usage-based',
  'subscription': 'Subscription',
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

  // Group tools by category for the filter badge counts
  const categoryCounts = tools.reduce<Record<string, number>>((acc, t) => {
    acc[t.category] = (acc[t.category] ?? 0) + 1
    return acc
  }, {})

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
              <p className="text-xs text-gray-500">Tool Reference</p>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex items-center gap-1 bg-gray-800 border border-gray-700 rounded-lg p-1">
            <Link
              href="/"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
            >
              <LayoutGrid size={12} />
              Resources
            </Link>
            <span className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-gray-700 rounded">
              <Wrench size={12} />
              Tools
            </span>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
            <p className="text-xs text-gray-500">Tools in Use</p>
            <p className="text-2xl font-bold text-white mt-0.5">{tools.length}</p>
            <p className="text-xs text-gray-600 mt-0.5">detected across all scanned resources</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
            <p className="text-xs text-gray-500 flex items-center gap-1">
              <ShoppingCart size={11} className="text-amber-400" /> Paid / API Key Required
            </p>
            <p className="text-2xl font-bold text-amber-400 mt-0.5">{paidCount}</p>
            <p className="text-xs text-gray-600 mt-0.5">require purchase or billing setup</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
            <p className="text-xs text-gray-500 flex items-center gap-1">
              <CheckCircle size={11} className="text-green-400" /> Free / OAuth
            </p>
            <p className="text-2xl font-bold text-green-400 mt-0.5">{freeCount}</p>
            <p className="text-xs text-gray-600 mt-0.5">free or OAuth-based access</p>
          </div>
        </div>

        {/* Category filter */}
        <div className="flex flex-wrap gap-1 mb-4">
          <button
            onClick={() => setCategoryFilter('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              categoryFilter === 'all'
                ? 'bg-gray-700 text-white'
                : 'bg-gray-900 border border-gray-800 text-gray-500 hover:text-gray-300'
            }`}
          >
            All ({tools.length})
          </button>
          {ALL_CATEGORIES.filter((c) => categoryCounts[c]).map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                categoryFilter === cat
                  ? 'bg-gray-700 text-white'
                  : 'bg-gray-900 border border-gray-800 text-gray-500 hover:text-gray-300'
              }`}
            >
              {CATEGORY_LABELS[cat]} ({categoryCounts[cat]})
            </button>
          ))}
        </div>

        {/* Tools table */}
        {loading ? (
          <div className="flex items-center justify-center py-24 gap-2 text-gray-500">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-sm">Loading tools...</span>
          </div>
        ) : tools.length === 0 ? (
          <div className="text-center py-24">
            <Wrench size={32} className="text-gray-700 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No tools detected yet.</p>
            <p className="text-gray-600 text-xs mt-1">
              Run a scan on your resources to populate this list.
            </p>
            <Link href="/" className="mt-3 inline-block text-xs text-blue-400 hover:text-blue-300 transition-colors">
              ← Go scan your resources
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((tool) => {
              const isExpanded = expandedTool === tool.service
              const meta = CATEGORY_COLORS[tool.category]
              const pricingColor = PRICING_COLORS[tool.pricingModel] ?? 'text-gray-400'

              return (
                <div
                  key={tool.service}
                  className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden"
                >
                  {/* Row */}
                  <button
                    onClick={() => setExpandedTool(isExpanded ? null : tool.service)}
                    className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-gray-800/50 transition-colors"
                  >
                    {/* Paid/free indicator */}
                    <div className="mt-0.5 shrink-0">
                      {tool.mustPurchase
                        ? <ShoppingCart size={14} className="text-amber-400" />
                        : <CheckCircle size={14} className="text-green-400" />}
                    </div>

                    {/* Name + category */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-white">{tool.service}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded border ${meta}`}>
                          {CATEGORY_LABELS[tool.category]}
                        </span>
                        <span className={`text-xs font-medium ${pricingColor}`}>
                          {PRICING_LABELS[tool.pricingModel]}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{tool.description}</p>
                    </div>

                    {/* Usage count + expand */}
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-gray-500">
                        {tool.usedBy.length} skill{tool.usedBy.length !== 1 ? 's' : ''}
                      </span>
                      {isExpanded
                        ? <ChevronUp size={14} className="text-gray-500" />
                        : <ChevronDown size={14} className="text-gray-500" />}
                    </div>
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="border-t border-gray-800 px-4 py-4 space-y-4">
                      {/* Description */}
                      <p className="text-xs text-gray-300 leading-relaxed">{tool.description}</p>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Pricing */}
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Pricing</p>
                          <p className={`text-xs font-medium mb-1 ${pricingColor}`}>
                            {PRICING_LABELS[tool.pricingModel]}
                          </p>
                          <p className="text-xs text-gray-400 leading-relaxed">{tool.pricingNotes}</p>
                        </div>

                        {/* Competitors */}
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Alternatives</p>
                          {tool.competitors.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {tool.competitors.map((c) => (
                                <span
                                  key={c}
                                  className="text-xs px-2 py-0.5 bg-gray-800 border border-gray-700 rounded text-gray-300"
                                >
                                  {c}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-gray-600">No direct alternatives</p>
                          )}
                        </div>

                        {/* Env vars */}
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Env Vars</p>
                          {tool.envVars.length > 0 ? (
                            <div className="space-y-1">
                              {tool.envVars.map((v) => (
                                <code
                                  key={v}
                                  className="block text-xs font-mono bg-gray-800 border border-gray-700 rounded px-2 py-0.5 text-green-300"
                                >
                                  {v}
                                </code>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-gray-600">No API key required</p>
                          )}
                        </div>
                      </div>

                      {/* Where it's used */}
                      {tool.usedBy.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Used In Your Stack</p>
                          <div className="space-y-1.5">
                            {tool.usedBy.map((u, i) => (
                              <div key={i} className="flex items-start gap-2 text-xs">
                                <span className="text-gray-500 shrink-0">→</span>
                                <div>
                                  <span className="text-blue-400">{u.resourceName}</span>
                                  <span className="text-gray-600 mx-1">·</span>
                                  <span className="text-gray-400">{u.skillName}</span>
                                  {u.purpose && (
                                    <>
                                      <span className="text-gray-600 mx-1">·</span>
                                      <span className="text-gray-500 italic">{u.purpose}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Endpoint */}
                      {tool.endpoint && (
                        <p className="text-xs text-gray-600 font-mono">
                          Endpoint: {tool.endpoint}
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
