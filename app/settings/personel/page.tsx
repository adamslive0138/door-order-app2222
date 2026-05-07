import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/src/lib/supabase/server'
import AppShell from '@/app/components/AppShell'
import PersonelForm from './PersonelForm'
import ShifreDegistir from './ShifreDegistir'

const ROLE_LABEL: Record<string, string> = {
  admin: 'Admin',
  satis: 'Satışçı',
}

const ROLE_COLOR: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-700',
  satis: 'bg-blue-100 text-blue-700',
}

export default async function PersonelPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id, role')
    .eq('id', user.id)
    .single()

  if (!profile?.company_id) redirect('/onboarding')
  if (profile.role !== 'admin') redirect('/settings')

  const companyId = profile.company_id

  const [companyRes, personelRes] = await Promise.all([
    supabase
      .from('companies')
      .select('name, code')
      .eq('id', companyId)
      .single(),
    supabase
      .from('profiles')
      .select('id, full_name, username, role, created_at')
      .eq('company_id', companyId)
      .order('created_at', { ascending: true }),
  ])

  const company  = companyRes.data
  const personel = personelRes.data ?? []

  return (
    <AppShell userEmail={user.email ?? ''}>
      <main className="mx-auto max-w-3xl px-4 py-6 space-y-6">

        {/* Header + sub-nav */}
        <div>
          <h1 className="text-xl font-bold text-gray-900">Ayarlar</h1>
          <nav className="mt-3 flex gap-1">
            <Link
              href="/settings"
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors"
            >
              Şirket Bilgileri
            </Link>
            <Link
              href="/settings/personel"
              className="rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-900"
            >
              Personel Yönetimi
            </Link>
          </nav>
        </div>

        {/* Company info banner */}
        <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-5 py-3.5 shadow-sm">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Şirket</p>
            <p className="text-sm font-semibold text-gray-900">{company?.name ?? '—'}</p>
          </div>
          <div className="ml-8">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Şirket Kodu</p>
            <p className="font-mono text-sm font-semibold text-gray-900">
              {company?.code ?? <span className="text-amber-600">Belirtilmemiş</span>}
            </p>
          </div>
          <div className="ml-8">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Personel Sayısı</p>
            <p className="text-sm font-semibold text-gray-900">{personel.length}</p>
          </div>
        </div>

        {/* Personnel table */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700">Mevcut Personel</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100">
                  <th className="px-5 py-3 text-left">Ad Soyad</th>
                  <th className="px-5 py-3 text-left">Kullanıcı Adı</th>
                  <th className="px-5 py-3 text-left">Rol</th>
                  <th className="px-5 py-3 text-left">Oluşturulma</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {personel.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 font-medium text-gray-900">
                      {p.full_name ?? <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-5 py-3 font-mono text-gray-700">
                      {p.username ?? <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          ROLE_COLOR[p.role ?? ''] ?? 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {ROLE_LABEL[p.role ?? ''] ?? p.role ?? '—'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-500">
                      {p.created_at
                        ? new Date(p.created_at).toLocaleDateString('tr-TR')
                        : '—'}
                    </td>
                    <td className="px-5 py-3">
                      <ShifreDegistir userId={p.id} fullName={p.full_name ?? null} />
                    </td>
                  </tr>
                ))}
                {personel.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-5 py-6 text-center text-sm text-gray-400">
                      Henüz personel bulunmuyor.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Add form */}
        <PersonelForm companyCode={company?.code ?? ''} />

      </main>
    </AppShell>
  )
}
