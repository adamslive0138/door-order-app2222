import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/src/lib/supabase/server'
import type { Cari, CariHareket } from '@/src/types'
import { calcBakiye } from '@/src/types'
import AppShell from '@/app/components/AppShell'
import CariTable from './CariTable'

export default async function CariPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; arsiv?: string }>
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('company_id, role')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) {
    console.error('[cari/page] profileError:', profileError)
    notFound()
  }
  if (!profile || !profile.company_id) redirect('/onboarding')
  const companyId = profile.company_id
  const isAdmin = profile.role === 'admin'

  const { type, arsiv } = await searchParams
  const showArsiv = arsiv === '1'

  let cariQuery = supabase.from('cariler').select('*').eq('company_id', companyId).order('name')

  if (type && ['musteri', 'tedarikci', 'her_ikisi'].includes(type)) {
    cariQuery = cariQuery.eq('cari_type', type)
  }

  if (!showArsiv) {
    cariQuery = cariQuery.or('cari_status.neq.arsiv,cari_status.is.null')
  }

  const [cariRes, hareketRes] = await Promise.all([
    cariQuery,
    supabase.from('cari_hareketler').select('cari_id, transaction_type, amount').eq('company_id', companyId),
  ])

  const ownerNames: Record<string, string> = {}
  const ownerIds = [...new Set((cariRes.data ?? []).map((c: any) => c.owner_id).filter(Boolean))] as string[]
  if (ownerIds.length > 0) {
    const { data: ownerProfiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', ownerIds)
    for (const p of ownerProfiles ?? []) {
      if (p.full_name) ownerNames[p.id] = p.full_name
    }
  }

  if (cariRes.error) notFound()
  const cariler = cariRes.data
  const hareketler = hareketRes.data as CariHareket[] | null

  const cariList: Cari[] = cariler ?? []
  const hareketList: CariHareket[] = hareketler ?? []

  const cariWithBakiye = cariList.map((cari) => {
    const mine = hareketList.filter((h) => h.cari_id === cari.id)
    const { net } = calcBakiye(mine)
    return { ...cari, bakiye: net }
  })

  return (
    <AppShell userEmail={user.email ?? ''}>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <CariTable cariler={cariWithBakiye} activeType={type} showArsiv={showArsiv} ownerNames={ownerNames} isAdmin={isAdmin} />
      </main>
    </AppShell>
  )
}
