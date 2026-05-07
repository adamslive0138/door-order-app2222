'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/src/lib/supabase/client'

interface Props {
  table: 'orders' | 'cariler'
  recordId: string
  currentOwnerId: string | null
  staffList: { id: string; full_name: string | null }[]
}

export default function OwnerChanger({ table, recordId, currentOwnerId, staffList }: Props) {
  const router = useRouter()
  const [open, setOpen]     = useState(false)
  const [busy, setBusy]     = useState(false)
  const [error, setError]   = useState<string | null>(null)
  const [selected, setSelected] = useState(currentOwnerId ?? '')

  async function handleChange(newOwnerId: string) {
    if (newOwnerId === currentOwnerId) { setOpen(false); return }
    setBusy(true)
    setError(null)
    const { error: dbError } = await createClient()
      .from(table)
      .update({ owner_id: newOwnerId })
      .eq('id', recordId)
    if (dbError) {
      setError(dbError.message)
      setBusy(false)
      return
    }
    setSelected(newOwnerId)
    setOpen(false)
    setBusy(false)
    router.refresh()
  }

  const currentName = staffList.find(s => s.id === selected)?.full_name ?? '—'

  if (!open) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-800">{currentName}</span>
        <button
          onClick={() => setOpen(true)}
          className="rounded px-2 py-0.5 text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors"
        >
          Değiştir
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <select
        autoFocus
        value={selected}
        onChange={(e) => handleChange(e.target.value)}
        disabled={busy}
        className="rounded-lg border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
      >
        <option value="">— Seçin —</option>
        {staffList.map((s) => (
          <option key={s.id} value={s.id}>{s.full_name ?? s.id}</option>
        ))}
      </select>
      <button
        onClick={() => setOpen(false)}
        disabled={busy}
        className="text-xs text-gray-400 hover:text-gray-600"
      >
        İptal
      </button>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  )
}
