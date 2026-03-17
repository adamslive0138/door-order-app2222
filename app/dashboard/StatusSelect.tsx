'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/src/lib/supabase/client'
import type { OrderStatus } from '@/src/types'

const STATUS_LABELS: Record<OrderStatus, string> = {
  siparis_alindi: 'Sipariş Alındı',
  uretimde: 'Üretimde',
  gonderildi: 'Gönderildi',
}

const STATUS_CLASSES: Record<OrderStatus, string> = {
  siparis_alindi: 'bg-amber-100 text-amber-800 border-amber-200',
  uretimde: 'bg-blue-100 text-blue-800 border-blue-200',
  gonderildi: 'bg-green-100 text-green-800 border-green-200',
}

interface Props {
  orderId: string
  status: OrderStatus
}

export default function StatusSelect({ orderId, status }: Props) {
  const router = useRouter()
  const [current, setCurrent] = useState<OrderStatus>(status)
  const [saving, setSaving] = useState(false)

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value as OrderStatus
    setSaving(true)
    setCurrent(next)

    const supabase = createClient()
    const { error } = await supabase
      .from('orders')
      .update({ status: next })
      .eq('id', orderId)

    if (error) {
      console.error('[StatusSelect] update error', error)
      setCurrent(status) // revert on failure
    } else {
      router.refresh()
    }

    setSaving(false)
  }

  return (
    <select
      value={current}
      onChange={handleChange}
      disabled={saving}
      className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition-opacity disabled:opacity-50 ${STATUS_CLASSES[current]}`}
    >
      {(Object.keys(STATUS_LABELS) as OrderStatus[]).map((s) => (
        <option key={s} value={s}>
          {STATUS_LABELS[s]}
        </option>
      ))}
    </select>
  )
}
