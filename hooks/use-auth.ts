"use client"

import { useState, useEffect, useCallback } from "react"
import { usePathname } from "next/navigation"
import { userApi } from "@/lib/api-service"

// page_access can be old format (string[]) or new format ({ pageName: 'view_only' | 'modify' })
type PageAccessMap = Record<string, 'view_only' | 'modify'>

interface User {
  id: number
  username: string
  role: string
  page_access: string[] | PageAccessMap | null
  depo_access: Record<string, string[]> | null
}

// URL path → page name mapping (matches PAGE_ACCESS_OPTIONS in settings)
const URL_TO_PAGE: Record<string, string> = {
  '/': 'Dashboard',
  '/order-punch': 'Order Punch',
  '/pre-approval': 'Pre Approval',
  '/approval-of-order': 'Approval of Order',
  '/dispatch-material': 'Dispatch Planning',
  '/actual-dispatch': 'Actual Dispatch',
  '/vehicle-details': 'Vehicle Details',
  '/material-load': 'Material Load',
  '/security-approval': 'Security Guard Approval',
  '/make-invoice': 'Make Invoice',
  '/check-invoice': 'Check Invoice',
  '/gate-out': 'Gate Out',
  '/material-receipt': 'Confirm Material Receipt',
  '/damage-adjustment': 'Damage Adjustment',
  '/variable-parameters': 'Variable Parameters',
  '/settings': 'Settings',
  '/master': 'Master',
  '/reports': 'Reports',
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const pathname = usePathname()

  // Read user from localStorage
  const checkAuth = useCallback(() => {
    try {
      const userStr = localStorage.getItem("user")
      const authStatus = localStorage.getItem("isAuthenticated") === "true"

      if (authStatus && userStr) {
        const userData = JSON.parse(userStr)
        if (userData) {
          userData.depo_access = normalizeDepoAccess(userData.depo_access)
        }
        setUser(userData)
        setIsAuthenticated(true)
      } else {
        setUser(null)
        setIsAuthenticated(false)
      }
    } catch (error) {
      console.error("Auth check failed:", error)
      setUser(null)
      setIsAuthenticated(false)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Initial load + listen for storage events
  useEffect(() => {
    checkAuth()
    window.addEventListener("storage", checkAuth)
    return () => window.removeEventListener("storage", checkAuth)
  }, [checkAuth])

  // Re-fetch fresh user data from server on every navigation
  useEffect(() => {
    const refreshUser = async () => {
      try {
        const userStr = localStorage.getItem("user")
        const authStatus = localStorage.getItem("isAuthenticated") === "true"
        if (!authStatus || !userStr) return

        const currentUser = JSON.parse(userStr)
        if (!currentUser?.id) return

        const response = await userApi.getById(currentUser.id)
        if (response.success && response.data) {
          const freshUser = response.data
          freshUser.depo_access = normalizeDepoAccess(freshUser.depo_access)
          // Update localStorage with fresh data from server
          localStorage.setItem("user", JSON.stringify(freshUser))
          setUser(freshUser)
        }
      } catch (error) {
        // Silent fail — don't break the app if refresh fails
        console.warn("Failed to refresh user data:", error)
      }
    }

    refreshUser()
  }, [pathname])

  /**
   * Normalizes depo_access from DB (potentially string/JSON) to Record<string, string[]>
   */
  function normalizeDepoAccess(raw: any): Record<string, string[]> {
    if (!raw) return {}
    let parsed: any = raw
    if (typeof raw === 'string') {
      try {
        parsed = JSON.parse(raw)
      } catch {
        // Fallback for Postgres text array format "{Value1,Value2}"
        const clean = raw.replace(/^\{/, '').replace(/\}$/, '')
        if (clean === "") return {}
        // This is a simple fallback; real Postgres arrays can be more complex, 
        // but for this app's depot names it should work.
        return { 'Default': clean.split(',').map(s => s.trim()) }
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

  /**
   * Returns 'modify' | 'view_only' | 'none' for a given page name.
   * Handles both old string[] format (all treated as 'modify') and
   * new object format { [pageName]: 'view_only' | 'modify' }.
   */
  const getPageAccess = (pageName: string): 'modify' | 'view_only' | 'none' => {
    if (!user || !user.page_access) return 'none'
    const pa = user.page_access
    if (Array.isArray(pa)) {
      return pa.includes(pageName) ? 'modify' : 'none'
    }
    return (pa as PageAccessMap)[pageName] || 'none'
  }

  // Current page name based on URL path
  const currentPageName = URL_TO_PAGE[pathname] || ''

  // Role-based read-only (pc role) OR per-page view_only access
  const isReadOnly = user?.role === 'pc' || getPageAccess(currentPageName) === 'view_only'
  const isAdmin = user?.role === 'admin'

  return {
    user,
    isAuthenticated,
    isLoading,
    isReadOnly,
    isAdmin,
    role: user?.role,
    getPageAccess,
    currentPageName,
  }
}
