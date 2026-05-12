import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/src/lib/supabase/server'
import AppShell from '@/app/components/AppShell'
import type { Order } from '@/src/types'
import {
  DOOR_TYPE_LABELS,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
  ORDER_STATUS_RANK,
  ORDER_STATUS_STEPS,
} from '@/src/types'
import WorkflowStatus, { type WorkflowStage } from '@/app/components/WorkflowStatus'
import OrderStatusChanger from './OrderStatusChanger'
import TeklifButton from './edit/TeklifButton'
import OwnerChanger from '@/app/components/OwnerChanger'

interface Props {
  params: Promise<{ id: string }>
}


function fmt(n: number) {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(n)
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value && value !== 0) return null
  return (
    <div>
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="mt-0.5 text-[14px] font-semibold text-gray-900">{value}</p>
    </div>
  )
}

export default async function OrderDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('company_id, role')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError || !profile?.company_id) redirect('/onboarding')
  const companyId = profile.company_id
  const userRole = (profile.role ?? 'admin') as import('@/src/types').UserRole

  const { data: orderData, error: orderError } = await supabase
    .from('orders')
    .select('*')
    .eq('id', id)
    .eq('company_id', companyId)
    .maybeSingle()

  if (orderError || !orderData) notFound()
  const order = orderData as Order

  // ── Parallel fetches ───────────────────────────────────────────────────────
  const [carilerRes, sourceOfferRes, hareketRes, ownerRes] = await Promise.all([
    supabase
      .from('cariler')
      .select('id, name')
      .eq('company_id', companyId)
      .eq('id', order.cari_id ?? '')
      .maybeSingle(),

    supabase
      .from('offers')
      .select('id, customer_name, status, total_price')
      .eq('order_id', id)
      .eq('company_id', companyId)
      .maybeSingle(),

    order.cari_id
      ? supabase
          .from('cari_hareketler')
          .select('id, receipt_url')
          .eq('cari_id', order.cari_id)
          .eq('company_id', companyId)
      : Promise.resolve({ data: [] as { id: string; receipt_url: string | null }[] }),

    order.owner_id
      ? supabase.from('profiles').select('full_name').eq('id', order.owner_id).single()
      : Promise.resolve({ data: null }),
  ])

  const linkedCari  = carilerRes.data ?? null
  const sourceOffer = sourceOfferRes.data ?? null
  const hareketler  = (hareketRes.data ?? []) as { id: string; receipt_url: string | null }[]
  const ownerName   = ownerRes.data?.full_name ?? null

  // Staff list for admin owner-changer
  const isAdmin = profile.role === 'admin'
  let staffList: { id: string; full_name: string | null }[] = []
  if (isAdmin) {
    const { data: staffData } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('company_id', companyId)
      .order('full_name')
    staffList = staffData ?? []
  }
  const hasHareket  = hareketler.length > 0
  const hasReceipt  = hareketler.some(h => h.receipt_url)
  const rank        = ORDER_STATUS_RANK[order.status] ?? 0

  const mdfDisplay = order.mdf_thickness === 'Diğer'
    ? (order.mdf_thickness_other ?? null)
    : (order.mdf_thickness ?? null)

  // ── Workflow stages ────────────────────────────────────────────────────────
  const stages: WorkflowStage[] = [
    { key: 'teklif',          label: 'Kaynak Teklif',        done: !!sourceOffer,      href: sourceOffer ? `/offers/${sourceOffer.id}` : undefined },
    { key: 'siparis_alindi',  label: 'Sipariş Alındı',       done: rank >= 1 },
    { key: 'uretimde',        label: 'Üretimde',             done: rank >= 2 },
    { key: 'gonderildi',      label: 'Gönderildi',           done: rank >= 4 },
    { key: 'cari',            label: 'Cari Bağlı',           done: !!order.cari_id,    href: order.cari_id ? `/cari/${order.cari_id}` : undefined },
    { key: 'hareket',         label: 'Hareket Var',          done: hasHareket,         href: order.cari_id ? `/cari/${order.cari_id}` : undefined },
    { key: 'tahsilat',        label: 'Tahsilat Belgelendi',  done: hasReceipt,         href: order.cari_id ? `/cari/${order.cari_id}` : undefined },
  ]

  return (
    <AppShell userEmail={user.email ?? ''}>
      <main className="mx-auto max-w-3xl px-4 py-6 space-y-5">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-gray-900">{order.customer_name}</h1>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${ORDER_STATUS_COLORS[order.status] ?? 'bg-gray-100 text-gray-600'}`}>
              {ORDER_STATUS_LABELS[order.status] ?? order.status}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={`/api/offer/${order.id}`}
              download
              className="inline-flex items-center gap-2 rounded-lg bg-gray-700 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-900 transition-colors shadow-sm"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Teklif PDF
            </a>
            <a
              href={`/api/production-guide/${order.id}`}
              download
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
              Üretim Rehberi
            </a>
            <TeklifButton
              orderId={order.id}
              companyId={companyId}
              existingOfferId={sourceOffer?.id ?? null}
              orderData={{
                cari_id:             order.cari_id,
                customer_name:       order.customer_name,
                customer_phone:      order.customer_phone ?? '',
                customer_city:       order.customer_city ?? '',
                door_type:           order.door_type,
                dimensions:          order.dimensions,
                quantity:            order.quantity,
                unit_price:          order.unit_price,
                notes:               order.notes,
                image_url:           order.image_url,
                lock_brand:          order.lock_brand,
                lock_system:         order.lock_system,
                frame_color:         order.frame_color,
                mdf_thickness:       order.mdf_thickness,
                mdf_thickness_other: order.mdf_thickness_other,
                steel_thickness:     order.steel_thickness,
              }}
            />
            <Link
              href={`/orders/${order.id}/edit`}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors shadow-sm"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Düzenle
            </Link>
          </div>
        </div>

        {/* ── Operasyonel durum ────────────────────────────────────────────── */}
        {order.status === 'iptal' ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-3 text-sm font-semibold text-red-700">
            Bu sipariş iptal edildi.
          </div>
        ) : (
          <div className="rounded-xl border border-gray-200 bg-white px-5 py-3.5 shadow-sm">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Operasyon Durumu</p>
            <div className="flex items-center gap-0">
              {ORDER_STATUS_STEPS.map((step, i) => {
                const stepRank = ORDER_STATUS_RANK[step]
                const done    = rank >= stepRank && rank >= 0
                const current = ORDER_STATUS_RANK[order.status] === stepRank
                const isLast  = i === ORDER_STATUS_STEPS.length - 1
                return (
                  <div key={step} className="flex flex-1 items-center">
                    <div className="flex flex-col items-center">
                      <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ring-2 ${
                        current
                          ? 'bg-blue-600 text-white ring-blue-300'
                          : done
                          ? 'bg-green-500 text-white ring-green-200'
                          : 'bg-white text-gray-300 ring-gray-200'
                      }`}>
                        {done && !current ? (
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          i + 1
                        )}
                      </div>
                      <span className={`mt-1 whitespace-nowrap text-xs ${current ? 'font-semibold text-blue-700' : done ? 'text-green-600' : 'text-gray-400'}`}>
                        {ORDER_STATUS_LABELS[step]}
                      </span>
                    </div>
                    {!isLast && (
                      <div className={`mb-3.5 h-0.5 flex-1 ${done && ORDER_STATUS_RANK[ORDER_STATUS_STEPS[i + 1]] <= rank ? 'bg-green-400' : 'bg-gray-200'}`} />
                    )}
                  </div>
                )
              })}
            </div>
            <OrderStatusChanger orderId={order.id} currentStatus={order.status} userRole={userRole} />
          </div>
        )}

        {/* ── Workflow pipeline ────────────────────────────────────────────── */}
        <div className="rounded-xl border border-gray-200 bg-white px-5 py-3.5 shadow-sm">
          <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-gray-500">İş Akışı</p>
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
                <p className="text-sm font-semibold text-blue-800">
                  {linkedCari.name}
                  {hasHareket && (
                    <span className="ml-2 text-xs font-normal text-blue-500">
                      {hareketler.length} hareket · {hasReceipt ? 'Dekont bağlı ✓' : 'Dekont bekleniyor'}
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
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </Link>
          </div>
        )}

        {/* ── Müşteri + Ürün ───────────────────────────────────────────────── */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Müşteri</h2>
            <Field label="Ad" value={order.customer_name} />
            <Field label="Telefon" value={order.customer_phone || null} />
            <Field label="Şehir" value={order.customer_city || null} />
            {(ownerName || isAdmin) && (
              <div>
                <p className="text-xs font-medium text-gray-500">Sorumlu Satıcı</p>
                <div className="mt-0.5">
                  {isAdmin ? (
                    <OwnerChanger
                      table="orders"
                      recordId={order.id}
                      currentOwnerId={order.owner_id}
                      staffList={staffList}
                    />
                  ) : (
                    <p className="text-[14px] font-semibold text-gray-900">{ownerName ?? '—'}</p>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Ürün</h2>
            <Field label="Kapı Tipi" value={DOOR_TYPE_LABELS[order.door_type] ?? order.door_type} />
            <Field label="Ölçüler" value={order.dimensions || null} />
          </div>
        </div>

        {/* ── Fiyat + Tarihler ─────────────────────────────────────────────── */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Fiyat</h2>
            <div className="flex gap-8">
              <Field label="Adet" value={order.quantity} />
              <Field label="Birim Fiyat" value={fmt(order.unit_price)} />
              <div>
                <p className="text-xs text-gray-400">Toplam</p>
                <p className="mt-0.5 text-base font-bold text-gray-900">{fmt(order.total_price)}</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Tarihler</h2>
            <div className="flex gap-8">
              <Field label="Sipariş Tarihi" value={fmtDate(order.created_at)} />
              <Field label="Termin" value={fmtDate(order.deadline_date)} />
            </div>
          </div>
        </div>

        {/* ── Kapı Özellikleri ─────────────────────────────────────────────── */}
        {(order.lock_brand || order.lock_system || order.frame_color || mdfDisplay || order.steel_thickness) && (
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Kapı Özellikleri</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Field label="Kilit Markası"   value={order.lock_brand} />
              <Field label="Kilit Sistemi"   value={order.lock_system} />
              <Field label="Kasa Rengi"      value={order.frame_color} />
              <Field label="MDF Kalınlığı"   value={mdfDisplay} />
              <Field label="Sac Kalınlığı"   value={order.steel_thickness} />
            </div>
          </div>
        )}

        {/* ── Ürün Görseli ─────────────────────────────────────────────────── */}
        {order.image_url && (
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Ürün Görseli</h2>
            <a href={order.image_url} target="_blank" rel="noopener noreferrer">
              <img
                src={order.image_url}
                alt="Sipariş görseli"
                className="max-h-64 rounded-lg object-contain border border-gray-200 hover:opacity-90 transition-opacity"
              />
            </a>
          </div>
        )}

        {/* ── Operasyon Takibi ─────────────────────────────────────────────── */}
        {(order.production_start_date || order.ready_date || order.shipped_date || order.delivered_date || order.operation_note) && (
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Operasyon Takibi</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Field label="Üretime Başlama" value={fmtDate(order.production_start_date)} />
              <Field label="Hazır Tarihi"    value={fmtDate(order.ready_date)} />
              <Field label="Sevk Tarihi"     value={fmtDate(order.shipped_date)} />
              <Field label="Teslim Tarihi"   value={fmtDate(order.delivered_date)} />
            </div>
            {order.operation_note && (
              <div className="mt-3">
                <p className="text-xs font-medium text-gray-500">Operasyon Notu</p>
                <p className="mt-0.5 text-[14px] text-gray-900 whitespace-pre-line">{order.operation_note}</p>
              </div>
            )}
          </div>
        )}

        {/* ── Notlar ───────────────────────────────────────────────────────── */}
        {order.notes && (
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Notlar</h2>
            <p className="text-[14px] text-gray-900 whitespace-pre-line">{order.notes}</p>
          </div>
        )}

      </main>
    </AppShell>
  )
}
