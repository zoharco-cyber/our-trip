-- חלוקה לא שווה: כמה כל אחת משלמת (בדולר). ריק = חלוקה שווה
alter table public.expenses add column if not exists split_amounts jsonb;

-- סיסמאות וויי-פיי של הוסטלים ומקומות
create table if not exists public.wifi_passwords (
  id uuid primary key default gen_random_uuid(),
  place text not null,
  network text,
  password text,
  note text,
  created_by uuid default auth.uid() references public.profiles on delete set null,
  created_at timestamptz not null default now()
);
alter table public.wifi_passwords enable row level security;
drop policy if exists members_all on public.wifi_passwords;
create policy members_all on public.wifi_passwords for all using (public.is_member()) with check (public.is_member());
do $$ begin alter publication supabase_realtime add table public.wifi_passwords; exception when duplicate_object then null; end $$;
