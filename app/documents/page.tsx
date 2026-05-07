import { redirect } from 'next/navigation'
import { createClient } from '@/src/lib/supabase/server'
import AppShell from '@/app/components/AppShell'
import DocumentList from './DocumentList'

export default async function DocumentsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id, role')
    .eq('id', user.id)
    .single()

  const companyId = profile?.company_id
  if (!companyId) redirect('/settings')
  const userRole = (profile?.role ?? 'admin') as import('@/src/types').UserRole

  const [{ data: documents }, { data: carilerData }] = await Promise.all([
    supabase
      .from('documents')
      .select(`
        id, file_url, file_type, extracted_name, extracted_amount,
        extracted_date, extracted_tax_number, extracted_type,
        linked_cari_id, is_processed, is_duplicate, created_at,
        cariler ( name )
      `)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false }),
    supabase
      .from('cariler')
      .select('id, name, tax_number')
      .eq('company_id', companyId)
      .order('name'),
  ])

  // Sign document paths (private bucket — 1 h TTL)
  const filePaths = (documents ?? []).map((d: any) => d.file_url).filter(Boolean) as string[]
  let signedDocMap: Record<string, string> = {}
  if (filePaths.length > 0) {
    const { data: signed } = await supabase.storage
      .from('documents')
      .createSignedUrls(filePaths, 3600)
    if (signed) {
      for (const s of signed) {
        if (s.signedUrl && s.path) signedDocMap[s.path] = s.signedUrl
      }
    }
  }

  const docs = (documents ?? []).map((d: any) => ({
    ...d,
    cariler: Array.isArray(d.cariler) ? (d.cariler[0] ?? null) : d.cariler,
    display_url: d.file_url ? (signedDocMap[d.file_url] ?? null) : null,
  }))

  return (
    <AppShell userEmail={user.email ?? ''}>
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        <DocumentList
          documents={docs}
          cariler={carilerData ?? []}
          companyId={companyId}
          userRole={userRole}
        />
      </main>
    </AppShell>
  )
}
