"use client"

import { useCallback, useEffect, useMemo, useState, type DragEvent } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowUpRight,
  BriefcaseBusiness,
  CalendarClock,
  ChevronRight,
  Download,
  FilePenLine,
  GripVertical,
  LayoutGrid,
  ListFilter,
  Plus,
  Search,
  Sparkles,
  TableProperties,
  Trophy,
} from "lucide-react"
import { ApplicationDialog } from "@/components/application-dialog"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/components/auth-provider"
import { getSupabaseBrowserClient } from "@/lib/supabase"
import {
  ACTIVE_STATUSES,
  DEMO_APPLICATIONS,
  JOB_STATUSES,
  STATUS_ACCENTS,
  STATUS_LABELS,
  type JobApplication,
  type JobApplicationDraft,
  type JobStatus,
} from "@/lib/job-applications"

type TrackerView = "board" | "table"
type TrackerScope = "active" | "closed" | "all"

function formatDate(value: string | null) {
  if (!value) return "—"
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(
    new Date(`${value}T12:00:00`),
  )
}

function isOverdue(value: string | null) {
  if (!value) return false
  return new Date(`${value}T23:59:59`) < new Date()
}

function csvCell(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`
}

function downloadText(filename: string, contents: string, type: string) {
  const url = URL.createObjectURL(new Blob([contents], { type }))
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function ApplicationCard({
  application,
  onOpen,
  onTailor,
}: {
  application: JobApplication
  onOpen: () => void
  onTailor: () => void
}) {
  return (
    <article
      className="job-card"
      draggable
      onDragStart={(event) => event.dataTransfer.setData("text/job-application-id", application.id)}
    >
      <div className="job-card-topline">
        <span className={`status-dot ${STATUS_ACCENTS[application.status]}`} />
        <GripVertical className="h-4 w-4 text-muted-foreground/50" aria-hidden="true" />
      </div>
      <button className="job-card-main" onClick={onOpen} aria-label={`Open ${application.role} at ${application.company}`}>
        <span className="company-monogram">{application.company.slice(0, 1).toUpperCase()}</span>
        <span>
          <strong>{application.role}</strong>
          <small>{application.company}</small>
        </span>
        <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
      </button>
      {application.location && <p className="job-card-meta">{application.location}</p>}
      <div className="job-card-footer">
        <span className="excitement" aria-label={`${application.excitement} out of 5 excitement`}>
          {Array.from({ length: 5 }, (_, index) => (
            <i key={index} className={index < application.excitement ? "active" : ""} />
          ))}
        </span>
        {application.follow_up_date && (
          <span className={isOverdue(application.follow_up_date) ? "date-chip overdue" : "date-chip"}>
            {isOverdue(application.follow_up_date) ? "Overdue · " : "Follow up · "}
            {formatDate(application.follow_up_date)}
          </span>
        )}
      </div>
      <button className="tailor-link" onClick={onTailor} disabled={!application.job_description}>
        <Sparkles className="h-3.5 w-3.5" /> Tailor resume
      </button>
    </article>
  )
}

export function JobTracker({ demo = false }: { demo?: boolean }) {
  const router = useRouter()
  const { user } = useAuth()
  const [applications, setApplications] = useState<JobApplication[]>(demo ? DEMO_APPLICATIONS : [])
  const [loading, setLoading] = useState(!demo)
  const [saving, setSaving] = useState(false)
  const [view, setView] = useState<TrackerView>("board")
  const [scope, setScope] = useState<TrackerScope>("active")
  const [query, setQuery] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<JobApplication | null>(null)
  const [initialStatus, setInitialStatus] = useState<JobStatus>("bookmarked")
  const [message, setMessage] = useState("")

  const loadApplications = useCallback(async () => {
    if (demo || !user) return
    const supabase = getSupabaseBrowserClient()
    if (!supabase) return
    const { data, error } = await supabase
      .from("job_applications")
      .select("*")
      .order("updated_at", { ascending: false })
    if (error) setMessage(error.message)
    else setApplications((data ?? []) as JobApplication[])
    setLoading(false)
  }, [demo, user])

  useEffect(() => {
    const task = window.setTimeout(() => void loadApplications(), 0)
    return () => window.clearTimeout(task)
  }, [loadApplications])

  const filteredApplications = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return applications.filter((application) => {
      const active = ACTIVE_STATUSES.includes(application.status)
      const scopeMatch = scope === "all" || (scope === "active" ? active : !active)
      const queryMatch =
        !normalizedQuery ||
        [application.company, application.role, application.location, application.notes]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery)
      return scopeMatch && queryMatch
    })
  }, [applications, query, scope])

  const stats = useMemo(() => {
    const interviews = applications.filter((application) => application.status === "interviewing").length
    const offers = applications.filter((application) =>
      ["negotiating", "accepted"].includes(application.status),
    ).length
    const overdue = applications.filter((application) => isOverdue(application.follow_up_date)).length
    const applied = applications.filter((application) =>
      ["applied", "interviewing", "negotiating", "accepted"].includes(application.status),
    ).length
    const responseRate = applied ? Math.round(((interviews + offers) / applied) * 100) : 0
    return { total: applications.length, interviews, offers, overdue, responseRate }
  }, [applications])

  const openNew = (status: JobStatus = "bookmarked") => {
    if (demo) {
      setMessage("Connect Supabase to add your own applications. This is a read-only preview.")
      return
    }
    setEditing(null)
    setInitialStatus(status)
    setDialogOpen(true)
  }

  const openExisting = (application: JobApplication) => {
    if (demo) {
      setMessage("Sign in after Supabase is connected to edit this application.")
      return
    }
    setEditing(application)
    setInitialStatus(application.status)
    setDialogOpen(true)
  }

  const saveApplication = async (draft: JobApplicationDraft) => {
    if (!user || demo) return
    const supabase = getSupabaseBrowserClient()
    if (!supabase) return
    setSaving(true)
    setMessage("")

    const payload = { ...draft, company: draft.company.trim(), role: draft.role.trim() }
    const result = editing
      ? await supabase.from("job_applications").update(payload).eq("id", editing.id).select().single()
      : await supabase
          .from("job_applications")
          .insert({ ...payload, user_id: user.id })
          .select()
          .single()

    if (result.error) {
      setMessage(result.error.message)
    } else {
      const saved = result.data as JobApplication
      setApplications((current) =>
        editing
          ? current.map((application) => (application.id === saved.id ? saved : application))
          : [saved, ...current],
      )
      setDialogOpen(false)
      setEditing(null)
      setMessage(editing ? "Application updated." : "Application added to your pipeline.")
    }
    setSaving(false)
  }

  const deleteApplication = async () => {
    if (!editing || !user || demo) return
    if (!window.confirm(`Delete ${editing.role} at ${editing.company}? This cannot be undone.`)) return
    const supabase = getSupabaseBrowserClient()
    if (!supabase) return
    setSaving(true)
    const { error } = await supabase.from("job_applications").delete().eq("id", editing.id)
    if (error) setMessage(error.message)
    else {
      setApplications((current) => current.filter((application) => application.id !== editing.id))
      setDialogOpen(false)
      setEditing(null)
      setMessage("Application deleted.")
    }
    setSaving(false)
  }

  const updateStatus = async (applicationId: string, status: JobStatus) => {
    if (demo) return
    const current = applications.find((application) => application.id === applicationId)
    if (!current || current.status === status) return
    setApplications((items) =>
      items.map((application) => (application.id === applicationId ? { ...application, status } : application)),
    )
    const supabase = getSupabaseBrowserClient()
    const { error } = (await supabase?.from("job_applications").update({ status }).eq("id", applicationId)) ?? {
      error: new Error("Supabase is unavailable."),
    }
    if (error) {
      setApplications((items) =>
        items.map((application) =>
          application.id === applicationId ? { ...application, status: current.status } : application,
        ),
      )
      setMessage(error.message)
    }
  }

  const handleDrop = (event: DragEvent, status: JobStatus) => {
    event.preventDefault()
    const applicationId = event.dataTransfer.getData("text/job-application-id")
    if (applicationId) void updateStatus(applicationId, status)
  }

  const tailorApplication = (application: JobApplication) => {
    if (!application.job_description) {
      setMessage("Add the job description before tailoring a resume for this role.")
      return
    }
    sessionStorage.setItem(
      "resume-tailor-application",
      JSON.stringify({
        id: application.id,
        company: application.company,
        role: application.role,
        jobDescription: application.job_description,
      }),
    )
    router.push("/")
  }

  const exportApplications = (format: "json" | "csv") => {
    if (format === "json") {
      downloadText(
        `resume-tailor-applications-${new Date().toISOString().slice(0, 10)}.json`,
        JSON.stringify(applications, null, 2),
        "application/json",
      )
      return
    }
    const keys: (keyof JobApplication)[] = [
      "company", "role", "status", "location", "salary", "date_saved", "date_applied",
      "follow_up_date", "deadline", "excitement", "job_url", "contact_name", "contact_email", "notes",
    ]
    const csv = [keys.map(csvCell).join(","), ...applications.map((item) => keys.map((key) => csvCell(item[key])).join(","))].join("\n")
    downloadText(`resume-tailor-applications-${new Date().toISOString().slice(0, 10)}.csv`, csv, "text/csv")
  }

  const boardStatuses = scope === "closed"
    ? JOB_STATUSES.filter((status) => !ACTIVE_STATUSES.includes(status))
    : ACTIVE_STATUSES

  return (
    <div className="tracker-shell">
      <section className="tracker-hero">
        <div>
          <span className="eyebrow"><span className="live-dot" /> Your search, in motion</span>
          <h1>Turn applications into a <span>clear pipeline.</span></h1>
          <p>Save every opportunity, plan every follow-up, and tailor the right resume without losing context.</p>
        </div>
        <Button size="lg" onClick={() => openNew()} disabled={demo}>
          <Plus className="mr-2 h-4 w-4" /> Add application
        </Button>
      </section>

      <section className="stats-grid" aria-label="Application statistics">
        <div className="stat-card violet"><BriefcaseBusiness /><span>Applications</span><strong>{stats.total}</strong><small>Across your search</small></div>
        <div className="stat-card blue"><CalendarClock /><span>Interviews</span><strong>{stats.interviews}</strong><small>Conversations active</small></div>
        <div className="stat-card emerald"><Trophy /><span>Offer stage</span><strong>{stats.offers}</strong><small>Negotiating or accepted</small></div>
        <div className="stat-card amber"><ArrowUpRight /><span>Response rate</span><strong>{stats.responseRate}%</strong><small>{stats.overdue} follow-ups overdue</small></div>
      </section>

      {message && (
        <div className="tracker-message" role="status">
          <Sparkles className="h-4 w-4" />
          <span>{message}</span>
          <button onClick={() => setMessage("")} aria-label="Dismiss message">×</button>
        </div>
      )}

      <section className="tracker-toolbar" aria-label="Tracker controls">
        <div className="search-control">
          <Search className="h-4 w-4" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search roles or companies" aria-label="Search applications" />
        </div>
        <div className="segmented-control" aria-label="Application scope">
          {(["active", "closed", "all"] as TrackerScope[]).map((item) => (
            <button key={item} className={scope === item ? "active" : ""} onClick={() => setScope(item)}>{item}</button>
          ))}
        </div>
        <div className="toolbar-spacer" />
        <div className="segmented-control icon-control" aria-label="Tracker view">
          <button className={view === "board" ? "active" : ""} onClick={() => setView("board")} aria-label="Board view"><LayoutGrid className="h-4 w-4" /></button>
          <button className={view === "table" ? "active" : ""} onClick={() => setView("table")} aria-label="Table view"><TableProperties className="h-4 w-4" /></button>
        </div>
        <div className="export-menu">
          <Download className="h-4 w-4" />
          <button onClick={() => exportApplications("csv")}>CSV</button>
          <button onClick={() => exportApplications("json")}>JSON</button>
        </div>
      </section>

      {loading ? (
        <div className="tracker-loading"><span /><span /><span /><p>Loading your pipeline…</p></div>
      ) : view === "board" ? (
        <section className="kanban" aria-label="Application pipeline">
          {boardStatuses.map((status) => {
            const items = filteredApplications.filter((application) => application.status === status)
            return (
              <div
                className="kanban-column"
                key={status}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => handleDrop(event, status)}
              >
                <div className="kanban-header">
                  <span className={`status-dot ${STATUS_ACCENTS[status]}`} />
                  <strong>{STATUS_LABELS[status]}</strong>
                  <span>{items.length}</span>
                  <button onClick={() => openNew(status)} disabled={demo} aria-label={`Add ${STATUS_LABELS[status]} application`}><Plus className="h-4 w-4" /></button>
                </div>
                <div className="kanban-stack">
                  {items.map((application) => (
                    <ApplicationCard
                      key={application.id}
                      application={application}
                      onOpen={() => openExisting(application)}
                      onTailor={() => tailorApplication(application)}
                    />
                  ))}
                  {!items.length && <button className="empty-column" onClick={() => openNew(status)} disabled={demo}>Drop here or add a role</button>}
                </div>
              </div>
            )
          })}
        </section>
      ) : (
        <section className="table-shell">
          <table className="applications-table">
            <thead><tr><th>Opportunity</th><th>Status</th><th>Applied</th><th>Follow-up</th><th>Excitement</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {filteredApplications.map((application) => (
                <tr key={application.id}>
                  <td><strong>{application.role}</strong><span>{application.company}{application.location ? ` · ${application.location}` : ""}</span></td>
                  <td><span className={`table-status ${STATUS_ACCENTS[application.status]}`}>{STATUS_LABELS[application.status]}</span></td>
                  <td>{formatDate(application.date_applied)}</td>
                  <td className={isOverdue(application.follow_up_date) ? "overdue-text" : ""}>{formatDate(application.follow_up_date)}</td>
                  <td>{application.excitement}/5</td>
                  <td><button onClick={() => openExisting(application)} aria-label={`Edit ${application.role}`}><FilePenLine className="h-4 w-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filteredApplications.length && <div className="table-empty"><ListFilter className="h-5 w-5" /> No applications match this view.</div>}
        </section>
      )}

      {dialogOpen && (
        <ApplicationDialog
          key={editing?.id ?? `new-${initialStatus}`}
          open
          application={editing}
          initialStatus={initialStatus}
          saving={saving}
          onClose={() => setDialogOpen(false)}
          onSave={saveApplication}
          onDelete={editing ? deleteApplication : undefined}
        />
      )}
    </div>
  )
}
