'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function SetupForm() {
  const router = useRouter()

  const [companyName, setCompanyName] = useState('')
  const [companyCode, setCompanyCode] = useState('')
  const [fullName,    setFullName]    = useState('')
  const [username,    setUsername]    = useState('')
  const [password,    setPassword]    = useState('')
  const [error,       setError]       = useState<string | null>(null)
  const [loading,     setLoading]     = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 6) {
      setError('Şifre en az 6 karakter olmalıdır.')
      return
    }

    setLoading(true)

    const res = await fetch('/api/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_name: companyName,
        company_code: companyCode,
        full_name:    fullName,
        username,
        password,
      }),
    })

    const json = await res.json()

    if (!res.ok || json.error) {
      setError(json.error ?? 'Bir hata oluştu.')
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  const inputClass =
    'mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-10">
      <div className="w-full max-w-md">

        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600">
            <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">İŞBAŞI Kurulum</h1>
          <p className="mt-1 text-sm text-gray-500">İlk yönetici hesabını oluşturun</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Company */}
          <fieldset className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <legend className="mb-4 text-sm font-semibold text-gray-700">Şirket Bilgileri</legend>
            <div className="space-y-4">
              <div>
                <label htmlFor="company_name" className="block text-sm font-medium text-gray-700">
                  Şirket Adı
                </label>
                <input
                  id="company_name"
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className={inputClass}
                  placeholder="Örnek Kapı A.Ş."
                />
              </div>
              <div>
                <label htmlFor="company_code" className="block text-sm font-medium text-gray-700">
                  Şirket Kodu
                </label>
                <input
                  id="company_code"
                  type="text"
                  required
                  value={companyCode}
                  onChange={(e) =>
                    setCompanyCode(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))
                  }
                  className={`${inputClass} font-mono`}
                  placeholder="ornekkapı → ornekkapu"
                  autoCapitalize="none"
                  autoCorrect="off"
                  maxLength={20}
                />
                <p className="mt-1 text-xs text-gray-400">
                  Personel bu kodu giriş ekranında kullanır. Küçük harf ve rakam.
                </p>
              </div>
            </div>
          </fieldset>

          {/* Admin account */}
          <fieldset className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <legend className="mb-4 text-sm font-semibold text-gray-700">Yönetici Hesabı</legend>
            <div className="space-y-4">
              <div>
                <label htmlFor="full_name" className="block text-sm font-medium text-gray-700">
                  Ad Soyad
                </label>
                <input
                  id="full_name"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className={inputClass}
                  placeholder="Ahmet Yılmaz"
                />
              </div>
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                  Kullanıcı Adı
                </label>
                <input
                  id="username"
                  type="text"
                  required
                  value={username}
                  onChange={(e) =>
                    setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))
                  }
                  className={`${inputClass} font-mono`}
                  placeholder="ahmet_yilmaz"
                  autoCapitalize="none"
                  autoCorrect="off"
                />
                <p className="mt-1 text-xs text-gray-400">Küçük harf, rakam ve _ kullanılabilir.</p>
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Şifre
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
                  placeholder="En az 6 karakter"
                />
              </div>
            </div>
          </fieldset>

          {error && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
              {error.includes('zaten tamamlanmış') && (
                <a href="/login" className="ml-2 font-semibold underline hover:text-red-800">
                  Giriş yap →
                </a>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? 'Kurulum yapılıyor...' : 'Kurulumu Tamamla ve Giriş Yap'}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-gray-400">
          Kurulum tamamlandıktan sonra bu sayfa devre dışı kalır.
        </p>
      </div>
    </div>
  )
}
