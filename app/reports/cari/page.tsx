import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/src/lib/supabase/server'
import { hareketNetDelta } from '@/src/types'
import AppShell from '@/app/components/AppShell'
import DashboardCard from '@/app/dashboard/DashboardCard'
import CariCharts from './CariCharts'

const fmt = (n: number) =>
  new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(n)

const monthLabel = (m: string) =>
  new Date(m + '-01').toLocaleDateString('tr-TR', { month: 'short', year: '2-digit' })

export default async function ReportsCariPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id')
    .eq('id', user.id)
    .single()

  const companyId = profile?.company_id
  if (!companyId) redirect('/settings')

  const [{ data: hareketler }, { data: carilerData }] = await Promise.all([
    supabase
      .from('cari_hareketler')
      .select('cari_id, transaction_type, amount, transaction_date')
      .eq('company_id', companyId),
    supabase
      .from('cariler')
      .select('id, name')
      .eq('company_id', companyId)
      .order('name'),
  ])

  const allH = hareketler ?? []
  const allC = carilerData ?? []
  const cariNameMap = new Map(allC.map(c => [c.id, c.name]))

  // ── Per-cari bakiye ─────────────────────────────────────────────────────────
  const cariMap = new Map<string, number>()
  for (const h of allH) {
    const prev  = cariMap.get(h.cari_id) ?? 0
    cariMap.set(h.cari_id, prev + hareketNetDelta(h))
  }

  // ── KPIs ───────────────────────────────────────────────────────────────────
  const allBalances  = [...cariMap.values()]
  const totalAlacak  = allBalances.filter(v => v > 0).reduce((s, v) => s + v, 0)
  const totalBorc    = allBalances.filter(v => v < 0).reduce((s, v) => s + Math.abs(v), 0)
  const netBakiye    = totalAlacak - totalBorc

  // ── Monthly movements ──────────────────────────────────────────────────────
  const monthMap = new Map<string, { tahsilat: number; odeme: number }>()
  for (const h of allH) {
    const m = (h.transaction_date ?? '').slice(0, 7)
    if (!m) continue
    const prev = monthMap.get(m) ?? { tahsilat: 0, odeme: 0 }
    // Monthly chart: only real cash flows (tahsilat/odeme); alacak/borc are accounting entries
    if (h.transaction_type === 'tahsilat') {
      monthMap.set(m, { ...prev, tahsilat: prev.tahsilat + Number(h.amount) })
    } else if (h.transaction_type === 'odeme') {
      monthMap.set(m, { ...prev, odeme: prev.odeme + Number(h.amount) })
    }
  }
  const monthly = [...monthMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([m, v]) => ({ month: monthLabel(m), ...v, net: v.tahsilat - v.odeme }))

  // ── Chart data: top 10 by absolute bakiye ──────────────────────────────────
  const cariBalances = [...cariMap.entries()]
    .map(([id, bakiye]) => ({ id, name: cariNameMap.get(id) ?? '—', bakiye }))
    .sort((a, b) => Math.abs(b.bakiye) - Math.abs(a.bakiye))
    .slice(0, 10)

  // ── Table: all cariler sorted by abs bakiye ────────────────────────────────
  const cariTable = allC.map(c => ({
    id:        c.id,
    name: c.name,
    bakiye:    cariMap.get(c.id) ?? 0,
  })).sort((a, b) => Math.abs(b.bakiye) - Math.abs(a.bakiye))

  return (
    <AppShell userEmail={user.email ?? ''}>
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">

        <div>
          <h1 className="text-xl font-semibold text-gray-900">Cari Raporu</h1>
          <p className="mt-0.5 text-sm text-gray-500">Cari bazlı bakiye ve hareket analizi.</p>
        </div>

        {/* KPI cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <DashboardCard
            label="Toplam Alacak" value={fmt(totalAlacak)} color="green"
            icon={<svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
            </svg>}
          />
          <DashboardCard
            label="Toplam Borç" value={fmt(totalBorc)} color="red"
            icon={<svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 13l-5 5m0 0l-5-5m5 5V6" />
            </svg>}
          />
          <DashboardCard
            label="Net Bakiye" value={fmt(netBakiye)} color={netBakiye >= 0 ? 'green' : 'red'}
            icon={<svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
            </svg>}
          />
          <DashboardCard
            label="Toplam Cari" value={String(allC.length)} color="blue"
            icon={<svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>}
          />
        </div>

        <CariCharts monthly={monthly} cariBalances={cariBalances} />

        {/* Cari balance table */}
        {cariTable.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-700">Cari Bakiye Listesi</p>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-5 py-3 text-left">Cari</th>
                  <th className="px-5 py-3 text-right">Bakiye</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {cariTable.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 font-medium text-gray-900">{c.name}</td>
                    <td className={`px-5 py-3 text-right font-semibold ${
                      c.bakiye > 0 ? 'text-green-700' : c.bakiye < 0 ? 'text-red-600' : 'text-gray-400'
                    }`}>
                      {c.bakiye === 0 ? '—' : (
                        <>
                          {fmt(Math.abs(c.bakiye))}
                          <span className="ml-1.5 text-xs font-normal opacity-70">
                            {c.bakiye > 0 ? 'Alacak' : 'Borç'}
                          </span>
                        </>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/cari/${c.id}`}
                        className="rounded-lg border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                      >
                        Detay
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </main>
    </AppShell>
  )
}
