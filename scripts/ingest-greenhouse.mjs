import { mkdir, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import {
  GREENHOUSE_BOARDS,
  MAX_CATALOGUE_JOBS,
  MAX_JOBS_PER_BOARD,
} from "../data/greenhouse-boards.mjs"

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const projectDirectory = resolve(scriptDirectory, "..")
const outputPath = resolve(projectDirectory, "public", "data", "jobs.json")
const detailsOutputPath = resolve(projectDirectory, "public", "data", "job-details.json")

const relevantRolePattern = /\b(?:ai|analytics|architect|cloud|data|design|developer|devops|engineer|engineering|frontend|infrastructure|mobile|platform|product|research|security|software|solutions|support|technical|technology)\b|full[- ]?stack|machine learning|site reliability/i

const skills = [
  ["Python", /\bpython\b/i],
  ["JavaScript", /\bjavascript\b/i],
  ["TypeScript", /\btypescript\b/i],
  ["React", /\breact(?:\.js|js)?\b/i],
  ["Node.js", /\bnode(?:\.js|js)?\b/i],
  ["Java", /\bjava\b/i],
  ["Go", /\b(?:golang|go language)\b/i],
  ["Rust", /\brust\b/i],
  ["C++", /\bc\+\+\b/i],
  ["SQL", /\bsql\b/i],
  ["PostgreSQL", /\bpostgres(?:ql)?\b/i],
  ["AWS", /\baws\b|amazon web services/i],
  ["Azure", /\bazure\b/i],
  ["GCP", /\bgcp\b|google cloud/i],
  ["Docker", /\bdocker\b/i],
  ["Kubernetes", /\bkubernetes\b|\bk8s\b/i],
  ["Terraform", /\bterraform\b/i],
  ["Linux", /\blinux\b/i],
  ["GraphQL", /\bgraphql\b/i],
  ["REST APIs", /\brest(?:ful)?\s+api/i],
  ["Machine Learning", /\bmachine learning\b/i],
  ["LLMs", /\bllms?\b|large language models?/i],
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
  let decoded = value
  for (let pass = 0; pass < 3; pass += 1) {
    const next = decodeHtml(decoded)
    if (next === decoded) break
    decoded = next
  }

  return decoded
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\r/g, "")
    .replace(/[\t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function workplaceType(jobText) {
  if (/\bhybrid\b/i.test(jobText)) return "hybrid"
  if (/\bremote\b|work from home|distributed team/i.test(jobText)) return "remote"
  if (/\bon[ -]?site\b|in office/i.test(jobText)) return "onsite"
  return "unspecified"
}

function detectedSkills(text) {
  return skills.filter(([, pattern]) => pattern.test(text)).map(([label]) => label).slice(0, 8)
}

function normalizedJob(board, job) {
  const description = htmlToText(job.content).slice(0, 12_000)
  const location = job.location?.name?.trim() || "Location not specified"
  const departments = (job.departments ?? []).map((department) => department.name).filter(Boolean)
  const searchableText = [job.title, location, departments.join(" "), description].join("\n")
  return {
    id: `greenhouse:${board.token}:${job.id}`,
    source: "greenhouse",
    sourceLabel: "Greenhouse",
    sourceJobId: String(job.id),
    company: board.company,
    title: job.title.trim(),
    location,
    workplaceType: workplaceType(searchableText),
    department: departments[0] || "General",
    skills: detectedSkills(searchableText),
    description,
    jobUrl: job.absolute_url,
    applyUrl: job.absolute_url,
    updatedAt: job.updated_at || null,
  }
}

async function fetchBoard(board) {
  const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(board.token)}/jobs?content=true`
  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "ResumeTailor-Jobs/1.0" },
    signal: AbortSignal.timeout(30_000),
  })
  if (!response.ok) throw new Error(`${board.company}: Greenhouse returned ${response.status}`)
  const payload = await response.json()
  return (payload.jobs ?? [])
    .filter((job) => {
      const departments = (job.departments ?? []).map((department) => department.name).join(" ")
      return relevantRolePattern.test(`${job.title} ${departments}`)
    })
    .map((job) => normalizedJob(board, job))
    .sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)))
    .slice(0, MAX_JOBS_PER_BOARD)
}

async function main() {
  const settledBoards = await Promise.allSettled(GREENHOUSE_BOARDS.map(fetchBoard))
  const failures = settledBoards
    .map((result, index) => ({ result, board: GREENHOUSE_BOARDS[index] }))
    .filter(({ result }) => result.status === "rejected")

  for (const { result, board } of failures) {
    console.error(`${board.company} could not be refreshed: ${result.reason}`)
  }

  const jobs = settledBoards
    .flatMap((result) => result.status === "fulfilled" ? result.value : [])
    .filter((job, index, allJobs) => allJobs.findIndex((candidate) => candidate.applyUrl === job.applyUrl) === index)
    .sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)))
    .slice(0, MAX_CATALOGUE_JOBS)

  if (!jobs.length) throw new Error("Greenhouse ingestion returned no jobs; keeping the previous catalogue.")

  const catalogue = {
    generatedAt: new Date().toISOString(),
    source: "Greenhouse public Job Board API",
    companies: GREENHOUSE_BOARDS.map(({ company, token }) => ({ company, token })),
    jobs: jobs.map(({ description, ...job }) => ({
      ...job,
      description: description.length > 420 ? `${description.slice(0, 417)}…` : description,
    })),
  }
  const details = Object.fromEntries(jobs.map((job) => [job.id, job.description]))

  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(catalogue)}\n`, "utf8")
  await writeFile(detailsOutputPath, `${JSON.stringify(details)}\n`, "utf8")
  console.log(`Saved ${jobs.length} jobs from ${GREENHOUSE_BOARDS.length - failures.length} Greenhouse boards.`)
}

await main()
