import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/src/lib/supabase/server'
import AppShell from '@/app/components/AppShell'
import HareketForm from './HareketForm'

export default async function NewHareketPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; cari_id?: string }>
}) {
  const { type: rawType, cari_id: rawCariId } = await searchParams
  const defaultType: 'tahsilat' | 'odeme' =
    rawType === 'odeme' ? 'odeme' : 'tahsilat'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('company_id')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) notFound()
  if (!profile || !profile.company_id) redirect('/onboarding')

  const companyId = profile.company_id

  // Fetch dropdown list and preselected cari in parallel
  const [{ data: carilerData }, preselectedResult] = await Promise.all([
    supabase
      .from('cariler')
      .select('id, name')
      .eq('company_id', companyId)
      .order('name'),
    rawCariId
      ? supabase
          .from('cariler')
          .select('id, name')
          .eq('id', rawCariId)
          .eq('company_id', companyId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  // Server-validated: null means rawCariId was provided but invalid/wrong-company
  const preselectedCari = rawCariId
    ? (preselectedResult.data ?? null)
    : null

  const isIn = defaultType === 'tahsilat'

  return (
    <AppShell userEmail={user.email ?? ''}>
      <main className="mx-auto max-w-2xl px-4 py-6 pb-20 sm:pb-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${isIn ? 'bg-green-100' : 'bg-red-100'}`}>
              <svg className={`h-5 w-5 ${isIn ? 'text-green-600' : 'text-red-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isIn
                  ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                }
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                {isIn ? 'Yeni Tahsilat' : 'Yeni Ödeme'}
              </h1>
              <p className="text-sm text-gray-500">
                {isIn ? 'Gelen ödeme kaydı ekle' : 'Giden ödeme kaydı ekle'}
              </p>
            </div>
          </div>
          <Link
            href={`/finance/${defaultType}`}
            className="text-sm text-gray-400 hover:text-gray-700 transition-colors"
          >
            ← Geri
          </Link>
        </div>

        <HareketForm
          companyId={companyId}
          userId={user.id}
          cariler={carilerData ?? []}
          defaultType={defaultType}
          preselectedCari={preselectedCari}
          invalidCariId={rawCariId && !preselectedCari ? true : false}
        />
      </main>
    </AppShell>
  )
}
