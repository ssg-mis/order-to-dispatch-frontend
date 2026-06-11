"use client"

import { usePathname } from "next/navigation"
import { useAuthContext } from "@/contexts/auth-context"

type PageAccessMap = Record<string, 'view_only' | 'modify'>

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
  '/gate-in': 'Gate In',
  '/variable-parameters': 'Variable Parameters',
  '/settings': 'Settings',
  '/set-turn-around-time': 'Set Turn Around Time',
  '/master': 'Master',
  '/reports': 'Reports',
}

export function useAuth() {
  const { user, isAuthenticated, isLoading } = useAuthContext()
  const pathname = usePathname()

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

  const currentPageName = URL_TO_PAGE[pathname] || ''

  const isReadOnly = user?.role === 'pc' || getPageAccess(currentPageName) === 'view_only'
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin'

  const isFeatureEnabled = (feature: string): boolean => {
    return user?.features?.[feature] === true
  }

  return {
    user,
    isAuthenticated,
    isLoading,
    isReadOnly,
    isAdmin,
    role: user?.role,
    getPageAccess,
    currentPageName,
    isFeatureEnabled,
  }
}
