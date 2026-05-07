'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  companyCode: string
}

export default function PersonelForm({ companyCode }: Props) {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'satis' | 'admin'>('satis')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    if (password.length < 6) {
      setError('Şifre en az 6 karakter olmalıdır.')
      return
    }

    setLoading(true)

    const res = await fetch('/api/personel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name: fullName, username, password, role }),
    })

    const json = await res.json()

    if (!res.ok || json.error) {
      setError(json.error ?? 'Bir hata oluştu.')
      setLoading(false)
      return
    }

    setSuccess(true)
    setFullName('')
    setUsername('')
    setPassword('')
    setRole('satis')
    setLoading(false)
    router.refresh()
  }

  const inputClass =
    'mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold text-gray-700">Yeni Personel Ekle</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">Ad Soyad</label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className={inputClass}
              placeholder="Ahmet Yılmaz"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Kullanıcı Adı</label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) =>
                setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))
              }
              className={inputClass}
              placeholder="ahmet_yilmaz"
              autoCapitalize="none"
              autoCorrect="off"
            />
            <p className="mt-1 text-xs text-gray-400">Küçük harf, rakam ve _ kullanılabilir.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Şifre</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
              placeholder="En az 6 karakter"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Rol</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as 'satis' | 'admin')}
              className={inputClass}
            >
              <option value="satis">Satışçı</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-500">Şirket Kodu (Otomatik)</label>
            <input
              type="text"
              value={companyCode || 'Belirtilmemiş'}
              disabled
              className="mt-1 block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-mono text-gray-500"
            />
            {!companyCode && (
              <p className="mt-1 text-xs text-amber-600">
                Personel eklemek için önce Şirket Ayarları&apos;ndan bir şirket kodu belirleyin.
              </p>
            )}
            {companyCode && (
              <p className="mt-1 text-xs text-gray-400">
                Personel bu kod ile giriş yapar.
              </p>
            )}
          </div>
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
        )}
        {success && (
          <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
            Personel başarıyla oluşturuldu.
          </p>
        )}

        <button
          type="submit"
          disabled={loading || !companyCode}
          className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
        >
          {loading ? 'Oluşturuluyor...' : 'Personel Ekle'}
        </button>
      </form>
    </div>
  )
}
