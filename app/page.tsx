"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { FileUpload } from "@/components/file-upload"
import { JobDescriptionInput } from "@/components/job-description-input"
import { TemplateSelector } from "@/components/template-selector"
import { ProgressTracker, type ProcessStep } from "@/components/progress-tracker"
import { ResumePreview } from "@/components/resume-preview"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { ArrowRight, BriefcaseBusiness, FileText, Sparkles, Target, Zap, ShieldCheck, TriangleAlert } from "lucide-react"
import { SiteHeader } from "@/components/site-header"
import { PipelineOrbit } from "@/components/pipeline-orbit"
import { useAuth } from "@/components/auth-provider"
import { getSupabaseBrowserClient } from "@/lib/supabase"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "")

interface TailorApiResponse {
  success: boolean
  tex_url: string
  pdf_url: string
  doc_url: string | null
  expires_in_seconds: number
  warnings: string[]
  detail?: string
}

export default function HomePage() {
  const { user } = useAuth()
  const [resumeFile, setResumeFile] = useState<File | null>(null)
  const [profileResumeText, setProfileResumeText] = useState("")
  const [jobDescription, setJobDescription] = useState("")
  const [selectedTemplate, setSelectedTemplate] = useState("template1")
  const [currentStep, setCurrentStep] = useState<ProcessStep>("idle")
  const [latexContent, setLatexContent] = useState("")
  const [pdfUrl, setPdfUrl] = useState("")
  const [texUrl, setTexUrl] = useState("")
  const [docUrl, setDocUrl] = useState("")
  const [errorMessage, setErrorMessage] = useState("")
  const [warnings, setWarnings] = useState<string[]>([])
  const [expiresInSeconds, setExpiresInSeconds] = useState(0)
  const [linkedApplication, setLinkedApplication] = useState<{
    id?: string
    company: string
    role: string
  } | null>(null)

  useEffect(() => {
    const saved = sessionStorage.getItem("resume-tailor-application")
    if (!saved) return
    try {
      const application = JSON.parse(saved) as {
        id: string
        company: string
        role: string
        jobDescription: string
      }
      if (application.jobDescription) {
        queueMicrotask(() => {
          setJobDescription(application.jobDescription)
          setLinkedApplication({ id: application.id, company: application.company, role: application.role })
        })
      }
    } catch {
      sessionStorage.removeItem("resume-tailor-application")
    }
  }, [])

  useEffect(() => {
    if (!user) { queueMicrotask(() => setProfileResumeText("")); return }
    const loadProfile = async () => {
      const supabase = getSupabaseBrowserClient()
      const { data, error } = await supabase?.from("user_profiles").select("base_resume_text").eq("user_id", user.id).maybeSingle() ?? { data: null, error: null }
      if (data?.base_resume_text) setProfileResumeText(data.base_resume_text)
      else if (!error) setProfileResumeText("")
    }
    const timer = window.setTimeout(() => void loadProfile(), 0)
    const handleProfile = (event: Event) => setProfileResumeText((event as CustomEvent<{ base_resume_text?: string }>).detail?.base_resume_text || "")
    window.addEventListener("resume-tailor-profile-updated", handleProfile)
    return () => { window.clearTimeout(timer); window.removeEventListener("resume-tailor-profile-updated", handleProfile) }
  }, [user])

  const resetResults = () => {
    setCurrentStep("idle")
    setLatexContent("")
    setPdfUrl("")
    setTexUrl("")
    setDocUrl("")
    setErrorMessage("")
    setWarnings([])
    setExpiresInSeconds(0)
  }

  const handleResumeChange = (file: File | null) => {
    setResumeFile(file)
    resetResults()
  }

  const useProfileResume = () => {
    if (!profileResumeText) return
    handleResumeChange(new File([profileResumeText], "resume-tailor-profile.txt", { type: "text/plain" }))
  }

  const handleJobDescriptionChange = (description: string) => {
    setJobDescription(description)
    resetResults()
  }

  const handleTemplateChange = (template: string) => {
    setSelectedTemplate(template)
    resetResults()
  }

  const canStartProcess = Boolean(
    resumeFile && jobDescription.trim() && currentStep !== "analyzing",
  )

  const handleTailorResume = async () => {
    if (!canStartProcess || !resumeFile) return
    if (!API_BASE_URL) {
      setErrorMessage("The backend API URL is not configured for this deployment.")
      setCurrentStep("error")
      return
    }

    setCurrentStep("uploading")
    setErrorMessage("")
    setWarnings([])

    try {
      const formData = new FormData()
      formData.append("resume", resumeFile)
      formData.append("job_desc", jobDescription)
      formData.append("template", selectedTemplate)

      setCurrentStep("analyzing")
      const response = await fetch(API_BASE_URL + "/tailor_resume", {
        method: "POST",
        body: formData,
      })
      const payload = (await response.json()) as TailorApiResponse
      if (!response.ok) {
        throw new Error(payload.detail || "The backend could not process this resume.")
      }
      if (!payload.tex_url || !payload.pdf_url) {
        throw new Error("The backend returned an incomplete result.")
      }

      setTexUrl(payload.tex_url)
      setPdfUrl(payload.pdf_url)
      setDocUrl(payload.doc_url || "")
      setWarnings(payload.warnings || [])
      setExpiresInSeconds(payload.expires_in_seconds)
      setLatexContent("Your tailored resume is ready.")
      setCurrentStep("complete")

      if (linkedApplication?.id && user) {
        const supabase = getSupabaseBrowserClient()
        await supabase
          ?.from("job_applications")
          .update({
            resume_template_id: selectedTemplate,
            resume_file_name: resumeFile.name,
          })
          .eq("id", linkedApplication.id)
        sessionStorage.removeItem("resume-tailor-application")
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Resume generation failed."
      setErrorMessage(message)
      setCurrentStep("error")
    }
  }

  const downloadFile = (url: string, filename: string) => {
    if (!url) return
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = filename
    anchor.target = "_blank"
    anchor.rel = "noopener noreferrer"
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-background">
      <div className="ambient-grid" aria-hidden="true" />
      <SiteHeader />

      <section className="tailor-hero container mx-auto px-4">
        <div className="tailor-hero-copy">
          <span className="eyebrow"><Sparkles className="h-4 w-4" /> Truthful AI tailoring</span>
          <h2 className="font-heading font-bold text-5xl md:text-6xl text-balance">
            One resume.<br /><span>Every right opportunity.</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl text-pretty">
            Adapt your real experience to a role without inventing qualifications, then carry that momentum into a focused application pipeline.
          </p>
          <div className="hero-actions">
            <a href="#tailor-workspace" className="primary-cta"><Sparkles className="h-4 w-4" /> Tailor a resume</a>
            <Link href="/tracker" className="secondary-cta"><BriefcaseBusiness className="h-4 w-4" /> Open job tracker <ArrowRight className="h-4 w-4" /></Link>
          </div>

          <div className="feature-row">
            <div className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4 text-primary" />
              <span>Six Reviewable Templates</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Target className="h-4 w-4 text-primary" />
              <span>Truthful Tailoring</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <span>Temporary Processing</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Zap className="h-4 w-4 text-primary" />
              <span>Three Download Formats</span>
            </div>
          </div>
        </div>
        <PipelineOrbit />
      </section>

      <main id="tailor-workspace" className="container mx-auto px-4 py-10 scroll-mt-20">
        <div className="workspace-heading">
          <span className="eyebrow">Resume studio</span>
          <h2>Build the version that belongs in this conversation.</h2>
          <p>Your source resume stays factual. The language and structure become relevant.</p>
        </div>
        <div className="grid lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            {profileResumeText && !resumeFile && (
              <Alert className="linked-application-alert">
                <FileText className="h-4 w-4" />
                <AlertTitle>Your base resume is ready</AlertTitle>
                <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
                  <span>Use the CV you uploaded or built during onboarding.</span>
                  <Button variant="outline" size="sm" onClick={useProfileResume}>Use profile resume</Button>
                </AlertDescription>
              </Alert>
            )}
            <FileUpload
              title="Upload Your Resume"
              description="Upload a TXT, PDF, or DOCX resume up to 5 MB"
              acceptedTypes={[
                "text/plain",
                "application/pdf",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
              ]}
              onFileUpload={handleResumeChange}
              uploadedFile={resumeFile}
            />

            <JobDescriptionInput
              title="Job Description"
              description="Paste the job description you are targeting"
              onJobDescriptionSubmit={handleJobDescriptionChange}
              jobDescription={jobDescription}
            />

            {linkedApplication && (
              <Alert className="linked-application-alert">
                <BriefcaseBusiness className="h-4 w-4" />
                <AlertTitle>Tailoring for {linkedApplication.company}</AlertTitle>
                <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    {linkedApplication.role}
                    {linkedApplication.id
                      ? " · the template choice will be saved to your tracker."
                      : " · the employer description has been imported from Jobs."}
                  </span>
                  <Link href={linkedApplication.id ? "/tracker" : "/jobs"} className="font-semibold text-primary hover:underline">
                    {linkedApplication.id ? "Back to tracker" : "Back to jobs"}
                  </Link>
                </AlertDescription>
              </Alert>
            )}

            <TemplateSelector
              selectedTemplate={selectedTemplate}
              onTemplateChange={handleTemplateChange}
            />

            <Alert>
              <ShieldCheck className="h-4 w-4" />
              <AlertTitle>Privacy notice</AlertTitle>
              <AlertDescription>
                Resume and job text are sent to Groq for tailoring. The generated PDF is sent to
                Aspose only for DOCX conversion. Download links expire after processing.
              </AlertDescription>
            </Alert>

            <Card>
              <CardContent className="p-6">
                <Button
                  onClick={handleTailorResume}
                  disabled={!canStartProcess}
                  size="lg"
                  className="w-full font-semibold"
                >
                  <Sparkles className="h-5 w-5 mr-2" />
                  Tailor My Resume
                </Button>
                {!canStartProcess && currentStep === "idle" && (
                  <p className="text-sm text-muted-foreground mt-2 text-center">
                    Add both a resume and job description to continue.
                  </p>
                )}
              </CardContent>
            </Card>

            {errorMessage && (
              <Alert variant="destructive" aria-live="polite">
                <TriangleAlert className="h-4 w-4" />
                <AlertTitle>Resume generation failed</AlertTitle>
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            )}

            {warnings.map((warning) => (
              <Alert key={warning} aria-live="polite">
                <TriangleAlert className="h-4 w-4" />
                <AlertTitle>Partial result</AlertTitle>
                <AlertDescription>{warning}</AlertDescription>
              </Alert>
            ))}

            <ProgressTracker currentStep={currentStep} />
          </div>

          <div>
            <ResumePreview
              latexContent={latexContent}
              pdfUrl={pdfUrl}
              onDownloadTex={texUrl ? () => downloadFile(texUrl, "tailored_resume.tex") : undefined}
              onDownloadPdf={pdfUrl ? () => downloadFile(pdfUrl, "tailored_resume.pdf") : undefined}
              onDownloadDoc={docUrl ? () => downloadFile(docUrl, "tailored_resume.docx") : undefined}
              expiresInSeconds={expiresInSeconds}
            />
          </div>
        </div>
      </main>

      <footer className="border-t mt-16 py-8 bg-muted/20">
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm text-muted-foreground">
            Verify every generated statement before submitting your resume.
          </p>
        </div>
      </footer>
    </div>
  )
}
