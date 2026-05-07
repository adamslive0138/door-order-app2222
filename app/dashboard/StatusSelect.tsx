'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/src/lib/supabase/client'
import type { OrderStatus } from '@/src/types'
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS, ORDER_STATUS_STEPS } from '@/src/types'

const SELECT_OPTIONS: OrderStatus[] = [...ORDER_STATUS_STEPS, 'iptal']

const ALLOWED_STATUSES = new Set([...ORDER_STATUS_STEPS, 'iptal'])

interface Props {
  orderId: string
  status: OrderStatus
}

export default function StatusSelect({ orderId, status }: Props) {
  const router = useRouter()
  const [current] = useState<OrderStatus>(status)
  const [saving, setSaving] = useState(false)

  
async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
  try {
    const next = e.target.value

    const allowed = [
      'beklemede',
      'onaylandi',
      'uretimde',
      'hazir',
      'sevkte',
      'tamamlandi',
      'iptal'
    ]

    if (next === 'tamamlandi') {
      const confirmed = window.confirm('Bu sipariş arşive alınacak. Onaylıyor musunuz?')
      if (!confirmed) return
    }

    if (!allowed.includes(next)) {
      console.error('INVALID STATUS:', next)
      return
    }

    const status = next as OrderStatus

    setSaving(true)

    const updateData =
      status === 'tamamlandi'
        ? { status: 'tamamlandi', is_archived: true }
        : { status }

    const { error } = await createClient()
      .from('orders')
      .update(updateData)
      .eq('id', orderId)

    if (error) {
      console.error('UPDATE ERROR:', error)
      alert(error.message)
      return
    }

    router.refresh()
    window.location.reload()
  } catch (err) {
    console.error('CRASH:', err)
    alert('Beklenmeyen hata oluştu')
  } finally {
    setSaving(false)
  }

  }

  const colorCls = ORDER_STATUS_COLORS[current] ?? 'bg-gray-100 text-gray-600'

  return (
    <select
      value={current}
      onChange={handleChange}
      disabled={saving}
      className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition-opacity disabled:opacity-50 ${colorCls}`}
    >
      {SELECT_OPTIONS.map((s) => (
        <option key={s} value={s}>
          {ORDER_STATUS_LABELS[s]}
        </option>
      ))}
    </select>
  )
}
