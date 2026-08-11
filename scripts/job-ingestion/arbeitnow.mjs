import { isRelevantJob, normalizedJob } from "./normalize.mjs"

const MAX_ARBEITNOW_JOBS = 180

export async function ingestArbeitnow() {
  const jobs = []
  let nextUrl = "https://www.arbeitnow.com/api/job-board-api"
  for (let page = 0; page < 2 && nextUrl; page += 1) {
    const response = await fetch(nextUrl, {
      headers: { Accept: "application/json", "User-Agent": "ResumeTailor-Jobs/2.0" },
      signal: AbortSignal.timeout(30_000),
    })
    if (!response.ok) throw new Error(`Arbeitnow returned ${response.status}`)
    const payload = await response.json()
    jobs.push(...(payload.data ?? []).map((job) => normalizedJob({
      source: "arbeitnow",
      sourceLabel: "Arbeitnow",
      sourceJobId: job.slug,
      company: job.company_name,
      title: job.title,
      location: job.location,
      workplaceType: job.remote ? "remote" : "",
      department: Array.isArray(job.tags) ? job.tags[0] : job.tags,
      employmentType: Array.isArray(job.job_types) ? job.job_types.join(", ") : job.job_types,
      skills: job.tags,
      description: job.description,
      jobUrl: job.url,
      applyUrl: job.url,
      publishedAt: job.created_at ? new Date(Number(job.created_at) * 1000).toISOString() : null,
      updatedAt: job.created_at ? new Date(Number(job.created_at) * 1000).toISOString() : null,
    })))
    nextUrl = payload.links?.next || ""
  }
  return {
    source: "arbeitnow",
    label: "Arbeitnow",
    jobs: jobs.filter(isRelevantJob).slice(0, MAX_ARBEITNOW_JOBS),
    failures: [],
  }
}
