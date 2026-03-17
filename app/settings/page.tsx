import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/src/lib/supabase/server'
import SettingsForm from './SettingsForm'

export default async function SettingsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id, full_name')
    .eq('id', user.id)
    .single()

  if (!profile?.company_id) redirect('/dashboard')

  const { data: company } = await supabase
    .from('companies')
    .select('name, phone, email')
    .eq('id', profile.company_id)
    .single()

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Link href="/dashboard" className="font-medium text-gray-900 hover:underline">
              Kapı Sipariş Takip
            </Link>
            <span>/</span>
            <span>Ayarlar</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        <h1 className="mb-6 text-xl font-bold text-gray-900">Şirket Ayarları</h1>
        <SettingsForm
          companyId={profile.company_id}
          initialCompany={{
            name: company?.name ?? null,
            phone: company?.phone ?? null,
            email: company?.email ?? null,
          }}
          initialProfile={{ full_name: profile.full_name ?? null }}
          userEmail={user.email ?? ''}
        />
      </main>
    </div>
  )
}
