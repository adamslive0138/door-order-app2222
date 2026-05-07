import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/src/lib/supabase/server'
import AppShell from '@/app/components/AppShell'
import OrderForm from '@/app/orders/new/OrderForm'
import WorkflowStatus, { type WorkflowStage } from '@/app/components/WorkflowStatus'
import { ORDER_STATUS_RANK } from '@/src/types'
import TeklifButton from './TeklifButton'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditOrderPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id')
    .eq('id', user.id)
    .single()

  if (!profile?.company_id) redirect('/dashboard')
  const companyId = profile.company_id

  const { data: order } = await supabase
    .from('orders')
    .select('*')
    .eq('id', id)
    .eq('company_id', companyId)
    .single()

  if (!order) notFound()

  // ── Parallel fetches for workflow ─────────────────────────────────────────
  const [carilerRes, sourceOfferRes, hareketRes] = await Promise.all([
    supabase
      .from('cariler')
      .select('id, name, contact_name, phone, city')
      .eq('company_id', companyId)
      .order('name'),

    // Reverse-lookup: offer that was converted into this order
    supabase
      .from('offers')
      .select('id, customer_name, status, total_price')
      .eq('order_id', id)
      .eq('company_id', companyId)
      .maybeSingle(),

    // Cari hareketler (to show movement + receipt status)
    order.cari_id
      ? supabase
          .from('cari_hareketler')
          .select('id, receipt_url')
          .eq('cari_id', order.cari_id)
          .eq('company_id', companyId)
      : Promise.resolve({ data: [] as any[] }),
  ])

  const cariler     = carilerRes.data ?? []
  const sourceOffer = sourceOfferRes.data ?? null
  const hareketler  = (hareketRes.data ?? []) as { id: string; receipt_url: string | null }[]

  const linkedCari  = order.cari_id ? cariler.find(c => c.id === order.cari_id) ?? null : null
  const hasHareket  = hareketler.length > 0
  const hasReceipt  = hareketler.some(h => h.receipt_url)
  const rank        = ORDER_STATUS_RANK[order.status as import('@/src/types').OrderStatus] ?? 0

  // ── Workflow stages ───────────────────────────────────────────────────────
  const stages: WorkflowStage[] = [
    {
      key:   'teklif',
      label: 'Kaynak Teklif',
      done:  !!sourceOffer,
      href:  sourceOffer ? `/offers/${sourceOffer.id}` : undefined,
    },
    { key: 'siparis_alindi', label: 'Sipariş Alındı', done: rank >= 1 },
    { key: 'uretimde',       label: 'Üretimde',       done: rank >= 2 },
    { key: 'gonderildi',     label: 'Gönderildi',     done: rank >= 4 },
    {
      key:   'cari',
      label: 'Cari Bağlı',
      done:  !!order.cari_id,
      href:  order.cari_id ? `/cari/${order.cari_id}` : undefined,
    },
    {
      key:   'hareket',
      label: 'Hareket Var',
      done:  hasHareket,
      href:  order.cari_id ? `/cari/${order.cari_id}` : undefined,
    },
    {
      key:   'tahsilat',
      label: 'Tahsilat Belgelendi',
      done:  hasReceipt,
      href:  order.cari_id ? `/cari/${order.cari_id}` : undefined,
    },
  ]

  return (
    <AppShell userEmail={user.email ?? ''}>
      <main className="mx-auto max-w-3xl px-4 py-6 space-y-5">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">Siparişi Düzenle</h1>
          <div className="flex items-center gap-2">
            <TeklifButton
              orderId={order.id}
              companyId={companyId}
              existingOfferId={sourceOffer?.id ?? null}
              orderData={{
                cari_id:        order.cari_id,
                customer_name:  order.customer_name,
                customer_phone: order.customer_phone,
                customer_city:  order.customer_city,
                door_type:      order.door_type,
                dimensions:     order.dimensions,
                quantity:       order.quantity,
                unit_price:     order.unit_price,
                notes:          order.notes,
              }}
            />
            <a
              href={`/api/production-guide/${order.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-100 transition-colors"
            >
              <svg className="h-4 w-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
              Üretim
            </a>
          </div>
        </div>

        {/* ── Workflow pipeline ────────────────────────────────────────────── */}
        <div className="rounded-xl border border-gray-200 bg-white px-5 py-3.5 shadow-sm">
          <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-gray-400">İş Akışı</p>
          <WorkflowStatus stages={stages} />
        </div>

        {/* ── Source offer banner ──────────────────────────────────────────── */}
        {sourceOffer && (
          <div className="flex items-center justify-between rounded-xl border border-amber-100 bg-amber-50 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100">
                <svg className="h-4 w-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-medium text-amber-500">Kaynak Teklif</p>
                <p className="text-sm font-semibold text-amber-900">{sourceOffer.customer_name}</p>
              </div>
            </div>
            <Link
              href={`/offers/${sourceOffer.id}`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600 transition-colors"
            >
              Teklifi Aç
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
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
                <p className="text-sm font-semibold text-blue-800">
                  {linkedCari.name}
                  {hasHareket && (
                    <span className="ml-2 text-xs font-normal text-blue-500">
                      {hareketler.length} hareket
                      {' · '}
                      {hasReceipt ? 'Dekont bağlı ✓' : 'Dekont bekleniyor'}
                    </span>
                  )}
                </p>
              </div>
            </div>
            <Link
              href={`/cari/${order.cari_id}`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors"
            >
              Cariyi Aç
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </Link>
          </div>
        )}

        {/* ── Order form ───────────────────────────────────────────────────── */}
        <OrderForm
          companyId={companyId}
          userId={user.id}
          orderId={order.id}
          initialData={order}
          cariler={cariler}
          initialCariId={order.cari_id ?? undefined}
        />

      </main>
    </AppShell>
  )
}
