'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutGrid, Wrench, Terminal, GitBranch } from 'lucide-react'

const NAV = [
  { href: '/', icon: LayoutGrid, label: 'Resources', key: '/' },
  { href: '/tools', icon: Wrench, label: 'Tools', key: '/tools' },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-52 bg-[#0a0a0a] border-r border-zinc-800/60 flex flex-col z-50">
      {/* Brand */}
      <div className="px-4 pt-5 pb-4 border-b border-zinc-800/60">
        <div className="flex items-center gap-2 mb-1">
          <Terminal size={14} className="text-cyan-400" />
          <span className="font-mono text-sm font-semibold text-zinc-100 tracking-tight">
            skills_dash
          </span>
        </div>
        <p className="font-mono text-[10px] text-zinc-600 pl-0.5">// ai resource tracker</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5">
        <p className="font-mono text-[10px] text-zinc-700 px-3 pb-2 pt-1 uppercase tracking-widest">
          navigation
        </p>
        {NAV.map(({ href, icon: Icon, label, key }) => {
          const active = pathname === key
          return (
            <Link
              key={href}
              href={href}
              className={`group flex items-center gap-2.5 px-3 py-2 rounded transition-all text-sm ${
                active
                  ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                  : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/60 border border-transparent'
              }`}
            >
              <Icon size={14} />
              <span className="font-mono">{label}</span>
              {active && (
                <span className="ml-auto font-mono text-[10px] text-cyan-500/50 animate-pulse">▌</span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-zinc-800/60">
        <div className="flex items-center gap-1.5 text-zinc-700">
          <GitBranch size={11} />
          <span className="font-mono text-[10px]">v0.1.0 · internal</span>
        </div>
      </div>
    </aside>
  )
}
