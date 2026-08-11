create table if not exists public.jobs (
  id text primary key,
  source text not null check (source in ('greenhouse', 'lever', 'arbeitnow', 'remotive')),
  source_label text not null,
  source_job_id text not null,
  company text not null,
  title text not null,
  location text not null default '',
  workplace_type text not null default 'unspecified' check (workplace_type in ('remote', 'hybrid', 'onsite', 'unspecified')),
  department text not null default '',
  employment_type text not null default '',
  salary text not null default '',
  skills text[] not null default '{}',
  description text not null default '',
  description_excerpt text not null default '',
  job_url text not null,
  apply_url text not null,
  published_at timestamptz,
  source_updated_at timestamptz,
  last_seen_at timestamptz not null default now(),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, source_job_id)
);

create index if not exists jobs_active_updated_idx on public.jobs (active, source_updated_at desc);
create index if not exists jobs_company_idx on public.jobs (company);
alter table public.jobs enable row level security;
drop policy if exists "Anyone can read active jobs" on public.jobs;
create policy "Anyone can read active jobs" on public.jobs for select using (active = true);
grant select on public.jobs to anon, authenticated;

create table if not exists public.saved_jobs (
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id text not null,
  job_snapshot jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, job_id)
);

create index if not exists saved_jobs_user_created_idx on public.saved_jobs (user_id, created_at desc);
alter table public.saved_jobs enable row level security;
drop policy if exists "Users can read saved jobs" on public.saved_jobs;
create policy "Users can read saved jobs" on public.saved_jobs for select using ((select auth.uid()) = user_id);
drop policy if exists "Users can save jobs" on public.saved_jobs;
create policy "Users can save jobs" on public.saved_jobs for insert with check ((select auth.uid()) = user_id);
drop policy if exists "Users can update saved jobs" on public.saved_jobs;
create policy "Users can update saved jobs" on public.saved_jobs for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Users can remove saved jobs" on public.saved_jobs;
create policy "Users can remove saved jobs" on public.saved_jobs for delete using ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.saved_jobs to authenticated;

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  desired_titles text[] not null default '{}',
  preferred_locations text[] not null default '{}',
  workplace_types text[] not null default '{}',
  experience_level text not null default '',
  employment_types text[] not null default '{}',
  skills text[] not null default '{}',
  has_resume boolean not null default false,
  base_resume_text text not null default '' check (char_length(base_resume_text) <= 60000),
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_profiles enable row level security;
drop policy if exists "Users can read their profile" on public.user_profiles;
create policy "Users can read their profile" on public.user_profiles for select using ((select auth.uid()) = user_id);
drop policy if exists "Users can create their profile" on public.user_profiles;
create policy "Users can create their profile" on public.user_profiles for insert with check ((select auth.uid()) = user_id);
drop policy if exists "Users can update their profile" on public.user_profiles;
create policy "Users can update their profile" on public.user_profiles for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
grant select, insert, update on public.user_profiles to authenticated;

create or replace function public.set_resume_tailor_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_jobs_updated_at on public.jobs;
create trigger set_jobs_updated_at before update on public.jobs
for each row execute function public.set_resume_tailor_updated_at();

drop trigger if exists set_user_profiles_updated_at on public.user_profiles;
create trigger set_user_profiles_updated_at before update on public.user_profiles
for each row execute function public.set_resume_tailor_updated_at();
