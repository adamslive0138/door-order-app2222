import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/src/lib/supabase/admin'

export async function POST(req: Request) {
  try {
    // ── Parse body ──────────────────────────────────────────────────────────
    let body: { company_name?: string }
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 })
    }

    const { company_name } = body
    if (!company_name?.trim()) {
      return NextResponse.json({ error: 'Şirket adı zorunludur.' }, { status: 400 })
    }

    // ── Auth check (anon key, cookie-aware) ─────────────────────────────────
    const cookieStore = await cookies()

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (list) =>
            list.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            ),
        },
      }
    )

    const { data: authData, error: authError } = await supabase.auth.getUser()

    if (authError) {
      console.error('[onboarding] auth.getUser error:', authError.message)
      return NextResponse.json({ error: 'Oturum doğrulanamadı.' }, { status: 401 })
    }

    const user = authData?.user
    if (!user) {
      return NextResponse.json({ error: 'Oturum bulunamadı.' }, { status: 401 })
    }

    console.log('[onboarding] user:', user.id, '| company_name:', company_name.trim())

    // ── Admin client (service role, bypasses RLS) ────────────────────────────
    let admin: ReturnType<typeof createAdminClient>
    try {
      admin = createAdminClient()
    } catch (e: any) {
      console.error('[onboarding] createAdminClient failed:', e?.message)
      return NextResponse.json(
        { error: 'Sunucu yapılandırma hatası.' },
        { status: 500 }
      )
    }

    // ── Idempotency: profile already has company → nothing to do ─────────────
    const { data: existing, error: existingErr } = await admin
      .from('profiles')
      .select('company_id')
      .eq('id', user.id)
      .maybeSingle()   // returns null (not an error) when no row exists

    if (existingErr) {
      console.error('[onboarding] profiles select error:', existingErr.message)
      // Non-fatal — continue; worst case we create a duplicate company
    }

    if (existing?.company_id) {
      console.log('[onboarding] already onboarded, skipping:', user.id)
      return NextResponse.json({ ok: true })
    }

    // ── Create company ───────────────────────────────────────────────────────
    const { data: company, error: companyError } = await admin
      .from('companies')
      .insert({ name: company_name.trim() })
      .select('id')
      .single()

    if (companyError || !company) {
      console.error('[onboarding] companies insert failed:', companyError?.message, companyError?.details, companyError?.hint)
      return NextResponse.json(
        { error: 'Şirket oluşturulamadı: ' + (companyError?.message ?? 'bilinmeyen hata') },
        { status: 500 }
      )
    }

    console.log('[onboarding] company created:', company.id)

    // ── Upsert profile: insert if missing, update company_id if row exists ───
    const { error: profileError } = await admin
      .from('profiles')
      .upsert(
        { id: user.id, company_id: company.id },
        { onConflict: 'id' }
      )

    if (profileError) {
      console.error('[onboarding] profiles upsert failed:', profileError.message, profileError.details, profileError.hint)
      // Rollback: delete the company we just created
      const { error: rollbackErr } = await admin
        .from('companies')
        .delete()
        .eq('id', company.id)
      if (rollbackErr) {
        console.error('[onboarding] rollback failed (orphan company):', company.id, rollbackErr.message)
      }
      return NextResponse.json(
        { error: 'Profil güncellenemedi: ' + profileError.message },
        { status: 500 }
      )
    }

    console.log('[onboarding] profile upserted for user:', user.id, '→ company:', company.id)

    return NextResponse.json({ ok: true })

  } catch (err: any) {
    // Catch-all for any unexpected JS exception so we always return JSON
    console.error('[onboarding] unhandled exception:', err?.message ?? err)
    return NextResponse.json(
      { error: 'Beklenmedik bir hata oluştu.' },
      { status: 500 }
    )
  }
}
