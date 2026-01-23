"use client"

import type React from "react"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"
import { SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { usePathname } from "next/navigation"
import { Toaster } from "@/components/ui/toaster"

const geistSans = Geist({ subsets: ["latin"], variable: "--font-sans" })
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" })

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const pathname = usePathname()
  const isLoginPage = pathname === "/login"

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
