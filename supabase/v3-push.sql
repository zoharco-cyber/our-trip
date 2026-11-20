-- תזכורת יומית ליומן: מנויים להתראות
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  tz text not null default 'America/Lima',
  hour int not null default 21 check (hour between 0 and 23),
  last_sent date,
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
drop policy if exists own_all on public.push_subscriptions;
create policy own_all on public.push_subscriptions for all
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_member());

create extension if not exists pg_cron;
create extension if not exists pg_net;
