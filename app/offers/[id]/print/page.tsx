import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/src/lib/supabase/server'
import type { Offer } from '@/src/types'
import { DOOR_TYPE_LABELS } from '@/src/types'
import PrintTrigger from './PrintTrigger'

const fmt = (n: number) =>
  new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(n)

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })

export default async function OfferPrintPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id')
    .eq('id', user.id)
    .single()

  const companyId = profile?.company_id
  if (!companyId) redirect('/onboarding')

  const [{ data }, { data: companyData }] = await Promise.all([
    supabase
      .from('offers')
      .select('*')
      .eq('id', id)
      .eq('company_id', companyId)
      .single(),
    supabase
      .from('companies')
      .select('name, phone, address')
      .eq('id', companyId)
      .single(),
  ])

  if (!data) notFound()

  const offer: Offer = data as Offer
  const company = companyData ?? null

  return (
    <>
      <PrintTrigger />

      <style>{`
        @media print {
          @page { size: A4; margin: 18mm 15mm; }
          body  { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        body { font-family: 'Segoe UI', Arial, sans-serif; background: #f8fafc; }
      `}</style>

      <div className="mx-auto max-w-[780px] bg-white shadow-xl print:shadow-none min-h-screen">

        {/* Header band */}
        <div style={{ background: '#1e40af' }} className="px-10 py-7 text-white">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-2xl font-bold tracking-tight">
                {company?.name ?? 'Şirket Adı'}
              </p>
              {company?.phone && (
                <p className="mt-0.5 text-blue-200 text-sm">{company.phone}</p>
              )}
              {company?.address && (
                <p className="mt-0.5 text-blue-200 text-sm">{company.address}</p>
              )}
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold uppercase tracking-widest text-blue-200">Teklif</p>
              <p className="mt-1 text-lg font-bold">{fmtDate(offer.created_at)}</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-10 py-8 space-y-8">

          {/* Customer + offer info */}
          <div className="grid grid-cols-2 gap-6">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Müşteri</p>
              <p className="font-semibold text-gray-900 text-base">{offer.customer_name}</p>
              {offer.customer_city    && <p className="text-sm text-gray-500 mt-0.5">{offer.customer_city}</p>}
              {offer.customer_phone   && <p className="text-sm text-gray-500 mt-0.5">{offer.customer_phone}</p>}
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Teklif Bilgileri</p>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Tarih</span>
                  <span className="font-medium text-gray-800">{fmtDate(offer.created_at)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Product image */}
          {offer.image_url && (
            <div className="flex justify-center">
              <img
                src={offer.image_url}
                alt="Ürün görseli"
                className="max-h-48 rounded-lg object-contain border border-gray-200"
              />
            </div>
          )}

          {/* Product table */}
          <div>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr style={{ background: '#1e40af' }} className="text-white">
                  <th className="px-4 py-3 text-left font-semibold rounded-tl-lg text-xs">#</th>
                  <th className="px-4 py-3 text-left font-semibold text-xs">Ürün / Açıklama</th>
                  <th className="px-4 py-3 text-left font-semibold text-xs">Ölçüler</th>
                  <th className="px-3 py-3 text-center font-semibold text-xs">Adet</th>
                  <th className="px-4 py-3 text-right font-semibold text-xs">Birim Fiyat</th>
                  <th className="px-4 py-3 text-right font-semibold rounded-tr-lg text-xs">Toplam</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-100">
                  <td className="px-4 py-3 text-gray-400 text-xs">1</td>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {offer.door_type ? DOOR_TYPE_LABELS[offer.door_type] : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{offer.dimensions ?? '—'}</td>
                  <td className="px-3 py-3 text-center text-gray-700">{offer.quantity}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{fmt(offer.unit_price)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">{fmt(offer.total_price)}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={5} className="px-4 py-3.5 text-right font-semibold text-gray-700 text-sm">
                    Genel Toplam (KDV Hariç)
                  </td>
                  <td className="px-4 py-3.5 text-right font-bold text-gray-900 text-base border-t-2 border-blue-800">
                    {fmt(offer.total_price)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Offer text */}
          {offer.offer_text && (
            <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600 mb-1.5">Teklif Açıklaması</p>
              <p className="text-sm text-gray-700 whitespace-pre-line">{offer.offer_text}</p>
            </div>
          )}

          {/* Notes */}
          {offer.notes && (
            <div className="rounded-lg border border-amber-100 bg-amber-50 p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600 mb-1.5">Notlar</p>
              <p className="text-sm text-gray-700 whitespace-pre-line">{offer.notes}</p>
            </div>
          )}

          {/* Signature block */}
          <div className="grid grid-cols-2 gap-10 pt-4">
            <div>
              <div className="border-b border-gray-300 pb-8 mb-2" />
              <p className="text-xs text-gray-400 text-center">Müşteri İmzası / Kaşesi</p>
            </div>
            <div>
              <div className="border-b border-gray-300 pb-8 mb-2" />
              <p className="text-xs text-gray-400 text-center">Yetkili İmza / Kaşe</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 px-10 py-4">
          <p className="text-xs text-gray-400 text-center">
            Bu teklif 30 gün geçerlidir.
            {company?.name ? ` · ${company.name}` : ''}
          </p>
        </div>
      </div>
    </>
  )
}
