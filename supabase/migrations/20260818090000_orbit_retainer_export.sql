-- Retainer handoff export. Applied 2026-08-18.
-- Private "exports" bucket holds generated retainer packages (profile PDF plus
-- original documents, zipped). No client-facing read policy is added: packages
-- are only reachable through service-role-issued signed URLs returned by the
-- retainer-export function, so the bucket stays closed by default RLS.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('exports', 'exports', false, 52428800, array['application/zip'])
on conflict (id) do nothing;

-- Per-org webhook target for automated handoff into a case management tool or
-- Zapier. No schema change needed, it lives inside organizations.settings as
-- {"retainer_webhook_url": "https://..."}. Set it with:
-- update organizations set settings = settings || '{"retainer_webhook_url":"https://..."}'::jsonb where slug = 'orbit-hq';
