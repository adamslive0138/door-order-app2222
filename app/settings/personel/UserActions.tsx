'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  userId: string
  fullName: string | null
  username: string | null
  isActive: boolean
  isSelf: boolean
  isAdmin: boolean
}

function Modal({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl">
        {children}
      </div>
    </div>
  )
}

export default function UserActions({ userId, fullName, username, isActive, isSelf, isAdmin }: Props) {
  const router = useRouter()
  const [mode, setMode] = useState<'idle' | 'edit' | 'toggle' | 'delete' | 'password'>('idle')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Edit form
  const [editName, setEditName] = useState(fullName ?? '')
  const [editUsername, setEditUsername] = useState(username ?? '')

  // Password form
  const [pw, setPw] = useState('')
  const [pwConfirm, setPwConfirm] = useState('')

  function close() {
    setMode('idle')
    setError(null)
    setPw('')
    setPwConfirm('')
  }

  async function callApi(url: string, method: string, body: object) {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = await res.json()
    if (!res.ok || json.error) throw new Error(json.error ?? 'Hata oluştu.')
    return json
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editName.trim()) { setError('Ad Soyad zorunludur.'); return }
    setLoading(true)
    setError(null)
    try {
      await callApi('/api/personel/edit', 'PATCH', {
        userId,
        full_name: editName,
        username: editUsername,
      })
      close()
      router.refresh()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault()
    if (pw.length < 6) { setError('Şifre en az 6 karakter olmalıdır.'); return }
    if (pw !== pwConfirm) { setError('Şifreler eşleşmiyor.'); return }
    setLoading(true)
    setError(null)
    try {
      await callApi('/api/personel/reset-password', 'POST', { userId, password: pw })
      close()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleToggle() {
    setLoading(true)
    setError(null)
    try {
      await callApi('/api/personel/toggle-active', 'POST', { userId, active: !isActive })
      close()
      router.refresh()
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }

  async function handleDelete() {
    setLoading(true)
    setError(null)
    try {
      await callApi('/api/personel/delete', 'DELETE', { userId })
      close()
      router.refresh()
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }

  const displayName = fullName ?? 'Kullanıcı'

  return (
    <>
      {/* ── Edit Modal ─────────────────────────────────────────────────────── */}
      {mode === 'edit' && (
        <Modal onClose={close}>
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-800">Kullanıcıyı Düzenle</h2>
            <button onClick={close} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <form onSubmit={handleEdit}>
            <div className="space-y-4 px-5 py-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Ad Soyad <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  autoFocus
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Kullanıcı Adı</label>
                <input
                  type="text"
                  value={editUsername}
                  onChange={e => setEditUsername(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-4">
              <button type="button" onClick={close} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">İptal</button>
              <button type="submit" disabled={loading} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
                {loading ? 'Kaydediliyor…' : 'Kaydet'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Password Modal ─────────────────────────────────────────────────── */}
      {mode === 'password' && (
        <Modal onClose={close}>
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-800">Şifre Değiştir — {displayName}</h2>
            <button onClick={close} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <form onSubmit={handlePassword}>
            <div className="space-y-4 px-5 py-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Yeni Şifre <span className="text-red-500">*</span></label>
                <input type="password" autoFocus required value={pw} onChange={e => setPw(e.target.value)} placeholder="En az 6 karakter"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Şifre Tekrar <span className="text-red-500">*</span></label>
                <input type="password" required value={pwConfirm} onChange={e => setPwConfirm(e.target.value)} placeholder="Aynı şifreyi tekrar girin"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-4">
              <button type="button" onClick={close} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">İptal</button>
              <button type="submit" disabled={loading} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
                {loading ? 'Kaydediliyor…' : 'Şifreyi Güncelle'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Toggle Active Modal ────────────────────────────────────────────── */}
      {mode === 'toggle' && (
        <Modal onClose={close}>
          <div className="px-5 py-5">
            <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-full ${isActive ? 'bg-amber-100' : 'bg-green-100'}`}>
              <svg className={`h-5 w-5 ${isActive ? 'text-amber-600' : 'text-green-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isActive ? 'M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636' : 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'} />
              </svg>
            </div>
            <h2 className="text-sm font-semibold text-gray-900">
              {isActive ? `${displayName} kullanıcısını pasif yap` : `${displayName} kullanıcısını aktif yap`}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {isActive
                ? 'Bu kullanıcı sisteme giriş yapamayacak. Kayıtları korunacak.'
                : 'Bu kullanıcı tekrar sisteme giriş yapabilecek.'}
            </p>
            {error && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
          </div>
          <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-4">
            <button onClick={close} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">İptal</button>
            <button
              onClick={handleToggle}
              disabled={loading}
              className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 ${isActive ? 'bg-amber-500 hover:bg-amber-600' : 'bg-green-600 hover:bg-green-700'}`}
            >
              {loading ? 'İşleniyor…' : isActive ? 'Pasif Yap' : 'Aktif Yap'}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Delete Modal ───────────────────────────────────────────────────── */}
      {mode === 'delete' && (
        <Modal onClose={close}>
          <div className="px-5 py-5">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
              <svg className="h-5 w-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h2 className="text-sm font-semibold text-gray-900">{displayName} kullanıcısını sil</h2>
            <p className="mt-1 text-sm text-gray-500">
              Bu işlem geri alınamaz. Kullanıcı silinecek, ancak oluşturduğu siparişler ve kayıtlar korunacak.
            </p>
            {error && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
          </div>
          <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-4">
            <button onClick={close} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">İptal</button>
            <button
              onClick={handleDelete}
              disabled={loading}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
            >
              {loading ? 'Siliniyor…' : 'Kullanıcıyı Sil'}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Action buttons ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-end gap-1.5">
        <button
          onClick={() => { setEditName(fullName ?? ''); setEditUsername(username ?? ''); setMode('edit') }}
          title="Düzenle"
          className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
        >
          Düzenle
        </button>
        <button
          onClick={() => setMode('password')}
          title="Şifre Değiştir"
          className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors"
        >
          Şifre
        </button>
        {!isSelf && !isAdmin && (
          <>
            <button
              onClick={() => setMode('toggle')}
              title={isActive ? 'Pasif Yap' : 'Aktif Yap'}
              className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
                isActive
                  ? 'border-amber-200 text-amber-600 hover:bg-amber-50'
                  : 'border-green-200 text-green-700 hover:bg-green-50'
              }`}
            >
              {isActive ? 'Pasif Yap' : 'Aktif Yap'}
            </button>
            <button
              onClick={() => setMode('delete')}
              title="Sil"
              className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
            >
              Sil
            </button>
          </>
        )}
      </div>
    </>
  )
}
