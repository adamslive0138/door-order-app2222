'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/src/lib/supabase/client'

interface Props {
  userId: string
  companyId: string
  initialCompany: { name: string | null; phone: string | null; email: string | null; code: string | null; logo_url: string | null }
  initialProfile: { full_name: string | null }
  userEmail: string
}

export default function SettingsForm({ userId, companyId, initialCompany, initialProfile }: Props) {
  const router = useRouter()
  const [company, setCompany] = useState({
    name:  initialCompany.name  ?? '',
    phone: initialCompany.phone ?? '',
    email: initialCompany.email ?? '',
    code:  initialCompany.code  ?? '',
  })
  const [fullName, setFullName] = useState(initialProfile.full_name ?? '')
  const [loading, setLoading]   = useState(false)
  const [success, setSuccess]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [logoFile, setLogoFile]       = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [hasLogo, setHasLogo]         = useState(!!initialCompany.logo_url)
  const [currentLogoPath, setCurrentLogoPath] = useState(initialCompany.logo_url)
  const [logoRemoving, setLogoRemoving] = useState(false)

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)

    const supabase = createClient()

    const normalizedCode = company.code.trim().toLowerCase().replace(/[^a-z0-9]/g, '') || null

    // Upload logo if a new file was selected
    let logoPath = initialCompany.logo_url
    if (logoFile) {
      const fileExt = logoFile.name.split('.').pop()
      const filePath = `${companyId}/${Date.now()}.${fileExt}`
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('company-logos')
        .upload(filePath, logoFile, { upsert: true })
      if (uploadError || !uploadData) {
        setError(`Logo yüklenemedi: ${uploadError?.message ?? 'Bilinmeyen hata'}`)
        setLoading(false)
        return
      }
      logoPath = uploadData.path
      console.log('LOGO PATH SAVED:', uploadData.path)
      setCurrentLogoPath(uploadData.path)
      setHasLogo(true)
      setLogoFile(null)
    }

    const [companyResult, profileResult] = await Promise.all([
      supabase
        .from('companies')
        .update({ name: company.name, phone: company.phone, email: company.email, code: normalizedCode, logo_url: logoPath })
        .eq('id', companyId),
      supabase
        .from('profiles')
        .update({ full_name: fullName })
        .eq('id', userId),
    ])

    if (companyResult.error || profileResult.error) {
      const msg = companyResult.error?.message ?? profileResult.error?.message ?? 'Bir hata oluştu.'
      // Unique constraint violation on code
      if (msg.includes('companies_code_unique') || msg.includes('unique')) {
        setError('Bu şirket kodu başka bir şirket tarafından kullanılıyor. Farklı bir kod deneyin.')
      } else {
        setError(msg)
      }
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
  }

  async function handleRemoveLogo() {
    if (!currentLogoPath) return
    setLogoRemoving(true)
    const supabase = createClient()
    await supabase.storage.from('company-logos').remove([currentLogoPath])
    const { error: dbError } = await supabase
      .from('companies')
      .update({ logo_url: null })
      .eq('id', companyId)
    if (dbError) {
      setError(`Logo kaldırılamadı: ${dbError.message}`)
      setLogoRemoving(false)
      return
    }
    setCurrentLogoPath(null)
    setHasLogo(false)
    setLogoPreview(null)
    setLogoFile(null)
    setSuccess(true)
    setLogoRemoving(false)
    router.refresh()
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
          <div>
            <label className="block text-sm font-medium text-gray-700">Şirket Kodu</label>
            <input
              type="text"
              value={company.code}
              onChange={(e) =>
                setCompany((p) => ({
                  ...p,
                  code: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''),
                }))
              }
              className={inputClass}
              placeholder="abc123"
              autoCapitalize="none"
              autoCorrect="off"
              maxLength={20}
            />
            <p className="mt-1 text-xs text-gray-400">
              Personel giriş ekranında bu kodu kullanır. Küçük harf ve rakam.
            </p>
          </div>
        </div>
      </fieldset>

      <fieldset className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <legend className="mb-4 text-sm font-semibold text-gray-700">Şirket Logosu</legend>
        <div className="space-y-3">
          {(logoPreview || hasLogo) && (
            <div className="space-y-2">
              <div>
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo önizleme" className="h-14 rounded border border-gray-200 object-contain" />
                ) : (
                  <div className="flex h-14 items-center rounded border border-gray-200 bg-gray-50 px-3 text-xs text-gray-500">
                    Mevcut logo yüklü
                  </div>
                )}
              </div>
              {!logoPreview && hasLogo && (
                <button
                  type="button"
                  onClick={handleRemoveLogo}
                  disabled={logoRemoving}
                  className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-60"
                >
                  {logoRemoving ? 'Kaldırılıyor...' : 'Logoyu Kaldır'}
                </button>
              )}
            </div>
          )}
          <input
            type="file"
            accept="image/*"
            onChange={e => {
              const file = e.target.files?.[0] ?? null
              setLogoFile(file)
              setLogoPreview(file ? URL.createObjectURL(file) : null)
            }}
            className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-200"
          />
          <p className="text-xs text-gray-400">PNG veya JPG önerilir. PDF tekliflerde header&apos;da gösterilir.</p>
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
