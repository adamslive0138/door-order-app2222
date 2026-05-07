import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/src/lib/supabase/server'
import AppShell from '@/app/components/AppShell'
import type { Check } from '@/src/types'
import ChecksTable from './ChecksTable'

function fmt(n: number) {
  return new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2 }).format(n)
}

export default async function ChecksPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id')
    .eq('id', user.id)
    .single()

  if (!profile?.company_id) redirect('/login')

  const { data: checks, error } = await supabase
    .from('checks')
    .select(`
      *,
      source_cari:cariler!checks_source_cari_id_fkey(name),
      target_cari:cariler!checks_target_cari_id_fkey(name)
    `)
    .eq('company_id', profile.company_id)
    .order('due_date', { ascending: true })

  const rows = (checks ?? []) as (Check & {
    source_cari: { name: string } | null
    target_cari: { name: string } | null
  })[]

  // Build ownerNames map
  const ownerNames: Record<string, string> = {}
  const ownerIds = [...new Set(rows.map(r => r.owner_id).filter(Boolean))] as string[]
  if (ownerIds.length > 0) {
    const { data: ownerProfiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', ownerIds)
    for (const p of ownerProfiles ?? []) {
      if (p.full_name) ownerNames[p.id] = p.full_name
    }
  }

  // KPIs
  const alinan  = rows.filter(r => r.check_direction === 'alindi')
  const verilen = rows.filter(r => r.check_direction === 'verildi')
  const portfoy = rows.filter(r => r.check_status === 'portfoy')
  const tahsil  = rows.filter(r => r.check_status === 'tahsil_edildi')

  const totalAlinan  = alinan.reduce((s, r)  => s + Number(r.amount), 0)
  const totalVerilen = verilen.reduce((s, r) => s + Number(r.amount), 0)
  const totalPortfoy = portfoy.reduce((s, r) => s + Number(r.amount), 0)
  const totalTahsil  = tahsil.reduce((s, r)  => s + Number(r.amount), 0)

  const allClear = rows.length > 0 && rows.every(r => r.check_status === 'tahsil_edildi')

  return (
    <AppShell userEmail={user.email ?? ''}>
      <div className="px-4 py-6 sm:px-6">

        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Çekler & Senetler</h1>
            <p className="mt-0.5 text-sm text-gray-500">Portföy, devir ve tahsilat takibi</p>
          </div>
          <Link
            href="/checks/new"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
          >
            + Yeni Çek
          </Link>
        </div>

        {/* KPI cards */}
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Toplam Alınan Çek</p>
            <p className="mt-1 text-2xl font-bold text-blue-600">₺{fmt(totalAlinan)}</p>
            <p className="mt-0.5 text-xs text-gray-400">{alinan.length} adet</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Toplam Verilen Çek</p>
            <p className="mt-1 text-2xl font-bold text-amber-600">₺{fmt(totalVerilen)}</p>
            <p className="mt-0.5 text-xs text-gray-400">{verilen.length} adet</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Portföydeki Çekler</p>
            <p className="mt-1 text-2xl font-bold text-gray-800">₺{fmt(totalPortfoy)}</p>
            <p className="mt-0.5 text-xs text-gray-400">{portfoy.length} adet</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Tahsil Edilen Çekler</p>
            <p className="mt-1 text-2xl font-bold text-green-600">₺{fmt(totalTahsil)}</p>
            <p className="mt-0.5 text-xs text-gray-400">{tahsil.length} adet</p>
          </div>
        </div>

        {/* All clear banner */}
        {allClear && (
          <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-5 py-3 text-sm font-semibold text-green-700">
            ✔ Tüm çekler tahsil edildi
          </div>
        )}

        {/* Table */}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          {error && (
            <div className="px-5 py-4 text-sm text-red-600">
              Veriler yüklenemedi: {error.message}
            </div>
          )}
          {!error && rows.length === 0 && (
            <div className="px-5 py-10 text-center text-sm text-gray-400">
              Henüz kayıtlı çek yok.{' '}
              <Link href="/checks/new" className="text-blue-600 hover:underline">İlk çeki ekle →</Link>
            </div>
          )}
          {rows.length > 0 && <ChecksTable rows={rows as any} ownerNames={ownerNames} />}
        </div>

      </div>
    </AppShell>
  )
}
