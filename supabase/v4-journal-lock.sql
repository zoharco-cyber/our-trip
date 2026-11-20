-- היומן נפתח לכתיבה רק מהיום הראשון של הטיול (האירוע הראשון ברשימת התאריכים)
create or replace function public.trip_start() returns date
language sql stable security definer set search_path = public as $$
  select coalesce((select (min(starts_at) at time zone 'Asia/Jerusalem')::date from events), date '2026-12-22') $$;

drop policy if exists journal_from_trip_start on public.journal_entries;
create policy journal_from_trip_start on public.journal_entries as restrictive for insert
  with check (day >= public.trip_start());
drop policy if exists journal_from_trip_start_upd on public.journal_entries;
create policy journal_from_trip_start_upd on public.journal_entries as restrictive for update
  with check (day >= public.trip_start());
