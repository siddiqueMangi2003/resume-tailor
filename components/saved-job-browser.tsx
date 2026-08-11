"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { BookmarkCheck, ExternalLink, LoaderCircle, MapPin, Sparkles, Trash2 } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { loadSavedJobs, registerJobApplication, removeSavedJob } from "@/lib/job-actions"
import type { PublicJob } from "@/lib/public-jobs"

export function SavedJobBrowser() {
  const router = useRouter()
  const { loading: authLoading, user, openAuth } = useAuth()
  const [jobs, setJobs] = useState<PublicJob[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState("")
  const [message, setMessage] = useState("")

  const refresh = useCallback(async () => {
    if (!user) { setLoading(false); return }
    setLoading(true)
    try { setJobs(await loadSavedJobs(user.id)) }
    catch (error) { setMessage(error instanceof Error ? error.message : "Saved jobs could not be loaded.") }
    setLoading(false)
  }, [user])

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0)
    return () => window.clearTimeout(timer)
  }, [refresh])

  useEffect(() => {
    if (!user) return
    const pending = sessionStorage.getItem("resume-tailor-pending-apply")
    if (!pending) return
    sessionStorage.removeItem("resume-tailor-pending-apply")
    try {
      const job = JSON.parse(pending) as PublicJob
      queueMicrotask(() => {
        setBusy(job.id)
        void registerJobApplication(job, user.id)
          .then(() => setMessage(`${job.title} was added to the Applying column.`))
          .catch((error) => setMessage(error instanceof Error ? error.message : "The tracker could not be updated."))
          .finally(() => setBusy(""))
      })
    } catch { queueMicrotask(() => setMessage("The pending application could not be restored.")) }
  }, [user])

  const tailor = (job: PublicJob) => {
    sessionStorage.setItem("resume-tailor-application", JSON.stringify({
      id: "", company: job.company, role: job.title, jobDescription: job.description,
    }))
    router.push("/")
  }

  const apply = async (job: PublicJob) => {
    window.open(job.applyUrl, "_blank", "noopener,noreferrer")
    if (!user) {
      sessionStorage.setItem("resume-tailor-pending-apply", JSON.stringify(job))
      openAuth("login")
      return
    }
    setBusy(job.id)
    try {
      await registerJobApplication(job, user.id)
      setMessage(`${job.title} was added to the Applying column.`)
    } catch (error) { setMessage(error instanceof Error ? error.message : "The tracker could not be updated.") }
    setBusy("")
  }

  const remove = async (job: PublicJob) => {
    if (!user) return
    setBusy(job.id)
    try {
      await removeSavedJob(job, user.id)
      setJobs((current) => current.filter((item) => item.id !== job.id))
      setMessage("Job removed from Saved.")
    } catch (error) { setMessage(error instanceof Error ? error.message : "The saved job could not be removed.") }
    setBusy("")
  }

  if (authLoading || loading) return <div className="saved-empty"><LoaderCircle className="animate-spin" /> Loading saved jobs…</div>
  if (!user) return (
    <div className="saved-empty">
      <BookmarkCheck />
      <h2>Your shortlist stays private.</h2>
      <p>Log in to save opportunities and return to them on any device.</p>
      <Button onClick={() => openAuth("login")}>Log in to view Saved</Button>
    </div>
  )

  return (
    <>
      {message && <div className="jobs-message" role="status"><BookmarkCheck /><span>{message}</span></div>}
      {jobs.length ? (
        <section className="saved-grid" aria-label="Saved jobs">
          {jobs.map((job) => (
            <article className="saved-job-card" key={job.id}>
              <div className="saved-job-source"><span>{job.sourceLabel}</span><strong>{job.company}</strong></div>
              <h2>{job.title}</h2>
              <p className="saved-job-location"><MapPin /> {job.location}</p>
              <p>{job.description.slice(0, 240)}{job.description.length > 240 ? "…" : ""}</p>
              <div className="skill-chips">{job.skills.slice(0, 5).map((skill) => <span key={skill}>{skill}</span>)}</div>
              <div className="saved-job-actions">
                <Button variant="outline" size="sm" onClick={() => void remove(job)} disabled={busy === job.id}><Trash2 /> Remove</Button>
                <Button size="sm" onClick={() => tailor(job)}><Sparkles /> Tailor</Button>
                <Button variant="outline" size="sm" onClick={() => void apply(job)} disabled={busy === job.id}>Apply <ExternalLink /></Button>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <div className="saved-empty">
          <BookmarkCheck />
          <h2>No saved jobs yet.</h2>
          <p>Use Save on the Jobs page to build a focused shortlist.</p>
          <Button onClick={() => router.push("/jobs")}>Explore jobs</Button>
        </div>
      )}
    </>
  )
}
