import Link from 'next/link'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PendingCari {
  id: string
  name: string
  bakiye: number
}

export interface EksikBelge {
  id: string
  extracted_name: string | null
  file_type: string
  eksik_neden: 'cari' | 'tutar' | 'her_ikisi'
}

export interface SevkteSiparis {
  id: string
  customer_name: string
  total_price: number
  shipped_date: string | null
}

export interface YaklasanCek {
  id: string
  amount: number
  due_date: string
  check_no: string | null
  source_cari_name: string | null
  overdue: boolean
}

interface Props {
  pendingCariler: PendingCari[]
  eksikBelgeler: EksikBelge[]
  sevkteSiparisler: SevkteSiparis[]
  yaklasanCekler: YaklasanCek[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(n)

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' })
}

const FILE_TYPE_LABEL: Record<string, string> = {
  fatura:  'Fatura',
  irsaliye: 'İrsaliye',
  sozlesme: 'Sözleşme',
  diger:   'Diğer',
}

// ── Panel wrapper ─────────────────────────────────────────────────────────────

function Panel({
  title,
  count,
  href,
  accent,
  icon,
  children,
  empty,
}: {
  title: string
  count: number
  href: string
  accent: string
  icon: React.ReactNode
  children: React.ReactNode
  empty: string
}) {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${accent}`}>
            {icon}
          </div>
          <span className="text-sm font-semibold text-gray-800">{title}</span>
          {count > 0 && (
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${accent}`}>
              {count}
            </span>
          )}
        </div>
        <Link
          href={href}
          className="text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
        >
          Tümü →
        </Link>
      </div>

      {/* Body */}
      <div className="flex-1 divide-y divide-gray-50">
        {count === 0 ? (
          <p className="px-4 py-8 text-center text-xs text-gray-400">{empty}</p>
        ) : (
          children
        )}
      </div>
    </div>
  )
}

// ── Sub-panels ────────────────────────────────────────────────────────────────

function PendingCariPanel({ cariler }: { cariler: PendingCari[] }) {
  return (
    <Panel
      title="Tahsilat Bekleyen"
      count={cariler.length}
      href="/cari"
      accent="bg-blue-50 text-blue-600"
      empty="Tahsilat bekleyen cari yok."
      icon={
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      }
    >
      {cariler.map(c => (
        <Link
          key={c.id}
          href={`/cari/${c.id}`}
          className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 transition-colors"
        >
          <span className="truncate text-sm font-medium text-gray-700">{c.name}</span>
          <span className="ml-3 shrink-0 text-sm font-bold text-blue-600">{fmt(c.bakiye)}</span>
        </Link>
      ))}
    </Panel>
  )
}

function EksikBelgePanel({ belgeler }: { belgeler: EksikBelge[] }) {
  const nedenLabel = {
    cari:      'cari eksik',
    tutar:     'tutar eksik',
    her_ikisi: 'cari & tutar eksik',
  }
  return (
    <Panel
      title="Eksik Belgeler"
      count={belgeler.length}
      href="/documents"
      accent="bg-red-50 text-red-600"
      empty="Eksik belge yok."
      icon={
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      }
    >
      {belgeler.map(b => (
        <Link
          key={b.id}
          href="/documents"
          className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 transition-colors"
        >
          <span className="truncate text-sm font-medium text-gray-700">
            {b.extracted_name ?? (FILE_TYPE_LABEL[b.file_type] ?? 'Belge')}
          </span>
          <span className="ml-3 shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">
            {nedenLabel[b.eksik_neden]}
          </span>
        </Link>
      ))}
    </Panel>
  )
}

function SevktePanel({ siparisler }: { siparisler: SevkteSiparis[] }) {
  return (
    <Panel
      title="Sevkte Siparişler"
      count={siparisler.length}
      href="/orders"
      accent="bg-purple-50 text-purple-600"
      empty="Sevkte sipariş yok."
      icon={
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9 17v2m3-2v2m3-2v2M3 9h18M3 13h18" />
        </svg>
      }
    >
      {siparisler.map(s => (
        <Link
          key={s.id}
          href={`/orders/${s.id}`}
          className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 transition-colors"
        >
          <span className="truncate text-sm font-medium text-gray-700">{s.customer_name}</span>
          <div className="ml-3 flex shrink-0 items-center gap-2">
            {s.shipped_date && (
              <span className="text-xs text-gray-400">{fmtDate(s.shipped_date)}</span>
            )}
            <span className="text-sm font-bold text-purple-600">{fmt(s.total_price)}</span>
          </div>
        </Link>
      ))}
    </Panel>
  )
}

function YaklasanCekPanel({ cekler }: { cekler: YaklasanCek[] }) {
  return (
    <Panel
      title="Vadesi Yaklaşan Çekler"
      count={cekler.length}
      href="/checks"
      accent="bg-amber-50 text-amber-600"
      empty="Vadesi yaklaşan çek yok."
      icon={
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      }
    >
      {cekler.map(c => (
        <Link
          key={c.id}
          href={`/checks/${c.id}`}
          className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 transition-colors"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-gray-700">
              {c.source_cari_name ?? (c.check_no ? `Çek #${c.check_no}` : 'Çek')}
            </p>
            <p className={`text-xs ${c.overdue ? 'font-semibold text-red-600' : 'text-gray-400'}`}>
              {c.overdue ? '⚠ ' : ''}{fmtDate(c.due_date)}
            </p>
          </div>
          <span className={`ml-3 shrink-0 text-sm font-bold ${c.overdue ? 'text-red-600' : 'text-amber-600'}`}>
            {fmt(c.amount)}
          </span>
        </Link>
      ))}
    </Panel>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function OperasyonPanel({
  pendingCariler,
  eksikBelgeler,
  sevkteSiparisler,
  yaklasanCekler,
}: Props) {
  const total =
    pendingCariler.length +
    eksikBelgeler.length +
    sevkteSiparisler.length +
    yaklasanCekler.length

  if (total === 0) return null

  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-sm font-semibold text-gray-700">Operasyon Takibi</h2>
        <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-600">
          {total} açık
        </span>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <PendingCariPanel cariler={pendingCariler} />
        <EksikBelgePanel belgeler={eksikBelgeler} />
        <SevktePanel siparisler={sevkteSiparisler} />
        <YaklasanCekPanel cekler={yaklasanCekler} />
      </div>
    </section>
  )
}
