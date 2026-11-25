-- v16: דיווח תקלות, התראה למנהל על תקלה, בדיקה שבועית, ניתוק מכשירים מרחוק

-- ---------- תקלות ודיווחים ----------
create table if not exists public.app_errors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid default auth.uid() references public.profiles on delete set null,
  created_at timestamptz not null default now(),
  kind text not null default 'auto' check (kind in ('auto', 'report')),
  message text not null check (length(message) <= 2000),
  details jsonb,
  resolved boolean not null default false
);
alter table public.app_errors enable row level security;
drop policy if exists errors_insert on public.app_errors;
create policy errors_insert on public.app_errors for insert to authenticated
  with check (user_id is null or user_id = auth.uid());
drop policy if exists errors_admin on public.app_errors;
create policy errors_admin on public.app_errors for select using (public.is_admin());
drop policy if exists errors_admin_upd on public.app_errors;
create policy errors_admin_upd on public.app_errors for update using (public.is_admin()) with check (public.is_admin());
drop policy if exists errors_admin_del on public.app_errors;
create policy errors_admin_del on public.app_errors for delete using (public.is_admin());

-- בלי הצפה: אותה תקלה אוטומטית מאותה משתמשת פעם בשעה, ועד 20 ביום
create or replace function public.app_errors_throttle() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- אורח עם סיסמה (guest) אינו בטבלת הפרופילים: נשמר בלי שם
  NEW.user_id := (select id from profiles where id = auth.uid());
  if NEW.kind = 'auto' then
    if exists (select 1 from app_errors where user_id is not distinct from NEW.user_id and kind = 'auto'
               and message = NEW.message and created_at > now() - interval '1 hour') then return null; end if;
    if (select count(*) from app_errors where user_id is not distinct from NEW.user_id and kind = 'auto'
        and created_at > now() - interval '1 day') >= 20 then return null; end if;
  end if;
  return NEW;
end $$;
drop trigger if exists app_errors_throttle on public.app_errors;
create trigger app_errors_throttle before insert on public.app_errors for each row execute function public.app_errors_throttle();
drop trigger if exists notify_app_error on public.app_errors;
create trigger notify_app_error after insert on public.app_errors for each row execute function public.notify_event();

-- ---------- ניתוק מכשירים מרחוק ----------
create table if not exists public.device_revocations (
  user_id uuid primary key references public.profiles on delete cascade,
  revoked_at timestamptz not null default now()
);
alter table public.device_revocations enable row level security;
drop policy if exists revoc_read on public.device_revocations;
create policy revoc_read on public.device_revocations for select using (user_id = auth.uid() or public.is_admin());

create or replace function public.admin_revoke(target uuid) returns timestamptz
language plpgsql security definer set search_path = public, auth as $$
declare t timestamptz := now();
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  insert into public.device_revocations (user_id, revoked_at) values (target, t)
    on conflict (user_id) do update set revoked_at = excluded.revoked_at;
  -- מבטל את כל החיבורים: מכשיר שנגנב לא יכול לחדש את הכניסה
  delete from auth.sessions where user_id = target;
  return t;
end $$;
revoke all on function public.admin_revoke(uuid) from public, anon;
grant execute on function public.admin_revoke(uuid) to authenticated;

-- ---------- בדיקה שבועית ----------
-- רק לפונקציה בשרת (service_role). מחזיר את כל מה שצריך לבדוק.
create or replace function public.health_report() returns jsonb
language sql stable security definer set search_path = public, storage, cron, net as $$
  select jsonb_build_object(
    'no_push', (select coalesce(jsonb_agg(p.display_name), '[]'::jsonb) from profiles p
                where p.is_traveler and not exists (select 1 from push_subscriptions s where s.user_id = p.id)),
    'not_seen', (select coalesce(jsonb_agg(jsonb_build_object('name', p.display_name, 'at', u.seen_at)), '[]'::jsonb)
                 from profiles p left join user_seen u on u.user_id = p.id
                 where p.is_traveler and (u.seen_at is null or u.seen_at < now() - interval '3 days')),
    'storage_bytes', (select coalesce(sum((metadata->>'size')::bigint), 0) from storage.objects),
    'db_bytes', pg_database_size(current_database()),
    'cron_failed', (select count(*) from cron.job_run_details where status = 'failed' and start_time > now() - interval '7 days'),
    'cron_failed_jobs', (select coalesce(jsonb_agg(distinct j.jobname), '[]'::jsonb) from cron.job_run_details d join cron.job j using (jobid)
                         where d.status = 'failed' and d.start_time > now() - interval '7 days'),
    'http_failed', (select count(*) from net._http_response where created > now() - interval '7 days'
                    and (status_code is null or status_code >= 400)),
    'errors_week', (select count(*) from app_errors where created_at > now() - interval '7 days' and kind = 'auto'),
    'reports_open', (select count(*) from app_errors where not resolved and kind = 'report')
  ) $$;
revoke all on function public.health_report() from public, anon, authenticated;
grant execute on function public.health_report() to service_role;

-- כל יום ראשון ב-9:07 בבוקר שעון ישראל (7:07 UTC בחורף)
select cron.unschedule('weekly-check') where exists (select 1 from cron.job where jobname = 'weekly-check');
select cron.schedule('weekly-check', '7 7 * * 0', $$
  select net.http_post(
    url := 'https://mwcbuicwdksyhjjyscil.supabase.co/functions/v1/weekly-check',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name='journal_cron_secret')),
    body := '{}'::jsonb
  );
$$);
