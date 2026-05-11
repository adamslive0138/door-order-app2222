'use client'

import { useState } from 'react'
import { createClient } from '@/src/lib/supabase/client'

interface Settings {
  id?: string
  company_name?: string | null
  logo_url?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
  tax_office?: string | null
  tax_number?: string | null
  default_kdv?: number | string | null
  footer_note?: string | null
  bank_info?: string | null
}

interface Props {
  companyId: string
  initialSettings: Settings | null
}

export default function CompanySettingsForm({ companyId, initialSettings }: Props) {
  const [form, setForm] = useState({
    company_name: initialSettings?.company_name ?? '',
    phone:        initialSettings?.phone        ?? '',
    email:        initialSettings?.email        ?? '',
    address:      initialSettings?.address      ?? '',
    tax_office:   initialSettings?.tax_office   ?? '',
    tax_number:   initialSettings?.tax_number   ?? '',
    default_kdv:  String(initialSettings?.default_kdv ?? '20'),
    footer_note:  initialSettings?.footer_note  ?? '',
    bank_info:    initialSettings?.bank_info    ?? '',
  })

  const [loading,      setLoading]      = useState(false)
  const [success,      setSuccess]      = useState(false)
  const [error,        setError]        = useState<string | null>(null)
  const [logoFile,     setLogoFile]     = useState<File | null>(null)
  const [logoPreview,  setLogoPreview]  = useState<string | null>(null)
  const [hasLogo,      setHasLogo]      = useState(!!initialSettings?.logo_url)
  const [logoRemoving, setLogoRemoving] = useState(false)

  type Field = keyof typeof form
  const set = (field: Field) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(p => ({ ...p, [field]: e.target.value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
    const supabase = createClient()
    let logoPath = initialSettings?.logo_url ?? null

    if (logoFile) {
      const ext      = logoFile.name.split('.').pop() ?? 'png'
      const filePath = `${companyId}/logo.${ext}`
      const { data: up, error: upErr } = await supabase.storage
        .from('company-logos')
        .upload(filePath, logoFile, { upsert: true, contentType: logoFile.type })
      if (upErr) {
        setError(`Logo yüklenemedi: ${upErr.message}`)
        return
      }
      logoPath = up.path
      setLogoFile(null)
      setHasLogo(true)
    }

    const payload = {
      company_id:  companyId,
      company_name: form.company_name || null,
      logo_url:     logoPath,
      phone:        form.phone       || null,
      email:        form.email       || null,
      address:      form.address     || null,
      tax_office:   form.tax_office  || null,
      tax_number:   form.tax_number  || null,
      default_kdv:  parseFloat(form.default_kdv) || 20,
      footer_note:  form.footer_note || null,
      bank_info:    form.bank_info   || null,
    }

    const { error: upsertErr } = await supabase
      .from('company_settings')
      .upsert(payload, { onConflict: 'company_id' })

    if (upsertErr) {
      setError(upsertErr.message)
      return
    }

    setSuccess(true)
    } catch {
      setError('Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.')
    } finally {
      setLoading(false)
    }
  }

  async function handleRemoveLogo() {
    setLogoRemoving(true)
    const supabase = createClient()
    if (initialSettings?.logo_url) {
      await supabase.storage.from('company-logos').remove([initialSettings.logo_url])
    }
    const { error: dbErr } = await supabase
      .from('company_settings')
      .update({ logo_url: null })
      .eq('company_id', companyId)
    if (dbErr) { setError(dbErr.message); setLogoRemoving(false); return }
    setHasLogo(false)
    setLogoPreview(null)
    setLogoFile(null)
    setSuccess(true)
    setLogoRemoving(false)
  }

  const inp = 'mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'
  const lbl = 'block text-sm font-medium text-gray-700'

  return (
    <form onSubmit={handleSubmit} className="space-y-5">

      {/* ── Company info ── */}
      <fieldset className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <legend className="mb-4 text-sm font-semibold text-gray-700">Şirket Bilgileri</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={lbl}>
              Şirket Adı <span className="text-xs font-normal text-gray-400">— PDF başlığında görünür</span>
            </label>
            <input type="text" value={form.company_name} onChange={set('company_name')} className={inp} />
          </div>
          <div>
            <label className={lbl}>Telefon</label>
            <input type="text" value={form.phone} onChange={set('phone')} className={inp} />
          </div>
          <div>
            <label className={lbl}>E-posta</label>
            <input type="email" value={form.email} onChange={set('email')} className={inp} />
          </div>
          <div className="sm:col-span-2">
            <label className={lbl}>Adres</label>
            <textarea value={form.address} onChange={set('address')} rows={2} className={inp} />
          </div>
        </div>
      </fieldset>

      {/* ── Logo ── */}
      <fieldset className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <legend className="mb-4 text-sm font-semibold text-gray-700">Şirket Logosu</legend>
        <div className="space-y-3">
          {(logoPreview || hasLogo) && (
            <div className="space-y-2">
              {logoPreview
                ? <img src={logoPreview} alt="Logo önizleme" className="h-16 rounded border border-gray-200 object-contain bg-gray-50 px-2" />
                : <div className="flex h-14 items-center rounded border border-gray-200 bg-gray-50 px-3 text-xs text-gray-500">Mevcut logo yüklü</div>
              }
              {!logoPreview && hasLogo && (
                <button
                  type="button"
                  onClick={handleRemoveLogo}
                  disabled={logoRemoving}
                  className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-60"
                >
                  {logoRemoving ? 'Kaldırılıyor…' : 'Logoyu Kaldır'}
                </button>
              )}
            </div>
          )}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={e => {
              const file = e.target.files?.[0] ?? null
              setLogoFile(file)
              setLogoPreview(file ? URL.createObjectURL(file) : null)
            }}
            className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-200"
          />
          <p className="text-xs text-gray-400">PNG veya JPG, maks 3 MB. PDF belgelerinde sağ üstte görünür.</p>
        </div>
      </fieldset>

      {/* ── Tax info ── */}
      <fieldset className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <legend className="mb-4 text-sm font-semibold text-gray-700">Vergi Bilgileri</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={lbl}>Vergi Dairesi</label>
            <input type="text" value={form.tax_office} onChange={set('tax_office')} className={inp} />
          </div>
          <div>
            <label className={lbl}>Vergi Numarası</label>
            <input type="text" value={form.tax_number} onChange={set('tax_number')} className={inp} />
          </div>
        </div>
      </fieldset>

      {/* ── PDF settings ── */}
      <fieldset className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <legend className="mb-4 text-sm font-semibold text-gray-700">PDF & Belge Ayarları</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={lbl}>Varsayılan KDV (%)</label>
            <input
              type="number"
              min={0}
              max={100}
              step={0.01}
              value={form.default_kdv}
              onChange={set('default_kdv')}
              className={inp}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={lbl}>
              PDF Alt Notu <span className="text-xs font-normal text-gray-400">— teklif ve üretim belgelerinde footer satırı</span>
            </label>
            <textarea
              value={form.footer_note}
              onChange={set('footer_note')}
              rows={2}
              className={inp}
              placeholder="örn: Bu teklif 30 gün geçerlidir."
            />
          </div>
          <div className="sm:col-span-2">
            <label className={lbl}>
              Banka Bilgileri <span className="text-xs font-normal text-gray-400">— yalnızca teklif PDF&apos;inde gösterilir</span>
            </label>
            <textarea
              value={form.bank_info}
              onChange={set('bank_info')}
              rows={3}
              className={inp}
              placeholder={'Banka: Ziraat Bankası\nIBAN: TR00 0000 0000 0000 0000 0000 00'}
            />
          </div>
        </div>
      </fieldset>

      {error   && <p className="rounded-lg bg-red-50   px-4 py-3 text-sm text-red-600">{error}</p>}
      {success && <p className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">Ayarlar kaydedildi.</p>}

      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
      >
        {loading ? 'Kaydediliyor…' : 'Kaydet'}
      </button>
    </form>
  )
}
