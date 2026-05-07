'use client'

interface Props {
  label: string
  value: string
  sub?: string
  color: 'green' | 'red' | 'blue' | 'amber' | 'gray'
  icon: React.ReactNode
}

const COLOR = {
  green: { bg: 'bg-green-50', icon: 'bg-green-100 text-green-600', value: 'text-green-700' },
  red:   { bg: 'bg-red-50',   icon: 'bg-red-100 text-red-500',     value: 'text-red-600'   },
  blue:  { bg: 'bg-blue-50',  icon: 'bg-blue-100 text-blue-600',   value: 'text-blue-700'  },
  amber: { bg: 'bg-amber-50', icon: 'bg-amber-100 text-amber-600', value: 'text-amber-700' },
  gray:  { bg: 'bg-gray-50',  icon: 'bg-gray-100 text-gray-500',   value: 'text-gray-700'  },
}

export default function DashboardCard({ label, value, sub, color, icon }: Props) {
  const c = COLOR[color]
  return (
    <div className={`rounded-xl border border-gray-200 bg-white p-5 shadow-sm`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</p>
          <p className={`mt-2 text-2xl font-bold ${c.value}`}>{value}</p>
          {sub && <p className="mt-1 text-xs text-gray-400">{sub}</p>}
        </div>
        <div className={`rounded-lg p-2.5 ${c.icon}`}>{icon}</div>
      </div>
    </div>
  )
}
