import type { CSSProperties } from "react"
import type { ResumeTemplate } from "@/lib/resume-templates"
import { cn } from "@/lib/utils"

interface TemplatePreviewProps {
  template: ResumeTemplate
  compact?: boolean
  className?: string
}

const experienceRows = [
  {
    title: "Backend Engineer · Northstar Labs",
    dates: "2023–Present",
    bullets: ["Built reliable Python APIs for data-intensive products.", "Improved service observability and release quality."],
  },
  {
    title: "Software Engineer · Atlas Systems",
    dates: "2021–2023",
    bullets: ["Delivered cloud services with distributed engineering teams."],
  },
]

function SectionHeading({ template, children }: { template: ResumeTemplate; children: string }) {
  const baseStyle: CSSProperties = {
    color: template.accent,
    borderColor: template.accent,
  }

  return (
    <div
      className={cn(
        "mb-1.5 mt-3 text-[9px] font-bold tracking-[0.12em]",
        template.sectionStyle === "caps" && "uppercase",
        template.sectionStyle === "rule" && "border-b pb-1",
        template.sectionStyle === "double" && "border-b-2 pb-1",
        template.sectionStyle === "minimal" && "tracking-[0.18em] uppercase",
      )}
      style={baseStyle}
    >
      {children}
    </div>
  )
}

export function TemplatePreview({ template, compact = false, className }: TemplatePreviewProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden bg-white text-slate-800 shadow-sm ring-1 ring-black/10",
        compact ? "aspect-[8.5/11] w-full rounded-md p-3" : "min-h-full w-full rounded-lg p-7 sm:p-9",
        className,
      )}
      style={{ fontFamily: template.fontFamily }}
      aria-label={`${template.name} sample resume preview`}
    >
      <div className={template.headerAlign === "center" ? "text-center" : "text-left"}>
        <div
          className={cn("font-bold tracking-tight", compact ? "text-[11px]" : "text-2xl")}
          style={{ color: template.accent }}
        >
          AISHA RAHMAN
        </div>
        <div className={cn("font-medium text-slate-600", compact ? "mt-0.5 text-[5px]" : "mt-1 text-xs")}>
          Backend Engineer · Rotterdam, NL
        </div>
        <div className={cn("text-slate-500", compact ? "mt-0.5 text-[4px]" : "mt-1 text-[10px]")}>
          aisha@example.com · linkedin.com/in/aisha · github.com/aisha
        </div>
      </div>

      {compact ? (
        <div className="mt-2 space-y-1.5">
          {[72, 94, 84].map((width, index) => (
            <div key={width}>
              <div className="mb-1 h-1 w-1/3 rounded-full" style={{ backgroundColor: template.accent }} />
              <div className="space-y-0.5">
                <div className="h-0.5 rounded-full bg-slate-300" style={{ width: `${width}%` }} />
                <div className="h-0.5 w-full rounded-full bg-slate-200" />
                {index !== 2 ? <div className="h-0.5 w-4/5 rounded-full bg-slate-200" /> : null}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-5 text-[10px] leading-relaxed text-slate-700">
          <SectionHeading template={template}>Professional Summary</SectionHeading>
          <p>
            Backend engineer focused on dependable APIs, cloud services, and pragmatic systems that
            support data and AI products.
          </p>

          <SectionHeading template={template}>Skills</SectionHeading>
          <p>Python · FastAPI · PostgreSQL · Docker · AWS · REST APIs · CI/CD</p>

          <SectionHeading template={template}>Experience</SectionHeading>
          <div className="space-y-2.5">
            {experienceRows.map((experience) => (
              <div key={experience.title}>
                <div className="flex items-start justify-between gap-4 font-bold text-slate-900">
                  <span>{experience.title}</span>
                  <span className="shrink-0 font-normal text-slate-500">{experience.dates}</span>
                </div>
                <ul className="mt-0.5 list-disc space-y-0.5 pl-4">
                  {experience.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <SectionHeading template={template}>Projects</SectionHeading>
          <div className="font-bold text-slate-900">AI Document Workflow</div>
          <p>Designed a secure document-processing API with temporary output links and automated tests.</p>

          <SectionHeading template={template}>Education</SectionHeading>
          <div className="flex justify-between gap-4">
            <span className="font-bold text-slate-900">BSc Computer Science · Example University</span>
            <span className="shrink-0 text-slate-500">2021</span>
          </div>
        </div>
      )}

      <div
        className={cn("absolute bottom-0 left-0 right-0", compact ? "h-1" : "h-1.5")}
        style={{ backgroundColor: template.accent }}
      />
    </div>
  )
}
