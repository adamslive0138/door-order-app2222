'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/src/lib/supabase/client'
import type { Check, UserRole } from '@/src/types'
import { canDo } from '@/src/lib/role'

type CariOption = { id: string; name: string }

interface Props {
  check: Check & {
    source_cari: { id: string; name: string } | null
    target_cari: { id: string; name: string } | null
  }
  cariler: CariOption[]
  userRole: UserRole
}

// ── Edit form state ───────────────────────────────────────────────────────────

interface EditForm {
  amount:           string
  due_date:         string
  check_no:         string
  bank_name:        string
  branch_name:      string
  account_no:       string
  description:      string
  source_cari_id:   string
  target_cari_id:   string
}

function EditModal({ check, cariler, onClose, onSaved }: {
  check: Props['check']
  cariler: CariOption[]
  onClose: () => void
  onSaved: () => void
}) {
  const supabase = createClient()
  const [form, setForm] = useState<EditForm>({
    amount:         String(check.amount),
    due_date:       check.due_date ?? '',
    check_no:       check.check_no ?? '',
    bank_name:      check.bank_name ?? '',
    branch_name:    check.branch_name ?? '',
    account_no:     check.account_no ?? '',
    description:    check.description ?? '',
    source_cari_id: check.source_cari_id ?? '',
    target_cari_id: check.target_cari_id ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  function set<K extends keyof EditForm>(field: K, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSave() {
    const amt = parseFloat(form.amount)
    if (isNaN(amt) || amt <= 0) { setError('Geçerli bir tutar giriniz.'); return }
    if (!form.due_date)          { setError('Vade tarihi zorunludur.'); return }

    setSaving(true)
    setError(null)

    const { error: dbErr } = await supabase
      .from('checks')
      .update({
        amount:         amt,
        due_date:       form.due_date,
        check_no:       form.check_no.trim()    || null,
        bank_name:      form.bank_name.trim()   || null,
        branch_name:    form.branch_name.trim() || null,
        account_no:     form.account_no.trim()  || null,
        description:    form.description.trim() || null,
        source_cari_id: form.source_cari_id     || null,
        target_cari_id: form.target_cari_id     || null,
      })
      .eq('id', check.id)

    setSaving(false)
    if (dbErr) { setError(dbErr.message); return }
    onSaved()
  }

  const inputCls = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'
  const labelCls = 'mb-1 block text-xs font-medium text-gray-600'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-800">Çeki Düzenle</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto space-y-4 px-5 py-4">
          {/* Tutar + Vade */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Tutar (₺) *</label>
              <input type="number" min="0" step="0.01" value={form.amount}
                onChange={e => set('amount', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Vade Tarihi *</label>
              <input type="date" value={form.due_date}
                onChange={e => set('due_date', e.target.value)} className={inputCls} />
            </div>
          </div>

          {/* Çek No + Banka */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Çek No</label>
              <input type="text" value={form.check_no}
                onChange={e => set('check_no', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Banka</label>
              <input type="text" value={form.bank_name}
                onChange={e => set('bank_name', e.target.value)} className={inputCls} />
            </div>
          </div>

          {/* Şube + Hesap No */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Şube</label>
              <input type="text" value={form.branch_name}
                onChange={e => set('branch_name', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Hesap No</label>
              <input type="text" value={form.account_no}
                onChange={e => set('account_no', e.target.value)} className={inputCls} />
            </div>
          </div>

          {/* Kaynak Cari + Hedef Cari */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Kaynak Cari</label>
              <select value={form.source_cari_id}
                onChange={e => set('source_cari_id', e.target.value)} className={inputCls}>
                <option value="">— Seçiniz —</option>
                {cariler.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Hedef Cari</label>
              <select value={form.target_cari_id}
                onChange={e => set('target_cari_id', e.target.value)} className={inputCls}>
                <option value="">— Seçiniz —</option>
                {cariler.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          {/* Açıklama */}
          <div>
            <label className={labelCls}>Açıklama</label>
            <textarea rows={3} value={form.description}
              onChange={e => set('description', e.target.value)}
              className={inputCls + ' resize-none'} />
          </div>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-4">
          <button onClick={onClose}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
            İptal
          </button>
          <button onClick={handleSave} disabled={saving}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {saving ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Delete confirm ────────────────────────────────────────────────────────────

function DeleteConfirm({ check, onClose, onDeleted }: {
  check: Props['check']
  onClose: () => void
  onDeleted: () => void
}) {
  const supabase = createClient()
  const [deleting, setDeleting] = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  const fmt = (n: number) =>
    new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 2 }).format(n)

  async function handleDelete() {
    setDeleting(true)
    setError(null)
    const { error: dbErr } = await supabase.from('checks').delete().eq('id', check.id)
    setDeleting(false)
    if (dbErr) { setError(dbErr.message); return }
    onDeleted()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl">
        <div className="px-5 py-5">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
            <svg className="h-5 w-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </div>
          <h2 className="text-sm font-semibold text-gray-900">Çeki sil</h2>
          <p className="mt-1 text-sm text-gray-500">
            <span className="font-medium">{fmt(Number(check.amount))}</span> tutarındaki çek kalıcı olarak silinecek. Bu işlem geri alınamaz.
          </p>
          {error && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-4">
          <button onClick={onClose}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
            İptal
          </button>
          <button onClick={handleDelete} disabled={deleting}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition-colors">
            {deleting ? 'Siliniyor…' : 'Sil'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function CheckActions({ check, cariler, userRole }: Props) {
  const router = useRouter()
  const [showEdit,   setShowEdit]   = useState(false)
  const [showDelete, setShowDelete] = useState(false)

  const canEdit = canDo(userRole, 'checks_edit')
  if (!canEdit) return null

  return (
    <>
      {showEdit && (
        <EditModal
          check={check}
          cariler={cariler}
          onClose={() => setShowEdit(false)}
          onSaved={() => { setShowEdit(false); router.refresh() }}
        />
      )}
      {showDelete && (
        <DeleteConfirm
          check={check}
          onClose={() => setShowDelete(false)}
          onDeleted={() => router.push('/checks')}
        />
      )}

      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowEdit(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Düzenle
        </button>
        <button
          onClick={() => setShowDelete(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Sil
        </button>
      </div>
    </>
  )
}
