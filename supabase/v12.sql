-- =====================================================================
--  צ'קליסט לפני הטיסה, כרטיס חירום רפואי, חידון ספרדית, אתגר צילום יומי
-- =====================================================================
create table if not exists public.pretrip_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  note text,
  due_date date not null,
  created_by uuid default auth.uid() references public.profiles on delete set null,
  created_at timestamptz not null default now()
);
create table if not exists public.pretrip_done (
  task_id uuid not null references public.pretrip_tasks on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (task_id, user_id)
);
-- כרטיס חירום: כל אחת עורכת את שלה, כל המטיילות והמנהל רואים
create table if not exists public.medical_cards (
  user_id uuid primary key default auth.uid() references public.profiles on delete cascade,
  blood_type text, allergies text, meds text, conditions text,
  insurance text, insurance_phone text, policy_no text,
  emergency_name text, emergency_phone text, notes text,
  updated_at timestamptz not null default now()
);
create table if not exists public.quiz_results (
  user_id uuid not null default auth.uid() references public.profiles on delete cascade,
  week text not null,
  score int not null check (score between 0 and 10),
  created_at timestamptz not null default now(),
  primary key (user_id, week)
);
alter table public.photos add column if not exists prompt_day date;
alter table public.push_subscriptions add column if not exists pretrip_sent date;

do $$
declare t text;
begin
  foreach t in array array['pretrip_tasks','pretrip_done','medical_cards','quiz_results'] loop
    execute format('alter table public.%I enable row level security', t);
    begin execute format('alter publication supabase_realtime add table public.%I', t); exception when duplicate_object then null; end;
  end loop;
end $$;
drop policy if exists members_all on public.pretrip_tasks;
create policy members_all on public.pretrip_tasks for all using (public.is_member()) with check (public.is_member());
drop policy if exists members_read on public.pretrip_done;
create policy members_read on public.pretrip_done for select using (public.is_member());
drop policy if exists own_write on public.pretrip_done;
create policy own_write on public.pretrip_done for insert with check (user_id = auth.uid() and public.is_member());
drop policy if exists own_delete on public.pretrip_done;
create policy own_delete on public.pretrip_done for delete using (user_id = auth.uid());
do $$
declare t text;
begin
  foreach t in array array['medical_cards','quiz_results'] loop
    execute format('drop policy if exists members_read on public.%I', t);
    execute format('create policy members_read on public.%I for select using (public.is_member())', t);
    execute format('drop policy if exists own_write on public.%I', t);
    execute format('create policy own_write on public.%I for insert with check (user_id = auth.uid() and public.is_member())', t);
    execute format('drop policy if exists own_update on public.%I', t);
    execute format('create policy own_update on public.%I for update using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

insert into public.pretrip_tasks (title, note, due_date, created_by)
select v.title, v.note, v.due::date, null from (values
  ('ביקור במרפאת מטיילים וחיסונים', 'קדחת צהובה צריך לפחות 10 ימים לפני. לקחת את פנקס החיסונים הצהוב', '2026-12-01'),
  ('אישור ESTA (לקונקשן בארה"ב)', 'רק אם עוברות דרך ארה"ב. באתר הרשמי esta.cbp.dhs.gov', '2026-12-05'),
  ('ביטוח נסיעות כולל ספורט אתגרי', 'לוודא כיסוי לטרקים בגובה ולפינוי רפואי', '2026-12-08'),
  ('רישיון נהיגה בינלאומי', null, '2026-12-10'),
  ('הודעה לבנק על נסיעה לחו"ל', 'ולבדוק עמלות משיכה בחו"ל בכרטיס', '2026-12-12'),
  ('להעלות צילומי מסמכים לאתר', 'דרכון, ביטוח, כרטיסי טיסה: בעמוד המסמכים', '2026-12-15'),
  ('למלא כרטיס חירום רפואי באתר', null, '2026-12-15'),
  ('להזמין eSIM או SIM לדרום אמריקה', null, '2026-12-18'),
  ('להכין דולרים במזומן, שטרות חדשים ונקיים', null, '2026-12-18'),
  ('להתקין את האתר במסך הבית ולהפעיל התראות', null, '2026-12-19'),
  ('לשמור במפה את אזור לימה לשימוש בלי קליטה', 'בעמוד המפה: "שמירת האזור שעל המסך"', '2026-12-20'),
  ('בדיקת תיקים אחרונה', 'בעמוד הציוד: "התיקים שלי" ואז "בדיקה לפני מעבר"', '2026-12-21')
) v(title, note, due)
where not exists (select 1 from public.pretrip_tasks);
