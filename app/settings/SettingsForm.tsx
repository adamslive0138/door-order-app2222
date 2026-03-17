'use client'

import { useState } from 'react'
import { createClient } from '@/src/lib/supabase/client'

interface Props {
  companyId: string
  initialCompany: { name: string | null; phone: string | null; email: string | null }
  initialProfile: { full_name: string | null }
  userEmail: string
}

export default function SettingsForm({ companyId, initialCompany, initialProfile, userEmail }: Props) {
  const [company, setCompany] = useState({
    name: initialCompany.name ?? '',
    phone: initialCompany.phone ?? '',
    email: initialCompany.email ?? '',
  })
  const [fullName, setFullName] = useState(initialProfile.full_name ?? '')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)

    const supabase = createClient()

    const [companyResult, profileResult] = await Promise.all([
      supabase
        .from('companies')
        .update({ name: company.name, phone: company.phone, email: company.email })
        .eq('id', companyId),
      supabase
        .from('profiles')
        .update({ full_name: fullName })
        .eq('company_id', companyId),
    ])

    if (companyResult.error || profileResult.error) {
      setError(companyResult.error?.message ?? profileResult.error?.message ?? 'Bir hata oluştu.')
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
  }

  const inputClass =
    'mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <fieldset className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <legend className="mb-4 text-sm font-semibold text-gray-700">Şirket Bilgileri</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700">Şirket Adı</label>
            <input
              type="text"
              value={company.name}
              onChange={(e) => setCompany((p) => ({ ...p, name: e.target.value }))}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Şirket Telefonu</label>
            <input
              type="text"
              value={company.phone}
              onChange={(e) => setCompany((p) => ({ ...p, phone: e.target.value }))}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Şirket E-postası</label>
            <input
              type="email"
              value={company.email}
              onChange={(e) => setCompany((p) => ({ ...p, email: e.target.value }))}
              className={inputClass}
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <legend className="mb-4 text-sm font-semibold text-gray-700">Yetkili Bilgileri</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">Ad Soyad</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Giriş E-postası</label>
            <input
              type="email"
              value={userEmail}
              disabled
              className="mt-1 block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500"
            />
            <p className="mt-1 text-xs text-gray-400">Giriş e-postası değiştirilemez.</p>
          </div>
        </div>
      </fieldset>

      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
      )}
      {success && (
        <p className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
          Değişiklikler kaydedildi.
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
      >
        {loading ? 'Kaydediliyor...' : 'Kaydet'}
      </button>
    </form>
  )
}
