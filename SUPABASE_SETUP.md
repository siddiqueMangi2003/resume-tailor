# Supabase setup

The application tracker uses Supabase Auth and Postgres. The public frontend only receives the
project URL and publishable/anon key. Never expose the service-role key or database password.

## 1. Create the database

1. Create a free Supabase project.
2. Open **SQL Editor** in the project dashboard.
3. Paste and run `supabase/migrations/202608090001_create_job_applications.sql`.
4. In **Table Editor**, confirm that `job_applications` exists and has Row Level Security enabled.

The migration creates ownership policies for select, insert, update, and delete. Every request is
restricted to rows whose `user_id` matches the authenticated user.

## 2. Configure authentication

In **Authentication → URL Configuration**, set:

- Site URL: `https://siddiquemangi2003.github.io/resume-tailor/`
- Redirect URL: `https://siddiquemangi2003.github.io/resume-tailor/tracker/`
- Local redirect URL: `http://localhost:3000/`
- Local redirect URL: `http://localhost:3000/tracker/`

The frontend sends OAuth through the Site URL and restores the page that started authentication.
This allows navbar login, tracker login, and authenticated job saves to share one safe callback.

Enable Google and/or GitHub in **Authentication → Providers**. Follow the provider instructions in
Supabase to create the OAuth credentials. The provider callback URL is displayed by Supabase and
normally has the form `https://<project-ref>.supabase.co/auth/v1/callback`.

## 3. Configure the frontend

Add these GitHub repository variables under **Settings → Secrets and variables → Actions → Variables**:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

These values are designed to be public. Security depends on the Row Level Security policies, not on
hiding the anon key.

For local development, add the same values to `.env.local`.

After adding the repository variables, run the **Deploy frontend to GitHub Pages** workflow again.
