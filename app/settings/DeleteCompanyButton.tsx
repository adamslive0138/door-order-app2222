'use client'

import { useState } from 'react'
import { createClient } from '@/src/lib/supabase/client'

export default function DeleteCompanyButton() {
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function close() {
    setOpen(false)
    setPassword('')
    setConfirm('')
    setError(null)
  }

  async function handleDelete() {
    if (!password) {
      setError('Şifrenizi giriniz.')
      return
    }
    if (confirm !== 'SİL') {
      setError('Lütfen onay kutusuna "SİL" yazınız.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()

      // 1. Verify current password before deletion
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.email) {
        setError('Kullanıcı bilgisi alınamadı.')
        setLoading(false)
        return
      }

      const { error: authError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password,
      })
      if (authError) {
        setError('Şifre hatalı. Silme işlemi iptal edildi.')
        setLoading(false)
        return
      }

      // 2. Password verified — proceed with deletion
      const res = await fetch('/api/company/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: 'SİL' }),
      })
      const json = await res.json()
      if (!res.ok || json.error) {
        setError(json.error ?? 'Silme işlemi başarısız.')
        setLoading(false)
        return
      }

      // 3. Sign out and redirect
      await supabase.auth.signOut()
      window.location.href = '/login'
    } catch {
      setError('Bağlantı hatası. Lütfen tekrar deneyin.')
      setLoading(false)
    }
  }

  const canSubmit = password.length > 0 && confirm === 'SİL' && !loading

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100">
                  <svg className="h-4 w-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h2 className="text-sm font-semibold text-gray-900">Hesabı Tamamen Sil</h2>
              </div>
              <button onClick={close} disabled={loading} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 disabled:opacity-50">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-5 py-5 space-y-4">
              {/* Warning */}
              <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                <p className="text-sm font-semibold text-red-800">Bu işlem geri alınamaz!</p>
                <p className="mt-1.5 text-xs text-red-700">
                  Tüm kullanıcılar, siparişler, teklifler, finans kayıtları ve dosyalar kalıcı olarak silinecek.
                </p>
                <ul className="mt-2 space-y-0.5 text-xs text-red-700">
                  <li>• Tüm siparişler ve teklifler silinecek</li>
                  <li>• Tüm cari kayıtları ve hareketler silinecek</li>
                  <li>• Tüm finans ve çek kayıtları silinecek</li>
                  <li>• Tüm belgeler ve dosyalar silinecek</li>
                  <li>• Tüm personel hesapları silinecek</li>
                  <li>• Şirket hesabı kalıcı olarak kapatılacak</li>
                </ul>
              </div>

              {/* Password */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Şifrenizi Girin <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  autoFocus
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Mevcut şifreniz"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                />
              </div>

              {/* SİL confirmation */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Onaylamak için <span className="font-bold text-red-600">SİL</span> yazınız:
                </label>
                <input
                  type="text"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="SİL"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                />
              </div>

              {error && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">{error}</p>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-4">
              <button
                onClick={close}
                disabled={loading}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-60"
              >
                İptal
              </button>
              <button
                onClick={handleDelete}
                disabled={!canSubmit}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-40 transition-colors"
              >
                {loading ? 'Siliniyor…' : 'Hesabı Kalıcı Olarak Sil'}
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-white px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
        Hesabı Tamamen Sil
      </button>
    </>
  )
}
