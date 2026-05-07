import { redirect } from 'next/navigation'
import { createClient } from '@/src/lib/supabase/server'
import AppShell from '@/app/components/AppShell'
import DashboardCard from '@/app/dashboard/DashboardCard'
import SalesCharts from './SalesCharts'
import { DOOR_TYPE_LABELS } from '@/src/types'

const fmt = (n: number) =>
  new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(n)

const monthLabel = (m: string) =>
  new Date(m + '-01').toLocaleDateString('tr-TR', { month: 'short', year: '2-digit' })

const DOOR_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6']

export default async function ReportsSalesPage() {
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

  const { data: orders } = await supabase
    .from('orders')
    .select('id, customer_name, door_type, total_price, status, created_at, quantity')
    .eq('company_id', companyId)
    .order('created_at')

  const allOrders = orders ?? []

  // ── KPIs ───────────────────────────────────────────────────────────────────
  const totalOrders  = allOrders.length
  const totalCiro    = allOrders.reduce((s, o) => s + Number(o.total_price), 0)
  const avgCiro      = totalOrders > 0 ? totalCiro / totalOrders : 0
  const activeOrders = allOrders.filter(o => o.status === 'siparis_alindi' || o.status === 'uretimde').length

  // ── Monthly grouping ───────────────────────────────────────────────────────
  const monthMap = new Map<string, { count: number; ciro: number }>()
  for (const o of allOrders) {
    const m    = o.created_at.slice(0, 7)
    const prev = monthMap.get(m) ?? { count: 0, ciro: 0 }
    monthMap.set(m, { count: prev.count + 1, ciro: prev.ciro + Number(o.total_price) })
  }
  const monthly = [...monthMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([m, v]) => ({ month: monthLabel(m), ...v }))

  // ── Door type pie ──────────────────────────────────────────────────────────
  const doorMap = new Map<string, number>()
  for (const o of allOrders) {
    const k = o.door_type ?? 'diger'
    doorMap.set(k, (doorMap.get(k) ?? 0) + 1)
  }
  const doorPie = [...doorMap.entries()].map(([k, v], i) => ({
    name:  (DOOR_TYPE_LABELS as Record<string, string>)[k] ?? k,
    value: v,
    color: DOOR_COLORS[i % DOOR_COLORS.length],
  }))

  // ── Top customers ──────────────────────────────────────────────────────────
  const custMap = new Map<string, number>()
  for (const o of allOrders) {
    custMap.set(o.customer_name, (custMap.get(o.customer_name) ?? 0) + Number(o.total_price))
  }
  const topCustomers = [...custMap.entries()]
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([name, total]) => ({ name, total }))

  return (
    <AppShell userEmail={user.email ?? ''}>
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">

        <div>
          <h1 className="text-xl font-semibold text-gray-900">Satış Raporu</h1>
          <p className="mt-0.5 text-sm text-gray-500">Tüm zamanların sipariş ve ciro analizi.</p>
        </div>

        {/* KPI cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <DashboardCard
            label="Toplam Sipariş" value={String(totalOrders)} color="blue"
            icon={<svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>}
          />
          <DashboardCard
            label="Toplam Ciro" value={fmt(totalCiro)} color="green"
            icon={<svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>}
          />
          <DashboardCard
            label="Ort. Sipariş Tutarı" value={fmt(avgCiro)} color="amber"
            icon={<svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>}
          />
          <DashboardCard
            label="Aktif Sipariş" value={String(activeOrders)} color="gray"
            icon={<svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>}
          />
        </div>

        <SalesCharts monthly={monthly} doorPie={doorPie} topCustomers={topCustomers} />

      </main>
    </AppShell>
  )
}
