import type { WorkplaceType } from "@/lib/public-jobs"

export interface UserProfile {
  user_id: string
  desired_titles: string[]
  preferred_locations: string[]
  workplace_types: WorkplaceType[]
  experience_level: string
  employment_types: string[]
  skills: string[]
  has_resume: boolean
  base_resume_text: string
  onboarding_completed: boolean
  created_at?: string
  updated_at?: string
}

export const EMPTY_PROFILE: Omit<UserProfile, "user_id"> = {
  desired_titles: [],
  preferred_locations: [],
  workplace_types: [],
  experience_level: "",
  employment_types: [],
  skills: [],
  has_resume: false,
  base_resume_text: "",
  onboarding_completed: false,
}

export function commaList(value: string) {
  return [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))]
}

export function profileMatchScore(job: { title: string; location: string; workplaceType: WorkplaceType; employmentType: string; skills: string[] }, profile: UserProfile | null) {
  if (!profile) return 0
  const title = job.title.toLowerCase()
  const location = job.location.toLowerCase()
  const employment = (job.employmentType || "").toLowerCase()
  const jobSkills = new Set(job.skills.map((skill) => skill.toLowerCase()))
  let score = 0
  if (profile.desired_titles.some((item) => title.includes(item.toLowerCase()))) score += 45
  if (profile.preferred_locations.some((item) => location.includes(item.toLowerCase()))) score += 20
  if (profile.workplace_types.includes(job.workplaceType)) score += 15
  if (profile.employment_types.some((item) => employment.includes(item.toLowerCase()))) score += 5
  score += Math.min(15, profile.skills.filter((skill) => jobSkills.has(skill.toLowerCase())).length * 3)
  return score
}
