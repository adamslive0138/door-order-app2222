import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/src/lib/supabase/server'
import OrderForm from '@/app/orders/new/OrderForm'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditOrderPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id')
    .eq('id', user.id)
    .single()

  if (!profile?.company_id) {
    redirect('/dashboard')
  }

  const { data: order } = await supabase
    .from('orders')
    .select('*')
    .eq('id', id)
    .eq('company_id', profile.company_id)
    .single()

  if (!order) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Link href="/dashboard" className="font-medium text-gray-900 hover:underline">
              Kapı Sipariş Takip
            </Link>
            <span>/</span>
            <span>Siparişi Düzenle</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        <h1 className="mb-6 text-xl font-bold text-gray-900">Siparişi Düzenle</h1>
        <OrderForm
          companyId={profile.company_id}
          orderId={order.id}
          initialData={order}
        />
      </main>
    </div>
  )
}
