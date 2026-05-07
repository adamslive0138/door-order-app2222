import { redirect } from 'next/navigation'
import { createClient } from '@/src/lib/supabase/server'
import AppShell from '@/app/components/AppShell'
import StockPage from './StockPage'

export default async function StockPageServer() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id, role')
    .eq('id', user.id)
    .single()

  if (!profile?.company_id) redirect('/onboarding')

  const { data: models } = await supabase
    .from('stock_models')
    .select('*')
    .eq('company_id', profile.company_id)
    .order('created_at', { ascending: false })

  const canEdit = profile.role === 'admin'

  // Supabase project URL — needed to build public image URLs on the client
  const storageUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''

  return (
    <AppShell userEmail={user.email ?? ''}>
      <StockPage
        companyId={profile.company_id}
        initialModels={models ?? []}
        canEdit={canEdit}
        storageUrl={storageUrl}
      />
    </AppShell>
  )
}
