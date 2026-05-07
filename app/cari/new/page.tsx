import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/src/lib/supabase/server'
import AppShell from '@/app/components/AppShell'
import CariForm from './CariForm'

export default async function YeniCariPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id, role')
    .eq('id', user.id)
    .single()

  if (!profile?.company_id) redirect('/onboarding')

  const isAdmin = profile.role === 'admin'

  const staffRes = isAdmin
    ? await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('company_id', profile.company_id)
        .order('full_name')
    : { data: [] as { id: string; full_name: string | null }[] }

  const staffList = (staffRes.data ?? []) as { id: string; full_name: string | null }[]

  return (
    <AppShell userEmail={user.email ?? ''}>
      <main className="mx-auto max-w-3xl px-4 py-6">
        <nav className="mb-6 flex items-center gap-2 text-sm text-gray-500">
          <Link href="/cari" className="hover:text-gray-900">
            Cari Takip
          </Link>
          <span>/</span>
          <span className="font-medium text-gray-900">Yeni Cari</span>
        </nav>
        <h1 className="mb-6 text-xl font-bold text-gray-900">Yeni Cari Ekle</h1>
        <CariForm
          companyId={profile.company_id}
          userId={user.id}
          userRole={profile.role ?? 'satis'}
          staffList={staffList}
        />
      </main>
    </AppShell>
  )
}
