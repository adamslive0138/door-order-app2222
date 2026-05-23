import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/src/lib/supabase/server'
import AppShell from '@/app/components/AppShell'
import type { Offer } from '@/src/types'
import { DOOR_TYPE_LABELS, OFFER_STATUS_LABELS, OFFER_STATUS_COLORS } from '@/src/types'
import OfferActions from './OfferActions'
import WorkflowStatus, { type WorkflowStage } from '@/app/components/WorkflowStatus'

const fmt = (n: number) =>
  new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(n)

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })

const ORDER_STATUS_LABELS: Record<string, string> = {
  siparis_alindi: 'Sipariş Alındı',
  uretimde:       'Üretimde',
  gonderildi:     'Gönderildi',
}

export default async function OfferDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
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
    .eq('id', id)
    .eq('company_id', companyId)
    .single()

  if (!data) notFound()

  const offer: Offer = data as Offer

  // ── Fetch linked data for workflow (in parallel) ───────────────────────────
  const [linkedOrderRes, linkedCariRes, hareketRes] = await Promise.all([
    offer.order_id
      ? supabase
          .from('orders')
          .select('id, status, customer_name, total_price, created_at')
          .eq('id', offer.order_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),

    offer.cari_id
      ? supabase
          .from('cariler')
          .select('id, name')
          .eq('id', offer.cari_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),

    offer.cari_id
      ? supabase
          .from('cari_hareketler')
          .select('id, receipt_url')
          .eq('cari_id', offer.cari_id)
          .eq('company_id', companyId)
      : Promise.resolve({ data: [] as { id: string; receipt_url: string | null }[] }),
  ])

  const linkedOrder    = linkedOrderRes.data
  const linkedCari     = linkedCariRes.data
  const hareketSummary = (hareketRes.data ?? []) as { id: string; receipt_url: string | null }[]
  const hasHareket     = hareketSummary.length > 0
  const hasReceipt     = hareketSummary.some(h => h.receipt_url)

  // ── Workflow stages ─────────────────────────────────────────────────────────
  const isApproved  = offer.status === 'kabul_edildi'
  const isConverted = !!offer.order_id

  const stages: WorkflowStage[] = [
    { key: 'teklif',   label: 'Teklif',          done: true,        href: `/offers/${offer.id}` },
    { key: 'onaylandi', label: 'Onaylandı',       done: isApproved                               },
    { key: 'siparis',  label: 'Sipariş',          done: isConverted, href: offer.order_id ? `/orders/${offer.order_id}/edit` : undefined },
    { key: 'cari',     label: 'Cari Bağlı',       done: !!offer.cari_id, href: offer.cari_id ? `/cari/${offer.cari_id}` : undefined },
    { key: 'hareket',  label: 'Hareket Var',       done: hasHareket,  href: offer.cari_id ? `/cari/${offer.cari_id}` : undefined },
    { key: 'tahsilat', label: 'Tahsilat Belgelendi', done: hasReceipt, href: offer.cari_id ? `/cari/${offer.cari_id}` : undefined },
  ]

  return (
    <AppShell userEmail={user.email ?? ''}>
      <main className="mx-auto max-w-4xl px-4 py-6 space-y-5">

        {/* ── Workflow pipeline ────────────────────────────────────────────── */}
        <div className="rounded-xl border border-gray-200 bg-white px-5 py-3.5 shadow-sm">
          <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-gray-400">İş Akışı</p>
          <WorkflowStatus stages={stages} />
        </div>

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-gray-900">{offer.customer_name}</h1>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${OFFER_STATUS_COLORS[offer.status]}`}>
                {OFFER_STATUS_LABELS[offer.status]}
              </span>
            </div>
            <p className="mt-0.5 text-sm text-gray-500">
              Oluşturuldu: {fmtDate(offer.created_at)}
            </p>
          </div>

          <OfferActions
            offerId={offer.id}
            currentStatus={offer.status}
            customer_phone={offer.customer_phone}
            orderId={offer.order_id}
          />
        </div>

        {/* ── Linked order banner ──────────────────────────────────────────── */}
        {linkedOrder && (
          <div className="flex items-center justify-between rounded-xl border border-green-100 bg-green-50 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-100">
                <svg className="h-4 w-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-medium text-green-500">Bu tekliften oluşturulan sipariş</p>
                <p className="text-sm font-semibold text-green-900">
                  {linkedOrder.customer_name} · {fmt(linkedOrder.total_price)}
                  <span className="ml-2 text-xs font-normal text-green-600">
                    {ORDER_STATUS_LABELS[linkedOrder.status] ?? linkedOrder.status}
                  </span>
                </p>
              </div>
            </div>
            <Link
              href={`/orders/${linkedOrder.id}/edit`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 transition-colors"
            >
              Siparişi Aç
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </Link>
          </div>
        )}

        {/* ── Linked cari banner ───────────────────────────────────────────── */}
        {linkedCari && (
          <div className="flex items-center justify-between rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100">
                <svg className="h-4 w-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-medium text-blue-500">Bağlı Cari</p>
                <p className="text-sm font-semibold text-blue-900">
                  {linkedCari.name}
                  {hasHareket && (
                    <span className="ml-2 text-xs font-normal text-blue-600">
                      {hareketSummary.length} hareket · {hasReceipt ? 'Dekont bağlı' : 'Dekont bekleniyor'}
                    </span>
                  )}
                </p>
              </div>
            </div>
            <Link
              href={`/cari/${linkedCari.id}`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors"
            >
              Cariyi Aç
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </Link>
          </div>
        )}

        {/* ── Customer + product ───────────────────────────────────────────── */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Müşteri</h2>
            <p className="text-base font-semibold text-gray-900">{offer.customer_name}</p>
            {offer.customer_city  && <p className="mt-0.5 text-sm text-gray-500">{offer.customer_city}</p>}
            {offer.customer_phone && <p className="mt-1 text-sm font-medium text-gray-700">{offer.customer_phone}</p>}
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Ürün</h2>
            <p className="text-base font-semibold text-gray-900">
              {offer.door_type ? DOOR_TYPE_LABELS[offer.door_type] : '—'}
            </p>
            {offer.dimensions && <p className="mt-0.5 text-sm text-gray-500">{offer.dimensions}</p>}
            <div className="mt-3 flex gap-6">
              <div>
                <p className="text-xs text-gray-400">Adet</p>
                <p className="text-sm font-semibold text-gray-800">{offer.quantity}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Birim Fiyat</p>
                <p className="text-sm font-semibold text-gray-800">{fmt(offer.unit_price)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Toplam</p>
                <p className="text-sm font-bold text-gray-900">{fmt(offer.total_price)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Product image ────────────────────────────────────────────────── */}
        {offer.image_url && (
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Ürün Görseli</h2>
            <img src={offer.image_url} alt="Ürün görseli"
              className="max-h-64 rounded-lg object-contain" />
          </div>
        )}

        {/* ── Offer text ───────────────────────────────────────────────────── */}
        {offer.offer_text && (
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Teklif Metni</h2>
            <p className="text-sm text-gray-700 whitespace-pre-line">{offer.offer_text}</p>
          </div>
        )}

        {/* ── Notes ───────────────────────────────────────────────────────── */}
        {offer.notes && (
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Notlar</h2>
            <p className="text-sm text-gray-700 whitespace-pre-line">{offer.notes}</p>
          </div>
        )}

      </main>
    </AppShell>
  )
}
