import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/src/lib/supabase/server'
import type { Cari, CariHareket } from '@/src/types'
import { CARI_TIPI_LABELS, CARI_STATUS_LABELS, CARI_STATUS_COLORS, calcBakiye } from '@/src/types'
import AppShell from '@/app/components/AppShell'
import CariStatusChanger from './CariStatusChanger'
import HareketListesi, { type PendingApproval } from './HareketListesi'
import Ekstrem from './Ekstrem'
import OwnerChanger from '@/app/components/OwnerChanger'

function fmt(n: number) {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(n)
}

function InfoField({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-0.5 text-sm text-gray-800">{value}</p>
    </div>
  )
}

export default async function CariDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('company_id, role')
    .eq('id', user.id)
    .maybeSingle()

  // profile satırı yoksa (gerçek onboarding eksikliği) → onboarding
  // query'nin kendisi başarısız olduysa (RLS, ağ vb.) → notFound ile sessizce hata göster
  if (profileError) {
    console.error('[cari/[id]] profileError:', profileError)
    notFound()
  }
  if (!profile || !profile.company_id) redirect('/onboarding')

  const companyId = profile.company_id
  const userRole = (profile.role ?? 'admin') as import('@/src/types').UserRole
  console.log('[cari/[id]] id:', id, 'companyId:', companyId)

  const [cariRes, { data: hareketData }, { data: pendingData }] = await Promise.all([
    supabase.from('cariler').select('*').eq('id', id).eq('company_id', companyId).maybeSingle(),
    supabase
      .from('cari_hareketler')
      .select('*')
      .eq('cari_id', id)
      .eq('company_id', companyId)
      .order('transaction_date', { ascending: false }),
    supabase
      .from('payment_approvals')
      .select('id, amount, description, payment_method, created_at')
      .eq('cari_id', id)
      .eq('company_id', companyId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false }),
  ])

  console.log('[cari/[id]] cariRes.error:', cariRes.error, 'cariRes.data null?', cariRes.data === null)
  if (!cariRes.data) notFound()
  const cari = cariRes.data as Cari

  // Fetch owner name + staff list for admin
  const isAdmin = (profile.role ?? '') === 'admin'
  let ownerName: string | null = null
  let staffList: { id: string; full_name: string | null }[] = []

  if (isAdmin) {
    const [ownerRes, staffRes] = await Promise.all([
      cari.owner_id
        ? supabase.from('profiles').select('full_name').eq('id', cari.owner_id).single()
        : Promise.resolve({ data: null }),
      supabase
        .from('profiles')
        .select('id, full_name')
        .eq('company_id', companyId)
        .order('full_name'),
    ])
    ownerName = ownerRes.data?.full_name ?? null
    staffList = staffRes.data ?? []
  } else if (cari.owner_id) {
    const { data: ownerProfile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', cari.owner_id)
      .single()
    ownerName = ownerProfile?.full_name ?? null
  }

  const hareketler: CariHareket[] = hareketData ?? []
  const pendingApprovals: PendingApproval[] = (pendingData ?? []) as PendingApproval[]
  const { alacak, tahsilat, net } = calcBakiye(hareketler)

  const tipiBadgeClass =
    cari.cari_type === 'musteri'
      ? 'bg-blue-50 text-blue-700'
      : cari.cari_type === 'tedarikci'
      ? 'bg-amber-50 text-amber-700'
      : 'bg-purple-50 text-purple-700'


  return (
    <AppShell userEmail={user.email ?? ''}>
      <main className="mx-auto max-w-5xl space-y-5 px-4 py-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm text-gray-400">
          <Link href="/cari" className="transition-colors hover:text-gray-700">
            Cari Takip
          </Link>
          <span>/</span>
          <span className="font-medium text-gray-700">{cari.name}</span>
        </nav>

        {/* ── Firma Kartı ─────────────────────────────────────── */}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          {/* Header bar */}
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-bold text-gray-900">{cari.name}</h1>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tipiBadgeClass}`}>
                  {CARI_TIPI_LABELS[cari.cari_type]}
                </span>
                {(() => {
                  const s = cari.cari_status ?? 'aktif'
                  return (
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${CARI_STATUS_COLORS[s]}`}>
                      {CARI_STATUS_LABELS[s]}
                    </span>
                  )
                })()}
              </div>
              {cari.contact_name && (
                <p className="mt-0.5 text-sm text-gray-500">{cari.contact_name}</p>
              )}
            </div>

            {/* Shortcut actions */}
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/cari/${cari.id}/edit`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
              >
                <svg className="h-3.5 w-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Düzenle
              </Link>
              <Link
                href={`/orders/new?cari_id=${cari.id}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
              >
                <svg className="h-3.5 w-3.5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                Yeni Sipariş
              </Link>
              <Link
                href={`/offers/new?cari_id=${cari.id}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
              >
                <svg className="h-3.5 w-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Teklif Oluştur
              </Link>
              <Link
                href={`/finance/new?type=tahsilat&cari_id=${cari.id}`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-green-700 transition-colors"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Tahsilat Al
              </Link>
              <Link
                href={`/finance/new?type=odeme&cari_id=${cari.id}`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-red-700 transition-colors"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                </svg>
                Ödeme Yap
              </Link>
              <Link
                href={`/cari/${cari.id}/yeni-hareket`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-blue-700 transition-colors"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Hareket Ekle
              </Link>
            </div>

            {cari.image_url && (
              <a
                href={cari.image_url}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-4 flex-shrink-0"
              >
                <img
                  src={cari.image_url}
                  alt="Firma belgesi"
                  className="h-16 w-24 rounded-lg border border-gray-200 object-contain bg-gray-50 hover:opacity-75 transition-opacity"
                />
              </a>
            )}
          </div>

          {/* Info grid */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-4 px-5 py-4 sm:grid-cols-4">
            <InfoField label="Telefon" value={cari.phone} />
            <InfoField label="Şehir" value={cari.city} />
            <InfoField label="Vergi Dairesi" value={cari.tax_office} />
            <InfoField label="Vergi No" value={cari.tax_number} />
            {cari.email && <InfoField label="E-Posta" value={cari.email} />}
            {cari.address && <InfoField label="Adres" value={cari.address} />}
            {(ownerName || isAdmin) && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Sorumlu Satıcı</p>
                <div className="mt-0.5">
                  {isAdmin ? (
                    <OwnerChanger
                      table="cariler"
                      recordId={cari.id}
                      currentOwnerId={cari.owner_id}
                      staffList={staffList}
                    />
                  ) : (
                    <p className="text-sm text-gray-800">{ownerName ?? '—'}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>


        {/* ── Bakiye Özeti ────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Toplam Alacak</p>
            <p className="mt-2 text-2xl font-bold text-blue-600">{fmt(alacak)}</p>
            <p className="mt-0.5 text-xs text-gray-400">Satıştan doğan alacak</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Tahsil Edildi</p>
            <p className="mt-2 text-2xl font-bold text-green-600">{fmt(tahsilat)}</p>
            <p className="mt-0.5 text-xs text-gray-400">Gerçek nakit tahsilat</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              {net >= 0 ? 'Net Bakiye (Alacak)' : 'Net Bakiye (Borç)'}
            </p>
            <p className={`mt-2 text-2xl font-bold ${net >= 0 ? 'text-blue-600' : 'text-amber-500'}`}>
              {fmt(Math.abs(net))}
            </p>
          </div>
        </div>

        {/* ── Ekstre / Mutabakat ──────────────────────────────── */}
        <Ekstrem hareketler={hareketler} firmName={cari.name} />

        {/* ── Cari Durumu ─────────────────────────────────────── */}
        <CariStatusChanger cariId={cari.id} currentStatus={cari.cari_status ?? null} userRole={userRole} />

        {/* ── Hareketler / Dekontlar ──────────────────────────── */}
        <HareketListesi hareketler={hareketler} cariId={id} userRole={userRole} pendingApprovals={pendingApprovals} />
      </main>
    </AppShell>
  )
}
