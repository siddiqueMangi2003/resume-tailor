import { getSupabaseBrowserClient } from "@/lib/supabase"
import type { JobApplication, JobStatus } from "@/lib/job-applications"
import type { PublicJob } from "@/lib/public-jobs"

function relationUnavailable(error: { code?: string; message?: string } | null) {
  return Boolean(error && (error.code === "42P01" || error.code === "PGRST205" || /schema cache|does not exist/i.test(error.message || "")))
}

function applicationSnapshot(application: JobApplication): PublicJob {
  return {
    id: `application:${application.id}`,
    source: "greenhouse",
    sourceLabel: "Saved opportunity",
    sourceJobId: application.id,
    company: application.company,
    title: application.role,
    location: application.location,
    workplaceType: /remote/i.test(application.location) ? "remote" : "unspecified",
    department: "General",
    employmentType: "",
    salary: application.salary,
    skills: [],
    description: application.job_description,
    jobUrl: application.job_url,
    applyUrl: application.job_url,
    publishedAt: null,
    updatedAt: application.updated_at,
  }
}

export async function loadSavedJobs(userId: string) {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) throw new Error("The private workspace is unavailable.")
  const savedResult = await supabase
    .from("saved_jobs")
    .select("job_id, job_snapshot, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
  if (savedResult.error && !relationUnavailable(savedResult.error)) throw savedResult.error
  const primary = savedResult.error
    ? []
    : (savedResult.data ?? []).map((row) => row.job_snapshot as PublicJob)
  const fallback = await supabase
    .from("job_applications")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "bookmarked")
    .order("updated_at", { ascending: false })
  if (fallback.error) throw fallback.error
  const legacy = (fallback.data ?? []).map((item) => applicationSnapshot(item as JobApplication))
  return [...primary, ...legacy].filter((job, index, all) =>
    all.findIndex((candidate) =>
      (candidate.applyUrl || candidate.jobUrl) === (job.applyUrl || job.jobUrl),
    ) === index,
  )
}

export async function saveJobForUser(job: PublicJob, userId: string) {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) throw new Error("The private workspace is unavailable.")
  const result = await supabase.from("saved_jobs").upsert(
    { user_id: userId, job_id: job.id, job_snapshot: job },
    { onConflict: "user_id,job_id" },
  )
  if (!result.error) return
  if (!relationUnavailable(result.error)) throw result.error

  const jobUrl = job.applyUrl || job.jobUrl
  const existing = await supabase.from("job_applications").select("id").eq("user_id", userId).eq("job_url", jobUrl).limit(1).maybeSingle()
  if (existing.error) throw existing.error
  if (existing.data) return
  const fallback = await supabase.from("job_applications").insert({
    user_id: userId,
    company: job.company.slice(0, 160),
    role: job.title.slice(0, 160),
    status: "bookmarked",
    location: job.location.slice(0, 240),
    job_url: jobUrl.slice(0, 2048),
    job_description: job.description.slice(0, 30_000),
    notes: `Saved from ${job.sourceLabel}.`,
  })
  if (fallback.error) throw fallback.error
}

export async function removeSavedJob(job: PublicJob, userId: string) {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) throw new Error("The private workspace is unavailable.")
  const result = await supabase.from("saved_jobs").delete().eq("user_id", userId).eq("job_id", job.id)
  if (result.error && !relationUnavailable(result.error)) throw result.error
  const fallback = await supabase
    .from("job_applications")
    .delete()
    .eq("user_id", userId)
    .eq("status", "bookmarked")
    .eq("job_url", job.applyUrl || job.jobUrl)
  if (fallback.error) throw fallback.error
}

export async function registerJobApplication(job: PublicJob, userId: string) {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) throw new Error("The application tracker is unavailable.")
  const jobUrl = job.applyUrl || job.jobUrl
  const existing = await supabase
    .from("job_applications")
    .select("id,status")
    .eq("user_id", userId)
    .eq("job_url", jobUrl)
    .limit(1)
    .maybeSingle()
  if (existing.error) throw existing.error
  if (existing.data) {
    const currentStatus = existing.data.status as JobStatus
    if (currentStatus === "bookmarked") {
      const update = await supabase.from("job_applications").update({ status: "applying" }).eq("id", existing.data.id)
      if (update.error) throw update.error
    }
    return existing.data.id as string
  }
  const result = await supabase.from("job_applications").insert({
    user_id: userId,
    company: job.company.slice(0, 160),
    role: job.title.slice(0, 160),
    status: "applying",
    location: job.location.slice(0, 240),
    salary: (job.salary || "").slice(0, 120),
    job_url: jobUrl.slice(0, 2048),
    job_description: job.description.slice(0, 30_000),
    notes: `Application started from ${job.sourceLabel}.`,
  }).select("id").single()
  if (result.error) throw result.error
  return result.data.id as string
}
