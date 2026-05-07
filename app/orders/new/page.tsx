import { redirect } from 'next/navigation'
import { createClient } from '@/src/lib/supabase/server'
import AppShell from '@/app/components/AppShell'
import OrderForm from './OrderForm'

export default async function NewOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ cari_id?: string }>
}) {
  const { cari_id } = await searchParams
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id, role')
    .eq('id', user.id)
    .single()

  if (!profile?.company_id) redirect('/dashboard')

  const isAdmin = profile.role === 'admin'

  const [carilerRes, staffRes] = await Promise.all([
    supabase
      .from('cariler')
      .select('id, name, contact_name, phone, city')
      .eq('company_id', profile.company_id)
      .order('name'),
    isAdmin
      ? supabase
          .from('profiles')
          .select('id, full_name')
          .eq('company_id', profile.company_id)
          .order('full_name')
      : Promise.resolve({ data: [] as { id: string; full_name: string | null }[] }),
  ])

  const cariler   = carilerRes.data ?? []
  const staffList = (staffRes.data ?? []) as { id: string; full_name: string | null }[]

  return (
    <AppShell userEmail={user.email ?? ''}>
      <main className="mx-auto max-w-3xl px-4 py-6">
        <h1 className="mb-6 text-xl font-bold text-gray-900">Yeni Sipariş</h1>
        <OrderForm
          companyId={profile.company_id}
          userId={user.id}
          cariler={cariler}
          initialCariId={cari_id}
          userRole={profile.role ?? 'satis'}
          staffList={staffList}
        />
      </main>
    </AppShell>
  )
}
