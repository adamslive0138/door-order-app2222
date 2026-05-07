'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/src/lib/supabase/client'
import type { OrderStatus, UserRole } from '@/src/types'
import { ORDER_STATUS_LABELS } from '@/src/types'
import { canDo } from '@/src/lib/role'

// Linear forward transition for each status
const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  beklemede:  'onaylandi',
  onaylandi:  'uretimde',
  uretimde:   'hazir',
  hazir:      'sevkte',
  sevkte:     'tamamlandi',
}

// Statuses from which cancellation is allowed
const CANCELLABLE: Set<OrderStatus> = new Set([
  'beklemede', 'onaylandi', 'uretimde', 'hazir',
])

interface Props {
  orderId: string
  currentStatus: OrderStatus
  userRole: UserRole
}

export default function OrderStatusChanger({ orderId, currentStatus, userRole }: Props) {
  if (!canDo(userRole, 'orders_status')) return null
  const router  = useRouter()
  const [busy, setBusy] = useState<OrderStatus | null>(null)
  const [error, setError] = useState<string | null>(null)

  const nextStatus  = NEXT_STATUS[currentStatus] ?? null
  const cancellable = CANCELLABLE.has(currentStatus)

  // Nothing to show for terminal statuses
  if (!nextStatus && !cancellable) return null

  async function advance(newStatus: OrderStatus) {
    if (newStatus === 'tamamlandi') {
      const confirmed = window.confirm('Bu sipariş arşivlenecek. Onaylıyor musunuz?')
      if (!confirmed) return
    }
    setBusy(newStatus)
    setError(null)

    const updateData =
      newStatus === 'tamamlandi'
        ? { status: 'tamamlandi', is_archived: true }
        : { status: newStatus }

    console.log('UPDATE DATA:', updateData)

    const { error } = await createClient()
      .from('orders')
      .update(updateData)
      .eq('id', orderId)

    if (error) {
      console.error(error)
      alert(error.message)
      setBusy(null)
      return
    }

    router.refresh()
  }

  return (
    <div className="border-t border-gray-100 px-5 pb-4 pt-3">
      <div className="flex flex-wrap items-center gap-2">
        {nextStatus && (
          <button
            onClick={() => advance(nextStatus)}
            disabled={!!busy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {busy === nextStatus ? 'İşleniyor…' : (
              <>
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                {ORDER_STATUS_LABELS[nextStatus]}
              </>
            )}
          </button>
        )}
        {cancellable && (
          <button
            onClick={() => advance('iptal')}
            disabled={!!busy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
          >
            {busy === 'iptal' ? 'İşleniyor…' : 'İptal Et'}
          </button>
        )}
      </div>
      {error && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
    </div>
  )
}
