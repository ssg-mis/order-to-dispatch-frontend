"use client"

import type React from "react"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"
import { SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { usePathname, useRouter } from "next/navigation"
import { Toaster } from "@/components/ui/toaster"
import { useEffect, useState } from "react"

const geistSans = Geist({ subsets: ["latin"], variable: "--font-sans" })
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" })

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
        const pageAccess = user.page_access || []
        
        // Map URLs to permission names
        const urlToPermission: Record<string, string> = {
          "/": "Dashboard",
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
          "/settings": "Settings",
          "/master": "Master",
        }

        const requiredPermission = urlToPermission[pathname]
        if (requiredPermission && requiredPermission !== "Dashboard" && !pageAccess.includes(requiredPermission)) {
          console.warn(`Unauthorized access attempt to ${pathname}`)
          router.push("/")
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
        <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased bg-muted/30`}>
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
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
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
              <main className="flex-1 overflow-y-auto bg-muted/30">{children}</main>
            </div>
            <Toaster />
          </SidebarProvider>
        )}
        <Analytics />
      </body>
    </html>
  )
}
