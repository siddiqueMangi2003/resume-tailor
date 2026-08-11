"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import type { Provider, Session, User } from "@supabase/supabase-js"
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase"

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? ""
const authReturnKey = "resume-tailor-auth-return"
export type AuthProviderName = "google" | "github" | "linkedin_oidc"
export type AuthMode = "login" | "signup"

interface AuthContextValue {
  configured: boolean
  loading: boolean
  session: Session | null
  user: User | null
  authOpen: boolean
  authMode: AuthMode
  openAuth: (mode?: AuthMode) => void
  closeAuth: () => void
  signIn: (provider: AuthProviderName) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [authOpen, setAuthOpen] = useState(false)
  const [authMode, setAuthMode] = useState<AuthMode>("login")

  useEffect(() => {
    const supabase = getSupabaseBrowserClient()
    if (!supabase) return

    const restoreRequestedPage = (nextSession: Session | null) => {
      if (!nextSession) return
      const returnPath = sessionStorage.getItem(authReturnKey)
      const allowedPrefix = `${basePath}/`
      if (!returnPath || !returnPath.startsWith(allowedPrefix) || returnPath.startsWith("//")) return
      sessionStorage.removeItem(authReturnKey)
      const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`
      if (returnPath !== currentPath) window.location.replace(returnPath)
    }

    let active = true
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setLoading(false)
      restoreRequestedPage(data.session)
    })

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setLoading(false)
      restoreRequestedPage(nextSession)
    })

    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  const openAuth = useCallback((mode: AuthMode = "login") => {
    setAuthMode(mode)
    setAuthOpen(true)
  }, [])

  const closeAuth = useCallback(() => setAuthOpen(false), [])

  const signIn = useCallback(async (provider: AuthProviderName) => {
    const supabase = getSupabaseBrowserClient()
    if (!supabase) return

    sessionStorage.setItem(
      authReturnKey,
      `${window.location.pathname}${window.location.search}${window.location.hash}`,
    )
    const redirectTo = `${window.location.origin}${basePath}/`
    const { error } = await supabase.auth.signInWithOAuth({
      provider: provider as Provider,
      options: {
        redirectTo,
        queryParams: provider === "google" ? { prompt: "select_account" } : undefined,
      },
    })
    if (error) throw error
  }, [])

  const signOut = useCallback(async () => {
    const supabase = getSupabaseBrowserClient()
    if (!supabase) return
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      configured: isSupabaseConfigured,
      loading,
      session,
      user: session?.user ?? null,
      authOpen,
      authMode,
      openAuth,
      closeAuth,
      signIn,
      signOut,
    }),
    [authMode, authOpen, closeAuth, loading, openAuth, session, signIn, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error("useAuth must be used within AuthProvider")
  return value
}
