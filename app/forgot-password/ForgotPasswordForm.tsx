'use client'

import { useState } from 'react'

export default function ForgotPasswordForm() {
  const [companyCode, setCompanyCode] = useState('')
  const [username, setUsername]       = useState('')
  const [error, setError]             = useState<string | null>(null)
  const [success, setSuccess]         = useState(false)
  const [loading, setLoading]         = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_code: companyCode.trim(),
        username:     username.trim(),
      }),
    })

    const json = await res.json().catch(() => ({}))

    if (!res.ok || json.error) {
      setError(json.error ?? 'İstek gönderilemedi.')
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(59,130,246,0.25),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgba(99,102,241,0.18),transparent_60%)]" />
      <div className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-blue-600/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 h-[28rem] w-[28rem] rounded-full bg-indigo-500/20 blur-3xl" />

      <div className="relative mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4 py-10">
        <div className="w-full rounded-2xl border border-white/10 bg-white p-6 shadow-2xl shadow-black/40 sm:p-8">
          <div className="mb-6 text-center">
            <h2 className="text-2xl font-bold text-slate-900">Şifremi Unuttum</h2>
            <p className="mt-1 text-sm text-slate-500">
              Hesabınıza tanımlı e-posta adresine sıfırlama bağlantısı gönderelim.
            </p>
          </div>

          {success ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-800">
                Eğer girdiğiniz bilgiler doğruysa, hesabınıza tanımlı e-posta adresine sıfırlama bağlantısı gönderildi.
                Lütfen gelen kutunuzu kontrol edin.
              </div>
              <a
                href="/login"
                className="inline-flex w-full items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Giriş ekranına dön
              </a>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="company_code" className="block text-sm font-medium text-slate-700">
                  Şirket Kodu
                </label>
                <input
                  id="company_code"
                  type="text"
                  required
                  value={companyCode}
                  onChange={(e) => setCompanyCode(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  placeholder="ABC123"
                  autoCapitalize="none"
                  autoCorrect="off"
                />
              </div>

              <div>
                <label htmlFor="username" className="block text-sm font-medium text-slate-700">
                  Kullanıcı Adı
                </label>
                <input
                  id="username"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  placeholder="kullanici_adi"
                  autoCapitalize="none"
                  autoCorrect="off"
                />
              </div>

              {error && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:from-blue-700 hover:to-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? 'Gönderiliyor...' : 'Sıfırlama Bağlantısı Gönder'}
              </button>

              <a
                href="/login"
                className="block text-center text-xs font-medium text-slate-500 hover:text-slate-700 hover:underline"
              >
                Giriş ekranına dön
              </a>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
