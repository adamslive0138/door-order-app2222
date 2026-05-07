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

  const [{ data: carilerData }, { data: ordersData }] = await Promise.all([
    supabase
      .from('cariler')
      .select('id, name, contact_name, phone, city')
      .eq('company_id', companyId)
      .order('name'),
    supabase
      .from('orders')
      .select('id, customer_name, customer_phone, customer_city, door_type, dimensions, quantity, unit_price, lock_brand, lock_system, frame_color, image_url')
      .eq('company_id', companyId)
      .or('is_archived.eq.false,is_archived.is.null')
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  return (
    <AppShell userEmail={user.email ?? ''}>
      <main className="mx-auto max-w-4xl px-4 py-6">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-900">Yeni Teklif</h1>
          <p className="mt-0.5 text-sm text-gray-500">Müşteri bilgileri ve ürünü girin, PDF ve Excel oluşturun.</p>
        </div>
        <OfferForm
          companyId={companyId}
          cariler={carilerData ?? []}
          orders={(ordersData ?? []) as any}
          initialCariId={cari_id}
          initialOrderId={order_id}
        />
      </main>
    </AppShell>
  )
}
