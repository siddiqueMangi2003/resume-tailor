"use client"

import { useEffect, useState } from "react"
import { Chrome, Github, Linkedin, LoaderCircle, LockKeyhole, Sparkles, X } from "lucide-react"
import { useAuth, type AuthProviderName } from "@/components/auth-provider"

const providers: Array<{ id: AuthProviderName; label: string; icon: typeof Github }> = [
  { id: "google", label: "Google", icon: Chrome },
  { id: "github", label: "GitHub", icon: Github },
  { id: "linkedin_oidc", label: "LinkedIn", icon: Linkedin },
]

export function AuthDialog() {
  const { authMode, authOpen, closeAuth, configured, signIn } = useAuth()
  const [busy, setBusy] = useState<AuthProviderName | "">("")
  const [error, setError] = useState("")

  useEffect(() => {
    if (!authOpen) return
    const closeOnEscape = (event: KeyboardEvent) => event.key === "Escape" && closeAuth()
    document.addEventListener("keydown", closeOnEscape)
    return () => document.removeEventListener("keydown", closeOnEscape)
  }, [authOpen, closeAuth])

  if (!authOpen) return null

  const start = async (provider: AuthProviderName) => {
    setError("")
    setBusy(provider)
    try {
      await signIn(provider)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sign-in could not be started.")
      setBusy("")
    }
  }

  return (
    <div className="auth-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && closeAuth()}>
      <section className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-modal-title">
        <button className="auth-modal-close" onClick={closeAuth} aria-label="Close authentication"><X /></button>
        <span className="auth-modal-mark"><Sparkles /></span>
        <p className="eyebrow">Private job-search workspace</p>
        <h2 id="auth-modal-title">{authMode === "signup" ? "Create your account" : "Welcome back"}</h2>
        <p>{authMode === "signup" ? "Choose a trusted account to save jobs, preferences and resumes." : "Choose how you want to continue."}</p>
        <div className="auth-provider-list">
          {providers.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => void start(id)} disabled={!configured || Boolean(busy)}>
              {busy === id ? <LoaderCircle className="animate-spin" /> : <Icon />}
              <span>Continue with {label}</span>
            </button>
          ))}
        </div>
        {!configured && <p className="auth-modal-error">Authentication is not configured for this deployment.</p>}
        {error && <p className="auth-modal-error" role="alert">{error}</p>}
        <small><LockKeyhole /> Your saved jobs and applications are protected by your account.</small>
      </section>
    </div>
  )
}
