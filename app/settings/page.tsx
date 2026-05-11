import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/src/lib/supabase/server'
import AppShell from '@/app/components/AppShell'
import SettingsForm from './SettingsForm'

export default async function SettingsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('company_id, full_name, role')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) notFound()
  if (!profile || !profile.company_id) redirect('/onboarding')

  const isAdmin = profile.role === 'admin'

  const { data: company } = await supabase
    .from('companies')
    .select('name, phone, email, code, logo_url')
    .eq('id', profile.company_id)
    .maybeSingle()

  return (
    <AppShell userEmail={user.email ?? ''}>
      <main className="mx-auto max-w-3xl px-4 py-6">
        <h1 className="mb-3 text-xl font-bold text-gray-900">Ayarlar</h1>

        {isAdmin && (
          <nav className="mb-6 flex gap-1">
            <Link
              href="/settings"
              className="rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-900"
            >
              Genel
            </Link>
            <Link
              href="/settings/company"
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors"
            >
              Şirket & PDF
            </Link>
            <Link
              href="/settings/personel"
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors"
            >
              Personel
            </Link>
          </nav>
        )}

        <SettingsForm
          userId={user.id}
          companyId={profile.company_id}
          initialCompany={{
            name: company?.name ?? null,
            phone: company?.phone ?? null,
            email: company?.email ?? null,
            code: company?.code ?? null,
            logo_url: company?.logo_url ?? null,
          }}
          initialProfile={{ full_name: profile.full_name ?? null }}
          userEmail={user.email ?? ''}
        />
      </main>
    </AppShell>
  )
}
