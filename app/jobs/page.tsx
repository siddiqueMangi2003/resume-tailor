import { SiteHeader } from "@/components/site-header"
import { JobBrowser } from "@/components/job-browser"

export default function JobsPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-background">
      <div className="ambient-grid" aria-hidden="true" />
      <SiteHeader />
      <main className="container mx-auto px-4 py-8">
        <JobBrowser />
      </main>
    </div>
  )
}
