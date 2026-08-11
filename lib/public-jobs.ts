export type WorkplaceType = "remote" | "hybrid" | "onsite" | "unspecified"

export interface PublicJob {
  id: string
  source: "greenhouse"
  sourceLabel: string
  sourceJobId: string
  company: string
  title: string
  location: string
  workplaceType: WorkplaceType
  department: string
  skills: string[]
  description: string
  jobUrl: string
  applyUrl: string
  updatedAt: string | null
}

export interface JobCatalogue {
  generatedAt: string
  source: string
  companies: Array<{ company: string; token: string }>
  jobs: PublicJob[]
}

export const EMPTY_JOB_CATALOGUE: JobCatalogue = {
  generatedAt: "",
  source: "Greenhouse public Job Board API",
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
