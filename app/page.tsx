"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { FileUpload } from "@/components/file-upload"
import { JobDescriptionInput } from "@/components/job-description-input"
import { TemplateSelector } from "@/components/template-selector"
import { ProgressTracker, type ProcessStep } from "@/components/progress-tracker"
import { ResumePreview } from "@/components/resume-preview"
import { ModeToggle } from "@/components/mode-toggle"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Sparkles, FileText, Target, Zap, ShieldCheck, TriangleAlert } from "lucide-react"

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
  const [resumeFile, setResumeFile] = useState<File | null>(null)
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
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-primary-foreground" />
              </div>
              <h1 className="font-heading font-bold text-xl">Resume Tailor</h1>
            </div>
            <ModeToggle />
          </div>
        </div>
      </header>

      <section className="py-12 bg-gradient-to-b from-background to-muted/20">
        <div className="container mx-auto px-4 text-center">
          <h2 className="font-heading font-bold text-4xl md:text-5xl mb-4 text-balance">
            Tailor Your Resume with <span className="text-primary">AI Precision</span>
          </h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto text-pretty">
            Adapt your existing experience to a job description without inventing qualifications,
            then download ATS-friendly TEX, PDF, and DOCX results.
          </p>

          <div className="flex flex-wrap justify-center gap-6 mb-8">
            <div className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4 text-primary" />
              <span>LaTeX Formatting</span>
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
      </section>

      <main className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-2 gap-8">
          <div className="space-y-6">
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
