'use client'

import { useState } from 'react'
import { ScanResult } from '@/types'
import DiffViewer from './DiffViewer'
import { ShieldAlert, ShieldCheck, AlertTriangle, ChevronDown, ChevronUp, GitMerge, SkipForward } from 'lucide-react'

interface UpdatePanelProps {
  result: ScanResult
  onMerge: () => Promise<void>
  onCheckNow: () => Promise<void>
}

const RECOMMENDATION_CONFIG = {
  SAFE_TO_MERGE: {
    icon: <ShieldCheck size={14} />,
    label: 'Safe to Merge',
    classes: 'bg-green-900/40 border-green-800 text-green-400',
    headerClasses: 'border-green-900/50',
  },
  HUMAN_REVIEW_NEEDED: {
    icon: <AlertTriangle size={14} />,
    label: 'Human Review Needed',
    classes: 'bg-amber-900/40 border-amber-800 text-amber-400',
    headerClasses: 'border-amber-900/50',
  },
  DO_NOT_MERGE: {
    icon: <ShieldAlert size={14} />,
    label: 'Do Not Merge',
    classes: 'bg-red-900/40 border-red-800 text-red-400',
    headerClasses: 'border-red-900/50',
  },
}

export default function UpdatePanel({ result, onMerge, onCheckNow }: UpdatePanelProps) {
  const [showDiff, setShowDiff] = useState(false)
  const [merging, setMerging] = useState(false)

  const rec = result.aiRecommendation
  const config = rec ? RECOMMENDATION_CONFIG[rec] : null

  async function handleMerge() {
    setMerging(true)
    await onMerge()
    setMerging(false)
  }

  return (
    <div className={`border rounded-lg overflow-hidden ${config?.classes || 'bg-gray-800/40 border-gray-700'}`}>
      {/* Header */}
      <div className={`flex items-center justify-between px-3 py-2 border-b ${config?.headerClasses || 'border-gray-700'}`}>
        <div className="flex items-center gap-2">
          {config?.icon}
          <span className="text-xs font-semibold uppercase tracking-wide">
            {result.commitsAhead} commit{result.commitsAhead !== 1 ? 's' : ''} ahead upstream
          </span>
        </div>
        {config && (
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${config.classes}`}>
            {config.label}
          </span>
        )}
      </div>

      <div className="p-3 space-y-3">
        {/* AI Summary */}
        {result.aiSummary && (
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Summary</p>
            <p className="text-sm text-gray-200 leading-relaxed">{result.aiSummary}</p>
          </div>
        )}

        {/* Endpoint Changes */}
        {result.endpointChanges.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
              Endpoint Changes
            </p>
            <div className="space-y-1">
              {result.endpointChanges.map((ec, i) => (
                <div key={i} className="flex items-center gap-2 text-xs font-mono">
                  <span className={ec.type === 'added' ? 'text-green-400' : 'text-red-400'}>
                    {ec.type === 'added' ? '+' : '-'}
                  </span>
                  <span className="text-gray-300 break-all">{ec.url}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Security Assessment */}
        {result.aiSecurityAssessment && result.aiSecurityAssessment !== 'No changes to assess.' && (
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
              Security Assessment
            </p>
            <p className="text-sm text-gray-300 leading-relaxed">{result.aiSecurityAssessment}</p>
          </div>
        )}

        {/* Reasoning */}
        {result.aiReasoning && (
          <div className="border-t border-gray-700/50 pt-2">
            <p className="text-xs text-gray-500 leading-relaxed">{result.aiReasoning}</p>
          </div>
        )}

        {/* Full Diff Toggle */}
        <button
          onClick={() => setShowDiff(!showDiff)}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          {showDiff ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          {showDiff ? 'Hide' : 'View'} full diff
        </button>

        {showDiff && <DiffViewer diff={result.diff} />}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-1">
          {rec === 'SAFE_TO_MERGE' && (
            <button
              onClick={handleMerge}
              disabled={merging}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white text-xs font-medium rounded transition-colors"
            >
              <GitMerge size={13} />
              {merging ? 'Merging...' : 'Merge & Update'}
            </button>
          )}

          {rec === 'HUMAN_REVIEW_NEEDED' && (
            <button
              onClick={handleMerge}
              disabled={merging}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-white text-xs font-medium rounded transition-colors"
            >
              <GitMerge size={13} />
              {merging ? 'Merging...' : 'Merge Anyway'}
            </button>
          )}

          {rec === 'DO_NOT_MERGE' && (
            <button
              disabled
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-900/50 border border-red-800 text-red-400 text-xs font-medium rounded cursor-not-allowed opacity-75"
            >
              <ShieldAlert size={13} />
              Merge Blocked
            </button>
          )}

          <button
            onClick={onCheckNow}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs font-medium rounded transition-colors"
          >
            <SkipForward size={13} />
            Re-scan
          </button>
        </div>
      </div>
    </div>
  )
}
