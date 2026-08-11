import { SiteHeader } from "@/components/site-header"
import { SavedJobBrowser } from "@/components/saved-job-browser"

export default function SavedPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-background">
      <div className="ambient-grid" aria-hidden="true" />
      <SiteHeader />
      <main className="saved-shell container mx-auto px-4 py-10">
        <section className="saved-hero">
          <span className="eyebrow">Your private shortlist</span>
          <h1>Save the signal.<br /><span>Act when ready.</span></h1>
          <p>Keep promising roles separate from active applications, then tailor or apply when the timing is right.</p>
        </section>
        <SavedJobBrowser />
      </main>
    </div>
  )
}
