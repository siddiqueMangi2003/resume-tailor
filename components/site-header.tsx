"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { BriefcaseBusiness, LogOut, Sparkles, UserRound } from "lucide-react"
import { ModeToggle } from "@/components/mode-toggle"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/components/auth-provider"

export function SiteHeader() {
  const pathname = usePathname()
  const { user, signOut } = useAuth()

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
            href="/tracker"
            className={pathname.startsWith("/tracker") ? "nav-link active" : "nav-link"}
          >
            <BriefcaseBusiness className="h-4 w-4" />
            <span>Tracker</span>
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          {user && (
            <div className="hidden items-center gap-2 rounded-full border bg-background/70 px-3 py-1.5 text-xs sm:flex">
              <UserRound className="h-3.5 w-3.5 text-primary" />
              <span className="max-w-32 truncate">{user.email}</span>
            </div>
          )}
          {user && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => void signOut()}
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          )}
          <ModeToggle />
        </div>
      </div>
    </header>
  )
}
