import { LEVER_BOARDS, MAX_JOBS_PER_LEVER_BOARD } from "../../data/lever-boards.mjs"
import { isRelevantJob, normalizedJob } from "./normalize.mjs"

async function fetchBoard(board) {
  const url = `https://api.lever.co/v0/postings/${encodeURIComponent(board.slug)}?mode=json&limit=200`
  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "ResumeTailor-Jobs/2.0" },
    signal: AbortSignal.timeout(30_000),
  })
  if (!response.ok) throw new Error(`${board.company}: Lever returned ${response.status}`)
  const payload = await response.json()
  return payload
    .map((job) => normalizedJob({
      source: "lever",
      sourceLabel: "Lever",
      sourceJobId: `${board.slug}:${job.id}`,
      company: board.company,
      title: job.text,
      location: job.categories?.location || job.categories?.allLocations?.join(", "),
      workplaceType: job.workplaceType,
      department: job.categories?.department || job.categories?.team,
      employmentType: job.categories?.commitment,
      salary: job.salaryDescriptionPlain,
      description: [job.descriptionPlain, job.additionalPlain].filter(Boolean).join("\n\n"),
      jobUrl: job.hostedUrl,
      applyUrl: job.applyUrl || job.hostedUrl,
      publishedAt: job.createdAt ? new Date(job.createdAt).toISOString() : null,
      updatedAt: job.createdAt ? new Date(job.createdAt).toISOString() : null,
    }))
    .filter(isRelevantJob)
    .slice(0, MAX_JOBS_PER_LEVER_BOARD)
}

export async function ingestLever() {
  const settled = await Promise.allSettled(LEVER_BOARDS.map(fetchBoard))
  const failures = settled.flatMap((result, index) => result.status === "rejected"
    ? [`${LEVER_BOARDS[index].company}: ${result.reason}`]
    : [])
  return {
    source: "lever",
    label: "Lever",
    jobs: settled.flatMap((result) => result.status === "fulfilled" ? result.value : []),
    failures,
  }
}
