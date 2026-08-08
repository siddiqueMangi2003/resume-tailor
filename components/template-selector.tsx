"use client"

import { useEffect, useState } from "react"
import { Check, ExternalLink, Eye, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { TemplatePreview } from "@/components/template-preview"
import { RESUME_TEMPLATES, getResumeTemplate } from "@/lib/resume-templates"
import { cn } from "@/lib/utils"

interface TemplateSelectorProps {
  selectedTemplate: string
  onTemplateChange: (template: string) => void
}

export function TemplateSelector({ selectedTemplate, onTemplateChange }: TemplateSelectorProps) {
  const [previewTemplateId, setPreviewTemplateId] = useState<string | null>(null)
  const previewTemplate = previewTemplateId ? getResumeTemplate(previewTemplateId) : null

  useEffect(() => {
    if (!previewTemplate) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPreviewTemplateId(null)
    }
    document.addEventListener("keydown", handleKeyDown)
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
      document.body.style.overflow = ""
    }
  }, [previewTemplate])

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="font-heading">Choose and Review a Template</CardTitle>
          <CardDescription>
            Preview the layout with sample content, then select it for your tailored resume.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={selectedTemplate}
            onValueChange={onTemplateChange}
            className="grid gap-4 sm:grid-cols-2"
          >
            {RESUME_TEMPLATES.map((template) => {
              const isSelected = selectedTemplate === template.id
              return (
                <div key={template.id} className="relative min-w-0">
                  <RadioGroupItem value={template.id} id={template.id} className="peer sr-only" />
                  <Label
                    htmlFor={template.id}
                    className={cn(
                      "flex h-full cursor-pointer flex-col overflow-hidden rounded-xl border-2 bg-card transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md",
                      "peer-data-[state=checked]:border-primary peer-data-[state=checked]:shadow-md",
                    )}
                  >
                    <div className="relative bg-muted/50 p-3">
                      <TemplatePreview template={template} compact />
                      {isSelected ? (
                        <span className="absolute right-5 top-5 inline-flex items-center gap-1 rounded-full bg-primary px-2 py-1 text-[10px] font-semibold text-primary-foreground shadow">
                          <Check className="h-3 w-3" /> Selected
                        </span>
                      ) : null}
                    </div>
                    <div className="flex flex-1 flex-col gap-2 p-4">
                      <div>
                        <p className="font-semibold leading-tight">{template.name}</p>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                          {template.description}
                        </p>
                      </div>
                      <p className="text-[11px] font-medium" style={{ color: template.accent }}>
                        {template.bestFor}
                      </p>
                      {template.source ? (
                        <span className="text-[10px] text-muted-foreground">
                          Overleaf-inspired · {template.source.license}
                        </span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">Resume Tailor original</span>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-auto w-full"
                        onClick={(event) => {
                          event.preventDefault()
                          event.stopPropagation()
                          setPreviewTemplateId(template.id)
                        }}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        Review template
                      </Button>
                    </div>
                  </Label>
                </div>
              )
            })}
          </RadioGroup>
          <p className="pt-4 text-center text-xs text-muted-foreground">
            All templates use the same truthful, ATS-readable resume content.
          </p>
        </CardContent>
      </Card>

      {previewTemplate ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="template-preview-title"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setPreviewTemplateId(null)
          }}
        >
          <div className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b px-5 py-4 sm:px-6">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 id="template-preview-title" className="font-heading text-xl font-bold">
                    {previewTemplate.name}
                  </h3>
                  {selectedTemplate === previewTemplate.id ? (
                    <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
                      Currently selected
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{previewTemplate.description}</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label="Close template preview"
                onClick={() => setPreviewTemplateId(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid min-h-0 flex-1 gap-5 overflow-y-auto bg-muted/35 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_260px]">
              <div className="mx-auto w-full max-w-[650px]">
                <TemplatePreview template={previewTemplate} />
              </div>
              <aside className="space-y-5 rounded-xl border bg-card p-5 lg:self-start">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Best for</p>
                  <p className="mt-1 text-sm font-medium">{previewTemplate.bestFor}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Output</p>
                  <p className="mt-1 text-sm">The chosen style is applied to TEX, PDF, and DOCX results.</p>
                </div>
                {previewTemplate.source ? (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Design reference</p>
                    <a
                      href={previewTemplate.source.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                    >
                      {previewTemplate.source.name}
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                    <p className="mt-1 text-xs text-muted-foreground">Licensed under {previewTemplate.source.license}</p>
                  </div>
                ) : null}
                <Button
                  type="button"
                  className="w-full"
                  onClick={() => {
                    onTemplateChange(previewTemplate.id)
                    setPreviewTemplateId(null)
                  }}
                >
                  <Check className="mr-2 h-4 w-4" />
                  Use this template
                </Button>
              </aside>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
