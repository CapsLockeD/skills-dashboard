'use client'

interface DiffViewerProps {
  diff: string
}

export default function DiffViewer({ diff }: DiffViewerProps) {
  if (!diff) return <p className="text-gray-500 text-xs">No diff available.</p>

  const lines = diff.split('\n')

  return (
    <pre className="text-xs overflow-auto max-h-72 bg-gray-950 p-3 rounded border border-gray-800 font-mono leading-5">
      {lines.map((line, i) => {
        let cls = 'text-gray-400'
        if (line.startsWith('+++') || line.startsWith('---')) cls = 'text-gray-500'
        else if (line.startsWith('+')) cls = 'text-green-400'
        else if (line.startsWith('-')) cls = 'text-red-400'
        else if (line.startsWith('@@')) cls = 'text-blue-400'
        else if (line.startsWith('diff ') || line.startsWith('index ')) cls = 'text-gray-500'

        return (
          <div key={i} className={cls}>
            {line || ' '}
          </div>
        )
      })}
    </pre>
  )
}
