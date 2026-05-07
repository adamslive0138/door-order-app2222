import { redirect } from 'next/navigation'
import { createClient } from '@/src/lib/supabase/server'
import AppShell from '@/app/components/AppShell'
import CheckForm from './CheckForm'

export default async function NewCheckPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id')
    .eq('id', user.id)
    .single()

  if (!profile?.company_id) redirect('/login')

  const { data: cariler } = await supabase
    .from('cariler')
    .select('id, name')
    .eq('company_id', profile.company_id)
    .order('name')

  return (
    <AppShell userEmail={user.email ?? ''}>
      <div className="mx-auto max-w-2xl px-4 py-6">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">Yeni Çek / Senet</h1>
          <p className="mt-1 text-sm text-gray-500">Portföye alınan veya verilen çek/seneti kaydedin.</p>
        </div>
        <CheckForm companyId={profile.company_id} userId={user.id} cariler={cariler ?? []} />
      </div>
    </AppShell>
  )
}
