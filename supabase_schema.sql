
-- Supabase schema for CyberMave / LikeCharlie public submissions + views

-- 1) Table
create table if not exists public.public_submissions (
  id            bigserial primary key,
  created_at    timestamptz not null default now(),
  action        text not null,
  platform      text,
  post_url      text,
  name          text,
  email         text,
  ref_code      text,
  ua            text,
  ip_hint       inet,
  approved      boolean not null default true  -- set to false if you want moderation
);

-- 2) RLS (Row Level Security)
alter table public.public_submissions enable row level security;

-- Open inserts + reads (for anon key). Tighten to your needs.
drop policy if exists "Allow insert for anon" on public.public_submissions;
create policy "Allow insert for anon"
  on public.public_submissions
  for insert
  to anon
  with check (true);

drop policy if exists "Allow read for anon" on public.public_submissions;
create policy "Allow read for anon"
  on public.public_submissions
  for select
  to anon
  using (approved = true);

-- 3) Helpful index
create index if not exists idx_public_submissions_created_at on public.public_submissions (created_at desc);

-- 4) RPC for leaderboard (action, count)
create or replace function public.public_action_counts()
returns table(action text, count bigint)
language sql
stable
as $$
  select lower(trim(action)) as action, count(*)::bigint
  from public.public_submissions
  where approved = true
  group by 1
  order by 2 desc;
$$;

-- 5) (Optional) Edge function to validate post URLs or fetch OG data can be added later.

