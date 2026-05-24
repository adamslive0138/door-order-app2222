import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/src/lib/supabase/server'
import AppShell from '@/app/components/AppShell'
import SettingsForm from './SettingsForm'
import DeleteCompanyButton from './DeleteCompanyButton'

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

        {isAdmin && (
          <div className="rounded-xl border border-red-200 bg-red-50/50 p-5 space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-red-800">Tehlikeli Bölge</h3>
              <p className="mt-0.5 text-xs text-red-600">
                Bu işlemler geri alınamaz. Devam etmeden önce tüm verileri yedeklediğinizden emin olun.
              </p>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-red-200 bg-white px-4 py-3">
              <div>
                <p className="text-sm font-medium text-gray-900">Hesabı Tamamen Sil</p>
                <p className="text-xs text-gray-500">Şirket ve tüm veriler kalıcı olarak silinir.</p>
              </div>
              <DeleteCompanyButton />
            </div>
          </div>
        )}
      </main>
    </AppShell>
  )
}
