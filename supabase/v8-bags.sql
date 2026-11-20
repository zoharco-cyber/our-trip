-- מה יש בתיקים של כל אחת (תיק גדול / קטן), ובדיקה לפני מעבר
create table if not exists public.bag_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles on delete cascade,
  bag text not null default 'big' check (bag in ('big','small')),
  text text not null,
  checked_at timestamptz,          -- סומן "בתיק" בבדיקה הנוכחית
  created_at timestamptz not null default now()
);
alter table public.bag_items enable row level security;
drop policy if exists own_only on public.bag_items;
create policy own_only on public.bag_items for all using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_member());
