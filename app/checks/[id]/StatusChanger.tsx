'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/src/lib/supabase/client'
import type { UserRole } from '@/src/types'
import { canDo } from '@/src/lib/role'

export default function StatusChanger({ checkId, userRole }: { checkId: string; userRole: UserRole }) {
  if (!canDo(userRole, 'checks_status')) return null
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function changeStatus(newStatus: 'devredildi' | 'tahsil_edildi') {
    setBusy(newStatus)
    setError(null)
    const supabase = createClient()
    const { error: dbErr } = await supabase
      .from('checks')
      .update({ check_status: newStatus })
      .eq('id', checkId)
    setBusy(null)
    if (dbErr) { setError(dbErr.message); return }
    router.refresh()
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Durum Değiştir</p>
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => changeStatus('devredildi')}
          disabled={!!busy}
          className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-50 transition-colors"
        >
          {busy === 'devredildi' ? 'İşleniyor…' : '→ Devredildi'}
        </button>
        <button
          onClick={() => changeStatus('tahsil_edildi')}
          disabled={!!busy}
          className="rounded-lg border border-green-300 bg-green-50 px-4 py-2 text-sm font-semibold text-green-700 hover:bg-green-100 disabled:opacity-50 transition-colors"
        >
          {busy === 'tahsil_edildi' ? 'İşleniyor…' : '→ Tahsil Edildi'}
        </button>
      </div>
      {error && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
    </div>
  )
}
