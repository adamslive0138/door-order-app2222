import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/src/lib/supabase/server'
import type { Cari, CariHareket } from '@/src/types'
import { calcBakiye, CARI_TIPI_LABELS } from '@/src/types'
import AppShell from '@/app/components/AppShell'
import OwnerFilterSelect from '@/app/components/OwnerFilterSelect'

const fmt = (n: number) =>
  new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(n)

function KpiCard({ label, value, accent, sub }: { label: string; value: string; accent?: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${accent ?? 'text-gray-800'}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
    </div>
  )
}

export default async function FinanceCariPage({
  searchParams,
}: {
  searchParams: Promise<{ owner_id?: string }>
}) {
  const { owner_id } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('company_id, role')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) notFound()
  if (!profile || !profile.company_id) redirect('/onboarding')
  const companyId = profile.company_id
  const isAdmin = profile.role === 'admin'

  let carilerQuery = supabase
    .from('cariler')
    .select('id, company_id, cari_type, name, contact_name, phone, city, address, tax_office, tax_number, notes, image_url, owner_id, created_at, updated_at')
    .eq('company_id', companyId)
    .order('name')

  if (owner_id) carilerQuery = carilerQuery.eq('owner_id', owner_id)

  const [{ data: carilerRaw }, { data: hareketlerRaw }, staffRes] = await Promise.all([
    carilerQuery,
    supabase
      .from('cari_hareketler')
      .select('id, company_id, cari_id, transaction_type, payment_method, amount, transaction_date, description, receipt_url, created_at')
      .eq('company_id', companyId),
    isAdmin
      ? supabase.from('profiles').select('id, full_name').eq('company_id', companyId).order('full_name')
      : Promise.resolve({ data: null }),
  ])

  const staffList = (staffRes.data ?? []) as { id: string; full_name: string | null }[]

  const cariler: Cari[] = (carilerRaw ?? []) as Cari[]

  // Build ownerNames: for admin use already-fetched staffList; for non-admin fetch targeted
  const ownerNames: Record<string, string> = {}
  if (staffList.length > 0) {
    for (const s of staffList) {
      if (s.full_name) ownerNames[s.id] = s.full_name
    }
  } else {
    const ownerIds = [...new Set(cariler.map(c => c.owner_id).filter(Boolean))] as string[]
    if (ownerIds.length > 0) {
      const { data: ownerProfiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', ownerIds)
      for (const p of ownerProfiles ?? []) {
        if (p.full_name) ownerNames[p.id] = p.full_name
      }
    }
  }
  const hareketler: CariHareket[] = (hareketlerRaw ?? []) as CariHareket[]

  const rows = cariler.map(c => {
    const mine = hareketler.filter(h => h.cari_id === c.id)
    const { alacak, borc, tahsilat, odeme, net } = calcBakiye(mine)
    return { ...c, alacak, borc, tahsilat, odeme, net }
  })

  const toplamAlacak = rows.filter(r => r.net > 0).reduce((s, r) => s + r.net, 0)
  const toplamBorc   = rows.filter(r => r.net < 0).reduce((s, r) => s + Math.abs(r.net), 0)
  const netBakiye    = toplamAlacak - toplamBorc

  return (
    <AppShell userEmail={user.email ?? ''}>
      <main className="mx-auto max-w-6xl px-4 py-6 space-y-5">

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Cari Bakiye</h1>
            <p className="mt-0.5 text-sm text-gray-500">
              {owner_id && staffList.find(s => s.id === owner_id)
                ? `${staffList.find(s => s.id === owner_id)!.full_name ?? 'Satıcı'} — kişiye ait cariler`
                : 'Tüm carilerin bakiye özeti'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && staffList.length > 1 && (
              <OwnerFilterSelect
                staffList={staffList}
                selectedOwnerId={owner_id ?? ''}
                basePath="/finance/cari"
              />
            )}
            <Link
              href="/cari/new"
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Cari Ekle
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <KpiCard label="Toplam Alacak" value={fmt(toplamAlacak)} accent="text-green-600" sub={`${rows.filter(r => r.net > 0).length} cari`} />
          <KpiCard label="Toplam Borç"   value={fmt(toplamBorc)}   accent="text-red-500"   sub={`${rows.filter(r => r.net < 0).length} cari`} />
          <KpiCard label="Net Bakiye"    value={fmt(netBakiye)}    accent={netBakiye >= 0 ? 'text-blue-600' : 'text-amber-500'} />
          <KpiCard label="Toplam Cari"   value={`${cariler.length}`} />
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          {rows.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm text-gray-400">Henüz cari kaydı yok.</p>
              <Link href="/cari/new" className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors">
                İlk Cariyi Ekle
              </Link>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                      <th className="px-4 py-3">Firma Adı</th>
                      <th className="px-4 py-3">Cari Tipi</th>
                      <th className="px-4 py-3">Sorumlu</th>
                      <th className="px-4 py-3 text-right">Alacak</th>
                      <th className="px-4 py-3 text-right">Tahsilat</th>
                      <th className="px-4 py-3 text-right">Net Bakiye</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rows.map(r => (
                      <tr key={r.id} className="transition-colors hover:bg-gray-50/80">
                        <td className="px-4 py-3.5">
                          <Link href={`/cari/${r.id}`} className="font-semibold text-gray-800 hover:text-blue-600 transition-colors">
                            {r.name}
                          </Link>
                          {r.contact_name && <p className="text-xs text-gray-400">{r.contact_name}</p>}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            r.cari_type === 'musteri'   ? 'bg-blue-50 text-blue-700' :
                            r.cari_type === 'tedarikci' ? 'bg-amber-50 text-amber-700' :
                            'bg-purple-50 text-purple-700'
                          }`}>
                            {CARI_TIPI_LABELS[r.cari_type]}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-xs text-gray-500">
                          {r.owner_id ? (ownerNames[r.owner_id] ?? '—') : '—'}
                        </td>
                        <td className="px-4 py-3.5 text-right font-semibold text-blue-600">
                          {r.alacak > 0 ? fmt(r.alacak) : '—'}
                        </td>
                        <td className="px-4 py-3.5 text-right font-semibold text-green-600">
                          {r.tahsilat > 0 ? fmt(r.tahsilat) : '—'}
                        </td>
                        <td className={`px-4 py-3.5 text-right font-bold ${
                          r.net > 0 ? 'text-green-600' : r.net < 0 ? 'text-red-500' : 'text-gray-400'
                        }`}>
                          {r.net === 0 ? '—' : fmt(r.net)}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1.5">
                            <Link href={`/cari/${r.id}`} className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                              Detay
                            </Link>
                            <Link href={`/finance/new?type=tahsilat`} className="rounded-lg border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 hover:bg-green-100 transition-colors">
                              + Tahsilat
                            </Link>
                            <Link href={`/finance/new?type=odeme`} className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-100 transition-colors">
                              + Ödeme
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="border-t border-gray-100 bg-gray-50/80 px-4 py-3 flex items-center justify-between">
                <span className="text-xs text-gray-400">{rows.length} cari</span>
                <span className="text-xs text-gray-500">Net: <span className={`font-bold ${netBakiye >= 0 ? 'text-green-600' : 'text-red-500'}`}>{fmt(netBakiye)}</span></span>
              </div>
            </>
          )}
        </div>
      </main>
    </AppShell>
  )
}
