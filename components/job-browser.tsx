"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowUpRight,
  Bookmark,
  BriefcaseBusiness,
  Building2,
  CalendarClock,
  Check,
  ChevronRight,
  DatabaseZap,
  ExternalLink,
  Filter,
  LoaderCircle,
  MapPin,
  Search,
  Sparkles,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/components/auth-provider"
import { getSupabaseBrowserClient } from "@/lib/supabase"
import {
  EMPTY_JOB_CATALOGUE,
  WORKPLACE_LABELS,
  formatJobDate,
  type JobCatalogue,
  type PublicJob,
  type WorkplaceType,
} from "@/lib/public-jobs"

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? ""
const PAGE_SIZE = 24
let jobDetailsRequest: Promise<Record<string, string>> | null = null

async function withFullDescription(job: PublicJob) {
  if (!jobDetailsRequest) {
    jobDetailsRequest = fetch(`${basePath}/data/job-details.json`, { cache: "no-store" }).then(async (response) => {
      if (!response.ok) throw new Error(`Job details returned ${response.status}.`)
      return response.json() as Promise<Record<string, string>>
    })
  }
  const details = await jobDetailsRequest
  return { ...job, description: details[job.id] || job.description }
}

type JobSort = "newest" | "title" | "company"

function jobSearchText(job: PublicJob) {
  return [job.title, job.company, job.location, job.department, job.skills.join(" "), job.description]
    .join(" ")
    .toLowerCase()
}

function descriptionExcerpt(description: string) {
  const compact = description.replace(/\s+/g, " ").trim()
  return compact.length > 210 ? `${compact.slice(0, 207)}…` : compact
}

export function JobBrowser() {
  const router = useRouter()
  const { configured, user, signIn } = useAuth()
  const [catalogue, setCatalogue] = useState<JobCatalogue>(EMPTY_JOB_CATALOGUE)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [query, setQuery] = useState("")
  const [company, setCompany] = useState("all")
  const [workplace, setWorkplace] = useState<WorkplaceType | "all">("all")
  const [sort, setSort] = useState<JobSort>("newest")
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [selectedJob, setSelectedJob] = useState<PublicJob | null>(null)
  const [savingId, setSavingId] = useState("")
  const [loadingDetailId, setLoadingDetailId] = useState("")
  const [message, setMessage] = useState("")

  useEffect(() => {
    let active = true
    void fetch(`${basePath}/data/jobs.json`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(`The catalogue returned ${response.status}.`)
        return response.json() as Promise<JobCatalogue>
      })
      .then((data) => {
        if (!active) return
        setCatalogue(data)
        setLoadError("")
      })
      .catch((error) => {
        if (!active) return
        setLoadError(error instanceof Error ? error.message : "The catalogue could not be loaded.")
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!selectedJob) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedJob(null)
    }
    document.addEventListener("keydown", closeOnEscape)
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", closeOnEscape)
      document.body.style.overflow = ""
    }
  }, [selectedJob])

  const companies = useMemo(
    () => Array.from(new Set(catalogue.jobs.map((job) => job.company))).sort(),
    [catalogue.jobs],
  )

  const filteredJobs = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return catalogue.jobs
      .filter((job) => company === "all" || job.company === company)
      .filter((job) => workplace === "all" || job.workplaceType === workplace)
      .filter((job) => !normalizedQuery || jobSearchText(job).includes(normalizedQuery))
      .toSorted((left, right) => {
        if (sort === "title") return left.title.localeCompare(right.title)
        if (sort === "company") return left.company.localeCompare(right.company)
        return String(right.updatedAt).localeCompare(String(left.updatedAt))
      })
  }, [catalogue.jobs, company, query, sort, workplace])

  const saveJob = useCallback(async (job: PublicJob) => {
    setMessage("")
    setSavingId(job.id)
    let detailedJob: PublicJob
    try {
      detailedJob = await withFullDescription(job)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The complete job description could not be loaded.")
      setSavingId("")
      return
    }
    if (!user) {
      if (!configured) {
        setMessage("Sign-in is not configured for this deployment yet.")
        setSavingId("")
        return
      }
      sessionStorage.setItem("resume-tailor-pending-job", JSON.stringify(detailedJob))
      try {
        await signIn("github")
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "GitHub sign-in could not be started.")
        setSavingId("")
      }
      return
    }

    const supabase = getSupabaseBrowserClient()
    if (!supabase) {
      setMessage("The private tracker connection is unavailable.")
      setSavingId("")
      return
    }

    const jobUrl = detailedJob.applyUrl || detailedJob.jobUrl
    const { data: existing, error: lookupError } = await supabase
      .from("job_applications")
      .select("id")
      .eq("job_url", jobUrl)
      .limit(1)
      .maybeSingle()

    if (lookupError) {
      setMessage(lookupError.message)
      setSavingId("")
      return
    }
    if (existing) {
      setMessage(`${detailedJob.title} at ${detailedJob.company} is already in your tracker.`)
      setSavingId("")
      return
    }

    const { error } = await supabase.from("job_applications").insert({
      user_id: user.id,
      company: detailedJob.company.slice(0, 160),
      role: detailedJob.title.slice(0, 160),
      status: "bookmarked",
      location: detailedJob.location.slice(0, 240),
      job_url: jobUrl.slice(0, 2048),
      job_description: detailedJob.description.slice(0, 30_000),
      notes: `Discovered through ${detailedJob.sourceLabel}.`,
    })

    setSavingId("")
    if (error) setMessage(error.message)
    else setMessage(`${detailedJob.title} at ${detailedJob.company} was saved to Bookmarked.`)
  }, [configured, signIn, user])

  useEffect(() => {
    if (!user) return
    const pending = sessionStorage.getItem("resume-tailor-pending-job")
    if (!pending) return
    sessionStorage.removeItem("resume-tailor-pending-job")
    try {
      const job = JSON.parse(pending) as PublicJob
      queueMicrotask(() => void saveJob(job))
    } catch {
      queueMicrotask(() => setMessage("The pending job could not be restored after sign-in."))
    }
  }, [saveJob, user])

  const openJob = async (job: PublicJob) => {
    setLoadingDetailId(job.id)
    try {
      setSelectedJob(await withFullDescription(job))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The complete job description could not be loaded.")
    }
    setLoadingDetailId("")
  }

  const tailorJob = async (job: PublicJob) => {
    setLoadingDetailId(job.id)
    let detailedJob: PublicJob
    try {
      detailedJob = await withFullDescription(job)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The complete job description could not be loaded.")
      setLoadingDetailId("")
      return
    }
    sessionStorage.setItem(
      "resume-tailor-application",
      JSON.stringify({
        id: "",
        company: detailedJob.company,
        role: detailedJob.title,
        jobDescription: detailedJob.description,
      }),
    )
    router.push("/")
  }

  const resetFilters = () => {
    setQuery("")
    setCompany("all")
    setWorkplace("all")
    setSort("newest")
    setVisibleCount(PAGE_SIZE)
  }

  const updatedLabel = catalogue.generatedAt
    ? new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
        .format(new Date(catalogue.generatedAt))
    : "Waiting for the first refresh"

  return (
    <div className="jobs-shell">
      <section className="jobs-hero">
        <div>
          <span className="eyebrow"><DatabaseZap className="h-4 w-4" /> Employer-direct discovery</span>
          <h1>Fresh roles.<br /><span>Less noise.</span></h1>
          <p>
            Explore technology opportunities published directly by selected employers, then save the right ones to your private pipeline or tailor a truthful resume immediately.
          </p>
          <div className="jobs-hero-meta">
            <span><BriefcaseBusiness /> {catalogue.jobs.length || "—"} active roles</span>
            <span><Building2 /> {companies.length || "—"} employers</span>
            <span><CalendarClock /> {updatedLabel}</span>
          </div>
        </div>
        <div className="jobs-signal-card" aria-label="Catalogue workflow">
          <span>Greenhouse signal</span>
          <strong>Discover → Save → Tailor</strong>
          <div className="signal-track"><i /><i /><i /></div>
          <small>Every listing links back to the employer’s original application page.</small>
        </div>
      </section>

      {message && (
        <div className="jobs-message" role="status">
          <Check className="h-4 w-4" />
          <span>{message}</span>
          <button onClick={() => setMessage("")} aria-label="Dismiss message"><X className="h-4 w-4" /></button>
        </div>
      )}

      <section className="jobs-toolbar" aria-label="Job filters">
        <label className="jobs-search">
          <Search className="h-4 w-4" />
          <span className="sr-only">Search jobs</span>
          <input
            value={query}
            onChange={(event) => { setQuery(event.target.value); setVisibleCount(PAGE_SIZE) }}
            placeholder="Search Python, backend, Amsterdam…"
          />
        </label>
        <label>
          <Building2 className="h-4 w-4" />
          <span className="sr-only">Company</span>
          <select value={company} onChange={(event) => { setCompany(event.target.value); setVisibleCount(PAGE_SIZE) }}>
            <option value="all">All companies</option>
            {companies.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label>
          <MapPin className="h-4 w-4" />
          <span className="sr-only">Workplace type</span>
          <select value={workplace} onChange={(event) => { setWorkplace(event.target.value as WorkplaceType | "all"); setVisibleCount(PAGE_SIZE) }}>
            <option value="all">Any workplace</option>
            <option value="remote">Remote</option>
            <option value="hybrid">Hybrid</option>
            <option value="onsite">On-site</option>
            <option value="unspecified">Flexible</option>
          </select>
        </label>
        <label>
          <Filter className="h-4 w-4" />
          <span className="sr-only">Sort jobs</span>
          <select value={sort} onChange={(event) => setSort(event.target.value as JobSort)}>
            <option value="newest">Recently updated</option>
            <option value="title">Job title</option>
            <option value="company">Company</option>
          </select>
        </label>
      </section>

      <div className="jobs-results-heading">
        <div>
          <span className="eyebrow">Live catalogue</span>
          <h2>{filteredJobs.length} opportunities match this view</h2>
        </div>
        {(query || company !== "all" || workplace !== "all" || sort !== "newest") && (
          <button onClick={resetFilters}>Clear filters</button>
        )}
      </div>

      {loading ? (
        <div className="jobs-loading"><LoaderCircle className="h-5 w-5 animate-spin" /> Loading employer opportunities…</div>
      ) : loadError ? (
        <div className="jobs-empty">
          <DatabaseZap className="h-6 w-6" />
          <strong>The catalogue is temporarily unavailable.</strong>
          <p>{loadError}</p>
        </div>
      ) : filteredJobs.length ? (
        <>
          <section className="jobs-grid" aria-label="Job opportunities">
            {filteredJobs.slice(0, visibleCount).map((job) => (
              <article className="opportunity-card" key={job.id}>
                <div className="opportunity-topline">
                  <span className={`workplace-badge ${job.workplaceType}`}>{WORKPLACE_LABELS[job.workplaceType]}</span>
                  <span>{formatJobDate(job.updatedAt)}</span>
                </div>
                <button className="opportunity-title" onClick={() => void openJob(job)} aria-busy={loadingDetailId === job.id}>
                  <span className="company-monogram">{job.company.slice(0, 1)}</span>
                  <span>
                    <strong>{job.title}</strong>
                    <small>{job.company}</small>
                  </span>
                  <ChevronRight className="ml-auto h-4 w-4" />
                </button>
                <div className="opportunity-location"><MapPin className="h-3.5 w-3.5" /> {job.location}</div>
                <p>{descriptionExcerpt(job.description)}</p>
                {!!job.skills.length && (
                  <div className="skill-chips">
                    {job.skills.slice(0, 5).map((skill) => <span key={skill}>{skill}</span>)}
                  </div>
                )}
                <div className="opportunity-actions">
                  <Button variant="outline" size="sm" onClick={() => void saveJob(job)} disabled={savingId === job.id}>
                    {savingId === job.id ? <LoaderCircle className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Bookmark className="mr-1.5 h-3.5 w-3.5" />}
                    Save
                  </Button>
                  <Button size="sm" onClick={() => void tailorJob(job)} disabled={loadingDetailId === job.id}>
                    {loadingDetailId === job.id ? <LoaderCircle className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />} Tailor
                  </Button>
                  <a href={job.applyUrl} target="_blank" rel="noopener noreferrer" aria-label={`Apply for ${job.title} at ${job.company}`}>
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              </article>
            ))}
          </section>
          {visibleCount < filteredJobs.length && (
            <div className="jobs-load-more">
              <Button variant="outline" size="lg" onClick={() => setVisibleCount((current) => current + PAGE_SIZE)}>
                Show more opportunities <ArrowUpRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      ) : (
        <div className="jobs-empty">
          <Search className="h-6 w-6" />
          <strong>No opportunities match these filters.</strong>
          <p>Try a broader title, technology or workplace preference.</p>
          <Button variant="outline" onClick={resetFilters}>Reset filters</Button>
        </div>
      )}

      <footer className="jobs-source-note">
        <DatabaseZap className="h-4 w-4" />
        Listings are collected from public Greenhouse employer boards. Availability can change; verify every role on the employer’s application page.
      </footer>

      {selectedJob && (
        <div className="job-detail-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setSelectedJob(null)}>
          <section className="job-detail-panel" role="dialog" aria-modal="true" aria-labelledby="job-detail-title">
            <div className="job-detail-header">
              <div>
                <span className={`workplace-badge ${selectedJob.workplaceType}`}>{WORKPLACE_LABELS[selectedJob.workplaceType]}</span>
                <h2 id="job-detail-title">{selectedJob.title}</h2>
                <p>{selectedJob.company} · {selectedJob.location}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setSelectedJob(null)} aria-label="Close job details"><X className="h-5 w-5" /></Button>
            </div>
            <div className="job-detail-body">
              {!!selectedJob.skills.length && (
                <div className="skill-chips large">{selectedJob.skills.map((skill) => <span key={skill}>{skill}</span>)}</div>
              )}
              <div className="job-description-text">{selectedJob.description}</div>
            </div>
            <div className="job-detail-actions">
              <Button variant="outline" onClick={() => void saveJob(selectedJob)} disabled={savingId === selectedJob.id}>
                <Bookmark className="mr-2 h-4 w-4" /> Save to tracker
              </Button>
              <Button onClick={() => void tailorJob(selectedJob)}><Sparkles className="mr-2 h-4 w-4" /> Tailor resume</Button>
              <a href={selectedJob.applyUrl} target="_blank" rel="noopener noreferrer" className="job-apply-link">
                Apply on employer site <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
