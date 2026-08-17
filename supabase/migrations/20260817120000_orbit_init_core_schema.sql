-- Orbit core schema v1. Applied to hpaxoxnwffzxginnbpgy on 2026-08-17 via MCP.
create extension if not exists pgcrypto;
create schema if not exists private;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  timezone text not null default 'America/Vancouver',
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.users (
  id uuid primary key,
  org_id uuid not null references public.organizations(id) on delete cascade,
  role text not null default 'staff' check (role in ('owner','admin','consultant','staff')),
  full_name text,
  email text,
  created_at timestamptz not null default now()
);

create or replace function private.user_org_id()
returns uuid language sql stable security definer set search_path = public
as $$ select org_id from public.users where id = auth.uid() $$;

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  source text not null default 'website' check (source in ('website','instagram','email','whatsapp','referral','other')),
  external_id text,
  full_name text, email text, phone text,
  service_interest text, goal text, timeline text, current_status text, location text,
  score int not null default 0 check (score between 0 and 100),
  temperature text not null default 'cold' check (temperature in ('hot','warm','cold')),
  stage text not null default 'new' check (stage in ('new','qualifying','qualified','booked','consulted','retained','lost','not_a_lead')),
  human_needed boolean not null default false,
  estimated_value numeric,
  consent jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index leads_org_source_external on public.leads(org_id, source, external_id) where external_id is not null;
create index leads_org_stage on public.leads(org_id, stage);
create index leads_org_created on public.leads(org_id, created_at desc);

create table public.lead_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index lead_events_lead on public.lead_events(lead_id, created_at desc);

create table public.communications (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete cascade,
  channel text not null check (channel in ('website','instagram','email','whatsapp','other')),
  direction text not null check (direction in ('inbound','outbound')),
  body text not null,
  status text not null default 'received' check (status in ('received','draft','pending_approval','approved','sent','rejected','failed')),
  claimed_at timestamptz,
  approved_by uuid, approved_at timestamptz, sent_at timestamptz,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index communications_lead on public.communications(lead_id, created_at desc);
create index communications_org_status on public.communications(org_id, status);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  starts_at timestamptz, ends_at timestamptz,
  status text not null default 'scheduled' check (status in ('scheduled','completed','no_show','cancelled')),
  booking_source text,
  created_at timestamptz not null default now()
);
create index appointments_org_time on public.appointments(org_id, starts_at);

create table public.approvals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  subject_type text not null, subject_id uuid,
  level int not null check (level in (2,3)),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  requested_by text not null, summary text,
  decided_by uuid, decided_at timestamptz, reason text,
  created_at timestamptz not null default now()
);
create index approvals_org_status on public.approvals(org_id, status);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  actor_type text not null check (actor_type in ('agent','user','system')),
  actor text not null, action text not null,
  subject_type text, subject_id uuid,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_org_created on public.audit_logs(org_id, created_at desc);

create table public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  agent text not null, trigger text not null,
  status text not null default 'running' check (status in ('running','succeeded','failed')),
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  error text, tokens int, cost numeric,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create index agent_runs_org on public.agent_runs(org_id, started_at desc);

create table public.knowledge_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  category text not null check (category in ('official_source','firm_knowledge','business_data','public_research','ai_generated')),
  title text not null, content text, source_url text, publisher text,
  confidence text check (confidence in ('high','medium','low')),
  verified_at timestamptz, expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.briefings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  briefing_date date not null,
  body text not null,
  stats jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (org_id, briefing_date)
);

create or replace function private.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger leads_touch before update on public.leads
  for each row execute function private.touch_updated_at();

alter table public.organizations enable row level security;
alter table public.users enable row level security;
alter table public.leads enable row level security;
alter table public.lead_events enable row level security;
alter table public.communications enable row level security;
alter table public.appointments enable row level security;
alter table public.approvals enable row level security;
alter table public.audit_logs enable row level security;
alter table public.agent_runs enable row level security;
alter table public.knowledge_items enable row level security;
alter table public.briefings enable row level security;

create policy org_read on public.organizations for select using (id = private.user_org_id());
create policy users_self_org on public.users for select using (org_id = private.user_org_id());
create policy leads_rw on public.leads for all using (org_id = private.user_org_id()) with check (org_id = private.user_org_id());
create policy lead_events_rw on public.lead_events for all using (org_id = private.user_org_id()) with check (org_id = private.user_org_id());
create policy comms_rw on public.communications for all using (org_id = private.user_org_id()) with check (org_id = private.user_org_id());
create policy appts_rw on public.appointments for all using (org_id = private.user_org_id()) with check (org_id = private.user_org_id());
create policy approvals_rw on public.approvals for all using (org_id = private.user_org_id()) with check (org_id = private.user_org_id());
create policy audit_read on public.audit_logs for select using (org_id = private.user_org_id());
create policy agent_runs_read on public.agent_runs for select using (org_id = private.user_org_id());
create policy knowledge_read on public.knowledge_items for select using (org_id is null or org_id = private.user_org_id());
create policy briefings_read on public.briefings for select using (org_id = private.user_org_id());

insert into public.organizations (slug, name) values ('orbit-hq', 'Orbit HQ');
