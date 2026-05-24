import { redirect } from 'next/navigation'
import { createClient } from '@/src/lib/supabase/server'
import type { Order } from '@/src/types'
import AppShell from '@/app/components/AppShell'
import OrdersTable from '@/app/dashboard/OrdersTable'

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ owner_id?: string }>
}) {
  const { owner_id } = await searchParams
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

  const isAdmin = profile?.role === 'admin'

  let query = supabase
    .from('orders')
    .select('id, customer_name, customer_phone, customer_city, door_type, status, total_price, quantity, created_at, deadline_date, owner_id, dimensions, lock_brand, lock_system, frame_color, mdf_thickness, mdf_thickness_other, steel_thickness')
    .eq('company_id', companyId)
    .or('is_archived.eq.false,is_archived.is.null')
    .order('created_at', { ascending: false })

  if (owner_id) query = query.eq('owner_id', owner_id)

  const [{ data: ordersData, error: ordersErr }, staffRes] = await Promise.all([
    query,
    isAdmin
      ? supabase.from('profiles').select('id, full_name').eq('company_id', companyId).order('full_name')
      : Promise.resolve({ data: null }),
  ])

  const orders: Order[] = (ordersData ?? []) as Order[]
  const staffList = (staffRes.data ?? []) as { id: string; full_name: string | null }[]

  // admin: staffList already contains all company profiles — derive directly, no extra query
  // non-admin: do a targeted lookup for the owner_ids visible in their result set
  const ownerNames: Record<string, string> = {}
  if (isAdmin) {
    for (const p of staffList) {
      if (p.full_name) ownerNames[p.id] = p.full_name
    }
  } else {
    const ownerIds = [...new Set(orders.map(o => o.owner_id).filter(Boolean))] as string[]
    if (ownerIds.length > 0) {
      const { data: ownerProfiles } = await supabase
        .from('profiles').select('id, full_name').in('id', ownerIds)
      for (const p of ownerProfiles ?? []) {
        if (p.full_name) ownerNames[p.id] = p.full_name
      }
    }
  }

  return (
    <AppShell userEmail={user.email ?? ''}>
      <main className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-5">
          <h1 className="text-xl font-bold text-gray-900">Siparişler</h1>
          <p className="mt-0.5 text-sm text-gray-500">Aktif tüm siparişler</p>
        </div>
        <OrdersTable
          orders={orders}
          error={!!ordersErr}
          ownerNames={ownerNames}
          isAdmin={isAdmin}
          staffList={staffList}
          selectedOwnerId={owner_id ?? ''}
        />
      </main>
    </AppShell>
  )
}
