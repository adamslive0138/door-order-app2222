'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/src/lib/supabase/client'

interface Props {
  userEmail: string
  children: React.ReactNode
}

// ── Route → title map ────────────────────────────────────────────────────

function getPageTitle(pathname: string): string {
  const titles: Record<string, string> = {
    '/dashboard':        'Dashboard',
    '/orders':           'Siparişler',
    '/orders/new':       'Yeni Sipariş',
    '/orders/archive':   'Arşiv',
    '/archive':          'Arşiv',
    '/crm/all':          'Tüm Cariler',
    '/crm/customers':    'Müşteriler',
    '/crm/suppliers':    'Tedarikçiler',
    '/cari':             'Cari Takip',
    '/cari/new':         'Yeni Cari',
    '/finance/cari':     'Finans — Cari',
    '/finance/tahsilat': 'Tahsilat',
    '/finance/odeme':    'Ödemeler',
    '/finance/new':                 'Yeni Hareket',
    '/finance/payment-approvals':  'Onay Bekleyen Tahsilatlar',
    '/offers':           'Teklifler',
    '/offers/new':       'Yeni Teklif',
    '/reports/sales':    'Satış Raporu',
    '/reports/cari':     'Cari Raporu',
    '/settings':              'Ayarlar',
    '/dekont/yukle':          'Dekont Yükle',
    '/documents':             'Belgeler & Faturalar',
    '/documents/upload':      'Belge Yükle',
    '/checks':                'Çekler & Senetler',
    '/checks/new':            'Yeni Çek / Senet',
    '/stock':                 'Stok / Modeller',
  }
  if (titles[pathname]) return titles[pathname]
  if (pathname.startsWith('/cari/') && pathname.endsWith('/yeni-hareket')) return 'Yeni Hareket'
  if (pathname.startsWith('/cari/')) return 'Cari Detay'
  if (pathname.startsWith('/orders/') && pathname.endsWith('/edit')) return 'Siparişi Düzenle'
  return 'İŞBAŞI'
}

// ── Active helpers ───────────────────────────────────────────────────────

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + '/')
}

// ── Icon helpers ─────────────────────────────────────────────────────────

function ChevronDown({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
      fill="none" stroke="currentColor" viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  )
}

// ── Sub-items list ───────────────────────────────────────────────────────

function SubItem({ href, label, active, badge }: { href: string; label: string; active: boolean; badge?: number }) {
  return (
    <Link
      href={href}
      className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
        active ? 'bg-white/15 text-white' : 'text-white/50 hover:bg-white/10 hover:text-white'
      }`}
    >
      <span>{label}</span>
      {badge != null && badge > 0 && (
        <span className="ml-1.5 shrink-0 rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
          {badge}
        </span>
      )}
    </Link>
  )
}

function SubList({ open, children }: { open: boolean; children: React.ReactNode }) {
  return (
    <div className={`overflow-hidden transition-all duration-200 ${open ? 'max-h-60 opacity-100' : 'max-h-0 opacity-0'}`}>
      <div className="ml-4 mt-0.5 space-y-0.5 border-l border-white/10 pl-3">
        {children}
      </div>
    </div>
  )
}

// ── Sidebar link styles ──────────────────────────────────────────────────

const BASE = 'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors'
const ACTIVE = 'bg-white/15 text-white'
const INACTIVE = 'text-white/60 hover:bg-white/10 hover:text-white'

// ════════════════════════════════════════════════════════════════════════════
export default function AppShell({ userEmail, children }: Props) {
  const router = useRouter()
  const pathname = usePathname()

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    const client = createClient()
    client.from('profiles').select('company_id, role').limit(1).single()
      .then(({ data }) => {
        const role = data?.role?.toLowerCase().trim() ?? null
        setUserRole(role)
        if (role === 'admin' && data?.company_id) {
          client
            .from('payment_approvals')
            .select('*', { count: 'exact', head: true })
            .eq('company_id', data.company_id)
            .eq('status', 'pending')
            .then(({ count }) => setPendingCount(count ?? 0))
        }
      })
  }, [])

  const inOrders  = pathname === '/dashboard' || pathname.startsWith('/orders')
  const inFinance = pathname.startsWith('/finance') || pathname.startsWith('/checks')
  const inReports = pathname.startsWith('/reports')

  const [exp, setExp] = useState({ orders: inOrders, finance: inFinance, reports: inReports })

  function tog(k: keyof typeof exp) {
    setExp(p => ({ ...p, [k]: !p[k] }))
  }

  useEffect(() => { setSidebarOpen(false) }, [pathname])

  async function logout() {
    await createClient().auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const lnk = (href: string) => `${BASE} ${isActive(pathname, href) ? ACTIVE : INACTIVE}`
  const groupActive = (test: boolean) => `${BASE} w-full justify-between ${test ? ACTIVE : INACTIVE}`

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── SIDEBAR ──────────────────────────────────────────────────────── */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-[#0f172a] shadow-2xl transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-500">
              <svg className="h-4 w-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
              </svg>
            </div>
            <span className="text-[15px] font-bold tracking-tight text-white">İŞBAŞI</span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="rounded-md p-1.5 text-white/40 hover:bg-white/10 hover:text-white lg:hidden"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">

          {/* Dashboard */}
          <Link href="/dashboard" className={lnk('/dashboard')}>
            <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Dashboard
          </Link>

          {/* ── Sipariş ─────────────────────────────────────────────────── */}
          <div className="pt-3">
            <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-white/25">Sipariş</p>
            <button onClick={() => tog('orders')} className={groupActive(inOrders)}>
              <span className="flex items-center gap-3">
                <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                Siparişler
              </span>
              <ChevronDown open={exp.orders} />
            </button>
            <SubList open={exp.orders}>
              <SubItem href="/orders"         label="Tüm Siparişler"  active={isActive(pathname, '/orders') && !pathname.endsWith('/new') && !pathname.endsWith('/archive')} />
              <SubItem href="/orders/new"     label="Yeni Sipariş"    active={pathname === '/orders/new'} />
              <SubItem href="/orders/archive" label="Arşiv"           active={isActive(pathname, '/orders/archive')} />
            </SubList>
          </div>

          {/* ── Finans ──────────────────────────────────────────────────── */}
          <div className="pt-3">
            <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-white/25">Finans</p>
            <button onClick={() => tog('finance')} className={groupActive(inFinance)}>
              <span className="flex items-center gap-3">
                <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Finans
              </span>
              <ChevronDown open={exp.finance} />
            </button>
            <SubList open={exp.finance}>
              <SubItem href="/finance/cari"      label="Cari Bakiye"  active={isActive(pathname, '/finance/cari')} />
              <SubItem href="/checks"            label="Çekler"       active={isActive(pathname, '/checks')} />
              {userRole === 'admin' && (
                <SubItem
                  href="/finance/payment-approvals"
                  label="Onay Bekleyen Tahsilatlar"
                  active={isActive(pathname, '/finance/payment-approvals')}
                  badge={pendingCount > 0 ? pendingCount : undefined}
                />
              )}
            </SubList>
          </div>

          {/* ── Raporlar ────────────────────────────────────────────────── */}
          <div className="pt-3">
            <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-white/25">Raporlar</p>
            <button onClick={() => tog('reports')} className={groupActive(inReports)}>
              <span className="flex items-center gap-3">
                <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Raporlar
              </span>
              <ChevronDown open={exp.reports} />
            </button>
            <SubList open={exp.reports}>
              <SubItem href="/reports/sales" label="Satış Raporu"  active={isActive(pathname, '/reports/sales')} />
              <SubItem href="/reports/cari"  label="Cari Raporu"   active={isActive(pathname, '/reports/cari')} />
            </SubList>
          </div>

          {/* ── Standalone links ─────────────────────────────────────── */}
          <div className="pt-3">
            <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-white/25">Diğer</p>
            <Link href="/stock" className={lnk('/stock')}>
              <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              Stok / Modeller
            </Link>

            <Link href="/documents" className={lnk('/documents')}>
              <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              Belgeler
            </Link>

          </div>
        </nav>

        {/* Bottom */}
        <div className="border-t border-white/10 px-3 pb-4 pt-3 space-y-0.5">
          <Link href="/settings" className={lnk('/settings')}>
            <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Ayarlar
          </Link>
          <button onClick={logout} className={`${BASE} w-full ${INACTIVE}`}>
            <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Çıkış Yap
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT ─────────────────────────────────────────────────── */}
      <div className="flex min-h-screen flex-col lg:ml-64">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-3 shadow-sm">
          <button
            onClick={() => setSidebarOpen(p => !p)}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900 lg:hidden"
            aria-label="Menüyü aç/kapat"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="text-sm font-semibold text-gray-800">{getPageTitle(pathname)}</span>
        </header>

        {/* Content */}
        <div className="flex-1">{children}</div>
      </div>
    </div>
  )
}
