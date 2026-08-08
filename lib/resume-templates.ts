export type ResumeTemplate = {
  id: string
  name: string
  description: string
  bestFor: string
  accent: string
  mutedAccent: string
  fontFamily: string
  headerAlign: "left" | "center"
  sectionStyle: "rule" | "minimal" | "caps" | "double"
  source?: {
    name: string
    url: string
    license: string
  }
}

export const RESUME_TEMPLATES: ResumeTemplate[] = [
  {
    id: "template1",
    name: "Classic Professional",
    description: "Balanced serif typography with crisp section rules.",
    bestFor: "Corporate and general applications",
    accent: "#155e75",
    mutedAccent: "#cffafe",
    fontFamily: "Georgia, 'Times New Roman', serif",
    headerAlign: "center",
    sectionStyle: "rule",
  },
  {
    id: "template2",
    name: "Modern Minimalist",
    description: "Airy sans-serif layout with restrained indigo details.",
    bestFor: "Startups, product, and technology",
    accent: "#4338ca",
    mutedAccent: "#e0e7ff",
    fontFamily: "Inter, Arial, sans-serif",
    headerAlign: "left",
    sectionStyle: "minimal",
  },
  {
    id: "template3",
    name: "Executive Bold",
    description: "Compact leadership layout with strong section hierarchy.",
    bestFor: "Senior and leadership roles",
    accent: "#7c2d12",
    mutedAccent: "#ffedd5",
    fontFamily: "Georgia, 'Times New Roman', serif",
    headerAlign: "center",
    sectionStyle: "caps",
  },
  {
    id: "template4",
    name: "Alta Teal",
    description: "A clean, information-forward adaptation of AltaCV.",
    bestFor: "Engineering and technical profiles",
    accent: "#0f766e",
    mutedAccent: "#ccfbf1",
    fontFamily: "Inter, Arial, sans-serif",
    headerAlign: "left",
    sectionStyle: "double",
    source: {
      name: "AltaCV on Overleaf",
      url: "https://www.overleaf.com/latex/templates/altacv-template/trgqjpwnmtgv",
      license: "LPPL 1.3c",
    },
  },
  {
    id: "template5",
    name: "Modern Banking",
    description: "A polished, understated adaptation of ModernCV banking.",
    bestFor: "Consulting, finance, and operations",
    accent: "#1d4ed8",
    mutedAccent: "#dbeafe",
    fontFamily: "Inter, Arial, sans-serif",
    headerAlign: "center",
    sectionStyle: "minimal",
    source: {
      name: "ModernCV on Overleaf",
      url: "https://www.overleaf.com/latex/templates/moderncv-and-cover-letter-template/sttkgjcysttn",
      license: "LPPL 1.3c",
    },
  },
  {
    id: "template6",
    name: "Pagella Scholar",
    description: "An editorial résumé adaptation with warm classical type.",
    bestFor: "Research, education, and graduate roles",
    accent: "#713f12",
    mutedAccent: "#fef3c7",
    fontFamily: "Palatino, 'Book Antiqua', Georgia, serif",
    headerAlign: "center",
    sectionStyle: "rule",
    source: {
      name: "Minimal LaTeX Resume on Overleaf",
      url: "https://www.overleaf.com/latex/templates/latex-resume-template/ngdmzkwsbgmd",
      license: "LPPL 1.3c",
    },
  },
]

export function getResumeTemplate(templateId: string) {
  return RESUME_TEMPLATES.find((template) => template.id === templateId) ?? RESUME_TEMPLATES[0]
}
