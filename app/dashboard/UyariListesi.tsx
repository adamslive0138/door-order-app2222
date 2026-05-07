'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { PendingCari, EksikBelge, SevkteSiparis, YaklasanCek } from './OperasyonPanel'

// ── Types ─────────────────────────────────────────────────────────────────────

type Severity = 'kritik' | 'dikkat' | 'bilgi'
type Filter   = 'tümü' | Severity

interface Uyari {
  key: string
  severity: Severity
  text: string
  href?: string
}

interface Props {
  pendingCariler: PendingCari[]
  eksikBelgeler: EksikBelge[]
  sevkteSiparisler: SevkteSiparis[]
  yaklasanCekler: YaklasanCek[]
}

// ── Thresholds ────────────────────────────────────────────────────────────────

const HIGH_BAKIYE    = 10_000   // ₺10k → dikkat; below → bilgi
const URGENT_CEK_DAYS = 7      // due within 7 days → dikkat; 7-30 → bilgi

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(n)

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('tr-TR', {
    day: '2-digit', month: 'short',
  })
}

// ── Alert builder ─────────────────────────────────────────────────────────────

function buildUyariler(
  pendingCariler: PendingCari[],
  eksikBelgeler: EksikBelge[],
  sevkteSiparisler: SevkteSiparis[],
  yaklasanCekler: YaklasanCek[],
): Uyari[] {
  const list: Uyari[] = []

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const in7 = new Date(today)
  in7.setDate(in7.getDate() + URGENT_CEK_DAYS)

  // ── Çekler ──────────────────────────────────────────────────────────────────
  for (const c of yaklasanCekler) {
    const dueDate = new Date(c.due_date + 'T00:00:00')
    const cariLabel = c.source_cari_name ?? (c.check_no ? `#${c.check_no}` : 'Çek')
    if (c.overdue) {
      list.push({
        key:      `cek-overdue-${c.id}`,
        severity: 'kritik',
        text:     `${cariLabel} çekinin vadesi geçti (${fmtDate(c.due_date)} · ${fmt(c.amount)})`,
        href:     `/checks/${c.id}`,
      })
    } else if (dueDate <= in7) {
      list.push({
        key:      `cek-urgent-${c.id}`,
        severity: 'dikkat',
        text:     `${cariLabel} çekinin vadesi ${fmtDate(c.due_date)} — ${fmt(c.amount)}`,
        href:     `/checks/${c.id}`,
      })
    } else {
      list.push({
        key:      `cek-info-${c.id}`,
        severity: 'bilgi',
        text:     `${cariLabel} çekinin vadesi ${fmtDate(c.due_date)} (${fmt(c.amount)})`,
        href:     `/checks/${c.id}`,
      })
    }
  }

  // ── Eksik belgeler ──────────────────────────────────────────────────────────
  for (const b of eksikBelgeler) {
    const label = b.extracted_name ?? b.file_type
    const nedenMap = {
      her_ikisi: 'cari ve tutar eksik',
      cari:      'cari bağlantısı eksik',
      tutar:     'tutar bilgisi eksik',
    }
    list.push({
      key:      `belge-${b.id}`,
      severity: b.eksik_neden === 'her_ikisi' ? 'kritik' : 'dikkat',
      text:     `"${label}" belgesinde ${nedenMap[b.eksik_neden]}`,
      href:     '/documents',
    })
  }

  // ── Tahsilat bekleyen cariler ────────────────────────────────────────────────
  for (const c of pendingCariler) {
    list.push({
      key:      `cari-${c.id}`,
      severity: c.bakiye >= HIGH_BAKIYE ? 'dikkat' : 'bilgi',
      text:     `${c.name} carisinde ${fmt(c.bakiye)} açık alacak`,
      href:     `/cari/${c.id}`,
    })
  }

  // ── Sevkte siparişler ────────────────────────────────────────────────────────
  for (const s of sevkteSiparisler) {
    list.push({
      key:      `sevkte-${s.id}`,
      severity: 'bilgi',
      text:     `${s.customer_name} siparişi sevkte bekliyor`,
      href:     `/orders/${s.id}`,
    })
  }

  // Sort: kritik first, then dikkat, then bilgi
  const rank: Record<Severity, number> = { kritik: 0, dikkat: 1, bilgi: 2 }
  list.sort((a, b) => rank[a.severity] - rank[b.severity])

  return list
}

// ── Severity config ───────────────────────────────────────────────────────────

const SEVERITY_CONFIG: Record<Severity, {
  label: string
  dot: string
  row: string
  badge: string
}> = {
  kritik: {
    label: 'Kritik',
    dot:   'bg-red-500',
    row:   'border-l-2 border-red-400 bg-red-50/60',
    badge: 'bg-red-100 text-red-700',
  },
  dikkat: {
    label: 'Dikkat',
    dot:   'bg-amber-400',
    row:   'border-l-2 border-amber-300 bg-amber-50/60',
    badge: 'bg-amber-100 text-amber-700',
  },
  bilgi: {
    label: 'Bilgi',
    dot:   'bg-blue-400',
    row:   'border-l-2 border-blue-200 bg-blue-50/40',
    badge: 'bg-blue-50 text-blue-600',
  },
}

// ── Filter button config ──────────────────────────────────────────────────────

const FILTER_CONFIG: Record<Filter, { label: string; active: string; dot?: string }> = {
  tümü:   { label: 'Tümü',   active: 'bg-gray-800 text-white' },
  kritik: { label: 'Kritik', active: 'bg-red-600 text-white',   dot: 'bg-red-500' },
  dikkat: { label: 'Dikkat', active: 'bg-amber-500 text-white', dot: 'bg-amber-400' },
  bilgi:  { label: 'Bilgi',  active: 'bg-blue-600 text-white',  dot: 'bg-blue-400' },
}

const FILTER_ORDER: Filter[] = ['tümü', 'kritik', 'dikkat', 'bilgi']

// ── Component ─────────────────────────────────────────────────────────────────

export default function UyariListesi({
  pendingCariler,
  eksikBelgeler,
  sevkteSiparisler,
  yaklasanCekler,
}: Props) {
  const [filter,    setFilter]    = useState<Filter>('tümü')
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  function dismiss(key: string) {
    setDismissed(prev => new Set(prev).add(key))
  }

  const uyariler = buildUyariler(
    pendingCariler,
    eksikBelgeler,
    sevkteSiparisler,
    yaklasanCekler,
  )

  if (uyariler.length === 0) return null

  // counts per severity (always from full list, not filtered)
  const counts: Record<Filter, number> = {
    tümü:   uyariler.length,
    kritik: uyariler.filter(u => u.severity === 'kritik').length,
    dikkat: uyariler.filter(u => u.severity === 'dikkat').length,
    bilgi:  uyariler.filter(u => u.severity === 'bilgi').length,
  }

  const visible = (filter === 'tümü' ? uyariler : uyariler.filter(u => u.severity === filter))
    .filter(u => !dismissed.has(u.key))

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <span className="text-sm font-semibold text-gray-800">Uyarılar</span>
        </div>

        {/* Filter buttons */}
        <div className="flex items-center gap-1.5">
          {FILTER_ORDER.map(f => {
            const cfg  = FILTER_CONFIG[f]
            const isActive = filter === f
            const count = counts[f]
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                disabled={count === 0 && f !== 'tümü'}
                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-default disabled:opacity-30 ${
                  isActive
                    ? cfg.active
                    : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {cfg.dot && !isActive && (
                  <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                )}
                {cfg.label}
                <span className={`rounded-full px-1 text-xs ${
                  isActive ? 'bg-white/20 text-inherit' : 'bg-gray-100 text-gray-500'
                }`}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* List */}
      <ul className="divide-y divide-gray-50">
        {visible.length === 0 ? (
          <li className="px-4 py-8 text-center text-xs text-gray-400">
            Bu kategoride uyarı yok.
          </li>
        ) : (
          visible.map(u => {
            const cfg = SEVERITY_CONFIG[u.severity]
            const inner = (
              <div className={`flex items-center gap-3 px-4 py-2.5 transition-colors ${cfg.row} ${u.href ? 'hover:brightness-95' : ''}`}>
                <span className={`h-2 w-2 shrink-0 rounded-full ${cfg.dot}`} />
                <span className="min-w-0 flex-1 text-sm text-gray-700">{u.text}</span>
                <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-xs font-medium ${cfg.badge}`}>
                  {cfg.label}
                </span>
              </div>
            )
            return (
              <li key={u.key} className="group flex items-stretch">
                <div className="min-w-0 flex-1">
                  {u.href ? (
                    <Link href={u.href} className="block">
                      {inner}
                    </Link>
                  ) : (
                    inner
                  )}
                </div>
                <button
                  onClick={() => dismiss(u.key)}
                  title="Gizle"
                  className="shrink-0 border-l border-gray-100 px-3 text-gray-300 opacity-0 transition-opacity hover:bg-gray-50 hover:text-gray-500 group-hover:opacity-100"
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </button>
              </li>
            )
          })
        )}
      </ul>
    </div>
  )
}
