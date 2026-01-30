"use client"
import Link from "next/link"
import {
  LayoutDashboard,
  ClipboardPen,
  BadgeCheck,
  FileSearch,
  BookMarked,
  Truck,
  ShieldCheck,
  FileText,
  Gauge as Gate,
  PackageCheck,
  History,
  AlertCircle,
  FileCheck,
  Receipt,
  FileSignature,
  Factory,
  Car,
  Search,
  Send,
  Settings2,
  LogOut,
} from "lucide-react"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarFooter,
} from "@/components/ui/sidebar"

const modules = [
  { title: "Dashboard", icon: LayoutDashboard, url: "/" },
  { title: "Order Punch", icon: ClipboardPen, url: "/order-punch" },
  { title: "Pre Approval", icon: BadgeCheck, url: "/pre-approval" },
  { title: "Approval of Order", icon: FileSearch, url: "/approval-of-order" },

  { title: "Dispatch Planning", icon: PackageCheck, url: "/dispatch-material" },
  { title: "Actual Dispatch", icon: Send, url: "/actual-dispatch" },
  { title: "Security Guard Approval", icon: ShieldCheck, url: "/security-approval" },
  { title: "Make Invoice (Proforma)", icon: FileText, url: "/make-invoice" },
  { title: "Check Invoice", icon: FileCheck, url: "/check-invoice" },

  { title: "Gate Out", icon: Gate, url: "/gate-out" },
  { title: "Confirm Material Receipt", icon: FileSignature, url: "/material-receipt" },
  { title: "Damage Adjustment", icon: AlertCircle, url: "/damage-adjustment" },
  { title: "Settings", icon: Settings2, url: "/settings" },
  { title: "Master", icon: BookMarked, url: "/master" },

]

export function AppSidebar() {
  const pathname = usePathname()
  const [allowedModules, setAllowedModules] = useState(modules)

  useEffect(() => {
    const userStr = localStorage.getItem("user")
    if (userStr) {
      try {
        const user = JSON.parse(userStr)
        const pageAccess = user.page_access || []
        
        // Special mapping for cases where sidebar title differs from permission name
        const permissionMapping: Record<string, string> = {
          "Make Invoice (Proforma)": "Make Invoice",
          "Confirm Material Receipt": "Confirm Material Receipt",
          "Damage Adjustment": "Damage Adjustment",
        }

        const filtered = modules.filter(module => {
          // Dashboard is always allowed if authenticated
          if (module.title === "Dashboard") return true
          
          const permissionName = permissionMapping[module.title] || module.title
          return pageAccess.includes(permissionName)
        })
        
        setAllowedModules(filtered)
      } catch (e) {
        console.error("Failed to parse user for sidebar filtering", e)
      }
    }
  }, [])

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <PackageCheck className="h-5 w-5" />
          </div>
          <span className="font-bold text-sidebar-foreground truncate">OMS Enterprise</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50">Modules</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {allowedModules.map((item) => {
                const isActive = pathname === item.url
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.title}
                      className={`transition-all duration-200 ease-in-out hover:pl-3 group-data-[collapsible=icon]:hover:pl-0 ${
                        isActive 
                          ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm font-medium" 
                          : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                      }`}
                    >
                      <Link href={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Logout"
              className="text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
              onClick={() => {
                // Clear authentication data
                localStorage.removeItem('user')
                localStorage.removeItem('isAuthenticated')
                console.log('User logged out')
                // Redirect to login page
                window.location.href = '/login'
              }}
            >
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
