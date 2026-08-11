"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Bookmark, BriefcaseBusiness, LogIn, LogOut, Search, Sparkles, UserPlus, UserRound } from "lucide-react"
import { ModeToggle } from "@/components/mode-toggle"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/components/auth-provider"

export function SiteHeader() {
  const pathname = usePathname()
  const { configured, loading, user, openAuth, signOut } = useAuth()

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
            href="/saved"
            className={pathname.startsWith("/saved") ? "nav-link active" : "nav-link"}
          >
            <Bookmark className="h-4 w-4" />
            <span>Saved</span>
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
              <button className="hidden items-center gap-2 rounded-full border bg-background/70 px-3 py-1.5 text-xs sm:flex" onClick={() => window.dispatchEvent(new Event("resume-tailor-open-onboarding"))} title="Edit job preferences">
                <UserRound className="h-3.5 w-3.5 text-primary" />
                <span className="max-w-32 truncate">{user.email}</span>
              </button>
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
              <Button variant="ghost" size="sm" onClick={() => openAuth("login")} disabled={loading || !configured}>
                <LogIn className="h-4 w-4" /><span>Log in</span>
              </Button>
              <Button size="sm" onClick={() => openAuth("signup")} disabled={loading || !configured}>
                <UserPlus className="h-4 w-4" /><span>Sign up</span>
              </Button>
            </div>
          )}
          <ModeToggle />
        </div>
      </div>
    </header>
  )
}
