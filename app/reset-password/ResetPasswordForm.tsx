'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/src/lib/supabase/client'

export default function ResetPasswordForm() {
  const router = useRouter()
  const supabase = createClient()

  const [password, setPassword]   = useState('')
  const [confirm, setConfirm]     = useState('')
  const [error, setError]         = useState<string | null>(null)
  const [success, setSuccess]     = useState(false)
  const [loading, setLoading]     = useState(false)
  const [ready, setReady]         = useState(false)
  const [sessionOk, setSessionOk] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function init() {
      // PKCE flow: ?code=... → exchange for session
      const url = new URL(window.location.href)
      const code = url.searchParams.get('code')
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (!cancelled) {
          if (error) {
            setError('Sıfırlama bağlantısı geçersiz veya süresi dolmuş.')
            setReady(true)
            return
          }
          // Clean the code out of the URL
          url.searchParams.delete('code')
          window.history.replaceState({}, '', url.toString())
        }
      }

      // Implicit flow: #access_token=...&type=recovery
      if (window.location.hash.includes('access_token')) {
        // supabase-js auto-handles the hash on load; just wait for the session.
      }

      const { data } = await supabase.auth.getSession()
      if (cancelled) return
      setSessionOk(!!data.session)
      setReady(true)
    }

    init()
    return () => { cancelled = true }
  }, [supabase])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 6) {
      setError('Şifre en az 6 karakter olmalıdır.')
      return
    }
    if (password !== confirm) {
      setError('Şifreler eşleşmiyor.')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    setSuccess(true)
    // Give the user a moment, then send them to login.
    setTimeout(() => {
      supabase.auth.signOut().finally(() => {
        router.push('/login')
        router.refresh()
      })
    }, 1500)
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(59,130,246,0.25),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgba(99,102,241,0.18),transparent_60%)]" />
      <div className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-blue-600/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 h-[28rem] w-[28rem] rounded-full bg-indigo-500/20 blur-3xl" />

      <div className="relative mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4 py-10">
        <div className="w-full rounded-2xl border border-white/10 bg-white p-6 shadow-2xl shadow-black/40 sm:p-8">
          <div className="mb-6 text-center">
            <h2 className="text-2xl font-bold text-slate-900">Yeni Şifre Belirle</h2>
            <p className="mt-1 text-sm text-slate-500">Hesabınız için yeni bir şifre oluşturun.</p>
          </div>

          {!ready ? (
            <p className="text-center text-sm text-slate-500">Yükleniyor...</p>
          ) : success ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-800">
              Şifreniz güncellendi. Giriş ekranına yönlendiriliyorsunuz...
            </div>
          ) : !sessionOk ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700">
                {error ?? 'Sıfırlama bağlantısı geçersiz veya süresi dolmuş. Lütfen yeniden talep edin.'}
              </div>
              <a
                href="/forgot-password"
                className="inline-flex w-full items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Yeni bağlantı talep et
              </a>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                  Yeni Şifre
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  placeholder="••••••••"
                  minLength={6}
                />
              </div>

              <div>
                <label htmlFor="confirm" className="block text-sm font-medium text-slate-700">
                  Yeni Şifre (Tekrar)
                </label>
                <input
                  id="confirm"
                  type="password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  placeholder="••••••••"
                  minLength={6}
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
                {loading ? 'Kaydediliyor...' : 'Şifreyi Güncelle'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
