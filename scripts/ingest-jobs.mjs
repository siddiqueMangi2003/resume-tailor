import { mkdir, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"
import { ingestArbeitnow } from "./job-ingestion/arbeitnow.mjs"
import { ingestGreenhouse } from "./job-ingestion/greenhouse.mjs"
import { ingestLever } from "./job-ingestion/lever.mjs"
import { ingestRemotive } from "./job-ingestion/remotive.mjs"

const projectDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const outputPath = resolve(projectDirectory, "public", "data", "jobs.json")
const detailsOutputPath = resolve(projectDirectory, "public", "data", "job-details.json")
const MAX_CATALOGUE_JOBS = 900

async function runAdapter(adapter, label) {
  try {
    return await adapter()
  } catch (error) {
    return { source: label.toLowerCase(), label, jobs: [], failures: [String(error)] }
  }
}

async function syncToSupabase(jobs) {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim()
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim()
  if (!url || !serviceKey) {
    console.log("Supabase job sync skipped: server-side credentials are not configured.")
    return
  }
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const seenAt = new Date().toISOString()
  const rows = jobs.map((job) => ({
    id: job.id, source: job.source, source_label: job.sourceLabel,
    source_job_id: job.sourceJobId, company: job.company, title: job.title,
    location: job.location, workplace_type: job.workplaceType, department: job.department,
    employment_type: job.employmentType, salary: job.salary, skills: job.skills,
    description: job.description, description_excerpt: job.description.slice(0, 420),
    job_url: job.jobUrl, apply_url: job.applyUrl, published_at: job.publishedAt,
    source_updated_at: job.updatedAt, last_seen_at: seenAt, active: true,
  }))
  for (let index = 0; index < rows.length; index += 100) {
    const { error } = await supabase.from("jobs").upsert(rows.slice(index, index + 100), { onConflict: "id" })
    if (error) throw new Error(`Supabase job sync failed: ${error.message}`)
  }
  console.log(`Synced ${rows.length} normalized jobs to Supabase.`)
}

async function main() {
  const adapters = await Promise.all([
    runAdapter(ingestGreenhouse, "Greenhouse"),
    runAdapter(ingestLever, "Lever"),
    runAdapter(ingestArbeitnow, "Arbeitnow"),
    runAdapter(ingestRemotive, "Remotive"),
  ])
  for (const result of adapters) for (const failure of result.failures) console.error(`${result.label}: ${failure}`)

  const jobs = adapters
    .flatMap((result) => result.jobs)
    .filter((job, index, all) => all.findIndex((candidate) => candidate.applyUrl === job.applyUrl) === index)
    .sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)))
    .slice(0, MAX_CATALOGUE_JOBS)
  if (!jobs.length) throw new Error("All job adapters returned empty results; keeping the previous catalogue.")

  const catalogue = {
    generatedAt: new Date().toISOString(),
    source: "Greenhouse, Lever, Arbeitnow and Remotive public job feeds",
    sources: adapters.map(({ source, label, jobs: sourceJobs }) => ({ source, label, jobs: sourceJobs.length })),
    companies: [...new Map(jobs.map((job) => [`${job.source}:${job.company}`, { company: job.company, source: job.source }])).values()],
    jobs: jobs.map(({ description, ...job }) => ({
      ...job,
      description: description.length > 420 ? `${description.slice(0, 417)}…` : description,
    })),
  }
  const details = Object.fromEntries(jobs.map((job) => [job.id, job.description]))
  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(catalogue)}\n`, "utf8")
  await writeFile(detailsOutputPath, `${JSON.stringify(details)}\n`, "utf8")
  try {
    await syncToSupabase(jobs)
  } catch (error) {
    console.error(String(error))
    console.error("Static catalogue generation succeeded; Supabase sync will retry on the next scheduled run.")
  }
  console.log(`Saved ${jobs.length} jobs: ${adapters.map((item) => `${item.label} ${item.jobs.length}`).join(", ")}.`)
}

await main()
