-- v15: בדיקת מערכת למנהל (מתי כל אחת נכנסה, התראות, אחסון)
-- טבלה נפרדת בלי הרשאות קריאה: רק דרך הפונקציות שלמטה (הבנות והאורחים לא רואים מתי מישהי הייתה מחוברת)
alter table public.profiles drop column if exists last_seen_at;
alter table public.profiles drop column if exists last_seen_device;
create table if not exists public.user_seen (
  user_id uuid primary key references public.profiles on delete cascade,
  seen_at timestamptz not null default now(),
  device text
);
alter table public.user_seen enable row level security;

-- כל משתמשת מעדכנת רק את עצמה, ורק את שני השדות האלה
create or replace function public.touch_seen(device text default null) returns void
language sql security definer set search_path = public as $$
  insert into user_seen (user_id, seen_at, device) select auth.uid(), now(), left(device, 60)
  where exists (select 1 from profiles where id = auth.uid())
  on conflict (user_id) do update set seen_at = excluded.seen_at, device = excluded.device $$;
revoke all on function public.touch_seen(text) from public, anon;
grant execute on function public.touch_seen(text) to authenticated;

-- רק למנהל: מצב כל המשתמשות + ניצול אחסון ומסד נתונים
create or replace function public.admin_system_status() returns jsonb
language plpgsql stable security definer set search_path = public, storage as $$
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  return jsonb_build_object(
    'users', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', p.id, 'last_seen_at', u.seen_at, 'device', u.device,
        'push', (select count(*) from push_subscriptions s where s.user_id = p.id),
        'push_last', (select max(created_at) from push_subscriptions s where s.user_id = p.id)
      ) order by p.display_name), '[]'::jsonb) from profiles p left join user_seen u on u.user_id = p.id),
    'storage', (select coalesce(jsonb_object_agg(bucket_id, jsonb_build_object('bytes', b, 'files', n)), '{}'::jsonb)
      from (select bucket_id, sum(coalesce((metadata->>'size')::bigint, 0)) b, count(*) n from storage.objects group by bucket_id) x),
    'db_bytes', pg_database_size(current_database())
  );
end $$;
revoke all on function public.admin_system_status() from public, anon;
grant execute on function public.admin_system_status() to authenticated;
