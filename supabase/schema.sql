-- =====================================================================
--  אתר הטיול — מבנה מסד הנתונים ב-Supabase
--  להריץ פעם אחת: Supabase > SQL Editor > New query > להדביק > Run
--  אפשר להריץ שוב בלי נזק (הסקריפט מדלג על מה שכבר קיים).
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- משתמשות ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  slug text unique not null,
  display_name text not null,
  color text not null default '#0f766e',
  is_admin boolean not null default false,
  is_traveler boolean not null default true,
  initial_budget_usd numeric not null default 0
);

-- כשנוצר משתמש חדש (Authentication > Add user) נוצר לו פרופיל אוטומטית לפי האימייל
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare s text := split_part(new.email, '@', 1);
begin
  insert into public.profiles (id, slug, display_name, color, is_admin, is_traveler)
  values (
    new.id, s,
    case s when 'admin' then 'מנהל' else s end,  -- השם המלא מתעדכן אחר כך בטבלת profiles
    case s when 't1' then '#d9467a' when 't2' then '#2f7fd6'
           when 't3' then '#e08a00' when 't4' then '#7a4fd6' else '#5b6470' end,
    s = 'admin', s <> 'admin')
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- הגדרות כלליות ----------
create table if not exists public.settings (key text primary key, value jsonb not null);
insert into public.settings values
  ('capsule_open', 'false'::jsonb)
on conflict do nothing;

create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid()) $$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and is_admin) $$;

create or replace function public.capsule_is_open() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select (value)::boolean from settings where key = 'capsule_open'), false) $$;

-- ---------- טבלאות ----------
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  starts_at timestamptz not null,
  created_by uuid default auth.uid() references public.profiles on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  description text not null,
  amount_usd numeric not null check (amount_usd >= 0),
  orig_amount numeric not null,
  orig_currency text not null default 'USD' check (orig_currency in ('USD','ILS')),
  paid_by uuid not null references public.profiles on delete cascade,
  split_among uuid[] not null,
  category text not null default 'אחר',
  spent_on date not null default current_date,
  created_by uuid default auth.uid() references public.profiles on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.transfers (
  id uuid primary key default gen_random_uuid(),
  from_id uuid not null references public.profiles on delete cascade,
  to_id uuid not null references public.profiles on delete cascade,
  amount_usd numeric not null check (amount_usd > 0),
  created_by uuid default auth.uid() references public.profiles on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  qty text,
  done boolean not null default false,
  week_of date not null,
  created_by uuid default auth.uid() references public.profiles on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.wishes (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  place text,
  done boolean not null default false,
  done_at timestamptz,
  created_by uuid default auth.uid() references public.profiles on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references public.profiles on delete cascade,
  name text not null,
  path text not null unique,
  mime text,
  size bigint,
  created_at timestamptz not null default now()
);

create table if not exists public.capsule_entries (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  created_by uuid not null default auth.uid() references public.profiles on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.places (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  lat double precision not null,
  lng double precision not null,
  visited_on date,
  created_by uuid default auth.uid() references public.profiles on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places on delete cascade,
  content text not null,
  created_by uuid default auth.uid() references public.profiles on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  place_id uuid references public.places on delete set null,
  path text not null unique,
  caption text,
  is_public boolean not null default false,
  created_by uuid default auth.uid() references public.profiles on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.gear_items (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  category text not null default 'שונות',
  created_by uuid default auth.uid() references public.profiles on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.gear_checks (
  item_id uuid not null references public.gear_items on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles on delete cascade,
  primary key (item_id, user_id)
);

create table if not exists public.destination_tips (
  id uuid primary key default gen_random_uuid(),
  destination text not null,
  content text not null,
  created_by uuid default auth.uid() references public.profiles on delete set null,
  created_at timestamptz not null default now()
);

-- כמה מכתבים יש בקפסולה (בלי לחשוף את התוכן)
create or replace function public.capsule_count() returns integer
language sql stable security definer set search_path = public as $$
  select count(*)::int from capsule_entries $$;

-- כמה מכתבים אני כתבתי (בלי לחשוף את התוכן)
create or replace function public.my_capsule_count() returns integer
language sql stable security definer set search_path = public as $$
  select count(*)::int from capsule_entries where created_by = auth.uid() $$;

-- למנהל בלבד: מי כתבה ומתי, בלי התוכן
create or replace function public.capsule_meta()
returns table (created_by uuid, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select c.created_by, c.created_at from capsule_entries c
  where public.is_admin()
  order by c.created_at $$;
revoke execute on function public.capsule_meta() from anon;

-- ---------- הרשאות (Row Level Security) ----------
do $$
declare t text;
begin
  foreach t in array array['profiles','settings','events','expenses','transfers','shopping_items',
    'wishes','documents','capsule_entries','places','stories','photos','gear_items','gear_checks','destination_tips']
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;

  -- טבלאות פרטיות: רק המטיילות והמנהל
  foreach t in array array['expenses','transfers','shopping_items','wishes','gear_items','gear_checks','destination_tips','documents']
  loop
    execute format('drop policy if exists members_all on public.%I', t);
    execute format('create policy members_all on public.%I for all using (public.is_member()) with check (public.is_member())', t);
  end loop;

  -- טבלאות שגם אורחים רואים (קריאה בלבד)
  foreach t in array array['events','places','stories']
  loop
    execute format('drop policy if exists anyone_read on public.%I', t);
    execute format('create policy anyone_read on public.%I for select using (true)', t);
    execute format('drop policy if exists members_write on public.%I', t);
    execute format('create policy members_write on public.%I for all using (public.is_member()) with check (public.is_member())', t);
  end loop;
end $$;

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select using (true);
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update using (id = auth.uid() or public.is_admin());

drop policy if exists settings_read on public.settings;
create policy settings_read on public.settings for select using (true);
drop policy if exists settings_admin on public.settings;
create policy settings_admin on public.settings for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists photos_read on public.photos;
create policy photos_read on public.photos for select using (is_public or public.is_member());
drop policy if exists photos_write on public.photos;
create policy photos_write on public.photos for all using (public.is_member()) with check (public.is_member());

-- קפסולת הזמן: אחרי שנכתב, אף אחד לא יכול לקרוא, לערוך או למחוק (גם לא הכותבת)
-- עד שהמנהל פותח את הקפסולה. אז כולן רואות הכול.
drop policy if exists capsule_read on public.capsule_entries;
create policy capsule_read on public.capsule_entries for select
  using (public.capsule_is_open() and public.is_member());
drop policy if exists capsule_insert on public.capsule_entries;
create policy capsule_insert on public.capsule_entries for insert
  with check (created_by = auth.uid() and public.is_member() and not public.capsule_is_open());
drop policy if exists capsule_delete on public.capsule_entries;

-- ---------- אחסון קבצים ----------
insert into storage.buckets (id, name, public) values
  ('documents', 'documents', false),
  ('photos', 'photos', false),
  ('brand', 'brand', true)  -- הלוגו והאייקונים, גלויים לכולם
on conflict (id) do nothing;

drop policy if exists docs_read on storage.objects;
create policy docs_read on storage.objects for select
  using (bucket_id = 'documents' and public.is_member());
drop policy if exists docs_insert on storage.objects;
create policy docs_insert on storage.objects for insert
  with check (bucket_id = 'documents' and public.is_member() and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists docs_delete on storage.objects;
create policy docs_delete on storage.objects for delete
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists photos_obj_read on storage.objects;
create policy photos_obj_read on storage.objects for select
  using (bucket_id = 'photos' and (public.is_member()
    or exists (select 1 from public.photos p where p.path = objects.name and p.is_public)));
-- תמונות דף הבית (תיקיית home) גלויות לכולם, גם לאורחים
drop policy if exists home_photos_read on storage.objects;
create policy home_photos_read on storage.objects for select
  using (bucket_id = 'photos' and name like 'home/%');
drop policy if exists photos_obj_insert on storage.objects;
create policy photos_obj_insert on storage.objects for insert
  with check (bucket_id = 'photos' and public.is_member());
drop policy if exists photos_obj_delete on storage.objects;
create policy photos_obj_delete on storage.objects for delete
  using (bucket_id = 'photos' and public.is_member());

-- ---------- עדכונים בזמן אמת ----------
do $$
declare t text;
begin
  foreach t in array array['events','expenses','transfers','shopping_items','wishes','documents',
    'places','stories','photos','gear_items','gear_checks','destination_tips','settings','profiles']
  loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- ---------- נתוני פתיחה ----------
insert into public.events (title, starts_at)
select 'טיסה ראשונה', '2026-12-22 00:00:00+02'
where not exists (select 1 from public.events);

insert into public.gear_items (text, category)
select * from (values
  ('דרכון בתוקף לפחות 6 חודשים', 'מסמכים'),
  ('צילום דרכון (גם בתיקיית המסמכים באתר)', 'מסמכים'),
  ('ביטוח נסיעות כולל ספורט אתגרי', 'מסמכים'),
  ('פנקס חיסונים בינלאומי (קדחת צהובה)', 'מסמכים'),
  ('רישיון נהיגה בינלאומי', 'מסמכים'),
  ('כרטיס אשראי + כרטיס גיבוי', 'כסף'),
  ('דולרים במזומן, שטרות חדשים ונקיים', 'כסף'),
  ('תיק גב גדול', 'ציוד'),
  ('תיק יום קטן', 'ציוד'),
  ('מנעול קטן לתיק ולוקר', 'ציוד'),
  ('פנס ראש', 'ציוד'),
  ('בקבוק מים / מסנן מים', 'ציוד'),
  ('שק שינה', 'ציוד'),
  ('מעיל גשם', 'ביגוד'),
  ('מעיל חם / פליז (לגובה ולפטגוניה)', 'ביגוד'),
  ('נעלי הליכה', 'ביגוד'),
  ('כפכפים', 'ביגוד'),
  ('בגד ים', 'ביגוד'),
  ('כובע ומשקפי שמש', 'ביגוד'),
  ('מטען + מתאם חשמל אוניברסלי', 'אלקטרוניקה'),
  ('סוללה ניידת', 'אלקטרוניקה'),
  ('כרטיס SIM / eSIM', 'אלקטרוניקה'),
  ('ערכת עזרה ראשונה', 'בריאות'),
  ('קרם הגנה', 'בריאות'),
  ('דוחה יתושים', 'בריאות'),
  ('תרופות קבועות + מרשמים', 'בריאות'),
  ('ייעוץ במרפאת מטיילים (גם לגבי מחלת גבהים)', 'בריאות')
) v(text, category)
where not exists (select 1 from public.gear_items);
