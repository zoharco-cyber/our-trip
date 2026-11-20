-- ערכת עיצוב לכל משתמשת. רק המנהל יכול לשנות.
alter table public.profiles add column if not exists theme text not null default 'pink'
  check (theme in ('pink','red','purple','midnight'));

create or replace function public.guard_theme() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- מטיילת שמעדכנת את הפרופיל שלה (למשל סכום התחלתי) לא יכולה לשנות ערכה
  if auth.uid() is not null and not public.is_admin() then
    NEW.theme := OLD.theme;
  end if;
  return NEW;
end $$;
drop trigger if exists guard_theme on public.profiles;
create trigger guard_theme before update on public.profiles for each row execute function public.guard_theme();

update public.profiles set theme = 'pink' where slug = 't1';
update public.profiles set theme = 'purple', color = '#8b3ff2' where slug = 't2';
update public.profiles set theme = 'red', color = '#e0283a' where slug = 't3';
update public.profiles set theme = 'midnight' where slug = 'admin';
