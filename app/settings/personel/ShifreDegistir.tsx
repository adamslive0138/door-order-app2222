'use client'

import { useState } from 'react'

interface Props {
  userId: string
  fullName: string | null
}

export default function ShifreDegistir({ userId, fullName }: Props) {
  const [open, setOpen]       = useState(false)
  const [password, setPassword]   = useState('')
  const [confirm,  setConfirm]    = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [toast, setToast]     = useState(false)

  function close() {
    setOpen(false)
    setPassword('')
    setConfirm('')
    setError(null)
  }

  function showToast() {
    setToast(true)
    setTimeout(() => setToast(false), 3000)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 6) { setError('Şifre en az 6 karakter olmalıdır.'); return }
    if (password !== confirm)  { setError('Şifreler eşleşmiyor.');             return }

    setLoading(true)
    const res = await fetch('/api/personel/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, password }),
    })
    const json = await res.json()
    setLoading(false)

    if (!res.ok || json.error) { setError(json.error ?? 'Hata oluştu.'); return }

    close()
    showToast()
  }

  return (
    <>
      {/* Success toast */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg">
          {fullName ?? 'Kullanıcı'} şifresi güncellendi.
        </div>
      )}

      <button
        onClick={() => setOpen(true)}
        className="text-xs font-medium text-blue-600 hover:underline"
      >
        Şifre Değiştir
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <h2 className="text-sm font-semibold text-gray-800">
                Şifre Değiştir — {fullName ?? 'Kullanıcı'}
              </h2>
              <button
                onClick={close}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handleSubmit}>
              <div className="space-y-4 px-5 py-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">
                    Yeni Şifre <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    autoFocus
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="En az 6 karakter"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">
                    Şifre Tekrar <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    placeholder="Aynı şifreyi tekrar girin"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                {error && (
                  <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>
                )}
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-4">
                <button
                  type="button"
                  onClick={close}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
                >
                  {loading ? 'Kaydediliyor...' : 'Şifreyi Güncelle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
