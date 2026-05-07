import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/src/lib/supabase/server'
import type { Cari } from '@/src/types'
import AppShell from '@/app/components/AppShell'
import HareketForm from './HareketForm'

export default async function YeniHareketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
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
      <main className="mx-auto max-w-3xl px-4 py-6">
        <nav className="mb-6 flex items-center gap-2 text-sm text-gray-500">
          <Link href="/cari" className="hover:text-gray-900">
            Cari Takip
          </Link>
          <span>/</span>
          <Link href={`/cari/${id}`} className="hover:text-gray-900">
            {cari.name}
          </Link>
          <span>/</span>
          <span className="font-medium text-gray-900">Yeni Hareket</span>
        </nav>
        <h1 className="mb-1 text-xl font-bold text-gray-900">Yeni Hareket Ekle</h1>
        <p className="mb-6 text-sm text-gray-500">{cari.name}</p>
        <HareketForm companyId={companyId} userId={user.id} cariId={id} cariAdi={cari.name} />
      </main>
    </AppShell>
  )
}
