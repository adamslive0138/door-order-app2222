import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/src/lib/supabase/server'
import type { Order, CariHareket } from '@/src/types'
import { hareketNetDelta } from '@/src/types'
import AppShell from '@/app/components/AppShell'
import DashboardCard from './DashboardCard'
import DashboardCharts, { type MonthPoint, type CariBarPoint, type PieSlice, type TopCustomer } from './DashboardCharts'
import RecentActivity, { type RecentTahsilat, type RecentOdeme } from './RecentActivity'
import FinancialAlerts, { type OverdueOrder, type HighDebtCari } from './FinancialAlerts'
import OperasyonPanel, {
  type PendingCari, type EksikBelge, type SevkteSiparis, type YaklasanCek,
} from './OperasyonPanel'
import UyariListesi from './UyariListesi'

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(n)

const TR_MONTHS = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara']

function toMonthLabel(key: string): string {
  const [, m] = key.split('-')
  return TR_MONTHS[parseInt(m, 10) - 1] ?? key
}

function buildMonthly(hareketler: CariHareket[]): MonthPoint[] {
  const map = new Map<string, { tahsilat: number; odeme: number }>()
  for (const h of hareketler) {
    const d = new Date(h.created_at)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    if (!map.has(key)) map.set(key, { tahsilat: 0, odeme: 0 })
    const e = map.get(key)!
    // Monthly chart: only real cash flows (tahsilat/odeme); alacak/borc are accounting entries
    if (h.transaction_type === 'tahsilat') e.tahsilat += Number(h.amount)
    else if (h.transaction_type === 'odeme') e.odeme += Number(h.amount)
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([k, v]) => ({ month: toMonthLabel(k), ...v, net: v.tahsilat - v.odeme }))
}

function buildCariBalances(
  cariler: { id: string; name: string }[],
  hareketler: CariHareket[]
): CariBarPoint[] {
  return cariler
    .map(c => {
      const mine = hareketler.filter(h => h.cari_id === c.id)
      const bakiye = mine.reduce(
        (s, h) => s + hareketNetDelta(h), 0
      )
      return { name: c.name, bakiye }
    })
    .filter(c => c.bakiye !== 0)
    .sort((a, b) => Math.abs(b.bakiye) - Math.abs(a.bakiye))
    .slice(0, 8)
}

const HIGH_DEBT_THRESHOLD = 5_000  // ₺5,000 — customise as needed

function buildTopCustomers(
  cariler: { id: string; name: string }[],
  hareketler: CariHareket[]
): TopCustomer[] {
  return cariler
    .map(c => {
      const net = hareketler
        .filter(h => h.cari_id === c.id)
        .reduce((s, h) => s + hareketNetDelta(h), 0)
      return { id: c.id, name: c.name, bakiye: net }
    })
    .filter(c => c.bakiye > 0)
    .sort((a, b) => b.bakiye - a.bakiye)
    .slice(0, 5)
}

function buildHighDebt(
  cariler: { id: string; name: string }[],
  hareketler: CariHareket[]
): HighDebtCari[] {
  return cariler
    .map(c => {
      const net = hareketler
        .filter(h => h.cari_id === c.id)
        .reduce((s, h) => s + hareketNetDelta(h), 0)
      return { id: c.id, name: c.name, bakiye: net }
    })
    .filter(c => c.bakiye < -HIGH_DEBT_THRESHOLD)
    .sort((a, b) => a.bakiye - b.bakiye)   // most negative first
    .slice(0, 5)
}

function buildOverdueOrders(orders: Order[]): OverdueOrder[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return orders
    .filter(o =>
      o.deadline_date &&
      o.status !== 'sevkte' &&
      new Date(o.deadline_date) < today
    )
    .sort((a, b) => new Date(a.deadline_date!).getTime() - new Date(b.deadline_date!).getTime())
    .slice(0, 5)
    .map(o => ({
      id:            o.id,
      customer_name: o.customer_name,
      deadline_date: o.deadline_date!,
      total_price:   o.total_price,
      status:        o.status,
    }))
}

// ── Operasyon panel helpers ───────────────────────────────────────────────────

function isEksik(d: {
  is_processed: boolean
  is_duplicate: boolean
  linked_cari_id: string | null
  extracted_amount: number | null
}): boolean {
  if (d.is_processed || d.is_duplicate) return false
  return !d.linked_cari_id || !d.extracted_amount
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id, role')
    .eq('id', user.id)
    .single()

  const companyId = profile?.company_id
  if (!companyId) redirect('/onboarding')

  const isAdmin = profile?.role === 'admin'

  // ── Parallel data fetch ────────────────────────────────────────────────────
  const [
    { data: ordersData },
    { data: hareketlerData },
    { data: carilerData },
    { data: documentsData },
    { data: checksData },
    { data: pendingApprovalsData },
    { data: profilesData },
  ] = await Promise.all([
    supabase
      .from('orders')
      .select('id, customer_name, status, total_price, deadline_date, shipped_date')
      .eq('company_id', companyId)
      .or('is_archived.eq.false,is_archived.is.null')
      .order('created_at', { ascending: false }),
    supabase
      .from('cari_hareketler')
      .select('id, cari_id, transaction_type, amount, description, created_at')
      .eq('company_id', companyId)
      .order('created_at', { ascending: true }),
    supabase
      .from('cariler')
      .select('id, name')
      .eq('company_id', companyId)
      .order('name'),
    supabase
      .from('documents')
      .select('id, file_type, extracted_name, extracted_amount, linked_cari_id, is_processed, is_duplicate')
      .eq('company_id', companyId)
      .eq('is_processed', false)
      .eq('is_duplicate', false),
    supabase
      .from('checks')
      .select('id, amount, due_date, check_no, check_status, source_cari:cariler!checks_source_cari_id_fkey(name)')
      .eq('company_id', companyId)
      .eq('check_status', 'portfoy')
      .order('due_date', { ascending: true })
      .limit(10),
    isAdmin
      ? supabase
          .from('payment_approvals')
          .select('amount')
          .eq('company_id', companyId)
          .eq('status', 'pending')
      : Promise.resolve({ data: [] }),
    isAdmin
      ? supabase.from('profiles').select('id, full_name').eq('company_id', companyId)
      : Promise.resolve({ data: [] as { id: string; full_name: string | null }[] }),
  ])

  const orders    = (ordersData    ?? []) as Order[]
  const hareketler = (hareketlerData ?? []) as CariHareket[]
  const cariler                  = carilerData   ?? []

  // ── KPI calculations ───────────────────────────────────────────────────────

  // Per-cari net balance
  const cariNets = cariler.map(c => {
    const mine = hareketler.filter(h => h.cari_id === c.id)
    return mine.reduce((s, h) => s + hareketNetDelta(h), 0)
  })
  const toplamAlacak = cariNets.filter(n => n > 0).reduce((s, n) => s + n, 0)
  const toplamBorc   = cariNets.filter(n => n < 0).reduce((s, n) => s + Math.abs(n), 0)

  const pendingApprovals = pendingApprovalsData ?? []
  const pendingCount  = pendingApprovals.length
  const pendingAmount = pendingApprovals.reduce((s, a) => s + Number((a as any).amount), 0)

  // Order status counts
  const counts = {
    beklemede: orders.filter(o => o.status === 'beklemede' || o.status === 'onaylandi').length,
    uretimde:  orders.filter(o => o.status === 'uretimde').length,
    sevkte:    orders.filter(o => o.status === 'sevkte').length,
  }
  const aktifSiparis = counts.beklemede + counts.uretimde

  // ── Chart data ─────────────────────────────────────────────────────────────

  const monthly: MonthPoint[]       = buildMonthly(hareketler)
  const cariBalances: CariBarPoint[] = buildCariBalances(cariler, hareketler)
  const topCustomers: TopCustomer[]  = buildTopCustomers(cariler, hareketler)

  const orderPie: PieSlice[] = [
    { name: 'Beklemede / Onaylı', value: counts.beklemede, color: '#f59e0b' },
    { name: 'Üretimde',           value: counts.uretimde,  color: '#3b82f6' },
    { name: 'Sevkte',             value: counts.sevkte,    color: '#22c55e' },
  ]

  // ── Alert data ─────────────────────────────────────────────────────────────

  const overdueOrders: OverdueOrder[]   = buildOverdueOrders(orders)
  const highDebtCariler: HighDebtCari[] = buildHighDebt(cariler, hareketler)

  // ── Operasyon panel data ────────────────────────────────────────────────────

  const pendingCariler: PendingCari[] = cariler
    .map(c => {
      const net = hareketler.filter(h => h.cari_id === c.id).reduce((s, h) => s + hareketNetDelta(h), 0)
      return { id: c.id, name: c.name, bakiye: net }
    })
    .filter(c => c.bakiye > 0)
    .sort((a, b) => b.bakiye - a.bakiye)
    .slice(0, 8)

  const eksikBelgeler: EksikBelge[] = (documentsData ?? [])
    .filter(isEksik)
    .slice(0, 8)
    .map(d => ({
      id:            d.id,
      extracted_name: d.extracted_name,
      file_type:     d.file_type,
      eksik_neden:   (!d.linked_cari_id && !d.extracted_amount
        ? 'her_ikisi'
        : !d.linked_cari_id
        ? 'cari'
        : 'tutar') as EksikBelge['eksik_neden'],
    }))

  const sevkteSiparisler: SevkteSiparis[] = orders
    .filter(o => o.status === 'sevkte')
    .slice(0, 8)
    .map(o => ({
      id:            o.id,
      customer_name: o.customer_name,
      total_price:   o.total_price,
      shipped_date:  o.shipped_date,
    }))

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const in30 = new Date(today)
  in30.setDate(in30.getDate() + 30)

  const yaklasanCekler: YaklasanCek[] = (checksData ?? [])
    .filter(c => {
      if (!c.due_date) return false
      const d = new Date(c.due_date)
      return d <= in30  // includes overdue
    })
    .map(c => ({
      id:               c.id,
      amount:           Number(c.amount),
      due_date:         c.due_date as string,
      check_no:         c.check_no,
      source_cari_name: (c.source_cari as any)?.name ?? null,
      overdue:          new Date(c.due_date as string) < today,
    }))

  // ── Recent activity ────────────────────────────────────────────────────────

  const cariMap = Object.fromEntries(cariler.map(c => [c.id, c.name]))

  const recentTahsilat: RecentTahsilat[] = hareketler
    .filter(h => h.transaction_type === 'tahsilat')
    .slice(-5)
    .reverse()
    .map(h => ({
      id:          h.id,
      cari_name:   cariMap[h.cari_id] ?? '—',
      amount:      Number(h.amount),
      description: h.description,
      created_at:  h.created_at,
    }))

  const recentOdeme: RecentOdeme[] = hareketler
    .filter(h => h.transaction_type === 'odeme')
    .slice(-5)
    .reverse()
    .map(h => ({
      id:          h.id,
      cari_name:   cariMap[h.cari_id] ?? '—',
      amount:      Number(h.amount),
      description: h.description,
      created_at:  h.created_at,
    }))

  // ── Satışçı Performansı (sadece admin) ────────────────────────────────────

  type SatisciPerf = { owner_id: string; full_name: string | null; siparis_sayisi: number; toplam_ciro: number }
  let satisciPerf: SatisciPerf[] = []

  if (isAdmin) {
    const { data: perfOrders } = await supabase
      .from('orders')
      .select('owner_id, total_price')
      .eq('company_id', companyId)
      .not('owner_id', 'is', null)

    if (perfOrders?.length) {
      const map = new Map<string, { count: number; ciro: number }>()
      for (const o of perfOrders) {
        const e = map.get(o.owner_id!) ?? { count: 0, ciro: 0 }
        e.count++
        e.ciro += Number(o.total_price)
        map.set(o.owner_id!, e)
      }
      const nameMap = Object.fromEntries((profilesData ?? []).map(p => [p.id, p.full_name ?? null]))
      satisciPerf = [...map.entries()]
        .map(([owner_id, s]) => ({ owner_id, full_name: nameMap[owner_id] ?? null, siparis_sayisi: s.count, toplam_ciro: s.ciro }))
        .sort((a, b) => b.toplam_ciro - a.toplam_ciro)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <AppShell userEmail={user.email ?? ''}>
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">

        {/* ── KPI Cards ──────────────────────────────────────────────────── */}
        <div className={`grid grid-cols-2 gap-4 ${isAdmin ? 'lg:grid-cols-5' : 'lg:grid-cols-4'}`}>
          <DashboardCard
            label="Toplam Alacak"
            value={fmt(toplamAlacak)}
            sub={`${cariNets.filter(n => n > 0).length} cari`}
            color="green"
            icon={
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
          <DashboardCard
            label="Toplam Borç"
            value={fmt(toplamBorc)}
            sub={`${cariNets.filter(n => n < 0).length} cari`}
            color="red"
            icon={
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
              </svg>
            }
          />
          <DashboardCard
            label="Aktif Sipariş"
            value={String(aktifSiparis)}
            sub={`${counts.beklemede} bekliyor · ${counts.uretimde} üretimde`}
            color="blue"
            icon={
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            }
          />
          <DashboardCard
            label="Toplam Cari"
            value={String(cariler.length)}
            sub={`${cariNets.filter(n => n > 0).length} alacaklı · ${cariNets.filter(n => n < 0).length} borçlu`}
            color="amber"
            icon={
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            }
          />
          {isAdmin && (
            <div className={`rounded-xl border p-5 shadow-sm ${pendingCount > 0 ? 'border-amber-200 bg-amber-50' : 'border-gray-200 bg-white'}`}>
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Bekleyen Tahsilatlar</p>
                  <p className={`mt-2 text-2xl font-bold ${pendingCount > 0 ? 'text-amber-700' : 'text-gray-700'}`}>
                    {fmt(pendingAmount)}
                  </p>
                  <p className="mt-1 text-xs text-gray-400">
                    {pendingCount > 0 ? `${pendingCount} adet onay bekliyor` : 'Onay bekleyen yok'}
                  </p>
                </div>
                <div className={`rounded-lg p-2.5 ${pendingCount > 0 ? 'bg-amber-100 text-amber-600' : 'bg-gray-100 text-gray-500'}`}>
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div className="mt-4">
                <Link
                  href="/finance/payment-approvals"
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                    pendingCount > 0
                      ? 'bg-amber-600 text-white hover:bg-amber-700'
                      : 'border border-gray-200 text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  Onay ekranına git
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* ── Uyarı Listesi ───────────────────────────────────────────────── */}
        <UyariListesi
          pendingCariler={pendingCariler}
          eksikBelgeler={eksikBelgeler}
          sevkteSiparisler={sevkteSiparisler}
          yaklasanCekler={yaklasanCekler}
        />

        {/* ── Alerts ──────────────────────────────────────────────────────── */}
        <FinancialAlerts overdueOrders={overdueOrders} highDebtCariler={highDebtCariler} />

        {/* ── Operasyon Takibi ─────────────────────────────────────────────── */}
        <OperasyonPanel
          pendingCariler={pendingCariler}
          eksikBelgeler={eksikBelgeler}
          sevkteSiparisler={sevkteSiparisler}
          yaklasanCekler={yaklasanCekler}
        />

        {/* ── Charts ─────────────────────────────────────────────────────── */}
        <DashboardCharts
          monthly={monthly}
          cariBalances={cariBalances}
          orderPie={orderPie}
          topCustomers={topCustomers}
        />

        {/* ── Recent Activity ─────────────────────────────────────────────── */}
        <RecentActivity tahsilat={recentTahsilat} odeme={recentOdeme} />

        {/* ── Satışçı Performansı (admin only) ─────────────────────────────── */}
        {isAdmin && satisciPerf.length > 0 && (
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-5 py-4">
              <h2 className="text-sm font-semibold text-gray-700">Satışçı Performansı</h2>
              <p className="mt-0.5 text-xs text-gray-400">Tüm siparişler — toplam ciro bazında sıralı</p>
            </div>
            <div className="divide-y divide-gray-100">
              {satisciPerf.map((s, i) => {
                const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null
                return (
                  <div key={s.owner_id} className="flex items-center justify-between px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <span className="w-5 text-center text-sm font-bold text-gray-400">
                        {medal ?? `${i + 1}.`}
                      </span>
                      <Link
                        href={`/orders?owner_id=${s.owner_id}`}
                        className="text-sm font-medium text-blue-600 hover:underline"
                      >
                        {s.full_name ?? 'İsimsiz Kullanıcı'}
                      </Link>
                    </div>
                    <div className="flex items-center gap-6 text-right">
                      <div>
                        <p className="text-xs text-gray-400">Sipariş</p>
                        <p className="text-sm font-semibold text-gray-700">{s.siparis_sayisi}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">Ciro</p>
                        <p className="text-sm font-bold text-gray-900">{fmt(s.toplam_ciro)}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </main>
    </AppShell>
  )
}
