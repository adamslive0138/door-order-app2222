import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/src/lib/supabase/server'
import AppShell from '@/app/components/AppShell'
import type { Check } from '@/src/types'
import { CHECK_STATUS_LABELS, CHECK_STATUS_COLORS, CHECK_DIRECTION_LABELS } from '@/src/types'
import StatusChanger from './StatusChanger'
import CheckActions from './CheckActions'
import CheckImageThumb from '../CheckImageThumb'

interface Props {
  params: Promise<{ id: string }>
}

function fmt(n: number) {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 2 }).format(n)
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value && value !== 0) return null
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-gray-800">{value}</p>
    </div>
  )
}

export default async function CheckDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id, role')
    .eq('id', user.id)
    .single()

  if (!profile?.company_id) redirect('/login')
  const companyId = profile.company_id
  const userRole = (profile?.role ?? 'admin') as import('@/src/types').UserRole

  const [checkRes, carilerRes] = await Promise.all([
    supabase
      .from('checks')
      .select(`
        *,
        source_cari:cariler!checks_source_cari_id_fkey(id, name),
        target_cari:cariler!checks_target_cari_id_fkey(id, name)
      `)
      .eq('id', id)
      .eq('company_id', companyId)
      .single(),
    supabase
      .from('cariler')
      .select('id, name')
      .eq('company_id', companyId)
      .order('name'),
  ])

  if (!checkRes.data) notFound()

  const check = checkRes.data as Check & {
    source_cari: { id: string; name: string } | null
    target_cari: { id: string; name: string } | null
  }
  const cariler = (carilerRes.data ?? []) as { id: string; name: string }[]

  // Fetch owner name if set
  let ownerName: string | null = null
  if (check.owner_id) {
    const { data: ownerProfile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', check.owner_id)
      .single()
    ownerName = ownerProfile?.full_name ?? null
  }

  return (
    <AppShell userEmail={user.email ?? ''}>
      <main className="mx-auto max-w-2xl px-4 py-6 space-y-5">

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/checks" className="text-sm text-gray-400 hover:text-gray-600">← Çekler</Link>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              check.check_direction === 'alindi' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'
            }`}>
              {CHECK_DIRECTION_LABELS[check.check_direction]}
            </span>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${CHECK_STATUS_COLORS[check.check_status]}`}>
              {CHECK_STATUS_LABELS[check.check_status]}
            </span>
          </div>
          <CheckActions check={check} cariler={cariler} userRole={userRole} />
        </div>

        {/* Amount */}
        <div className="rounded-xl border border-gray-200 bg-white px-6 py-5 shadow-sm text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Tutar</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">{fmt(Number(check.amount))}</p>
          <p className="mt-1 text-sm text-gray-500">Vade: {fmtDate(check.due_date)}</p>
        </div>

        {/* Status changer */}
        {check.check_status === 'portfoy' && (
          <StatusChanger checkId={check.id} userRole={userRole} />
        )}

        {/* Cari info */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Cari Bilgisi</h2>
          {check.source_cari && (
            <div>
              <p className="text-xs text-gray-400">Kaynak Cari</p>
              <Link
                href={`/cari/${check.source_cari.id}`}
                className="mt-0.5 text-sm font-medium text-blue-600 hover:underline"
              >
                {check.source_cari.name}
              </Link>
            </div>
          )}
          {check.target_cari && (
            <div>
              <p className="text-xs text-gray-400">Hedef Cari</p>
              <Link
                href={`/cari/${check.target_cari.id}`}
                className="mt-0.5 text-sm font-medium text-blue-600 hover:underline"
              >
                {check.target_cari.name}
              </Link>
            </div>
          )}
          {!check.source_cari && !check.target_cari && (
            <p className="text-sm text-gray-400">Cari bağlanmamış.</p>
          )}
        </div>

        {/* Details */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Çek Detayları</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Field label="Sorumlu Satıcı" value={ownerName ?? '—'} />
            <Field label="Çek No"         value={check.check_no} />
            <Field label="Banka"          value={check.bank_name} />
            <Field label="Şube"           value={check.branch_name} />
            <Field label="Hesap No"       value={check.account_no} />
            <Field label="Kesim Tarihi"   value={fmtDate(check.issue_date)} />
            <Field label="Vade Tarihi"    value={fmtDate(check.due_date)} />
          </div>
          {check.description && (
            <div className="mt-4">
              <p className="text-xs text-gray-400">Açıklama</p>
              <p className="mt-0.5 text-sm text-gray-700 whitespace-pre-line">{check.description}</p>
            </div>
          )}
        </div>

        {/* Çek Fotoğrafları */}
        {((check as any).front_image_path || (check as any).back_image_path) && (
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Çek Fotoğrafları</h2>
            <div className="flex gap-4">
              {(check as any).front_image_path && (
                <div className="flex flex-col items-center gap-1.5">
                  <CheckImageThumb
                    path={(check as any).front_image_path}
                    className="h-24 w-24 object-cover rounded-lg border cursor-pointer hover:opacity-90 transition-opacity"
                  />
                  <p className="text-xs text-gray-400">Ön Yüz</p>
                </div>
              )}
              {(check as any).back_image_path && (
                <div className="flex flex-col items-center gap-1.5">
                  <CheckImageThumb
                    path={(check as any).back_image_path}
                    className="h-24 w-24 object-cover rounded-lg border cursor-pointer hover:opacity-90 transition-opacity"
                  />
                  <p className="text-xs text-gray-400">Arka Yüz</p>
                </div>
              )}
            </div>
          </div>
        )}

      </main>
    </AppShell>
  )
}
