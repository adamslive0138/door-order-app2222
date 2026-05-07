import { redirect } from 'next/navigation'
import { createClient } from '@/src/lib/supabase/server'
import type { Cari } from '@/src/types'
import AppShell from '@/app/components/AppShell'
import DekontForm from './DekontForm'

export default async function DekontYuklePage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id')
    .eq('id', user.id)
    .single()

  if (!profile?.company_id) redirect('/dashboard')

  const { data: carilerData } = await supabase
    .from('cariler')
    .select('id, name, cari_type')
    .eq('company_id', profile.company_id)
    .order('name')

  const cariler: Pick<Cari, 'id' | 'name' | 'cari_type'>[] = carilerData ?? []

  return (
    <AppShell userEmail={user.email ?? ''}>
      <main className="mx-auto max-w-2xl px-4 py-6">
        <h1 className="mb-6 text-xl font-bold text-gray-900">Dekont Yükle</h1>
        <DekontForm companyId={profile.company_id} cariler={cariler} />
      </main>
    </AppShell>
  )
}
