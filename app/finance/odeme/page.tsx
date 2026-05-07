import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/src/lib/supabase/server'
import AppShell from '@/app/components/AppShell'
import HareketListesi, { type HareketRow } from '../_components/HareketListesi'

export default async function OdemePage() {
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
  const userRole = (profile.role ?? 'admin') as import('@/src/types').UserRole

  // unreachable guard — keeps TypeScript happy after the redirect above
  if (!companyId) {
    return (
      <AppShell userEmail={user.email ?? ''}>
        <main className="mx-auto max-w-6xl px-4 py-6" />
      </AppShell>
    )
  }

  const [{ data: raw }, { data: carilerData }] = await Promise.all([
    supabase
      .from('cari_hareketler')
      .select('id, cari_id, transaction_type, amount, payment_method, transaction_date, description, receipt_url, created_at, cariler(id, name)')
      .eq('company_id', companyId)
      .eq('transaction_type', 'odeme')
      .order('created_at', { ascending: false }),
    supabase
      .from('cariler')
      .select('id, name')
      .eq('company_id', companyId)
      .order('name'),
  ])

  // Sign receipt paths (private bucket — 1 h TTL)
  const paths = (raw ?? []).map((h: any) => h.receipt_url).filter(Boolean) as string[]
  let signedMap: Record<string, string> = {}
  if (paths.length > 0) {
    const { data: signed } = await supabase.storage
      .from('receipts')
      .createSignedUrls(paths, 3600)
    if (signed) {
      for (const s of signed) {
        if (s.signedUrl && s.path) signedMap[s.path] = s.signedUrl
      }
    }
  }

  const hareketler: HareketRow[] = (raw ?? []).map((h: any) => ({
    id:               h.id,
    cari_id:          h.cari_id,
    cari_name:        h.cariler?.name ?? null,
    transaction_type: h.transaction_type,
    amount:           h.amount,
    payment_method:   h.payment_method,
    transaction_date: h.transaction_date,
    description:      h.description,
    receipt_url:      h.receipt_url ? (signedMap[h.receipt_url] ?? null) : null,
    created_at:       h.created_at,
  }))

  return (
    <AppShell userEmail={user.email ?? ''}>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-100">
              <svg className="h-5 w-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Ödemeler</h1>
              <p className="text-sm text-gray-500">Tüm giden ödeme kayıtları</p>
            </div>
          </div>
        </div>
        <HareketListesi
          hareketler={hareketler}
          cariler={carilerData ?? []}
          type="odeme"
          newHref="/finance/new?type=odeme"
          userRole={userRole}
        />
      </main>
    </AppShell>
  )
}
