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
} from "lucide-react"
import { usePathname } from "next/navigation"

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
} from "@/components/ui/sidebar"

const modules = [
  { title: "Dashboard", icon: LayoutDashboard, url: "/" },
  { title: "Order Punch", icon: ClipboardPen, url: "/order-punch" },
  { title: "Pre Approval", icon: BadgeCheck, url: "/pre-approval" },
  { title: "Approval of Order", icon: FileSearch, url: "/approval-of-order" },

  { title: "Dispatch Planning", icon: PackageCheck, url: "/dispatch-material" },
  { title: "Actual Dispatch", icon: Send, url: "/actual-dispatch" },
  { title: "Vehicle Details", icon: Car, url: "/vehicle-details" },
  { title: "Material Load", icon: Truck, url: "/material-load" },
  { title: "Security Guard Approval", icon: ShieldCheck, url: "/security-approval" },
  { title: "Make Invoice (Proforma)", icon: FileText, url: "/make-invoice" },
  { title: "Check Invoice", icon: FileCheck, url: "/check-invoice" },

  { title: "Gate Out", icon: Gate, url: "/gate-out" },
  { title: "Confirm Material Receipt", icon: FileSignature, url: "/material-receipt" },
  { title: "Damage Adjustment", icon: AlertCircle, url: "/damage-adjustment" },

]

export function AppSidebar() {
  const pathname = usePathname()
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
              {modules.map((item) => {
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
      <SidebarRail />
    </Sidebar>
  )
}
