'use client'

import { AuthorProfile, RegistryAuthorRef } from '@/types'
import { Github, Twitter, Globe, RefreshCw, Linkedin, Youtube } from 'lucide-react'

interface AuthorPanelProps {
  authorRef: RegistryAuthorRef | null
  profile: AuthorProfile | null
  onRefresh?: () => void
  refreshing?: boolean
}

const SOCIAL_ICONS: Record<string, React.ReactNode> = {
  github: <Github size={13} />,
  twitter: <Twitter size={13} />,
  website: <Globe size={13} />,
  linkedin: <Linkedin size={13} />,
  youtube: <Youtube size={13} />,
}

export default function AuthorPanel({ authorRef, profile, onRefresh, refreshing }: AuthorPanelProps) {
  const name = profile?.name || authorRef?.name || 'Unknown Author'
  const socials = profile?.socials || []

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Author</span>
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className="text-gray-500 hover:text-gray-300 transition-colors"
            title="Refresh author profile"
          >
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
          </button>
        )}
      </div>

      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white">{name}</p>

          {profile?.authority && (
            <p className="text-xs text-gray-400 mt-0.5">{profile.authority}</p>
          )}

          {socials.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-1.5">
              {socials.map((s, i) => (
                <a
                  key={i}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center gap-1 text-xs transition-colors ${
                    s.aiGuessed
                      ? 'text-zinc-500 hover:text-zinc-300'
                      : 'text-blue-400 hover:text-blue-300'
                  }`}
                  title={s.aiGuessed ? 'AI-guessed — verify before trusting' : undefined}
                >
                  {SOCIAL_ICONS[s.platform] || <Globe size={13} />}
                  {s.handle || s.platform}
                  {s.aiGuessed && <span className="text-[9px] text-zinc-600">?</span>}
                </a>
              ))}
            </div>
          )}

          {profile?.aiDiscoveredSocials && (
            <p className="font-mono text-[10px] text-zinc-700 mt-1">
              // github-readme-parsed · unverified — links may be wrong, verify manually
            </p>
          )}

          {!profile && !authorRef && (
            <p className="text-xs text-gray-500 mt-1">
              No author information. Add an author_id to the registry entry.
            </p>
          )}
        </div>
      </div>

      {profile?.whyTrust && (
        <div className="bg-gray-800/50 border border-gray-700 rounded p-2.5">
          <p className="text-xs text-gray-400 leading-relaxed">{profile.whyTrust}</p>
        </div>
      )}

      {profile && !profile.whyTrust && (
        <p className="text-xs text-gray-600 italic">
          Author profile found — click refresh to enrich with AI summary.
        </p>
      )}
    </div>
  )
}
