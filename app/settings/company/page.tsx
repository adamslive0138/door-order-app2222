import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/src/lib/supabase/server'
import AppShell from '@/app/components/AppShell'
import CompanySettingsForm from './CompanySettingsForm'

export default async function CompanySettingsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id, role')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.company_id) redirect('/onboarding')
  if (profile.role !== 'admin') redirect('/settings')

  const { data: settings } = await supabase
    .from('company_settings')
    .select('*')
    .eq('company_id', profile.company_id)
    .maybeSingle()

  return (
    <AppShell userEmail={user.email ?? ''}>
      <main className="mx-auto max-w-3xl px-4 py-6">
        <h1 className="mb-3 text-xl font-bold text-gray-900">Ayarlar</h1>

        <nav className="mb-6 flex gap-1">
          <Link
            href="/settings"
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors"
          >
            Genel
          </Link>
          <Link
            href="/settings/company"
            className="rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-900"
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

        <CompanySettingsForm
          companyId={profile.company_id}
          initialSettings={settings ?? null}
        />
      </main>
    </AppShell>
  )
}
