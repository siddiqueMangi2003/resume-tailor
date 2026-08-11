"use client"

import { useEffect, useMemo, useState } from "react"
import { BriefcaseBusiness, Check, ChevronLeft, ChevronRight, FileText, LoaderCircle, MapPin, Sparkles, Upload, X } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { getSupabaseBrowserClient } from "@/lib/supabase"
import { commaList, EMPTY_PROFILE, type UserProfile } from "@/lib/user-profile"
import type { WorkplaceType } from "@/lib/public-jobs"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "")
const localCompleteKey = "resume-tailor-onboarding-complete"
const localDraftKey = "resume-tailor-onboarding-draft"

type ResumeChoice = "upload" | "manual" | "later"

interface ManualResume {
  name: string
  email: string
  phone: string
  summary: string
  experience: string
  education: string
  skills: string
  projects: string
  certifications: string
}

const emptyManual: ManualResume = { name: "", email: "", phone: "", summary: "", experience: "", education: "", skills: "", projects: "", certifications: "" }

function buildManualResume(value: ManualResume) {
  return [
    value.name, [value.email, value.phone].filter(Boolean).join(" | "),
    value.summary && `PROFESSIONAL SUMMARY\n${value.summary}`,
    value.experience && `EXPERIENCE\n${value.experience}`,
    value.education && `EDUCATION\n${value.education}`,
    value.skills && `SKILLS\n${value.skills}`,
    value.projects && `PROJECTS\n${value.projects}`,
    value.certifications && `CERTIFICATIONS\n${value.certifications}`,
  ].filter(Boolean).join("\n\n").trim()
}

export function OnboardingDialog() {
  const { loading: authLoading, user, openAuth } = useAuth()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [titles, setTitles] = useState("")
  const [locations, setLocations] = useState("")
  const [workplaces, setWorkplaces] = useState<WorkplaceType[]>([])
  const [level, setLevel] = useState("")
  const [employment, setEmployment] = useState("Full-time")
  const [skills, setSkills] = useState("")
  const [resumeChoice, setResumeChoice] = useState<ResumeChoice>("later")
  const [resumeFile, setResumeFile] = useState<File | null>(null)
  const [existingResumeText, setExistingResumeText] = useState("")
  const [manual, setManual] = useState<ManualResume>(emptyManual)

  useEffect(() => {
    if (authLoading) return
    let active = true
    const timer = window.setTimeout(async () => {
      if (!active) return
      if (!user) {
        if (!localStorage.getItem(localCompleteKey)) setOpen(true)
        return
      }
      const pending = sessionStorage.getItem(localDraftKey)
      if (pending) {
        try {
          const draft = JSON.parse(pending) as { titles: string; locations: string; workplaces: WorkplaceType[]; level: string; employment: string; skills: string; resumeChoice: ResumeChoice; manual: ManualResume }
          setTitles(draft.titles); setLocations(draft.locations); setWorkplaces(draft.workplaces)
          setLevel(draft.level); setEmployment(draft.employment); setSkills(draft.skills)
          setResumeChoice(draft.resumeChoice); setManual(draft.manual); setStep(1); setOpen(true)
        } catch { sessionStorage.removeItem(localDraftKey) }
      }
      const supabase = getSupabaseBrowserClient()
      if (!supabase) return
      const { data, error: profileError } = await supabase.from("user_profiles").select("*").eq("user_id", user.id).maybeSingle()
      if (!active) return
      if (data) {
        const profile = data as UserProfile
        setTitles(profile.desired_titles.join(", ")); setLocations(profile.preferred_locations.join(", "))
        setWorkplaces(profile.workplace_types); setLevel(profile.experience_level)
        setEmployment(profile.employment_types.join(", ")); setSkills(profile.skills.join(", "))
        setExistingResumeText(profile.base_resume_text)
        setResumeChoice("later")
      }
      if (data?.onboarding_completed) { localStorage.setItem(localCompleteKey, "true"); return }
      if (profileError && !/schema cache|does not exist/i.test(profileError.message)) return
      setOpen(true)
    }, user ? 0 : 900)
    return () => { active = false; window.clearTimeout(timer) }
  }, [authLoading, user])

  useEffect(() => {
    const show = () => { setStep(0); setOpen(true) }
    window.addEventListener("resume-tailor-open-onboarding", show)
    return () => window.removeEventListener("resume-tailor-open-onboarding", show)
  }, [])

  const profileDraft = useMemo(() => ({
    ...EMPTY_PROFILE,
    desired_titles: commaList(titles),
    preferred_locations: commaList(locations),
    workplace_types: workplaces,
    experience_level: level,
    employment_types: commaList(employment),
    skills: commaList(skills),
    has_resume: resumeChoice !== "later" || Boolean(existingResumeText),
  }), [employment, existingResumeText, level, locations, resumeChoice, skills, titles, workplaces])

  if (!open) return null

  const storePendingAndAuthenticate = () => {
    sessionStorage.setItem(localDraftKey, JSON.stringify({ titles, locations, workplaces, level, employment, skills, resumeChoice, manual }))
    localStorage.setItem(localCompleteKey, "true")
    setOpen(false)
    openAuth("signup")
  }

  const skip = async () => {
    localStorage.setItem(localCompleteKey, "true")
    setOpen(false)
    if (!user) return
    const supabase = getSupabaseBrowserClient()
    await supabase?.from("user_profiles").upsert({ user_id: user.id, ...EMPTY_PROFILE, onboarding_completed: true }, { onConflict: "user_id" })
  }

  const finish = async () => {
    if (!user) { storePendingAndAuthenticate(); return }
    setSaving(true); setError("")
    let resumeText = resumeChoice === "manual" ? buildManualResume(manual) : existingResumeText
    try {
      if (resumeChoice === "upload") {
        if (!resumeFile) throw new Error("Choose a TXT, PDF or DOCX resume to continue.")
        if (!API_BASE_URL) throw new Error("Resume extraction is not configured for this deployment.")
        const form = new FormData(); form.append("resume", resumeFile)
        const response = await fetch(`${API_BASE_URL}/extract_resume`, { method: "POST", body: form })
        const payload = await response.json() as { text?: string; detail?: string }
        if (!response.ok || !payload.text) throw new Error(payload.detail || "The resume could not be read.")
        resumeText = payload.text
      }
      if (resumeChoice === "manual" && !resumeText) throw new Error("Add at least your name and one resume section.")
      const profile: UserProfile = {
        user_id: user.id, ...profileDraft, base_resume_text: resumeText,
        onboarding_completed: true,
      }
      const supabase = getSupabaseBrowserClient()
      const result = await supabase?.from("user_profiles").upsert(profile, { onConflict: "user_id" })
      if (!result) throw new Error("The private profile connection is unavailable.")
      if (result.error) throw result.error
      localStorage.setItem(localCompleteKey, "true")
      sessionStorage.removeItem(localDraftKey)
      window.dispatchEvent(new CustomEvent("resume-tailor-profile-updated", { detail: profile }))
      setOpen(false)
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Your profile could not be saved.") }
    setSaving(false)
  }

  const toggleWorkplace = (value: WorkplaceType) => setWorkplaces((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value])

  return (
    <div className="onboarding-backdrop">
      <section className="onboarding-dialog" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
        <button className="auth-modal-close" onClick={() => void skip()} aria-label="Skip onboarding"><X /></button>
        <div className="onboarding-progress"><i className={step >= 0 ? "active" : ""} /><i className={step >= 1 ? "active" : ""} /><i className={step >= 2 ? "active" : ""} /></div>
        {step === 0 && (
          <div className="onboarding-step">
            <span className="onboarding-icon"><BriefcaseBusiness /></span>
            <p className="eyebrow">Personalize your search</p>
            <h2 id="onboarding-title">What kind of opportunity should we find?</h2>
            <p>These preferences improve job ordering. You can change them later.</p>
            <div className="onboarding-grid">
              <label><span>Desired job titles</span><input value={titles} onChange={(event) => setTitles(event.target.value)} placeholder="Backend Engineer, Data Engineer" /></label>
              <label><span>Preferred locations</span><input value={locations} onChange={(event) => setLocations(event.target.value)} placeholder="Netherlands, Remote, Berlin" /></label>
              <label><span>Experience level</span><select value={level} onChange={(event) => setLevel(event.target.value)}><option value="">Any level</option><option>Entry level</option><option>Mid level</option><option>Senior</option><option>Lead</option></select></label>
              <label><span>Employment type</span><input value={employment} onChange={(event) => setEmployment(event.target.value)} placeholder="Full-time, Contract" /></label>
              <label className="onboarding-span"><span>Key skills</span><input value={skills} onChange={(event) => setSkills(event.target.value)} placeholder="Python, FastAPI, PostgreSQL, AWS" /></label>
              <fieldset className="onboarding-span"><legend>Workplace preference</legend><div className="choice-chips">{(["remote", "hybrid", "onsite"] as WorkplaceType[]).map((item) => <button type="button" key={item} className={workplaces.includes(item) ? "active" : ""} onClick={() => toggleWorkplace(item)}><MapPin /> {item}</button>)}</div></fieldset>
            </div>
          </div>
        )}
        {step === 1 && (
          <div className="onboarding-step">
            <span className="onboarding-icon"><FileText /></span>
            <p className="eyebrow">Your resume foundation</p>
            <h2>Do you already have a CV?</h2>
            <p>We only use information you provide and never invent qualifications.</p>
            <div className="resume-choice-grid">
              <button className={resumeChoice === "upload" ? "active" : ""} onClick={() => setResumeChoice("upload")}><Upload /><strong>Yes, upload it</strong><span>TXT, PDF or DOCX</span></button>
              <button className={resumeChoice === "manual" ? "active" : ""} onClick={() => setResumeChoice("manual")}><Sparkles /><strong>Build one with me</strong><span>Answer guided questions</span></button>
              <button className={resumeChoice === "later" ? "active" : ""} onClick={() => setResumeChoice("later")}><ChevronRight /><strong>I’ll add it later</strong><span>Explore jobs first</span></button>
            </div>
          </div>
        )}
        {step === 2 && (
          <div className="onboarding-step">
            <span className="onboarding-icon"><Check /></span>
            <p className="eyebrow">Finish your workspace</p>
            {resumeChoice === "upload" ? <><h2>Upload your existing CV</h2><p>Readable text is extracted into your private profile; the original file is not stored.</p><label className="onboarding-upload"><Upload /><input type="file" accept=".txt,.pdf,.docx" onChange={(event) => setResumeFile(event.target.files?.[0] || null)} /><strong>{resumeFile?.name || "Choose resume"}</strong></label></> : resumeChoice === "manual" ? <><h2>Build a factual base resume</h2><p>Use plain language. You will review and edit this again before tailoring.</p><div className="manual-resume-grid"><label><span>Name</span><input value={manual.name} onChange={(event) => setManual({ ...manual, name: event.target.value })} /></label><label><span>Email</span><input type="email" value={manual.email} onChange={(event) => setManual({ ...manual, email: event.target.value })} /></label><label><span>Phone</span><input value={manual.phone} onChange={(event) => setManual({ ...manual, phone: event.target.value })} /></label><label><span>Summary</span><textarea value={manual.summary} onChange={(event) => setManual({ ...manual, summary: event.target.value })} /></label><label><span>Experience</span><textarea value={manual.experience} onChange={(event) => setManual({ ...manual, experience: event.target.value })} placeholder="Role, company, dates, achievements" /></label><label><span>Education</span><textarea value={manual.education} onChange={(event) => setManual({ ...manual, education: event.target.value })} /></label><label><span>Skills</span><textarea value={manual.skills} onChange={(event) => setManual({ ...manual, skills: event.target.value })} /></label><label><span>Projects</span><textarea value={manual.projects} onChange={(event) => setManual({ ...manual, projects: event.target.value })} /></label><label><span>Certifications</span><textarea value={manual.certifications} onChange={(event) => setManual({ ...manual, certifications: event.target.value })} /></label></div></> : <><h2>Your workspace is ready</h2><p>You can browse recommendations now and upload or build a resume from the Tailor page later.</p></>}
          </div>
        )}
        {error && <p className="auth-modal-error" role="alert">{error}</p>}
        <div className="onboarding-actions">
          <button onClick={() => void skip()}>Skip for now</button>
          <div>
            {step > 0 && <Button variant="outline" onClick={() => setStep((current) => current - 1)}><ChevronLeft /> Back</Button>}
            {step < 2 ? <Button onClick={() => setStep((current) => current + 1)}>Continue <ChevronRight /></Button> : <Button onClick={() => void finish()} disabled={saving}>{saving ? <LoaderCircle className="animate-spin" /> : <Check />} {user ? "Save profile" : "Sign up and save"}</Button>}
          </div>
        </div>
      </section>
    </div>
  )
}
