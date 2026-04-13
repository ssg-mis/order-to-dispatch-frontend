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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const pathname = usePathname()
  const router = useRouter()
  const [isReady, setIsReady] = useState(false)
  const isLoginPage = pathname === "/login"

  useEffect(() => {
    const userStr = localStorage.getItem("user")
    const isAuthenticated = localStorage.getItem("isAuthenticated") === "true"
    
    if (!isAuthenticated && !isLoginPage) {
      router.push("/login")
    } else if (isAuthenticated && isLoginPage) {
      router.push("/")
    } else if (isAuthenticated && userStr) {
      try {
        const user = JSON.parse(userStr)
        const pageAccess = user.page_access

        // Map URLs to permission names
        const urlToPermission: Record<string, string> = {
          "/": "Dashboard",
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
          "/variable-parameters": "Variable Parameters",
          "/settings": "Settings",
          "/master": "Master",
          "/reports": "Reports",
        }

        // Helper: check if a page is allowed, supporting both old (string[]) and new ({ page: level }) formats
        const hasAccess = (permissionName: string): boolean => {
          if (!pageAccess) return false
          if (Array.isArray(pageAccess)) return pageAccess.includes(permissionName)
          return !!(pageAccess as Record<string, string>)[permissionName]
        }

        const requiredPermission = urlToPermission[pathname]
        if (requiredPermission && !hasAccess(requiredPermission)) {
          console.warn(`Unauthorized access attempt to ${pathname}`)
          
          // Redirect to the first available authorized module
          const firstAvailable = Object.entries(urlToPermission).find(([url, perm]) => hasAccess(perm))
          if (firstAvailable) {
            router.push(firstAvailable[0])
          } else {
            // No access to any modules? Log them out or show an error.
            setIsReady(true)
          }
        } else {
          setIsReady(true)
        }
      } catch (e) {
        console.error("Failed to parse user for route protection", e)
        setIsReady(true)
      }
    } else {
      setIsReady(true)
    }
  }, [pathname, router, isLoginPage])

  // Don't render anything until auth check is done to prevent flicker
  if (!isReady && !isLoginPage) {
    return (
      <html lang="en">
        <body className={`${inter.variable} ${geistSans.variable} ${geistMono.variable} font-sans antialiased`} style={{ background: "oklch(0.97 0.012 245)" }}>
          <div className="flex min-h-screen w-full items-center justify-center">
            <div className="animate-pulse text-muted-foreground font-medium">Loading session...</div>
          </div>
        </body>
      </html>
    )
  }

  return (
    <html lang="en">
      <head>
        <title>Enterprise Order Management</title>
        <meta name="description" content="Professional multi-stage order tracking system" />
      </head>
      <body className={`${inter.variable} ${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
        <QueryProvider>
          {isLoginPage ? (
            // Login page without sidebar
            <>
              {children}
              <Toaster />
            </>
          ) : (
            // All other pages with sidebar
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
        </QueryProvider>
        <Analytics />
      </body>
    </html>
  )
}
