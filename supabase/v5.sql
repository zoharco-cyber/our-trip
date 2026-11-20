-- =====================================================================
--  "אנחנו בסדר" + התראות על אירועים
-- =====================================================================
create table if not exists public.status_updates (
  id uuid primary key default gen_random_uuid(),
  message text not null,
  lat double precision,
  lng double precision,
  place text,
  created_by uuid default auth.uid() references public.profiles on delete set null,
  created_at timestamptz not null default now()
);
alter table public.status_updates enable row level security;
drop policy if exists anyone_read on public.status_updates;
create policy anyone_read on public.status_updates for select using (true);
drop policy if exists members_write on public.status_updates;
create policy members_write on public.status_updates for all using (public.is_member()) with check (public.is_member());
do $$ begin alter publication supabase_realtime add table public.status_updates; exception when duplicate_object then null; end $$;

-- שליחת אירוע לפונקציית ההתראות
create or replace function public.notify_event() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if TG_TABLE_NAME = 'wishes' and not (NEW.done and not coalesce(OLD.done, false)) then return NEW; end if;
  perform net.http_post(
    url := 'https://mwcbuicwdksyhjjyscil.supabase.co/functions/v1/notify',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'journal_cron_secret')),
    body := jsonb_build_object('table', TG_TABLE_NAME, 'record', to_jsonb(NEW))
  );
  return NEW;
exception when others then
  return NEW;  -- התראה שנכשלה לעולם לא חוסמת שמירה
end $$;

drop trigger if exists notify_challenge on public.challenge_done;
create trigger notify_challenge after insert on public.challenge_done for each row execute function public.notify_event();
drop trigger if exists notify_expense on public.expenses;
create trigger notify_expense after insert on public.expenses for each row execute function public.notify_event();
drop trigger if exists notify_wish on public.wishes;
create trigger notify_wish after update on public.wishes for each row execute function public.notify_event();
drop trigger if exists notify_status on public.status_updates;
create trigger notify_status after insert on public.status_updates for each row execute function public.notify_event();
