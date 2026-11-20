-- =====================================================================
--  תוספות: מיקום נוכחי, יומן, הזמנות, אנשי קשר לחירום, אתגרים, מטבעות מקומיים
-- =====================================================================

-- הוצאה אפשר להזין בכל מטבע (קוד של 3 אותיות)
alter table public.expenses drop constraint if exists expenses_orig_currency_check;
alter table public.expenses add constraint expenses_orig_currency_check check (orig_currency ~ '^[A-Z]{3}$');

-- "איפה אנחנו עכשיו" (גלוי גם לאורחים)
create table if not exists public.location_updates (
  id uuid primary key default gen_random_uuid(),
  name text,
  lat double precision not null,
  lng double precision not null,
  created_by uuid default auth.uid() references public.profiles on delete set null,
  created_at timestamptz not null default now()
);

-- יומן מסע: משפט ומצב רוח ליום, לכל אחת
create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  day date not null default current_date,
  content text not null,
  mood text,
  photo_path text,
  created_by uuid not null default auth.uid() references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  unique (day, created_by)
);

-- כרטיסים והזמנות
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'אחר',
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  ref_code text,
  notes text,
  created_by uuid default auth.uid() references public.profiles on delete set null,
  created_at timestamptz not null default now()
);

-- אנשי קשר לחירום (ביטוח, שגרירות, משפחה)
create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  phone text not null,
  note text,
  created_by uuid default auth.uid() references public.profiles on delete set null,
  created_at timestamptz not null default now()
);

-- האתגרים של זוהר: המנהל כותב, המטיילות מסמנות שביצעו
create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  details text,
  points int not null default 10 check (points > 0),
  created_at timestamptz not null default now()
);
create table if not exists public.challenge_done (
  challenge_id uuid not null references public.challenges on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles on delete cascade,
  note text,
  created_at timestamptz not null default now(),
  primary key (challenge_id, user_id)
);

do $$
declare t text;
begin
  foreach t in array array['location_updates','journal_entries','bookings','contacts','challenges','challenge_done']
  loop execute format('alter table public.%I enable row level security', t); end loop;
  foreach t in array array['journal_entries','bookings','contacts']
  loop
    execute format('drop policy if exists members_all on public.%I', t);
    execute format('create policy members_all on public.%I for all using (public.is_member()) with check (public.is_member())', t);
  end loop;
end $$;

drop policy if exists anyone_read on public.location_updates;
create policy anyone_read on public.location_updates for select using (true);
drop policy if exists members_write on public.location_updates;
create policy members_write on public.location_updates for all using (public.is_member()) with check (public.is_member());

drop policy if exists members_read on public.challenges;
create policy members_read on public.challenges for select using (public.is_member());
drop policy if exists admin_write on public.challenges;
create policy admin_write on public.challenges for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists members_read on public.challenge_done;
create policy members_read on public.challenge_done for select using (public.is_member());
drop policy if exists own_write on public.challenge_done;
create policy own_write on public.challenge_done for insert with check (user_id = auth.uid() and public.is_member());
drop policy if exists own_delete on public.challenge_done;
create policy own_delete on public.challenge_done for delete using (user_id = auth.uid() or public.is_admin());

do $$
declare t text;
begin
  foreach t in array array['location_updates','journal_entries','bookings','contacts','challenges','challenge_done']
  loop
    begin execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null; end;
  end loop;
end $$;

insert into public.challenges (title, details, points)
select * from (values
  ('סלפי עם לאמה', 'הלאמה חייבת להיות בפריים. גם אלפקה נחשבת.', 10),
  ('לרקוד טנגו ברחוב בבואנוס איירס', 'לפחות 30 שניות, עם מישהו מקומי.', 30),
  ('לאכול גיני פיג (קוי)', 'בפרו. חתיכה אחת מספיקה.', 40),
  ('לשכנע מקומי ללמד אותך מילה בקצ׳ואה', 'ולזכור אותה עד סוף היום.', 20),
  ('תמונה מתחת לסלאר עם פרספקטיבה מצחיקה', 'דינוזאור, בקבוק ענק, מה שבא.', 20),
  ('להתמקח בשוק ולהוריד 30%', 'בספרדית בלבד.', 15),
  ('לראות זריחה מעל 4,000 מטר', 'עם הוכחה מצולמת.', 25),
  ('לשיר במיקרופון בקריוקי מקומי', 'שיר בספרדית שווה כפול.', 25),
  ('לעשות חבר/ה חדש/ה ממדינה אחרת', 'ולהחליף אינסטגרם.', 10),
  ('להתעורר לפני 5 בבוקר בשביל טרק', 'בלי לקטר. טוב, מעט.', 15)
) v(title, details, points)
where not exists (select 1 from public.challenges);
