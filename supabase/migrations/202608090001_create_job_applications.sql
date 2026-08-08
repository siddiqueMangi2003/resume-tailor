create extension if not exists "pgcrypto";

create table if not exists public.job_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company text not null check (char_length(company) between 1 and 160),
  role text not null check (char_length(role) between 1 and 160),
  status text not null default 'bookmarked' check (
    status in (
      'bookmarked', 'applying', 'applied', 'interviewing', 'negotiating',
      'accepted', 'not_selected', 'withdrawn', 'no_response', 'archived'
    )
  ),
  location text not null default '' check (char_length(location) <= 240),
  salary text not null default '' check (char_length(salary) <= 120),
  job_url text not null default '' check (char_length(job_url) <= 2048),
  job_description text not null default '' check (char_length(job_description) <= 30000),
  notes text not null default '' check (char_length(notes) <= 20000),
  contact_name text not null default '' check (char_length(contact_name) <= 160),
  contact_email text not null default '' check (char_length(contact_email) <= 320),
  excitement smallint not null default 3 check (excitement between 1 and 5),
  date_saved date not null default current_date,
  date_applied date,
  follow_up_date date,
  deadline date,
  resume_template_id text not null default '' check (char_length(resume_template_id) <= 40),
  resume_file_name text not null default '' check (char_length(resume_file_name) <= 255),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.job_applications enable row level security;

create index if not exists job_applications_user_status_idx
  on public.job_applications (user_id, status, updated_at desc);

create index if not exists job_applications_user_follow_up_idx
  on public.job_applications (user_id, follow_up_date)
  where follow_up_date is not null;

drop policy if exists "Users can read their applications" on public.job_applications;
create policy "Users can read their applications"
  on public.job_applications for select
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their applications" on public.job_applications;
create policy "Users can create their applications"
  on public.job_applications for insert
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their applications" on public.job_applications;
create policy "Users can update their applications"
  on public.job_applications for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their applications" on public.job_applications;
create policy "Users can delete their applications"
  on public.job_applications for delete
  using ((select auth.uid()) = user_id);

create or replace function public.set_job_application_updated_at()
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

drop trigger if exists set_job_application_updated_at on public.job_applications;
create trigger set_job_application_updated_at
before update on public.job_applications
for each row execute function public.set_job_application_updated_at();

grant select, insert, update, delete on public.job_applications to authenticated;
