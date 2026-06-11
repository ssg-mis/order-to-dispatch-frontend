"use client"

import type React from "react"
import { Geist, Geist_Mono, Inter } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"
import { SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { usePathname, useRouter } from "next/navigation"
import { Toaster } from "@/components/ui/toaster"
import { useEffect, useState } from "react"

const geistSans = Geist({ subsets: ["latin"], variable: "--font-geist-sans" })
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" })
const inter = Inter({ subsets: ["latin"], variable: "--font-sans", weight: ["400", "500", "600", "700", "800", "900"] })

import { QueryProvider } from "@/components/query-provider"
import { AuthProvider, useAuthContext } from "@/contexts/auth-context"

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        <title>Enterprise Order Management</title>
        <meta name="description" content="Professional multi-stage order tracking system" />
      </head>
      <body className={`${inter.variable} ${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
        <QueryProvider>
          <AuthProvider>
            <LayoutShell>{children}</LayoutShell>
          </AuthProvider>
        </QueryProvider>
        <Analytics />
      </body>
    </html>
  )
}

function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, isAuthenticated, isLoading } = useAuthContext()
  const [isReady, setIsReady] = useState(false)
  const isLoginPage = pathname === "/login"

  useEffect(() => {
    const preventNumberScroll = (e: WheelEvent) => {
      if ((e.target as HTMLElement).closest('input[type="number"]')) {
        e.preventDefault()
      }
    }
    document.addEventListener("wheel", preventNumberScroll, { passive: false })
    return () => document.removeEventListener("wheel", preventNumberScroll)
  }, [])

  useEffect(() => {
    if (isLoading) return // wait for /me to resolve

    if (!isAuthenticated && !isLoginPage) {
      router.push("/login")
      return
    }

    if (isAuthenticated && isLoginPage) {
      router.push("/")
      return
    }

    if (isAuthenticated && user) {
      const pageAccess = user.page_access

      const urlToPermission: Record<string, string> = {
        "/": "Dashboard",
        "/owner-dashboard": "Owner Dashboard",
        "/system-flow": "System Flow",
        "/commitment-punch": "Commitment Punch",
        "/order-punch": "Order Punch",
        "/pre-approval": "Pre Approval",
        "/approval-of-order": "Approval of Order",
        "/dispatch-material": "Dispatch Planning",
        "/actual-dispatch": "Actual Dispatch",
        "/vehicle-details": "Vehicle Details",
        "/material-load": "Material Load",
        "/security-approval": "Security Guard Approval",
        "/make-invoice": "Make Invoice",
        "/check-invoice": "Check Invoice",
        "/gate-out": "Gate Out",
        "/material-receipt": "Confirm Material Receipt",
        "/damage-adjustment": "Damage Adjustment",
        "/gate-in": "Gate In",
        "/variable-parameters": "Variable Parameters",
        "/settings": "Settings",
        "/set-turn-around-time": "Set Turn Around Time",
        "/master": "Master",
        "/reports": "Reports",
      }

      const hasAccess = (permissionName: string): boolean => {
        if (!pageAccess) return false
        if (Array.isArray(pageAccess)) return pageAccess.includes(permissionName)
        return !!(pageAccess as Record<string, string>)[permissionName]
      }

      const requiredPermission = urlToPermission[pathname]
      if (requiredPermission && !hasAccess(requiredPermission)) {
        console.warn(`Unauthorized access attempt to ${pathname}`)
        const firstAvailable = Object.entries(urlToPermission).find(([, perm]) => hasAccess(perm))
        if (firstAvailable) {
          router.push(firstAvailable[0])
          return
        }
      }
    }

    setIsReady(true)
  }, [pathname, isLoading, isAuthenticated, user, isLoginPage, router])

  if (!isReady && !isLoginPage) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center" style={{ background: "oklch(0.97 0.012 245)" }}>
        <div className="animate-pulse text-muted-foreground font-medium">Loading session...</div>
      </div>
    )
  }

  return (
    <>
      {isLoginPage ? (
        <>
          {children}
          <Toaster />
        </>
      ) : (
        <SidebarProvider defaultOpen={true}>
          <div className="flex min-h-screen w-full">
            <AppSidebar />
            <main
              className="flex-1 overflow-y-auto overflow-x-hidden"
              style={{ background: "oklch(0.97 0.012 245)" }}
            >
              {children}
            </main>
          </div>
          <Toaster />
        </SidebarProvider>
      )}
    </>
  )
}
