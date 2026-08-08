export const JOB_STATUSES = [
  "bookmarked",
  "applying",
  "applied",
  "interviewing",
  "negotiating",
  "accepted",
  "not_selected",
  "withdrawn",
  "no_response",
  "archived",
] as const

export type JobStatus = (typeof JOB_STATUSES)[number]

export interface JobApplication {
  id: string
  user_id: string
  company: string
  role: string
  status: JobStatus
  location: string
  salary: string
  job_url: string
  job_description: string
  notes: string
  contact_name: string
  contact_email: string
  excitement: number
  date_saved: string
  date_applied: string | null
  follow_up_date: string | null
  deadline: string | null
  resume_template_id: string
  resume_file_name: string
  created_at: string
  updated_at: string
}

export type JobApplicationDraft = Omit<
  JobApplication,
  "id" | "user_id" | "created_at" | "updated_at"
>

export const ACTIVE_STATUSES: JobStatus[] = [
  "bookmarked",
  "applying",
  "applied",
  "interviewing",
  "negotiating",
  "accepted",
]

export const STATUS_LABELS: Record<JobStatus, string> = {
  bookmarked: "Bookmarked",
  applying: "Applying",
  applied: "Applied",
  interviewing: "Interviewing",
  negotiating: "Negotiating",
  accepted: "Accepted",
  not_selected: "Not selected",
  withdrawn: "Withdrawn",
  no_response: "No response",
  archived: "Archived",
}

export const STATUS_ACCENTS: Record<JobStatus, string> = {
  bookmarked: "status-slate",
  applying: "status-violet",
  applied: "status-blue",
  interviewing: "status-amber",
  negotiating: "status-pink",
  accepted: "status-emerald",
  not_selected: "status-rose",
  withdrawn: "status-slate",
  no_response: "status-orange",
  archived: "status-slate",
}

export function emptyApplicationDraft(): JobApplicationDraft {
  return {
    company: "",
    role: "",
    status: "bookmarked",
    location: "",
    salary: "",
    job_url: "",
    job_description: "",
    notes: "",
    contact_name: "",
    contact_email: "",
    excitement: 3,
    date_saved: new Date().toISOString().slice(0, 10),
    date_applied: null,
    follow_up_date: null,
    deadline: null,
    resume_template_id: "",
    resume_file_name: "",
  }
}

export const DEMO_APPLICATIONS: JobApplication[] = [
  {
    id: "demo-1",
    user_id: "demo",
    company: "Northstar AI",
    role: "Backend Engineer",
    status: "interviewing",
    location: "Rotterdam · Hybrid",
    salary: "€68k–€82k",
    job_url: "",
    job_description: "Build dependable APIs and data services for AI products.",
    notes: "Prepare distributed systems examples for the technical conversation.",
    contact_name: "Maya Chen",
    contact_email: "",
    excitement: 5,
    date_saved: "2026-08-02",
    date_applied: "2026-08-04",
    follow_up_date: "2026-08-12",
    deadline: null,
    resume_template_id: "template4",
    resume_file_name: "backend-engineer-resume.pdf",
    created_at: "2026-08-02T10:00:00.000Z",
    updated_at: "2026-08-08T10:00:00.000Z",
  },
  {
    id: "demo-2",
    user_id: "demo",
    company: "Orbit Systems",
    role: "Platform Developer",
    status: "applied",
    location: "Remote · EU",
    salary: "",
    job_url: "",
    job_description: "Own cloud infrastructure and internal developer tooling.",
    notes: "Follow up with the recruiter next week.",
    contact_name: "",
    contact_email: "",
    excitement: 4,
    date_saved: "2026-08-05",
    date_applied: "2026-08-07",
    follow_up_date: "2026-08-14",
    deadline: null,
    resume_template_id: "template2",
    resume_file_name: "platform-resume.pdf",
    created_at: "2026-08-05T10:00:00.000Z",
    updated_at: "2026-08-07T10:00:00.000Z",
  },
  {
    id: "demo-3",
    user_id: "demo",
    company: "Lumen Data",
    role: "Python Engineer",
    status: "bookmarked",
    location: "Amsterdam",
    salary: "€60k–€74k",
    job_url: "",
    job_description: "Create Python services for high-volume data processing.",
    notes: "",
    contact_name: "",
    contact_email: "",
    excitement: 4,
    date_saved: "2026-08-08",
    date_applied: null,
    follow_up_date: null,
    deadline: "2026-08-18",
    resume_template_id: "",
    resume_file_name: "",
    created_at: "2026-08-08T10:00:00.000Z",
    updated_at: "2026-08-08T10:00:00.000Z",
  },
]
