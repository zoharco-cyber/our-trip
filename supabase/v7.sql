-- =====================================================================
--  קבלות, שירי הטיול, שאלת היום, תזכורות לתרופות, תאריך סיום
-- =====================================================================
alter table public.expenses add column if not exists receipt_path text;

-- שירי הטיול
create table if not exists public.songs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  artist text,
  url text,
  note text,
  created_by uuid default auth.uid() references public.profiles on delete set null,
  created_at timestamptz not null default now()
);

-- שאלת היום: תשובות (לא חובה)
create table if not exists public.daily_answers (
  id uuid primary key default gen_random_uuid(),
  day date not null,
  question text not null,
  answer text not null,
  created_by uuid not null default auth.uid() references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  unique (day, created_by)
);

-- תרופות: פרטי לגמרי, כל אחת רואה רק את שלה (גם לא המנהל)
create table if not exists public.meds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles on delete cascade,
  name text not null,
  times text[] not null default '{}',   -- למשל {'08:00','20:00'}
  tz text not null default 'America/Lima',
  active boolean not null default true,
  last_sent text,                        -- 'YYYY-MM-DD HH:MM' האחרון שנשלח
  created_at timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['songs','daily_answers','meds'] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
  foreach t in array array['songs','daily_answers'] loop
    execute format('drop policy if exists members_all on public.%I', t);
    execute format('create policy members_all on public.%I for all using (public.is_member()) with check (public.is_member())', t);
    begin execute format('alter publication supabase_realtime add table public.%I', t); exception when duplicate_object then null; end;
  end loop;
end $$;
drop policy if exists own_only on public.meds;
create policy own_only on public.meds for all using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_member());

-- תאריך סיום הטיול (בשביל התקציב היומי), המנהל קובע
insert into public.settings values ('trip_end', 'null'::jsonb) on conflict do nothing;

-- תזכורות לתרופות: כל רבע שעה
select cron.unschedule('meds-reminder') where exists (select 1 from cron.job where jobname = 'meds-reminder');
select cron.schedule('meds-reminder', '*/15 * * * *', $$
  select net.http_post(
    url := 'https://mwcbuicwdksyhjjyscil.supabase.co/functions/v1/meds-reminder',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name='journal_cron_secret')),
    body := '{}'::jsonb
  );
$$);
