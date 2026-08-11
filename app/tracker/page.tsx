"use client"

import { Cloud, LockKeyhole, ShieldCheck, Sparkles } from "lucide-react"
import { SiteHeader } from "@/components/site-header"
import { PipelineOrbit } from "@/components/pipeline-orbit"
import { JobTracker } from "@/components/job-tracker"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/components/auth-provider"

export default function TrackerPage() {
  const { configured, loading, user, openAuth } = useAuth()

  return (
    <div className="min-h-screen overflow-x-hidden bg-background">
      <div className="ambient-grid" aria-hidden="true" />
      <SiteHeader />

      {loading ? (
        <main className="container mx-auto px-4 py-20">
          <div className="auth-loading"><span /><p>Opening your private workspace…</p></div>
        </main>
      ) : user ? (
        <main className="container mx-auto px-4 py-8">
          <JobTracker />
        </main>
      ) : (
        <main>
          <section className="tracker-welcome container mx-auto px-4">
            <div className="welcome-copy">
              <span className="eyebrow"><Sparkles className="h-4 w-4" /> Application intelligence</span>
              <h1>Every opportunity.<br /><span>One clear trajectory.</span></h1>
              <p>
                A private command center for your job search—built directly into the resume workflow you already use.
              </p>
              <div className="privacy-points">
                <span><ShieldCheck /> Private rows</span>
                <span><Cloud /> Synced across devices</span>
                <span><LockKeyhole /> Secure sign-in</span>
              </div>

              <div className="auth-panel">
                {configured ? (
                  <>
                    <div>
                      <strong>Open your tracker</strong>
                      <p>Sign in to create a private application pipeline.</p>
                    </div>
                    <div className="auth-buttons">
                      <Button size="lg" onClick={() => openAuth("login")}>
                        Open secure sign in
                      </Button>
                    </div>
                    <small>Only your account can read or change your application records.</small>
                  </>
                ) : (
                  <>
                    <div>
                      <strong>Cloud connection pending</strong>
                      <p>The experience is ready. Add the Supabase project values to activate secure sign-in.</p>
                    </div>
                    <span className="setup-chip">Preview mode</span>
                  </>
                )}
              </div>
            </div>
            <PipelineOrbit />
          </section>

          <section className="tracker-preview-section">
            <div className="container mx-auto px-4">
              <div className="preview-heading">
                <div>
                  <span className="eyebrow">Interactive preview</span>
                  <h2>See your search at a glance.</h2>
                </div>
                <p>Sign in to replace this fictional pipeline with your own private applications.</p>
              </div>
              <JobTracker demo />
            </div>
          </section>
        </main>
      )}
    </div>
  )
}
