import Link from 'next/link'

export interface OverdueOrder {
  id: string
  customer_name: string
  deadline_date: string
  total_price: number
  status: string
}

export interface HighDebtCari {
  id: string
  name: string
  bakiye: number   // negative = they owe us
}

interface Props {
  overdueOrders: OverdueOrder[]
  highDebtCariler: HighDebtCari[]
}

const fmt = (n: number) =>
  new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(n)

function daysSince(dateStr: string): number {
  const ms = Date.now() - new Date(dateStr).getTime()
  return Math.floor(ms / (1000 * 60 * 60 * 24))
}

export default function FinancialAlerts({ overdueOrders, highDebtCariler }: Props) {
  const hasOverdue  = overdueOrders.length > 0
  const hasHighDebt = highDebtCariler.length > 0

  if (!hasOverdue && !hasHighDebt) return null

  return (
    <div className="grid gap-4 lg:grid-cols-2">

      {/* ── Overdue Payments ────────────────────────────────────────────── */}
      {hasOverdue && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-100">
              <svg className="h-3.5 w-3.5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
            <h3 className="text-sm font-semibold text-amber-800">
              Gecikmiş Siparişler
              <span className="ml-1.5 rounded-full bg-amber-200 px-1.5 py-0.5 text-xs font-bold text-amber-700">
                {overdueOrders.length}
              </span>
            </h3>
          </div>

          <ul className="space-y-2">
            {overdueOrders.map(o => {
              const days = daysSince(o.deadline_date)
              return (
                <li key={o.id}>
                  <Link
                    href={`/orders/${o.id}/edit`}
                    className="flex items-center justify-between rounded-lg bg-white px-3 py-2 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-gray-800">{o.customer_name}</p>
                      <p className="text-[11px] text-amber-600 font-medium">{days} gün gecikti</p>
                    </div>
                    <span className="ml-3 shrink-0 text-xs font-semibold text-gray-700">
                      {fmt(o.total_price)}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* ── High Debt Customers ─────────────────────────────────────────── */}
      {hasHighDebt && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-100">
              <svg className="h-3.5 w-3.5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
            </span>
            <h3 className="text-sm font-semibold text-red-800">
              Yüksek Borçlu Cariler
              <span className="ml-1.5 rounded-full bg-red-200 px-1.5 py-0.5 text-xs font-bold text-red-700">
                {highDebtCariler.length}
              </span>
            </h3>
          </div>

          <ul className="space-y-2">
            {highDebtCariler.map(c => (
              <li key={c.id}>
                <Link
                  href={`/cari/${c.id}`}
                  className="flex items-center justify-between rounded-lg bg-white px-3 py-2 shadow-sm hover:shadow-md transition-shadow"
                >
                  <p className="truncate text-xs font-medium text-gray-800">{c.name}</p>
                  <span className="ml-3 shrink-0 text-xs font-semibold text-red-600">
                    {fmt(Math.abs(c.bakiye))} borç
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
