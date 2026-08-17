-- Applied live 2026-08-17: client accounts, document AI summaries, notification target.
create table public.client_accounts (
  auth_user_id uuid primary key,
  org_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.client_accounts enable row level security;
create policy ca_self_read on public.client_accounts
  for select using (auth_user_id = auth.uid());
create policy leads_client_read on public.leads
  for select using (id in (select lead_id from public.client_accounts where auth_user_id = auth.uid()));
alter table public.documents add column ai_summary text;
update public.organizations
  set settings = settings || '{"notify_email":"abdullah@logorhythmx.com"}'::jsonb
  where slug = 'orbit-hq';
