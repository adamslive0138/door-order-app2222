import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/src/lib/supabase/server'
import AppShell from '@/app/components/AppShell'
import type { Offer } from '@/src/types'
import { DOOR_TYPE_LABELS, OFFER_STATUS_LABELS, OFFER_STATUS_COLORS } from '@/src/types'

const fmt = (n: number) =>
  new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(n)

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' })

export default async function OffersPage() {
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

  const { data } = await supabase
    .from('offers')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })

  const offers: Offer[] = data ?? []

  const counts = {
    taslak:       offers.filter(o => o.status === 'taslak').length,
    gonderildi:   offers.filter(o => o.status === 'gonderildi').length,
    kabul_edildi: offers.filter(o => o.status === 'kabul_edildi').length,
  }

  return (
    <AppShell userEmail={user.email ?? ''}>
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Teklifler</h1>
            <p className="mt-0.5 text-sm text-gray-500">
              {offers.length} teklif · {counts.taslak} hazırlanıyor · {counts.gonderildi} gönderildi · {counts.kabul_edildi} onaylandı
            </p>
          </div>
          <Link
            href="/offers/new"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors shadow-sm"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Yeni Teklif
          </Link>
        </div>

        {/* Table */}
        {offers.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white py-20 text-center">
            <svg className="mb-3 h-10 w-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-sm font-medium text-gray-500">Henüz teklif oluşturulmadı</p>
            <Link href="/offers/new" className="mt-3 text-xs text-blue-600 hover:underline">
              İlk teklifi oluştur →
            </Link>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-5 py-3 text-left">Müşteri</th>
                  <th className="px-5 py-3 text-left">Ürün Tipi</th>
                  <th className="px-4 py-3 text-center">Adet</th>
                  <th className="px-5 py-3 text-right">Toplam</th>
                  <th className="px-5 py-3 text-left">Durum</th>
                  <th className="px-5 py-3 text-left">Tarih</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {offers.map(o => (
                  <tr key={o.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-gray-900">{o.customer_name}</p>
                      {o.customer_city && (
                        <p className="text-xs text-gray-400">{o.customer_city}</p>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-gray-600">
                      {o.door_type ? DOOR_TYPE_LABELS[o.door_type] : '—'}
                    </td>
                    <td className="px-4 py-3.5 text-center text-gray-700">{o.quantity}</td>
                    <td className="px-5 py-3.5 text-right font-medium text-gray-900">
                      {fmt(o.total_price)}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${OFFER_STATUS_COLORS[o.status]}`}>
                        {OFFER_STATUS_LABELS[o.status]}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-gray-400 text-xs">{fmtDate(o.created_at)}</td>
                    <td className="px-4 py-3.5">
                      <Link
                        href={`/offers/${o.id}`}
                        className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                      >
                        Görüntüle
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
