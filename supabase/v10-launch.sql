-- =====================================================================
--  ההשקה: עד המועד, אורחים צריכים סיסמה (משתמש אורח), אחרי - פתוח לכולם
-- =====================================================================
insert into public.settings values ('launch_at', '"2026-11-24T20:00:00+02:00"'::jsonb) on conflict (key) do nothing;

create or replace function public.launched() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select now() >= (value #>> '{}')::timestamptz from settings where key = 'launch_at' and value <> 'null'::jsonb), true) $$;

-- משתמש האורח לא מקבל פרופיל (הוא לא מטייל ולא מנהל)
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare s text := split_part(new.email, '@', 1);
begin
  if s = 'guest' then return new; end if;
  insert into public.profiles (id, slug, display_name, color, is_admin, is_traveler)
  values (
    new.id, s,
    case s when 'admin' then 'מנהל' else s end,
    case s when 't1' then '#d9467a' when 't2' then '#2f7fd6'
           when 't3' then '#e08a00' when 't4' then '#7a4fd6' else '#5b6470' end,
    s = 'admin', s <> 'admin')
  on conflict (id) do nothing;
  return new;
end $$;

-- מה שגלוי לאורחים: רק אחרי ההשקה, או עם סיסמת אורח (מחובר)
do $$
declare t text;
begin
  foreach t in array array['events','places','stories','location_updates','status_updates'] loop
    execute format('drop policy if exists anyone_read on public.%I', t);
    execute format('create policy anyone_read on public.%I for select using (public.launched() or auth.uid() is not null)', t);
  end loop;
end $$;

drop policy if exists photos_read on public.photos;
create policy photos_read on public.photos for select
  using (public.is_member() or (is_public and (public.launched() or auth.uid() is not null)));

drop policy if exists photos_obj_read on storage.objects;
create policy photos_obj_read on storage.objects for select
  using (bucket_id = 'photos' and (public.is_member()
    or ((public.launched() or auth.uid() is not null) and exists (select 1 from public.photos p where p.path = objects.name and p.is_public))));
drop policy if exists home_photos_read on storage.objects;
create policy home_photos_read on storage.objects for select
  using (bucket_id = 'photos' and name like 'home/%' and (public.launched() or auth.uid() is not null));
