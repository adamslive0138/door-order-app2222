'use client'

interface Props {
  title: string
  children: React.ReactNode
  className?: string
}

export default function ChartCard({ title, children, className = '' }: Props) {
  return (
    <div className={`rounded-xl border border-gray-200 bg-white p-5 shadow-sm ${className}`}>
      <p className="mb-4 text-sm font-semibold text-gray-700">{title}</p>
      {children}
    </div>
  )
}
