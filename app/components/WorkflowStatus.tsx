import Link from 'next/link'

export interface WorkflowStage {
  key:     string
  label:   string
  done:    boolean
  active?: boolean   // highlight as the current live stage
  href?:   string    // if done, make it a link
}

export default function WorkflowStatus({ stages }: { stages: WorkflowStage[] }) {
  return (
    <div className="flex flex-wrap items-center gap-0">
      {stages.map((stage, i) => {
        // "active" = done and the next stage is not done yet (the frontier)
        const isActive =
          stage.active ??
          (stage.done && (!stages[i + 1] || !stages[i + 1].done))

        const pill = (
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap ${
              isActive
                ? 'bg-blue-100 text-blue-700 ring-1 ring-inset ring-blue-200'
                : stage.done
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-400'
            }`}
          >
            {stage.done ? (
              <svg className="h-3 w-3 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd" />
              </svg>
            ) : (
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
            )}
            {stage.label}
          </span>
        )

        return (
          <div key={stage.key} className="flex items-center">
            {i > 0 && (
              <div className={`w-5 h-px mx-0.5 ${stages[i - 1].done ? 'bg-green-300' : 'bg-gray-200'}`} />
            )}
            {stage.href && stage.done ? (
              <Link href={stage.href} className="hover:opacity-80 transition-opacity">
                {pill}
              </Link>
            ) : (
              pill
            )}
          </div>
        )
      })}
    </div>
  )
}
