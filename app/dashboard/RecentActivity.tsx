'use client'

import Link from 'next/link'

const STATUS_STYLE: Record<string, string> = {
  siparis_alindi: 'bg-amber-50 text-amber-700',
  uretimde:       'bg-blue-50 text-blue-700',
  gonderildi:     'bg-green-50 text-green-700',
}
const STATUS_LABEL: Record<string, string> = {
  siparis_alindi: 'Sipariş Alındı',
  uretimde:       'Üretimde',
  gonderildi:     'Gönderildi',
}

function fmtCur(n: number) {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(n)
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' })
}

export interface RecentOrder {
  id: string
  customer_name: string
  status: string
  total_price: number
  created_at: string
}

export interface RecentTahsilat {
  id: string
  cari_name: string
  amount: number
  description: string | null
  created_at: string
}

export interface RecentOdeme {
  id: string
  cari_name: string
  amount: number
  description: string | null
  created_at: string
}

interface Props {
  orders?:  RecentOrder[]
  tahsilat: RecentTahsilat[]
  odeme:    RecentOdeme[]
}

export default function RecentActivity({ orders, tahsilat, odeme }: Props) {
  return (
    <div className={`grid gap-4 ${orders ? 'lg:grid-cols-3' : 'lg:grid-cols-2'}`}>
      {/* Son Siparişler — only shown when orders prop is passed */}
      {orders && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3.5">
            <p className="text-sm font-semibold text-gray-700">Son Siparişler</p>
            <Link href="/orders" className="text-xs font-medium text-blue-600 hover:underline">Tümü →</Link>
          </div>

          {orders.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-gray-400">Sipariş yok.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {orders.map(o => (
                <li key={o.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50/60 transition-colors">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-800">{o.customer_name}</p>
                    <p className="text-xs text-gray-400">{fmtDate(o.created_at)}</p>
                  </div>
                  <div className="ml-4 flex shrink-0 items-center gap-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[o.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {STATUS_LABEL[o.status] ?? o.status}
                    </span>
                    <span className="text-sm font-semibold text-gray-700">{fmtCur(o.total_price)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Son Tahsilatlar */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3.5">
          <p className="text-sm font-semibold text-gray-700">Son Tahsilatlar</p>
          <Link href="/finance/tahsilat" className="text-xs font-medium text-blue-600 hover:underline">Tümü →</Link>
        </div>

        {tahsilat.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-gray-400">Tahsilat yok.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {tahsilat.map(h => (
              <li key={h.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50/60 transition-colors">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-800">{h.cari_name}</p>
                  <p className="truncate text-xs text-gray-400">{h.description ?? fmtDate(h.created_at)}</p>
                </div>
                <span className="ml-4 shrink-0 text-sm font-semibold text-green-600">+{fmtCur(h.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Son Ödemeler */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3.5">
          <p className="text-sm font-semibold text-gray-700">Son Ödemeler</p>
          <Link href="/finance/odeme" className="text-xs font-medium text-blue-600 hover:underline">Tümü →</Link>
        </div>

        {odeme.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-gray-400">Ödeme yok.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {odeme.map(h => (
              <li key={h.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50/60 transition-colors">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-800">{h.cari_name}</p>
                  <p className="truncate text-xs text-gray-400">{h.description ?? fmtDate(h.created_at)}</p>
                </div>
                <span className="ml-4 shrink-0 text-sm font-semibold text-red-500">-{fmtCur(h.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
