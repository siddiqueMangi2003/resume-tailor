"use client"

import { useEffect, useState, type FormEvent } from "react"
import { BriefcaseBusiness, CalendarDays, Link2, Mail, MapPin, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  JOB_STATUSES,
  STATUS_LABELS,
  emptyApplicationDraft,
  type JobApplication,
  type JobApplicationDraft,
  type JobStatus,
} from "@/lib/job-applications"

interface ApplicationDialogProps {
  open: boolean
  application: JobApplication | null
  initialStatus?: JobStatus
  saving: boolean
  onClose: () => void
  onSave: (draft: JobApplicationDraft) => Promise<void>
  onDelete?: () => Promise<void>
}

function dateValue(value: string | null) {
  return value ?? ""
}

function draftFromApplication(application: JobApplication | null, initialStatus: JobStatus) {
  if (!application) return { ...emptyApplicationDraft(), status: initialStatus }
  return {
    company: application.company,
    role: application.role,
    status: application.status,
    location: application.location,
    salary: application.salary,
    job_url: application.job_url,
    job_description: application.job_description,
    notes: application.notes,
    contact_name: application.contact_name,
    contact_email: application.contact_email,
    excitement: application.excitement,
    date_saved: application.date_saved,
    date_applied: application.date_applied,
    follow_up_date: application.follow_up_date,
    deadline: application.deadline,
    resume_template_id: application.resume_template_id,
    resume_file_name: application.resume_file_name,
  }
}

export function ApplicationDialog({
  open,
  application,
  initialStatus = "bookmarked",
  saving,
  onClose,
  onSave,
  onDelete,
}: ApplicationDialogProps) {
  const [draft, setDraft] = useState<JobApplicationDraft>(() =>
    draftFromApplication(application, initialStatus),
  )

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handleKeyDown)
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
      document.body.style.overflow = ""
    }
  }, [onClose, open])

  if (!open) return null

  const setField = <K extends keyof JobApplicationDraft>(key: K, value: JobApplicationDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    await onSave(draft)
  }

  return (
    <div className="dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section
        className="application-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="application-dialog-title"
      >
        <div className="dialog-header">
          <div>
            <span className="eyebrow">Application workspace</span>
            <h2 id="application-dialog-title" className="font-heading text-2xl font-bold">
              {application ? "Update opportunity" : "Add an opportunity"}
            </h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close application editor">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <form onSubmit={submit} className="dialog-form">
          <div className="form-section">
            <div className="form-section-title">
              <BriefcaseBusiness className="h-4 w-4" />
              Role details
            </div>
            <div className="form-grid">
              <label className="field-label">
                Company <span aria-hidden="true">*</span>
                <input
                  className="field-input"
                  value={draft.company}
                  maxLength={160}
                  required
                  autoFocus
                  onChange={(event) => setField("company", event.target.value)}
                  placeholder="Northstar AI"
                />
              </label>
              <label className="field-label">
                Position <span aria-hidden="true">*</span>
                <input
                  className="field-input"
                  value={draft.role}
                  maxLength={160}
                  required
                  onChange={(event) => setField("role", event.target.value)}
                  placeholder="Backend Engineer"
                />
              </label>
              <label className="field-label">
                <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />Location</span>
                <input
                  className="field-input"
                  value={draft.location}
                  maxLength={240}
                  onChange={(event) => setField("location", event.target.value)}
                  placeholder="Remote · Europe"
                />
              </label>
              <label className="field-label">
                Salary range
                <input
                  className="field-input"
                  value={draft.salary}
                  maxLength={120}
                  onChange={(event) => setField("salary", event.target.value)}
                  placeholder="€65k–€80k"
                />
              </label>
              <label className="field-label form-span-2">
                <span className="inline-flex items-center gap-1.5"><Link2 className="h-3.5 w-3.5" />Job posting</span>
                <input
                  type="url"
                  className="field-input"
                  value={draft.job_url}
                  maxLength={2048}
                  onChange={(event) => setField("job_url", event.target.value)}
                  placeholder="https://company.com/jobs/..."
                />
              </label>
            </div>
          </div>

          <div className="form-section">
            <div className="form-section-title">
              <CalendarDays className="h-4 w-4" />
              Pipeline and timing
            </div>
            <div className="form-grid form-grid-4">
              <label className="field-label">
                Status
                <select
                  className="field-input"
                  value={draft.status}
                  onChange={(event) => setField("status", event.target.value as JobStatus)}
                >
                  {JOB_STATUSES.map((status) => (
                    <option key={status} value={status}>{STATUS_LABELS[status]}</option>
                  ))}
                </select>
              </label>
              <label className="field-label">
                Saved
                <input
                  type="date"
                  className="field-input"
                  value={draft.date_saved}
                  onChange={(event) => setField("date_saved", event.target.value)}
                />
              </label>
              <label className="field-label">
                Applied
                <input
                  type="date"
                  className="field-input"
                  value={dateValue(draft.date_applied)}
                  onChange={(event) => setField("date_applied", event.target.value || null)}
                />
              </label>
              <label className="field-label">
                Follow up
                <input
                  type="date"
                  className="field-input"
                  value={dateValue(draft.follow_up_date)}
                  onChange={(event) => setField("follow_up_date", event.target.value || null)}
                />
              </label>
              <label className="field-label">
                Deadline
                <input
                  type="date"
                  className="field-input"
                  value={dateValue(draft.deadline)}
                  onChange={(event) => setField("deadline", event.target.value || null)}
                />
              </label>
              <fieldset className="field-label form-span-2">
                <legend>Excitement</legend>
                <div className="rating-row" aria-label="Excitement rating">
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <button
                      type="button"
                      key={rating}
                      className={rating <= draft.excitement ? "rating-dot active" : "rating-dot"}
                      onClick={() => setField("excitement", rating)}
                      aria-label={`${rating} out of 5`}
                      aria-pressed={draft.excitement === rating}
                    />
                  ))}
                  <span>{draft.excitement}/5</span>
                </div>
              </fieldset>
            </div>
          </div>

          <div className="form-section">
            <div className="form-section-title">
              <Mail className="h-4 w-4" />
              Context and contacts
            </div>
            <div className="form-grid">
              <label className="field-label">
                Contact name
                <input
                  className="field-input"
                  value={draft.contact_name}
                  maxLength={160}
                  onChange={(event) => setField("contact_name", event.target.value)}
                  placeholder="Recruiter or hiring manager"
                />
              </label>
              <label className="field-label">
                Contact email
                <input
                  type="email"
                  className="field-input"
                  value={draft.contact_email}
                  maxLength={320}
                  onChange={(event) => setField("contact_email", event.target.value)}
                  placeholder="name@company.com"
                />
              </label>
              <label className="field-label form-span-2">
                Job description
                <textarea
                  className="field-input field-textarea"
                  value={draft.job_description}
                  maxLength={30000}
                  onChange={(event) => setField("job_description", event.target.value)}
                  placeholder="Keep the full description for tailoring and interview preparation."
                />
              </label>
              <label className="field-label form-span-2">
                Notes
                <textarea
                  className="field-input field-textarea small"
                  value={draft.notes}
                  maxLength={20000}
                  onChange={(event) => setField("notes", event.target.value)}
                  placeholder="Questions, interview feedback, follow-up details..."
                />
              </label>
            </div>
          </div>

          <div className="dialog-actions">
            {application && onDelete ? (
              <Button type="button" variant="ghost" className="text-destructive" onClick={() => void onDelete()}>
                <Trash2 className="mr-2 h-4 w-4" /> Delete
              </Button>
            ) : <span />}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={saving || !draft.company.trim() || !draft.role.trim()}>
                {saving ? "Saving…" : application ? "Save changes" : "Add application"}
              </Button>
            </div>
          </div>
        </form>
      </section>
    </div>
  )
}
