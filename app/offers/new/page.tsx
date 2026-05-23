import { redirect } from 'next/navigation'
import { createClient } from '@/src/lib/supabase/server'
import AppShell from '@/app/components/AppShell'
import OfferForm from './OfferForm'

export default async function NewOfferPage({
  searchParams,
}: {
  searchParams: Promise<{ cari_id?: string; order_id?: string }>
}) {
  const { cari_id, order_id } = await searchParams
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

  // When a specific source is provided we ONLY fetch that source — no large
  // dropdown queries, no recent-50 limit. When no source is provided we fall
  // back to the original dropdown flow (cariler + recent orders).
  const hasSource = !!order_id || !!cari_id

  const [sourceOrderRes, sourceCariRes, carilerRes, ordersRes] = await Promise.all([
    order_id
      ? supabase
          .from('orders')
          .select('id, customer_name, customer_phone, customer_city, door_type, dimensions, quantity, unit_price, lock_brand, lock_system, frame_color, image_url, notes, cari_id')
          .eq('id', order_id)
          .eq('company_id', companyId)
          .maybeSingle()
      : Promise.resolve({ data: null }),

    cari_id
      ? supabase
          .from('cariler')
          .select('id, name, contact_name, phone, city')
          .eq('id', cari_id)
          .eq('company_id', companyId)
          .maybeSingle()
      : Promise.resolve({ data: null }),

    // Only fetch the cari dropdown when there is no source (manual-pick flow).
    hasSource
      ? Promise.resolve({ data: [] })
      : supabase
          .from('cariler')
          .select('id, name, contact_name, phone, city')
          .eq('company_id', companyId)
          .order('name'),

    // Only fetch the order dropdown when there is no source.
    hasSource
      ? Promise.resolve({ data: [] })
      : supabase
          .from('orders')
          .select('id, customer_name, customer_phone, customer_city, door_type, dimensions, quantity, unit_price, lock_brand, lock_system, frame_color, image_url')
          .eq('company_id', companyId)
          .or('is_archived.eq.false,is_archived.is.null')
          .order('created_at', { ascending: false })
          .limit(50),
  ])

  // If a source order is linked to a cari and the cari wasn't already fetched,
  // grab the cari too so the offer carries cari_id forward.
  let sourceCari = sourceCariRes.data
  if (!sourceCari && sourceOrderRes.data?.cari_id) {
    const { data } = await supabase
      .from('cariler')
      .select('id, name, contact_name, phone, city')
      .eq('id', sourceOrderRes.data.cari_id)
      .eq('company_id', companyId)
      .maybeSingle()
    sourceCari = data
  }

  return (
    <AppShell userEmail={user.email ?? ''}>
      <main className="mx-auto max-w-4xl px-4 py-6">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-900">Yeni Teklif</h1>
          <p className="mt-0.5 text-sm text-gray-500">Müşteri bilgileri ve ürünü girin, PDF ve Excel oluşturun.</p>
        </div>
        <OfferForm
          companyId={companyId}
          cariler={(carilerRes.data ?? []) as any}
          orders={(ordersRes.data ?? []) as any}
          initialCariId={cari_id ?? sourceOrderRes.data?.cari_id ?? undefined}
          initialOrderId={order_id}
          initialOrder={(sourceOrderRes.data ?? null) as any}
          initialCari={(sourceCari ?? null) as any}
        />
      </main>
    </AppShell>
  )
}
