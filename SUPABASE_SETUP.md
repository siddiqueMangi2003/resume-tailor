# Supabase setup

The application tracker uses Supabase Auth and Postgres. The public frontend only receives the
project URL and publishable/anon key. Never expose the service-role key or database password.

## 1. Create the database

1. Create a free Supabase project.
2. Open **SQL Editor** in the project dashboard.
3. Paste and run `supabase/migrations/202608090001_create_job_applications.sql`.
4. Paste and run `supabase/migrations/202608120001_jobs_saved_profiles.sql`.
5. In **Table Editor**, confirm that `job_applications`, `jobs`, `saved_jobs`, and
   `user_profiles` exist and have Row Level Security enabled.

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

Enable GitHub, Google, and LinkedIn (OIDC) in **Authentication → Providers**. Follow each provider's
instructions in Supabase to create its OAuth credentials. LinkedIn must use the LinkedIn (OIDC)
provider. The provider callback URL is displayed by Supabase and normally has the form
`https://<project-ref>.supabase.co/auth/v1/callback`.

The login and signup buttons open an in-app provider chooser. Google is requested with an account
chooser so returning users can select another Google account.

## 3. Configure the frontend

Add these GitHub repository variables under **Settings → Secrets and variables → Actions → Variables**:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

These values are designed to be public. Security depends on the Row Level Security policies, not on
hiding the anon key.

To synchronize the normalized public job catalogue into the `jobs` table, add this GitHub Actions
repository secret:

- `SUPABASE_SERVICE_ROLE_KEY`

The service-role key is server-only. The scheduled workflow passes it only to the ingestion process;
it is never included in the GitHub Pages build. If the secret is absent, the deployed static catalogue
continues to work and synchronization is skipped.

For local development, add the same values to `.env.local`.

After adding the repository variables, run the **Deploy frontend to GitHub Pages** workflow again.
