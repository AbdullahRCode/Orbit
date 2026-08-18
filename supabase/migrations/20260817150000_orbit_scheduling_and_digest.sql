-- Applied live 2026-08-17: pg_cron plus pg_net scheduling, digest tracking.
create extension if not exists pg_cron;
create extension if not exists pg_net;

alter table public.documents add column digested boolean not null default false;
alter table public.leads add column notified_at timestamptz;

-- internal secret storage, private schema is not exposed through the API
create table private.app_secrets (key text primary key, value text not null);
-- value inserted live, matches ORBIT_WEBHOOK_SECRET edge secret; not committed to source control

create or replace function private.call_edge(fn text, body jsonb)
returns void language plpgsql security definer set search_path = public, private, extensions as $$
declare s text;
begin
  select value into s from private.app_secrets where key = 'webhook';
  perform net.http_post(
    url := 'https://hpaxoxnwffzxginnbpgy.supabase.co/functions/v1/' || fn,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-orbit-secret', coalesce(s, '')),
    body := body
  );
end $$;

select cron.schedule('orbit-digest-sweep', '*/10 * * * *',
  $$select private.call_edge('digest-sweep', '{}'::jsonb)$$);
select cron.schedule('orbit-daily-briefing', '0 15 * * *',
  $$select private.call_edge('daily-briefing', '{}'::jsonb)$$);
