"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { BriefcaseBusiness, LogIn, LogOut, Search, Sparkles, UserPlus, UserRound, X } from "lucide-react"
import { ModeToggle } from "@/components/mode-toggle"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/components/auth-provider"

export function SiteHeader() {
  const pathname = usePathname()
  const { configured, loading, user, signIn, signOut } = useAuth()
  const [authError, setAuthError] = useState("")

  const startGithubAuth = async () => {
    setAuthError("")
    try {
      await signIn("github")
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "GitHub sign-in could not be started.")
    }
  }

  return (
    <header className="site-header">
      <div className="container mx-auto flex items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="group flex min-w-0 items-center gap-3" aria-label="Resume Tailor home">
          <span className="brand-cube" aria-hidden="true">
            <Sparkles className="h-4 w-4" />
          </span>
          <span className="truncate font-heading text-lg font-bold tracking-tight">Resume Tailor</span>
        </Link>

        <nav className="nav-pill" aria-label="Primary navigation">
          <Link href="/" className={pathname === "/" ? "nav-link active" : "nav-link"}>
            <Sparkles className="h-4 w-4" />
            <span>Tailor</span>
          </Link>
          <Link
            href="/jobs"
            className={pathname.startsWith("/jobs") ? "nav-link active" : "nav-link"}
          >
            <Search className="h-4 w-4" />
            <span>Jobs</span>
          </Link>
          <Link
            href="/tracker"
            className={pathname.startsWith("/tracker") ? "nav-link active" : "nav-link"}
          >
            <BriefcaseBusiness className="h-4 w-4" />
            <span>Tracker</span>
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              <div className="hidden items-center gap-2 rounded-full border bg-background/70 px-3 py-1.5 text-xs sm:flex">
                <UserRound className="h-3.5 w-3.5 text-primary" />
                <span className="max-w-32 truncate">{user.email}</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => void signOut()}
                aria-label="Sign out"
                title="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <div className="nav-auth-actions">
              <Button variant="ghost" size="sm" onClick={() => void startGithubAuth()} disabled={loading || !configured}>
                <LogIn className="h-4 w-4" /><span>Log in</span>
              </Button>
              <Button size="sm" onClick={() => void startGithubAuth()} disabled={loading || !configured}>
                <UserPlus className="h-4 w-4" /><span>Sign up</span>
              </Button>
            </div>
          )}
          <ModeToggle />
        </div>
      </div>
      {authError && (
        <div className="nav-auth-error" role="alert">
          <span>{authError}</span>
          <button onClick={() => setAuthError("")} aria-label="Dismiss sign-in error"><X className="h-4 w-4" /></button>
        </div>
      )}
    </header>
  )
}
