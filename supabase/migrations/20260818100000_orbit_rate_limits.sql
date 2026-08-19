-- Rate limiting for public, unauthenticated endpoints. Applied 2026-08-18.
-- Service role only: no policy grants client access, so it is closed by
-- default RLS. Functions check and record hits themselves via the service
-- role client they already hold.
create table public.rate_limits (
  id uuid primary key default gen_random_uuid(),
  scope text not null,
  bucket_key text not null,
  created_at timestamptz not null default now()
);
create index rate_limits_scope_key_time on public.rate_limits(scope, bucket_key, created_at desc);
alter table public.rate_limits enable row level security;

-- Housekeeping: old rows are cheap to keep, but this keeps the table small.
-- Runs inside the existing digest-sweep cron cadence, no new schedule needed.
create or replace function private.rate_limits_prune()
returns void language sql security definer set search_path = public as $$
  delete from public.rate_limits where created_at < now() - interval '2 days';
$$;
