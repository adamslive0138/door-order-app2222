import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/src/lib/supabase/server'
import type { Cari } from '@/src/types'
import AppShell from '@/app/components/AppShell'
import EditCariForm from './EditCariForm'

export default async function EditCariPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id')
    .eq('id', user.id)
    .single()

  const companyId = profile?.company_id
  if (!companyId) redirect('/dashboard')

  const { data: cariData } = await supabase
    .from('cariler')
    .select('*')
    .eq('id', id)
    .eq('company_id', companyId)
    .single()

  if (!cariData) notFound()

  const cari = cariData as Cari

  return (
    <AppShell userEmail={user.email ?? ''}>
      <main className="mx-auto max-w-3xl px-4 py-6 space-y-5">
        <nav className="flex items-center gap-1.5 text-sm text-gray-400">
          <Link href="/cari" className="transition-colors hover:text-gray-700">Cari Takip</Link>
          <span>/</span>
          <Link href={`/cari/${id}`} className="transition-colors hover:text-gray-700">{cari.name}</Link>
          <span>/</span>
          <span className="font-medium text-gray-700">Düzenle</span>
        </nav>

        <h1 className="text-xl font-bold text-gray-900">Cari Düzenle</h1>

        <EditCariForm cari={cari} companyId={companyId} />
      </main>
    </AppShell>
  )
}
