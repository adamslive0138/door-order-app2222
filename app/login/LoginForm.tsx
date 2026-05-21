'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const FEATURES = [
  { title: 'Sipariş Takibi', desc: 'Tüm siparişlerinizi tek panelden takip edin.' },
  { title: 'Cari & Tahsilat Yönetimi', desc: 'Cari hesap ve tahsilatlarınızı kolayca yönetin.' },
  { title: 'Teklif ve PDF Oluşturma', desc: 'Profesyonel teklif ve PDF dokümanları üretin.' },
  { title: 'Üretim Süreç Yönetimi', desc: 'Üretim aşamalarını uçtan uca yönetin.' },
  { title: 'Mobil Uyumlu Kullanım', desc: 'Her cihazdan sorunsuz erişim.' },
]

export default function LoginForm() {
  const router = useRouter()
  const [companyCode, setCompanyCode] = useState('')
  const [username, setUsername]       = useState('')
  const [password, setPassword]       = useState('')
  const [error, setError]             = useState<string | null>(null)
  const [loading, setLoading]         = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_code: companyCode.trim(),
        username:     username.trim(),
        password,
      }),
    })

    const json = await res.json()

    if (!res.ok || json.error) {
      setError(json.error ?? 'Giriş başarısız.')
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950">
      {/* Background gradient + soft shapes */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(59,130,246,0.25),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgba(99,102,241,0.18),transparent_60%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(148,163,184,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.06)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" />
      <div className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-blue-600/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 h-[28rem] w-[28rem] rounded-full bg-indigo-500/20 blur-3xl" />

      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col items-center justify-center gap-12 px-4 py-10 lg:flex-row lg:items-center lg:justify-between lg:gap-16 lg:px-10">
        {/* Left: brand + value proposition */}
        <div className="w-full max-w-xl text-white lg:max-w-2xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-blue-200 backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Yönetim Paneli
          </div>

          <h1 className="text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl lg:text-5xl">
            Operasyon Merkezi
          </h1>
          <p className="mt-4 max-w-lg text-base leading-relaxed text-slate-300 sm:text-lg">
            Tüm sipariş, üretim, cari ve finans süreçlerinizi tek panelden yönetin.
          </p>

          <ul className="mt-8 hidden grid-cols-1 gap-4 sm:grid sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            {FEATURES.map((f) => (
              <li
                key={f.title}
                className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-3 backdrop-blur-sm transition hover:border-white/20 hover:bg-white/10"
              >
                <span className="mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-blue-500/15 text-blue-300">
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <path
                      d="M4 10.5l3.5 3.5L16 5.5"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">{f.title}</p>
                  <p className="mt-0.5 text-xs text-slate-400">{f.desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Right: login card */}
        <div className="w-full max-w-md">
          <div className="rounded-2xl border border-white/10 bg-white p-6 shadow-2xl shadow-black/40 sm:p-8">
            <div className="mb-6 text-center">
              <h2 className="text-2xl font-bold text-slate-900">Operasyon Merkezi</h2>
              <p className="mt-1 text-sm text-slate-500">Hesabınıza güvenli giriş yapın</p>
            </div>

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

              <div>
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                    Şifre
                  </label>
                  <a
                    href="/forgot-password"
                    className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline"
                  >
                    Şifremi unuttum
                  </a>
                </div>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  placeholder="••••••••"
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
                {loading ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                      <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                    </svg>
                    Giriş yapılıyor...
                  </>
                ) : (
                  'Giriş Yap'
                )}
              </button>
            </form>

            <p className="mt-6 text-center text-xs text-slate-500">
              İlk kurulum için{' '}
              <a href="/setup" className="font-medium text-slate-700 underline hover:text-slate-900">
                kurulum sihirbazına gidin
              </a>
            </p>
          </div>

          <p className="mt-4 text-center text-xs text-slate-400">
            © {new Date().getFullYear()} Operasyon Merkezi · Güvenli giriş
          </p>
        </div>
      </div>
    </div>
  )
}
