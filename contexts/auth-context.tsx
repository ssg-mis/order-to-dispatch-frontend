"use client"

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react"
import { usePathname } from "next/navigation"
import { API_CONFIG } from "@/lib/api-config"

type PageAccessMap = Record<string, 'view_only' | 'modify'>

export interface AuthUser {
  id: number
  username: string
  role: string
  page_access: string[] | PageAccessMap | null
  depo_access: Record<string, string[]> | null
  features?: Record<string, boolean>
}

interface AuthContextType {
  user: AuthUser | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (user: AuthUser) => void
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

function normalizeDepoAccess(raw: any): Record<string, string[]> {
  if (!raw) return {}
  let parsed: any = raw
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw)
    } catch {
      const clean = raw.replace(/^\{/, '').replace(/\}$/, '')
      if (clean === "") return {}
      return { 'Default': clean.split(',').map((s: string) => s.trim()) }
    }
  }

  if (!parsed || typeof parsed !== 'object') return {}

  const result: Record<string, string[]> = {}
  Object.entries(parsed).forEach(([page, val]) => {
    if (Array.isArray(val)) {
      result[page] = val.map(String)
    } else if (typeof val === 'string') {
      result[page] = val
        .replace(/^\{/, '').replace(/\}$/, '')
        .split(',')
        .map((s: string) => s.replace(/^"/, '').replace(/"$/, '').trim())
        .filter(Boolean)
    } else {
      result[page] = []
    }
  })
  return result
}

function normalizeUser(raw: any): AuthUser {
  return {
    ...raw,
    depo_access: normalizeDepoAccess(raw.depo_access),
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const pathname = usePathname()

  const fetchMe = useCallback(async (showLoading = false) => {
    if (showLoading) setIsLoading(true)
    try {
      const res = await fetch(`${API_CONFIG.baseURL}/users/me`, {
        credentials: "include",
      })
      if (res.status === 401) {
        setUser(null)
        return
      }
      if (!res.ok) return // transient error — keep current state
      const data = await res.json()
      if (data.success && data.data) {
        setUser(normalizeUser(data.data))
      }
    } catch {
      // network error — keep current state
    } finally {
      if (showLoading) setIsLoading(false)
    }
  }, [])

  // Initial load
  useEffect(() => {
    fetchMe(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Background refresh on navigation (no loading spinner)
  useEffect(() => {
    if (!isLoading) {
      fetchMe(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  const login = useCallback((userData: AuthUser) => {
    setUser(normalizeUser(userData))
  }, [])

  const logout = useCallback(() => {
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      isLoading,
      login,
      logout,
      refreshUser: () => fetchMe(false),
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuthContext(): AuthContextType {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuthContext must be used within AuthProvider")
  return ctx
}
