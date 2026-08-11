import { isRelevantJob, normalizedJob } from "./normalize.mjs"

const MAX_REMOTIVE_JOBS = 140

export async function ingestRemotive() {
  const response = await fetch("https://remotive.com/api/remote-jobs?limit=200", {
    headers: { Accept: "application/json", "User-Agent": "ResumeTailor-Jobs/2.0" },
    signal: AbortSignal.timeout(30_000),
  })
  if (!response.ok) throw new Error(`Remotive returned ${response.status}`)
  const payload = await response.json()
  const jobs = (payload.jobs ?? []).map((job) => normalizedJob({
    source: "remotive",
    sourceLabel: "Remotive",
    sourceJobId: job.id,
    company: job.company_name,
    title: job.title,
    location: job.candidate_required_location || "Remote",
    workplaceType: "remote",
    department: job.category,
    employmentType: job.job_type,
    salary: job.salary,
    skills: job.tags,
    description: job.description,
    jobUrl: job.url,
    applyUrl: job.url,
    publishedAt: job.publication_date,
    updatedAt: job.publication_date,
  }))
  return { source: "remotive", label: "Remotive", jobs: jobs.filter(isRelevantJob).slice(0, MAX_REMOTIVE_JOBS), failures: [] }
}
