import { GREENHOUSE_BOARDS, MAX_JOBS_PER_BOARD } from "../../data/greenhouse-boards.mjs"
import { isRelevantJob, normalizedJob } from "./normalize.mjs"

async function fetchBoard(board) {
  const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(board.token)}/jobs?content=true`
  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "ResumeTailor-Jobs/2.0" },
    signal: AbortSignal.timeout(30_000),
  })
  if (!response.ok) throw new Error(`${board.company}: Greenhouse returned ${response.status}`)
  const payload = await response.json()
  return (payload.jobs ?? [])
    .map((job) => normalizedJob({
      source: "greenhouse",
      sourceLabel: "Greenhouse",
      sourceJobId: `${board.token}:${job.id}`,
      company: board.company,
      title: job.title,
      location: job.location?.name,
      department: job.departments?.[0]?.name,
      description: job.content,
      jobUrl: job.absolute_url,
      applyUrl: job.absolute_url,
      updatedAt: job.updated_at,
    }))
    .filter(isRelevantJob)
    .sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)))
    .slice(0, MAX_JOBS_PER_BOARD)
}

export async function ingestGreenhouse() {
  const settled = await Promise.allSettled(GREENHOUSE_BOARDS.map(fetchBoard))
  const failures = settled.flatMap((result, index) => result.status === "rejected"
    ? [`${GREENHOUSE_BOARDS[index].company}: ${result.reason}`]
    : [])
  return {
    source: "greenhouse",
    label: "Greenhouse",
    jobs: settled.flatMap((result) => result.status === "fulfilled" ? result.value : []),
    failures,
  }
}
