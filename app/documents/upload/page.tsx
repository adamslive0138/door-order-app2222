import { redirect } from 'next/navigation'
import { createClient } from '@/src/lib/supabase/server'
import AppShell from '@/app/components/AppShell'
import DocumentUpload from './DocumentUpload'

export default async function DocumentUploadPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id')
    .eq('id', user.id)
    .single()

  const companyId = profile?.company_id
  if (!companyId) redirect('/settings')

  const { data: cariler } = await supabase
    .from('cariler')
    .select('id, name, tax_number')
    .eq('company_id', companyId)
    .order('name')

  return (
    <AppShell userEmail={user.email ?? ''}>
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6">
        <DocumentUpload
          companyId={companyId}
          cariler={cariler ?? []}
        />
      </main>
    </AppShell>
  )
}
