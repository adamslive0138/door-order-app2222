import { redirect } from 'next/navigation'
import { createClient } from '@/src/lib/supabase/server'
import { createAdminClient } from '@/src/lib/supabase/admin'
import AppShell from '@/app/components/AppShell'
import ApprovalList from './ApprovalList'

function fmt(n: number) {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(n)
}

export default async function PaymentApprovalsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id, role')
    .eq('id', user.id)
    .single()

  if (!profile?.company_id) redirect('/login')
  if (profile.role !== 'admin') redirect('/dashboard')

  // Use admin client to bypass RLS — user is already verified as admin above
  const admin = createAdminClient()
  const { data: rows, error: rowsError } = await admin
    .from('payment_approvals')
    .select(`*, cariler (id, name)`)
    .eq('company_id', profile.company_id)
    .order('created_at', { ascending: false })

  console.log('PAYMENT APPROVALS:', rows, 'ERROR:', rowsError)

  const approvals = (rows ?? []) as any[]

  // Generate signed URLs for receipts
  const withUrls = await Promise.all(
    approvals.map(async (a) => {
      if (!a.receipt_path) return { ...a, receipt_url: null }
      try {
        const { data } = await admin.storage
          .from('receipts')
          .createSignedUrl(a.receipt_path, 60 * 60)
        return { ...a, receipt_url: data?.signedUrl ?? null }
      } catch {
        return { ...a, receipt_url: null }
      }
    })
  )

  const pending  = withUrls.filter(a => a.status === 'pending')
  const resolved = withUrls.filter(a => a.status !== 'pending')

  const totalPending = pending.reduce((s: number, a: any) => s + Number(a.amount), 0)

  return (
    <AppShell userEmail={user.email ?? ''}>
      <div className="px-4 py-6 sm:px-6">

        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">Onay Bekleyen Tahsilatlar</h1>
          <p className="mt-0.5 text-sm text-gray-500">Satışçıların girdiği tahsilatları onayla veya reddet</p>
        </div>

        {/* KPI */}
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">Onay Bekleyen</p>
            <p className="mt-1 text-2xl font-bold text-amber-700">{fmt(totalPending)}</p>
            <p className="mt-0.5 text-xs text-amber-500">{pending.length} adet</p>
          </div>
          <div className="rounded-xl border border-green-200 bg-green-50 p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-green-600">Onaylanan</p>
            <p className="mt-1 text-2xl font-bold text-green-700">
              {fmt(resolved.filter((a: any) => a.status === 'approved').reduce((s: number, a: any) => s + Number(a.amount), 0))}
            </p>
            <p className="mt-0.5 text-xs text-green-500">
              {resolved.filter((a: any) => a.status === 'approved').length} adet
            </p>
          </div>
          <div className="rounded-xl border border-red-200 bg-red-50 p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-red-500">Reddedilen</p>
            <p className="mt-1 text-2xl font-bold text-red-600">
              {fmt(resolved.filter((a: any) => a.status === 'rejected').reduce((s: number, a: any) => s + Number(a.amount), 0))}
            </p>
            <p className="mt-0.5 text-xs text-red-400">
              {resolved.filter((a: any) => a.status === 'rejected').length} adet
            </p>
          </div>
        </div>

        <ApprovalList pending={pending} resolved={resolved} />
      </div>
    </AppShell>
  )
}
