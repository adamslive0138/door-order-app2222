'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/src/lib/supabase/client'

export default function UnarchiveButton({ orderId }: { orderId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleUnarchive() {
    setLoading(true)
    const supabase = createClient()
    await supabase.from('orders').update({ is_archived: false }).eq('id', orderId)
    router.refresh()
    setLoading(false)
  }

  return (
    <button
      onClick={handleUnarchive}
      disabled={loading}
      className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50 hover:border-gray-300 disabled:opacity-50"
    >
      {loading ? '…' : 'Geri Al'}
    </button>
  )
}
