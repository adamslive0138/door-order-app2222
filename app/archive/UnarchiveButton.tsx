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
      className="text-xs font-medium text-blue-600 hover:underline disabled:opacity-50"
    >
      {loading ? '...' : 'Geri Al'}
    </button>
  )
}
