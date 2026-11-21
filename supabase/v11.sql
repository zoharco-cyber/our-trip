-- =====================================================================
--  מכתבי פתיחה, תזכורת שקיעה
-- =====================================================================
create table if not exists public.welcome_letters (
  user_id uuid primary key references public.profiles on delete cascade,
  content text not null,
  opened_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.welcome_letters enable row level security;
-- המנהל כותב וקורא הכול. כל אחת קוראת רק את שלה, ורק אחרי ההשקה
drop policy if exists admin_all on public.welcome_letters;
create policy admin_all on public.welcome_letters for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists own_read on public.welcome_letters;
create policy own_read on public.welcome_letters for select using (user_id = auth.uid() and public.launched());

-- סימון "נפתח" (רק לשורה שלה, רק את השדה הזה)
create or replace function public.mark_letter_opened() returns void
language sql security definer set search_path = public as $$
  update welcome_letters set opened_at = coalesce(opened_at, now()) where user_id = auth.uid() and public.launched() $$;

-- תזכורת שקיעה: אפשר לכבות לכל מכשיר
alter table public.push_subscriptions add column if not exists sunset boolean not null default true;
insert into public.settings values ('sunset_sent', 'null'::jsonb) on conflict do nothing;

select cron.unschedule('sunset-reminder') where exists (select 1 from cron.job where jobname = 'sunset-reminder');
select cron.schedule('sunset-reminder', '*/15 * * * *', $$
  select net.http_post(
    url := 'https://mwcbuicwdksyhjjyscil.supabase.co/functions/v1/sunset-reminder',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name='journal_cron_secret')),
    body := '{}'::jsonb
  );
$$);
