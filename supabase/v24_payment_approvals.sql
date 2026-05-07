-- ── payment_approvals ───────────────────────────────────────────────────────
-- Satışçının girdiği tahsilatlar, admin onayına kadar burada bekler.
-- Onaylanınca cari_hareketler'e yazılır.

create table if not exists payment_approvals (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references companies(id) on delete cascade,
  owner_id       uuid not null references auth.users(id),

  cari_id        uuid not null references cariler(id) on delete cascade,

  amount         numeric(12,2) not null,
  payment_method text,
  description    text,
  receipt_path   text,

  status         text not null default 'pending'
    check (status in ('pending','approved','rejected')),

  approved_by    uuid references auth.users(id),
  approved_at    timestamptz,

  created_at     timestamptz default now()
);

create index if not exists idx_payment_approvals_company  on payment_approvals(company_id);
create index if not exists idx_payment_approvals_owner    on payment_approvals(owner_id);
create index if not exists idx_payment_approvals_status   on payment_approvals(status);

-- ── RLS ─────────────────────────────────────────────────────────────────────

alter table payment_approvals enable row level security;

-- Admin: şirketindeki tüm kayıtları görür ve günceller
create policy "admin_all" on payment_approvals
  for all
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.company_id = payment_approvals.company_id
        and profiles.role = 'admin'
    )
  );

-- Satis: sadece kendi kayıtlarını görür ve oluşturur
create policy "satis_select_own" on payment_approvals
  for select
  using (owner_id = auth.uid());

create policy "satis_insert_own" on payment_approvals
  for insert
  with check (
    owner_id = auth.uid()
    and exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.company_id = payment_approvals.company_id
    )
  );
