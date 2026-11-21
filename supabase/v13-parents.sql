-- =====================================================================
--  להורים: קטעי יומן משותפים, "לאן עכשיו" מההזמנות, שירי הטיול
-- =====================================================================
alter table public.journal_entries add column if not exists shared boolean not null default false;

-- אורחים רואים רק רשומות יומן שסומנו "לשתף עם הבית"
drop policy if exists guests_shared_read on public.journal_entries;
create policy guests_shared_read on public.journal_entries for select
  using (shared and (public.launched() or auth.uid() is not null));

-- תמונת היום של רשומה משותפת
drop policy if exists journal_photo_shared on storage.objects;
create policy journal_photo_shared on storage.objects for select
  using (bucket_id = 'photos' and (public.launched() or auth.uid() is not null)
    and exists (select 1 from public.journal_entries j where j.photo_path = objects.name and j.shared));

-- "לאן עכשיו": רק סוג, שם ותאריך מההזמנות, בלי מספרי הזמנה והערות
create or replace function public.next_moves()
returns table (kind text, title text, starts_at timestamptz)
language sql stable security definer set search_path = public as $$
  select b.kind, b.title, b.starts_at from bookings b
  where (public.launched() or auth.uid() is not null)
    and b.starts_at >= now() - interval '3 hours'
  order by b.starts_at limit 3 $$;
grant execute on function public.next_moves() to anon, authenticated;

-- שירי הטיול: גלויים גם לאורחים (קריאה בלבד)
drop policy if exists guests_read on public.songs;
create policy guests_read on public.songs for select using (public.launched() or auth.uid() is not null);
