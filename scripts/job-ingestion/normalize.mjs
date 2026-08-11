export const relevantRolePattern = /\b(?:ai|analytics|architect|cloud|data|design|developer|devops|engineer|engineering|frontend|infrastructure|mobile|platform|product|research|security|software|solutions|support|technical|technology)\b|full[- ]?stack|machine learning|site reliability/i

const skillPatterns = [
  ["Python", /\bpython\b/i], ["JavaScript", /\bjavascript\b/i],
  ["TypeScript", /\btypescript\b/i], ["React", /\breact(?:\.js|js)?\b/i],
  ["Node.js", /\bnode(?:\.js|js)?\b/i], ["Java", /\bjava\b/i],
  ["Go", /\b(?:golang|go language)\b/i], ["Rust", /\brust\b/i],
  ["C++", /\bc\+\+\b/i], ["SQL", /\bsql\b/i],
  ["PostgreSQL", /\bpostgres(?:ql)?\b/i], ["AWS", /\baws\b|amazon web services/i],
  ["Azure", /\bazure\b/i], ["GCP", /\bgcp\b|google cloud/i],
  ["Docker", /\bdocker\b/i], ["Kubernetes", /\bkubernetes\b|\bk8s\b/i],
  ["Terraform", /\bterraform\b/i], ["Linux", /\blinux\b/i],
  ["GraphQL", /\bgraphql\b/i], ["REST APIs", /\brest(?:ful)?\s+api/i],
  ["Machine Learning", /\bmachine learning\b/i], ["LLMs", /\bllms?\b|large language models?/i],
]

function decodeHtml(value) {
  const entities = {
    amp: "&", apos: "'", gt: ">", lt: "<", nbsp: " ", quot: '"',
    ndash: "–", mdash: "—", bull: "•", hellip: "…",
  }
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (match, name) => entities[name.toLowerCase()] ?? match)
}

export function htmlToText(value = "") {
  let decoded = String(value)
  for (let pass = 0; pass < 3; pass += 1) {
    const next = decodeHtml(decoded)
    if (next === decoded) break
    decoded = next
  }
  return decoded
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|ul|ol|section)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\r/g, "")
    .replace(/[\t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

export function workplaceType(text, explicit = "") {
  const normalized = explicit.toLowerCase()
  if (normalized.includes("hybrid")) return "hybrid"
  if (normalized.includes("remote")) return "remote"
  if (normalized.includes("on-site") || normalized.includes("onsite")) return "onsite"
  if (/\bhybrid\b/i.test(text)) return "hybrid"
  if (/\bremote\b|work from home|distributed team/i.test(text)) return "remote"
  if (/\bon[ -]?site\b|in office/i.test(text)) return "onsite"
  return "unspecified"
}

export function detectedSkills(text, supplied = []) {
  const found = skillPatterns.filter(([, pattern]) => pattern.test(text)).map(([label]) => label)
  const suppliedSkills = Array.isArray(supplied) ? supplied : String(supplied).split(",")
  return [...new Set([...suppliedSkills.map((item) => String(item).trim()).filter(Boolean), ...found])].slice(0, 10)
}

export function normalizedJob(input) {
  const description = htmlToText(input.description).slice(0, 12_000)
  const location = htmlToText(input.location || "") || "Location not specified"
  const title = htmlToText(input.title || "").trim()
  const company = htmlToText(input.company || "").trim()
  const department = htmlToText(input.department || "") || "General"
  const searchableText = [title, company, location, department, description].join("\n")
  return {
    id: `${input.source}:${String(input.sourceJobId)}`,
    source: input.source,
    sourceLabel: input.sourceLabel,
    sourceJobId: String(input.sourceJobId),
    company,
    title,
    location,
    workplaceType: workplaceType(searchableText, input.workplaceType),
    department,
    employmentType: htmlToText(input.employmentType || ""),
    salary: htmlToText(input.salary || ""),
    skills: detectedSkills(searchableText, input.skills),
    description,
    jobUrl: input.jobUrl,
    applyUrl: input.applyUrl || input.jobUrl,
    publishedAt: input.publishedAt || null,
    updatedAt: input.updatedAt || input.publishedAt || null,
  }
}

export function isRelevantJob(job) {
  return Boolean(job.title && job.company && job.applyUrl && relevantRolePattern.test(`${job.title} ${job.department}`))
}
