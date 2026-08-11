export type WorkplaceType = "remote" | "hybrid" | "onsite" | "unspecified"
export type JobSource = "greenhouse" | "lever" | "arbeitnow" | "remotive"

export interface PublicJob {
  id: string
  source: JobSource
  sourceLabel: string
  sourceJobId: string
  company: string
  title: string
  location: string
  workplaceType: WorkplaceType
  department: string
  employmentType: string
  salary: string
  skills: string[]
  description: string
  jobUrl: string
  applyUrl: string
  publishedAt: string | null
  updatedAt: string | null
}

export interface JobCatalogue {
  generatedAt: string
  source: string
  sources: Array<{ source: JobSource; label: string; jobs: number }>
  companies: Array<{ company: string; source: JobSource }>
  jobs: PublicJob[]
}

export const EMPTY_JOB_CATALOGUE: JobCatalogue = {
  generatedAt: "",
  source: "Public job feeds",
  sources: [],
  companies: [],
  jobs: [],
}

export const WORKPLACE_LABELS: Record<WorkplaceType, string> = {
  remote: "Remote",
  hybrid: "Hybrid",
  onsite: "On-site",
  unspecified: "Flexible",
}

export function formatJobDate(value: string | null) {
  if (!value) return "Recently updated"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Recently updated"
  const elapsedDays = Math.max(0, Math.floor((Date.now() - date.getTime()) / 86_400_000))
  if (elapsedDays === 0) return "Updated today"
  if (elapsedDays === 1) return "Updated yesterday"
  if (elapsedDays < 30) return `Updated ${elapsedDays} days ago`
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(date)
}
