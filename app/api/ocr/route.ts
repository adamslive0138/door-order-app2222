import { NextRequest, NextResponse } from 'next/server'

const PROMPTS = {
  cari: `Bu görüntü bir firma kaşesi veya firma bilgisi belgesidir. Aşağıdaki bilgileri JSON formatında çıkar:
{
  "firma_adi": "firma adı veya null",
  "telefon": "telefon numarası veya null",
  "vergi_no": "vergi numarası (sadece rakamlar) veya null",
  "vergi_dairesi": "vergi dairesi adı veya null",
  "adres": "adres veya null",
  "sehir": "şehir adı veya null"
}
Sadece JSON döndür, başka açıklama ekleme.`,

  dekont: `Bu görüntü bir ödeme dekontu, makbuz veya banka transferidir. Aşağıdaki bilgileri JSON formatında çıkar:
{
  "isim": "gönderen veya alıcı kişi/firma adı veya null",
  "tutar": "sayısal tutar (sadece rakam ve ondalık ayırıcı, örn: 1500.00) veya null",
  "tarih": "tarih YYYY-MM-DD formatında veya null",
  "aciklama": "açıklama, not veya referans kodu veya null"
}
Sadece JSON döndür, başka açıklama ekleme.`,

  document: `Bu görüntü bir fatura, dekont veya ticari belgedir. Aşağıdaki bilgileri JSON formatında çıkar:
{
  "firma_adi": "fatura kesilen veya kesen firma adı veya null",
  "vergi_no": "vergi numarası (sadece rakamlar) veya null",
  "telefon": "belgedeki telefon numarası (firma veya iletişim telefonu) veya null",
  "tutar": "toplam tutar (sadece rakam ve ondalık, örn: 1500.00) veya null",
  "tarih": "belge tarihi YYYY-MM-DD formatında veya null",
  "belge_tipi": "fatura veya dekont veya diger",
  "islem_tipi": "alis veya satis veya null",
  "keywords_found": ["belgede geçen anahtar kelimeler — sadece şu listeden seç: fatura, tahsilat, banka, makbuz, irsaliye, eft, havale, kdv, toplam, fatura_no"],
  "confidence": {
    "firma_adi": "high veya medium veya low",
    "vergi_no": "high veya medium veya low",
    "telefon": "high veya medium veya low",
    "tutar": "high veya medium veya low",
    "tarih": "high veya medium veya low",
    "belge_tipi": "high veya medium veya low",
    "islem_tipi": "high veya medium veya low"
  }
}

Güven seviyesi kuralları:
- high: belgede net ve açıkça görünüyor, hata ihtimali yok
- medium: görünüyor ancak kısmi okunabilir veya formatı belirsiz
- low: tahmin edildi, okunamadı veya belgede bulunamadı (null döndürülen alanlar için de low yaz)

Belge tipi kuralları:
- belge_tipi: fatura numarası/invoice/KDV içeriyorsa 'fatura', banka/EFT/havale dekontu veya makbuzsa 'dekont', diğer durumlarda 'diger'
- islem_tipi: alış/satın alma faturasıysa 'alis', satış faturasıysa 'satis', belirlenemiyorsa null

Sadece JSON döndür, başka açıklama ekleme.`,
}

export async function POST(req: NextRequest) {
  const { imageBase64, mimeType, type } = await req.json()

  if (!imageBase64 || !mimeType) {
    return NextResponse.json({ error: 'Görsel verisi eksik' }, { status: 400 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'OCR servisi yapılandırılmamış (ANTHROPIC_API_KEY eksik)' },
      { status: 503 }
    )
  }

  const prompt = PROMPTS[(type as keyof typeof PROMPTS) ?? 'cari'] ?? PROMPTS.cari

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mimeType, data: imageBase64 },
            },
            { type: 'text', text: prompt },
          ],
        },
      ],
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    return NextResponse.json({ error: `OCR API hatası: ${err}` }, { status: 500 })
  }

  const data = await response.json()
  const text: string = data.content?.[0]?.text ?? ''

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('JSON bulunamadı')
    const parsed = JSON.parse(jsonMatch[0])
    return NextResponse.json({ data: parsed })
  } catch {
    return NextResponse.json({ error: 'Metin çıkarılamadı', raw: text }, { status: 422 })
  }
}
