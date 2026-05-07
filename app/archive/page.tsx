import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/src/lib/supabase/server'
import type { Order } from '@/src/types'
import { DOOR_TYPE_LABELS } from '@/src/types'
import AppShell from '@/app/components/AppShell'
import UnarchiveButton from './UnarchiveButton'

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('tr-TR')
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(amount)
}

export default async function ArchivePage() {
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

  const { data: orders } = companyId
    ? await supabase
        .from('orders')
        .select('*')
        .eq('company_id', companyId)
        .eq('is_archived', true)
        .order('created_at', { ascending: false })
    : { data: [] }

  const orderList: Order[] = orders ?? []

  return (
    <AppShell userEmail={user.email ?? ''}>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <nav className="mb-5 flex items-center gap-1.5 text-sm text-gray-400">
          <Link href="/dashboard" className="transition-colors hover:text-gray-700">
            Sipariş Takip
          </Link>
          <span>/</span>
          <span className="font-medium text-gray-700">Arşiv</span>
        </nav>

        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-700">
              Arşivlenen Siparişler{' '}
              <span className="ml-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-normal text-gray-500">
                {orderList.length}
              </span>
            </h2>
          </div>

          {orderList.length === 0 && (
            <div className="px-4 py-12 text-center text-sm text-gray-400">
              Arşivlenmiş sipariş bulunmuyor.
            </div>
          )}

          {orderList.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    <th className="px-4 py-3">Müşteri</th>
                    <th className="px-4 py-3">Kapı Tipi</th>
                    <th className="px-4 py-3">Şehir</th>
                    <th className="px-4 py-3 text-right">Toplam</th>
                    <th className="px-4 py-3">Sipariş Tarihi</th>
                    <th className="px-4 py-3">Termin Tarihi</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {orderList.map((order) => (
                    <tr key={order.id} className="transition-colors hover:bg-gray-50/80">
                      <td className="px-4 py-3.5 font-semibold text-gray-800">{order.customer_name}</td>
                      <td className="px-4 py-3.5 text-gray-500">
                        {DOOR_TYPE_LABELS[order.door_type] ?? order.door_type}
                      </td>
                      <td className="px-4 py-3.5 text-gray-500">{order.customer_city}</td>
                      <td className="px-4 py-3.5 text-right font-semibold text-gray-800">
                        {formatCurrency(order.total_price)}
                      </td>
                      <td className="px-4 py-3.5 text-gray-500">{formatDate(order.created_at)}</td>
                      <td className="px-4 py-3.5 text-gray-500">{formatDate(order.deadline_date)}</td>
                      <td className="px-4 py-3.5">
                        <UnarchiveButton orderId={order.id} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </AppShell>
  )
}
