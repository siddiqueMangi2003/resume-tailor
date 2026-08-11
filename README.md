# Resume Tailor

Resume Tailor discovers employer-direct jobs, adapts an existing resume to a target job
description without inventing qualifications, and keeps private applications organized in a
visual tracker. Tailored resumes are available as temporary LaTeX, PDF, and DOCX downloads.

## Architecture

- Next.js static frontend, deployed to GitHub Pages
- FastAPI backend, deployed to Render with Docker
- Supabase Auth and Postgres for profiles, saved jobs, normalized jobs, and application tracking
- Scheduled Greenhouse, Lever, Arbeitnow, and Remotive ingestion for the public Jobs catalogue
- Groq for truthful resume rewriting
- pdfLaTeX for PDF generation
- Aspose Words Cloud for PDF-to-DOCX conversion

Generated files use opaque job identifiers and are deleted from the backend after ten minutes
by default. Application records are stored in Supabase with Row Level Security.

## Jobs catalogue

The public `/jobs` page combines Greenhouse, Lever, Arbeitnow, and Remotive public feeds.
Source-specific adapters under `scripts/job-ingestion` convert every listing to one normalized
format with titles, locations, workplace types, descriptions, departments, skills, source links,
employment types, salaries, and timestamps.

~~~powershell
npm run ingest:jobs
~~~

The lightweight catalogue index is stored at `public/data/jobs.json`. Complete descriptions are
stored separately and loaded only when a visitor opens, saves, applies, or tailors a job. GitHub
Pages refreshes the deployed catalogue every six hours. When a server-side Supabase service-role
secret is configured, the same normalized records are also upserted into `public.jobs`; otherwise
the static catalogue remains the reliable fallback.

Saving creates a private shortlist entry. Applying opens the original source page and registers the
opportunity in the tracker's Applying column. Tailoring transfers the complete job description into
the resume studio.

## Authentication and onboarding

The frontend offers Google, GitHub, and LinkedIn (OIDC) through Supabase's social authentication.
First-time visitors can record job preferences and either upload an existing resume for text
extraction or build a factual base resume from guided questions. Extracted text is stored in the
user-owned profile; the original uploaded file is not stored.

## Privacy

Resume and job-description text are sent to Groq. The generated PDF is sent to Aspose only
for DOCX conversion. Do not use this application for information you are not authorized to
send to those processors. Always verify generated content before submitting it.

The repository contains only fictional examples under backend/samples. Local PDF and DOCX
resume files under backend/data are ignored by Git.

## Local frontend

Requirements: Node.js 24 and npm.

~~~powershell
Copy-Item .env.example .env.local
npm install
npm run dev
~~~

Set `NEXT_PUBLIC_API_BASE_URL` to the backend origin and add the public Supabase project URL and
publishable key described in `SUPABASE_SETUP.md`.

## Local backend

Requirements: Python 3.12 and a pdfLaTeX installation.

~~~powershell
python -m venv backend/.venv
backend/.venv/Scripts/python -m pip install -r backend/requirements.dev.txt
Copy-Item .env.example backend/.env
backend/.venv/Scripts/python -m uvicorn main:app --app-dir backend --reload
~~~

Required backend settings:

- GROQ_API_KEY
- GROQ_MODEL, defaulting to openai/gpt-oss-120b
- FRONTEND_ORIGINS, a comma-separated list of browser origins

Aspose settings:

- ASPOSE_CLIENT_ID
- ASPOSE_CLIENT_SECRET

If Aspose is missing or unavailable, TEX and PDF still succeed and the response explains
that DOCX conversion is temporarily unavailable.

## Validation

~~~powershell
npm run check
npm run build
python -m pytest
ruff check backend
~~~

## Render deployment

The included render.yaml and Dockerfile install the required TeX packages and run FastAPI
as a non-root user. Create a Render Blueprint from this repository and provide the Groq and
Aspose secrets when prompted.

The free Render service has cold starts and ephemeral storage. Ephemeral storage is
intentional here because results are temporary.

## GitHub Pages deployment

The deploy-pages workflow creates a static Next.js export. Before running it:

1. Create the repository Actions variable NEXT_PUBLIC_API_BASE_URL with the Render origin.
2. Add the public Supabase URL and publishable key as `NEXT_PUBLIC_SUPABASE_URL` and
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` repository variables.
3. In Settings, Pages, set the source to GitHub Actions.
4. Run the Deploy frontend to GitHub Pages workflow.

The frontend automatically uses the repository name as its GitHub Pages base path.
