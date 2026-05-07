'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/src/lib/supabase/client'
import type { CariStatus, UserRole } from '@/src/types'
import { CARI_STATUS_LABELS, CARI_STATUS_COLORS } from '@/src/types'
import { canDo } from '@/src/lib/role'

const ALL_STATUSES: CariStatus[] = ['aktif', 'pasif', 'arsiv']

interface Props {
  cariId: string
  currentStatus: CariStatus | null
  userRole: UserRole
}

export default function CariStatusChanger({ cariId, currentStatus, userRole }: Props) {
  if (!canDo(userRole, 'cari_status')) return null
  const router  = useRouter()
  const current = currentStatus ?? 'aktif'
  const [busy,  setBusy]  = useState<CariStatus | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function changeStatus(next: CariStatus) {
    if (next === current) return
    setBusy(next)
    setError(null)
    const { error: dbErr } = await createClient()
      .from('cariler')
      .update({ cari_status: next })
      .eq('id', cariId)
    setBusy(null)
    if (dbErr) { setError(dbErr.message); return }
    router.refresh()
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Cari Durumu</p>
      <div className="flex flex-wrap gap-2">
        {ALL_STATUSES.map(s => (
          <button
            key={s}
            onClick={() => changeStatus(s)}
            disabled={s === current || !!busy}
            className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors disabled:cursor-default ${
              s === current
                ? `${CARI_STATUS_COLORS[s]} border-transparent ring-2 ring-offset-1 ring-current opacity-100`
                : 'border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40'
            }`}
          >
            {busy === s ? 'İşleniyor…' : CARI_STATUS_LABELS[s]}
          </button>
        ))}
      </div>
      {error && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
    </div>
  )
}
