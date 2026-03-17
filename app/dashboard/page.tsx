import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/src/lib/supabase/server'
import type { Order } from '@/src/types'
import LogoutButton from './LogoutButton'
import OrdersTable from './OrdersTable'

export default async function DashboardPage() {
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

  const companyId = profile?.company_id

  const { data: orders, error } = companyId
    ? await supabase
        .from('orders')
        .select('*')
        .eq('company_id', companyId)
        .or('is_archived.eq.false,is_archived.is.null')
        .order('created_at', { ascending: true })
    : { data: [], error: null }

  const orderList: Order[] = orders ?? []

  const counts = {
    siparis_alindi: orderList.filter((o) => o.status === 'siparis_alindi').length,
    uretimde: orderList.filter((o) => o.status === 'uretimde').length,
    gonderildi: orderList.filter((o) => o.status === 'gonderildi').length,
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <h1 className="text-lg font-bold text-gray-900">Kapı Sipariş Takip</h1>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-gray-500 sm:block">{user.email}</span>
            <Link href="/archive" className="text-sm font-medium text-gray-500 hover:text-gray-900">
              Arşiv
            </Link>
            <Link href="/settings" className="text-sm font-medium text-gray-500 hover:text-gray-900">
              Ayarlar
            </Link>
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        {/* Stats */}
        <div className="mb-6 grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-amber-100 bg-amber-50 p-4 text-center">
            <p className="text-2xl font-bold text-amber-700">{counts.siparis_alindi}</p>
            <p className="mt-1 text-xs font-medium text-amber-600">Sipariş Alındı</p>
          </div>
          <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-center">
            <p className="text-2xl font-bold text-blue-700">{counts.uretimde}</p>
            <p className="mt-1 text-xs font-medium text-blue-600">Üretimde</p>
          </div>
          <div className="rounded-xl border border-green-100 bg-green-50 p-4 text-center">
            <p className="text-2xl font-bold text-green-700">{counts.gonderildi}</p>
            <p className="mt-1 text-xs font-medium text-green-600">Gönderildi</p>
          </div>
        </div>

        <OrdersTable orders={orderList} error={!!error} />
      </main>
    </div>
  )
}
