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
  AlertCircle,
  FileCheck,
  Receipt,
  FileSignature,
  Factory,
  Car,
  Send,
  Settings2,
  LogOut,
  ChevronRight,
  BarChart2,
  Calculator,
  Save,
  Calendar,
} from "lucide-react"
import { usePathname } from "next/navigation"
import { useEffect, useState, useMemo } from "react"
import { useToast } from "@/hooks/use-toast"

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
  { title: "Variable Parameters", icon: Calculator, url: "/variable-parameters" },
  { title: "Settings", icon: Settings2, url: "/settings" },
  { title: "Master", icon: BookMarked, url: "/master" },
  { title: "Reports", icon: BarChart2, url: "/reports" },
]

export function AppSidebar() {
  const pathname = usePathname()
  const [allowedModules, setAllowedModules] = useState(modules)
  const [username, setUsername] = useState<string>("")
  const [userRole, setUserRole] = useState<string>("")

  const { toast } = useToast()

  useEffect(() => {
    const userStr = localStorage.getItem("user")
    if (userStr) {
      try {
        const user = JSON.parse(userStr)
        const pageAccess = user.page_access || []
        setUsername(user.username || "")
        setUserRole(user.role || "")

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
    <Sidebar collapsible="icon" className="border-r-0">
      {/* Header */}
      <SidebarHeader className="p-0">
        <div
          className="flex items-center gap-3 px-4 py-5"
          style={{
            background: "linear-gradient(135deg, oklch(0.10 0.05 260) 0%, oklch(0.16 0.06 255) 100%)",
            borderBottom: "1px solid oklch(0.25 0.06 255)",
          }}
        >
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl shadow-lg shrink-0"
            style={{
              background: "linear-gradient(135deg, oklch(0.54 0.22 265) 0%, oklch(0.44 0.20 280) 100%)",
              boxShadow: "0 4px 12px oklch(0.42 0.18 265 / 0.4)",
            }}
          >
            <PackageCheck className="h-5 w-5 text-white" />
          </div>
          <div className="flex flex-col min-w-0 group-data-[collapsible=icon]:hidden">
            <span className="font-black text-white text-sm tracking-tight leading-tight">OMS Enterprise</span>
            <span className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: "oklch(0.65 0.12 265)" }}>
              Order Management
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="py-3">
        <SidebarGroup>
          <SidebarGroupLabel
            className="px-4 mb-1 text-[9px] font-black uppercase tracking-[0.18em]"
            style={{ color: "oklch(0.50 0.05 255)" }}
          >
            Modules
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5 px-2">
              {allowedModules.map((item) => {
                const isActive = pathname === item.url
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.title}
                      className={`
                        relative h-9 rounded-lg transition-all duration-200 ease-out
                        group-data-[collapsible=icon]:justify-center
                        ${isActive
                          ? "text-white font-semibold shadow-md"
                          : "font-medium hover:text-white"
                        }
                      `}
                      style={isActive ? {
                        background: "linear-gradient(90deg, oklch(0.42 0.18 265) 0%, oklch(0.48 0.20 260) 100%)",
                        boxShadow: "0 2px 10px oklch(0.42 0.18 265 / 0.35)",
                        color: "white",
                      } : {
                        color: "oklch(0.70 0.04 250)",
                      }}
                    >
                      <Link href={item.url} className="flex items-center gap-3 px-3 w-full">
                        {isActive && (
                          <span
                            className="absolute left-0 inset-y-0 w-[3px] rounded-r-full"
                            style={{ background: "oklch(0.78 0.18 265)" }}
                          />
                        )}
                        <item.icon
                          className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:scale-105"
                          style={{ color: isActive ? "white" : "oklch(0.60 0.10 260)" }}
                        />
                        <span className="truncate text-[13px]">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

      </SidebarContent>

      <SidebarFooter
        className="p-2"
        style={{ borderTop: "1px solid oklch(0.22 0.06 255)" }}
      >
        {/* User Info (visible when expanded) */}
        {username && (
          <div
            className="flex items-center gap-3 px-3 py-2 rounded-lg mb-1 group-data-[collapsible=icon]:hidden"
            style={{ background: "oklch(0.20 0.05 255)" }}
          >
            <div
              className="flex h-7 w-7 items-center justify-center rounded-lg shrink-0 text-xs font-black text-white"
              style={{ background: "oklch(0.42 0.18 265)" }}
            >
              {username.charAt(0).toUpperCase()}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[12px] font-bold text-white/90 capitalize truncate">{username}</span>
              <span className="text-[10px] capitalize" style={{ color: "oklch(0.55 0.06 255)" }}>{userRole || "user"}</span>
            </div>
          </div>
        )}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Logout"
              className="h-9 rounded-lg font-medium transition-all duration-200"
              style={{ color: "oklch(0.62 0.12 25)" }}
              onClick={() => {
                localStorage.removeItem('user')
                localStorage.removeItem('isAuthenticated')
                window.location.href = '/login'
              }}
            >
              <LogOut className="h-4 w-4" />
              <span className="text-[13px]">Logout</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
