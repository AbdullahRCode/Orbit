-- Applied live 2026-08-17: portal, documents, storage, admin auth wiring, plus advisor lint fixes.
alter table public.leads
  add column portal_token text unique,
  add column intake_profile jsonb not null default '{}'::jsonb,
  add column country text;

create table public.document_requirements (
  id uuid primary key default gen_random_uuid(),
  service text not null, code text not null, label text not null,
  description text, required boolean not null default true, sort int not null default 0,
  unique (service, code)
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  requirement_code text, file_name text not null, storage_path text not null unique,
  mime_type text, size_bytes bigint not null default 0,
  status text not null default 'received' check (status in ('received','reviewed','rejected')),
  uploaded_at timestamptz not null default now()
);
create index documents_lead on public.documents(lead_id, uploaded_at desc);

alter table public.document_requirements enable row level security;
alter table public.documents enable row level security;
create policy doc_reqs_read_all on public.document_requirements for select using (true);
create policy documents_org_rw on public.documents for all
  using (org_id = private.user_org_id()) with check (org_id = private.user_org_id());

create table public.allowed_admins (
  email text primary key, org_slug text not null, role text not null default 'owner'
);
alter table public.allowed_admins enable row level security;
create policy allowed_admins_no_client_access on public.allowed_admins for select using (false);
insert into public.allowed_admins (email, org_slug, role)
  values ('abdullah@logorhythmx.com', 'orbit-hq', 'owner');

create or replace function private.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_org uuid; v_role text;
begin
  select o.id, a.role into v_org, v_role
  from allowed_admins a join organizations o on o.slug = a.org_slug
  where lower(a.email) = lower(new.email);
  if v_org is not null then
    insert into public.users (id, org_id, role, email)
    values (new.id, v_org, v_role, new.email) on conflict (id) do nothing;
  end if;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_auth_user();

create or replace function private.touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('client-docs', 'client-docs', false, 10485760,
  array['application/pdf','image/jpeg','image/png','image/heic','image/webp',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do nothing;

create policy client_docs_org_read on storage.objects for select
  using (bucket_id = 'client-docs' and (storage.foldername(name))[1] in
    (select o.id::text from organizations o where o.id = private.user_org_id()));

-- checklist seeds: see live database for full rows (7 services, typical IRCC document lists)
