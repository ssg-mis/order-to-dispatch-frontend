"use client"

import { useState, useEffect } from "react"
import { usePathname } from "next/navigation"

// page_access can be old format (string[]) or new format ({ pageName: 'view_only' | 'modify' })
type PageAccessMap = Record<string, 'view_only' | 'modify'>

interface User {
  id: number
  username: string
  role: string
  page_access: string[] | PageAccessMap | null
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

  useEffect(() => {
    const checkAuth = () => {
      try {
        const userStr = localStorage.getItem("user")
        const authStatus = localStorage.getItem("isAuthenticated") === "true"

        if (authStatus && userStr) {
          const userData = JSON.parse(userStr)
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
    }

    checkAuth()

    // Listen for storage events to sync across tabs
    window.addEventListener("storage", checkAuth)
    return () => window.removeEventListener("storage", checkAuth)
  }, [])

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
