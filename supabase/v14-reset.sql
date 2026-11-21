-- =====================================================================
--  איפוס היסטוריה: עותק של הרשימות המקוריות + מאגר שאלות (תשובות מוצפנות)
-- =====================================================================
-- עותק של הרשימות כמו שהן היום, כדי לחזור אליהן באיפוס
create table if not exists public.seed_challenges as select title, details, points from public.challenges where false;
create table if not exists public.seed_gear as select text, category from public.gear_items where false;
create table if not exists public.seed_pretrip as select title, note, due_date from public.pretrip_tasks where false;
insert into public.seed_challenges select title, details, points from public.challenges where not exists (select 1 from public.seed_challenges);
insert into public.seed_gear select text, category from public.gear_items where not exists (select 1 from public.seed_gear);
insert into public.seed_pretrip select title, note, due_date from public.pretrip_tasks where not exists (select 1 from public.seed_pretrip);

-- מאגר השאלות. אין הרשאות קריאה לאף אחד: רק הפונקציה בשרת ניגשת
create table if not exists public.reset_questions (
  id serial primary key,
  question text not null,
  answer_hash text not null
);
alter table public.seed_challenges enable row level security;
alter table public.seed_gear enable row level security;
alter table public.seed_pretrip enable row level security;
alter table public.reset_questions enable row level security;

insert into public.settings values ('reset_fails', '[]'::jsonb) on conflict do nothing;

select (select count(*) from public.seed_challenges) ch, (select count(*) from public.seed_gear) gear, (select count(*) from public.seed_pretrip) pre;
