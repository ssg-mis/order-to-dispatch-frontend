"use client"

import { useEffect, useState, useMemo, useRef } from "react"
import { SidebarTrigger } from "@/components/ui/sidebar"
import {
  Package, Package as Box,
  FileBarChart, Truck, Activity, ShieldCheck, FileText, FileCheck,
  LogOut, AlertTriangle, XCircle, BarChart3, Calendar, Layers,
  Send, Car, Plus, MapPin, ChevronDown, Search, X, ChevronRight,
  CheckCircle2,
} from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/hooks/use-auth"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useRouter } from "next/navigation"

// ─── Stage Definitions ────────────────────────────────────────────────────
const STAGES = [
  { id: "Order Punch",       label: "Order Punch",             shortLabel: "Order",    color: "#6366f1", url: "/order-punch" },
  { id: "Pre-Approval",      label: "Pre Approval",            shortLabel: "Pre App",  color: "#8b5cf6", url: "/pre-approval" },
  { id: "Approval Of Order", label: "Approval of Order",       shortLabel: "Approval", color: "#a855f7", url: "/approval-of-order" },
  { id: "Dispatch Planning", label: "Dispatch Planning",       shortLabel: "Plan",     color: "#ec4899", url: "/dispatch-material" },
  { id: "Actual Dispatch",   label: "Actual Dispatch",         shortLabel: "Dispatch", color: "#f43f5e", url: "/actual-dispatch" },
  { id: "Vehicle Details",   label: "Vehicle Details",         shortLabel: "Vehicle",  color: "#f97316", url: "/vehicle-details" },
  { id: "Material Load",     label: "Material Load",           shortLabel: "Load",     color: "#f59e0b", url: "/material-load" },
  { id: "Security Approval", label: "Security Guard Approval", shortLabel: "Security", color: "#eab308", url: "/security-approval" },
  { id: "Make Invoice",      label: "Invoice (Proforma)",      shortLabel: "Invoice",  color: "#84cc16", url: "/make-invoice" },
  { id: "Check Invoice",     label: "Check Invoice",           shortLabel: "Check",    color: "#22c55e", url: "/check-invoice" },
  { id: "Gate Out",          label: "Gate Out",                shortLabel: "Gate",     color: "#10b981", url: "/gate-out" },
  { id: "Material Receipt",  label: "Confirm Receipt",         shortLabel: "Receipt",  color: "#14b8a6", url: "/material-receipt" },
  { id: "Damage Adjustment", label: "Damage Adjustment",       shortLabel: "Damage",   color: "#06b6d4", url: "/damage-adjustment" },
  { id: "Final Delivery",    label: "Final Delivery",          shortLabel: "Done",     color: "#22d3ee", url: "/" }
]

/**
 * Strip trailing letter suffix(es) from order number.
 * DO/26-27/0001A  → DO/26-27/0001
 * DO/26-27/0001B  → DO/26-27/0001
 * DO/26-27/0001   → DO/26-27/0001
 */
const getBaseOrderNo = (orderNo: string) => {
  if (!orderNo) return orderNo
  const match = orderNo.match(/^(DO[-\/](?:\d{2}-\d{2}\/)?\d+)/i)
  return match ? match[1].toUpperCase() : orderNo
}

const PAGE_SIZE = 20

// ─── Dashboard ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const router = useRouter()
  const { user, role: authRole } = useAuth()
  const [role, setRole] = useState("admin")
  const [timeRange, setTimeRange] = useState("today")
  const [lastSync, setLastSync] = useState(new Date())
  const [isMounted, setIsMounted] = useState(false)
  const [backendData, setBackendData] = useState<any>(null)

  // Pipeline state
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null)
  const [filterOrderNo, setFilterOrderNo] = useState("")
  const [filterCompany, setFilterCompany] = useState("")
  const [pageCount, setPageCount] = useState(1)
  const loaderRef = useRef<HTMLDivElement>(null)

  // Dialogs
  const [dialogs, setDialogs] = useState({
    pending: false, completed: false, dispatch: false, damages: false,
    invoices: false, delayed: false, rejected: false, total: false
  })
  const openDialog = (key: keyof typeof dialogs) => setDialogs(d => ({ ...d, [key]: true }))
  const closeDialog = (key: keyof typeof dialogs) => setDialogs(d => ({ ...d, [key]: false }))

  useEffect(() => { if (authRole) setRole(authRole) }, [authRole])

  useEffect(() => {
    setIsMounted(true)
    const load = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api/v1'}/dashboard/overview`)
        if (res.ok) {
          const r = await res.json()
          if (r.success) setBackendData(r.data)
        }
      } catch (e) { console.error(e) }
    }
    load()
    const iv = setInterval(() => { load(); setLastSync(new Date()) }, 8000)
    return () => clearInterval(iv)
  }, [])

  // Infinite scroll
  useEffect(() => {
    const el = loaderRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting) setPageCount(p => p + 1) },
      { threshold: 0.1 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [loaderRef.current])

  const stats = useMemo(() => {
    if (!backendData) return {
      total: 0, active: 0, completed: 0, delayed: 0, cancelled: 0,
      stageCounts: [], recentOrders: [], createdToday: 0, dispatchedToday: 0,
      invoicedToday: 0, deliveredToday: 0, timelineData: [],
      pendingOrdersList: [], completedOrdersList: [], dispatchPlanningList: [],
      damagesOrdersList: [], invoicesOrdersList: [], delayedOrdersList: [],
      cancelledOrdersList: [], totalOrdersList: []
    }
    const orders = backendData.recentOrders || []
    return {
      total: backendData.total || 0,
      active: backendData.active || 0,
      completed: backendData.completed || 0,
      delayed: backendData.delayed || 0,
      cancelled: backendData.cancelled || 0,
      stageCounts: backendData.stageCounts || [],
      recentOrders: orders,
      createdToday: backendData.createdToday || 0,
      dispatchedToday: backendData.dispatchedToday || 0,
      invoicedToday: backendData.invoicedToday || 0,
      deliveredToday: backendData.deliveredToday || 0,
      timelineData: [],
      pendingOrdersList: orders.filter((o: any) => o.status === 'pending'),
      completedOrdersList: orders.filter((o: any) => o.status === 'completed'),
      dispatchPlanningList: orders.filter((o: any) => o.stage === 'Dispatch Planning'),
      damagesOrdersList: orders.filter((o: any) => o.stage === 'Damage Adjustment'),
      invoicesOrdersList: orders.filter((o: any) => ['Make Invoice','Check Invoice'].includes(o.stage)),
      delayedOrdersList: orders.filter((o: any) => o.status === 'pending'),
      cancelledOrdersList: orders.filter((o: any) => o.status === 'cancelled'),
      totalOrdersList: orders
    }
  }, [backendData])

  /**
   * Group orders by their base order number.
   * DO-416A, DO-416B, DO-416C → one group "DO-416" with 3 sub-orders
   */
  const groupedOrders = useMemo(() => {
    const map = new Map<string, { baseNo: string; subOrders: any[] }>()
    stats.recentOrders.forEach((order: any) => {
      const rawNo = order.doNumber || order.orderNo || ""
      const base = getBaseOrderNo(rawNo)
      if (!map.has(base)) map.set(base, { baseNo: base, subOrders: [] })
      map.get(base)!.subOrders.push(order)
    })
    return Array.from(map.values())
  }, [stats.recentOrders])

  // Filter by order no or company name
  const filteredGroups = useMemo(() => {
    const fNo = filterOrderNo.toLowerCase().trim()
    const fCo = filterCompany.toLowerCase().trim()
    return groupedOrders.filter(g => {
      const baseMatch = !fNo || g.baseNo.toLowerCase().includes(fNo)
      const companyMatch = !fCo || g.subOrders.some(o => (o.customerName || "").toLowerCase().includes(fCo))
      return baseMatch && companyMatch
    })
  }, [groupedOrders, filterOrderNo, filterCompany])

  const visibleGroups = useMemo(() => filteredGroups.slice(0, pageCount * PAGE_SIZE), [filteredGroups, pageCount])

  return (
    <div className="min-h-screen" style={{ background: "oklch(0.97 0.012 245)" }}>

      {/* Header */}
      <div className="sticky top-0 z-30 flex items-center justify-between px-6 py-3 border-b"
        style={{ background: "rgba(255,255,255,0.88)", backdropFilter: "blur(12px)", borderColor: "oklch(0.88 0.025 245)", boxShadow: "0 1px 12px oklch(0.42 0.18 265 / 0.06)" }}>
        <div className="flex items-center gap-3">
          <SidebarTrigger className="-ml-1" />
          <div className="h-5 w-px bg-border mx-1" />
          <h1 className="text-xl font-black tracking-tight text-slate-900">Dashboard</h1>
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider"
            style={{ background: "oklch(0.95 0.05 155)", color: "oklch(0.40 0.15 155)" }}>
            <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />Live
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-slate-400 font-medium hidden md:inline" suppressHydrationWarning>
            Synced: {isMounted ? lastSync.toLocaleTimeString() : "--:--:--"}
          </span>
          <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl" style={{ background: "oklch(0.95 0.02 245)" }}>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg text-xs font-black text-white"
              style={{ background: "linear-gradient(135deg, oklch(0.42 0.18 265), oklch(0.54 0.22 265))" }}>
              {(user?.username || "A").charAt(0).toUpperCase()}
            </div>
            <div className="hidden sm:flex flex-col">
              <span className="text-[12px] font-bold text-slate-800 capitalize leading-none">{user?.username || "Administrator"}</span>
              <span className="text-[10px] text-slate-400 capitalize">{role}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Page body */}
      <div className="p-5 md:p-7 max-w-[1600px] mx-auto space-y-6">
        <p className="text-sm text-slate-500 font-medium">OMS Enterprise Operational Overview</p>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {[
            { title: "Total Orders", value: stats.total, icon: Package, color: "#6366f1", trend: "Total", onClick: () => openDialog("total") },
            { title: "Active Orders", value: stats.active, icon: Activity, color: "#f59e0b", trend: "In Progress", onClick: () => openDialog("pending") },
            { title: "Completed", value: stats.completed, icon: CheckCircle2, color: "#10b981", trend: "Fulfilled", onClick: () => openDialog("completed") },
            { title: "Delayed / Attention", value: stats.delayed, icon: AlertTriangle, color: "#f43f5e", trend: "Review SLA", alert: stats.delayed > 0, onClick: () => openDialog("delayed") },
            { title: "Rejected", value: stats.cancelled, icon: XCircle, color: "#64748b", trend: "Failed", onClick: () => openDialog("rejected") },
          ].map(card => <KPICard key={card.title} {...card} />)}
        </div>

        {/* Order Overview */}
        <div className="rounded-2xl border overflow-hidden bg-white"
          style={{ borderColor: "oklch(0.88 0.025 245)", boxShadow: "0 1px 12px oklch(0.42 0.18 265 / 0.04)" }}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-4 border-b"
            style={{ background: "oklch(0.97 0.014 248)", borderColor: "oklch(0.90 0.025 245)" }}>
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: "oklch(0.42 0.18 265 / 0.10)" }}>
                <Layers className="h-4 w-4" style={{ color: "oklch(0.42 0.18 265)" }} />
              </div>
              <span className="text-base font-bold text-slate-800">Order Overview</span>
            </div>
            <Tabs value={timeRange} onValueChange={setTimeRange} className="w-auto">
              <TabsList className="h-9 p-1 gap-0.5 rounded-xl" style={{ background: "oklch(0.91 0.03 245)" }}>
                {["today","week","month"].map(t => (
                  <TabsTrigger key={t} value={t}
                    className="rounded-lg h-7 px-4 text-[10px] font-black uppercase tracking-widest transition-all data-[state=active]:bg-white data-[state=active]:shadow-sm"
                    style={{ color: timeRange === t ? "oklch(0.42 0.18 265)" : "oklch(0.52 0.04 245)" }}>
                    {t === "today" ? "Today" : t === "week" ? "This Week" : "Month"}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
          <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              <MiniStatCard icon={Activity} label="Pending Orders" value={stats.active} badge="Live Status" badgeColor="#f59e0b" cardBg="oklch(0.99 0.04 75 / 0.4)" borderColor="oklch(0.88 0.08 75)" iconColor="#f59e0b" onClick={() => openDialog("pending")} />
              <MiniStatCard icon={CheckCircle2} label="Complete Orders" value={stats.completed} badge="Success" badgeColor="#10b981" cardBg="oklch(0.98 0.04 155 / 0.4)" borderColor="oklch(0.88 0.08 155)" iconColor="#10b981" onClick={() => openDialog("completed")} />
              <MiniStatCard icon={Layers} label="Dispatch Planning"
                value={(stats.stageCounts.find((s: any) => s.id === "Dispatch Planning")?.pending || 0) + (stats.stageCounts.find((s: any) => s.id === "Dispatch Planning")?.completed || 0)}
                badge="Planning" badgeColor="#6366f1" cardBg="oklch(0.98 0.03 265 / 0.4)" borderColor="oklch(0.88 0.06 265)" iconColor="#6366f1"
                subData={[
                  { label: "P", value: stats.stageCounts.find((s: any) => s.id === "Dispatch Planning")?.pending || 0, color: "#f59e0b" },
                  { label: "C", value: stats.stageCounts.find((s: any) => s.id === "Dispatch Planning")?.completed || 0, color: "#10b981" }
                ]}
                onClick={() => openDialog("dispatch")} />
              <MiniStatCard icon={AlertTriangle} label="Damages (Count)" value={stats.stageCounts.find((s: any) => s.id === "Damage Adjustment")?.pending || 0} badge="Critical" badgeColor="#f43f5e" cardBg="oklch(0.99 0.04 25 / 0.4)" borderColor="oklch(0.88 0.08 25)" iconColor="#f43f5e" onClick={() => openDialog("damages")} />
              <MiniStatCard icon={FileText} label="Total Payment" value={stats.stageCounts.find((s: any) => s.id === "Make Invoice")?.completed || 0} badge="Payment" badgeColor="#8b5cf6" cardBg="oklch(0.98 0.03 295 / 0.4)" borderColor="oklch(0.88 0.06 295)" iconColor="#8b5cf6" onClick={() => openDialog("invoices")} />
            </div>
            <div className="lg:col-span-4 rounded-xl border overflow-hidden flex flex-col" style={{ borderColor: "oklch(0.90 0.025 245)" }}>
              <div className="px-4 py-2.5 border-b" style={{ background: "oklch(0.95 0.02 248)", borderColor: "oklch(0.90 0.025 245)" }}>
                <span className="text-[11px] font-black text-slate-600 uppercase tracking-wider">System Stage Overview</span>
              </div>
              <ScrollArea className="h-[320px]">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent" style={{ borderColor: "oklch(0.90 0.025 245)" }}>
                      <TableHead className="h-8 text-[10px] font-black uppercase pl-4 py-0" style={{ color: "oklch(0.52 0.04 245)" }}>Stage</TableHead>
                      <TableHead className="h-8 text-[10px] font-black uppercase py-0 text-center" style={{ color: "#f59e0b" }}>Pending</TableHead>
                      <TableHead className="h-8 text-[10px] font-black uppercase py-0 text-right pr-4" style={{ color: "#10b981" }}>Done</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.stageCounts.map((s: any, i: number) => (
                      <TableRow key={i} className="hover:bg-slate-50/60 transition-colors" style={{ borderColor: "oklch(0.93 0.015 245)" }}>
                        <TableCell className="py-2 pl-4 text-[12px] font-semibold text-slate-700">{s.label}</TableCell>
                        <TableCell className="py-2 text-center">
                          <span className="inline-flex items-center justify-center min-w-8 px-2 py-0.5 rounded-md text-[11px] font-black" style={{ background: "#fef3c7", color: "#92400e" }}>{s.pending}</span>
                        </TableCell>
                        <TableCell className="py-2 text-right pr-4">
                          <span className="inline-flex items-center justify-center min-w-8 px-2 py-0.5 rounded-md text-[11px] font-black" style={{ background: "#d1fae5", color: "#065f46" }}>{s.completed}</span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          </div>
        </div>

        {/* ══════ ORDER PIPELINE TRACKER ══════ */}
        <div className="rounded-2xl border overflow-hidden bg-white"
          style={{ borderColor: "oklch(0.88 0.025 245)", boxShadow: "0 1px 12px oklch(0.42 0.18 265 / 0.04)" }}>

          {/* Tracker header + filters */}
          <div className="px-6 py-4 border-b" style={{ background: "oklch(0.97 0.014 248)", borderColor: "oklch(0.90 0.025 245)" }}>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-center gap-2 flex-1">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg shrink-0" style={{ background: "oklch(0.93 0.10 265 / 0.25)" }}>
                  <MapPin className="h-4 w-4" style={{ color: "oklch(0.42 0.18 265)" }} />
                </div>
                <span className="text-base font-bold text-slate-800">Order Pipeline Tracker</span>
                <span className="text-slate-400 text-[11px] font-medium ml-1 hidden sm:inline">— click ▾ to expand sub-orders</span>
                <span className="text-[11px] font-black ml-auto text-slate-500">{filteredGroups.length} orders</span>
              </div>
              <div className="flex items-center gap-3 text-[10px] font-black uppercase shrink-0">
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" />Done</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />Stuck</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-slate-200" />Pending</span>
              </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-2 mt-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                <Input placeholder="Filter by order no. (e.g. DO-416)"
                  value={filterOrderNo} onChange={e => { setFilterOrderNo(e.target.value); setPageCount(1) }}
                  className="pl-8 h-9 text-sm border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-indigo-400/30" />
                {filterOrderNo && (
                  <button onClick={() => setFilterOrderNo("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                    <X className="h-3.5 w-3.5 text-slate-400 hover:text-rose-500 transition-colors" />
                  </button>
                )}
              </div>
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                <Input placeholder="Filter by company name"
                  value={filterCompany} onChange={e => { setFilterCompany(e.target.value); setPageCount(1) }}
                  className="pl-8 h-9 text-sm border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-indigo-400/30" />
                {filterCompany && (
                  <button onClick={() => setFilterCompany("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                    <X className="h-3.5 w-3.5 text-slate-400 hover:text-rose-500 transition-colors" />
                  </button>
                )}
              </div>
              {(filterOrderNo || filterCompany) && (
                <Button variant="ghost" size="sm" className="rounded-xl text-xs font-bold text-slate-400 hover:text-rose-500"
                  onClick={() => { setFilterOrderNo(""); setFilterCompany(""); setPageCount(1) }}>
                  Clear
                </Button>
              )}
            </div>
          </div>

          {/* ── ORDER GROUPS LIST — fixed height with scroll ── */}
          <ScrollArea className="h-[520px]">
            <div className="divide-y" style={{ borderColor: "oklch(0.93 0.015 245)" }}>
              {visibleGroups.map(group => (
                <OrderGroupRow
                  key={group.baseNo}
                  group={group}
                  stages={STAGES}
                  isExpanded={expandedGroupId === group.baseNo}
                  onToggle={() => setExpandedGroupId(expandedGroupId === group.baseNo ? null : group.baseNo)}
                />
              ))}
              {visibleGroups.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 gap-3 opacity-30">
                  <Package className="h-10 w-10 text-slate-300" />
                  <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">No orders found</p>
                </div>
              )}
            </div>

            {/* Infinite scroll trigger */}
            {visibleGroups.length < filteredGroups.length && (
              <div ref={loaderRef} className="flex items-center justify-center gap-2 py-5 text-[12px] font-bold text-slate-400">
                <div className="h-4 w-4 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
                Loading more…
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Today's Activity + Weekly Chart */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-2xl border overflow-hidden bg-white"
            style={{ borderColor: "oklch(0.88 0.025 245)", boxShadow: "0 1px 12px oklch(0.42 0.18 265 / 0.04)" }}>
            <div className="flex items-center gap-2 px-6 py-4 border-b"
              style={{ background: "oklch(0.97 0.014 248)", borderColor: "oklch(0.90 0.025 245)" }}>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: "oklch(0.93 0.06 265 / 0.5)" }}>
                <Calendar className="h-4 w-4" style={{ color: "oklch(0.42 0.18 265)" }} />
              </div>
              <span className="text-base font-bold text-slate-800">Today's Activity</span>
            </div>
            <div className="p-6 grid grid-cols-2 gap-4">
              {[
                { label: "Created", count: stats.createdToday, icon: Plus, color: "#6366f1", bg: "oklch(0.93 0.06 265 / 0.2)" },
                { label: "Dispatched", count: stats.dispatchedToday, icon: Send, color: "#f59e0b", bg: "oklch(0.95 0.08 75 / 0.25)" },
                { label: "Invoiced", count: stats.invoicedToday, icon: FileText, color: "#8b5cf6", bg: "oklch(0.93 0.06 295 / 0.25)" },
                { label: "Delivered", count: stats.deliveredToday, icon: CheckCircle2, color: "#10b981", bg: "oklch(0.94 0.08 155 / 0.25)" },
              ].map(({ label, count, icon: Ic, color, bg }) => (
                <div key={label} className="flex items-center gap-4 p-4 rounded-xl group transition-all hover:scale-[1.02]" style={{ background: bg }}>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl shrink-0 bg-white group-hover:scale-110 transition-transform" style={{ boxShadow: `0 2px 8px ${color}30` }}>
                    <Ic className="h-5 w-5" style={{ color }} />
                  </div>
                  <div>
                    <p className="text-xl font-black text-slate-800">{count}</p>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">{label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border overflow-hidden bg-white"
            style={{ borderColor: "oklch(0.88 0.025 245)", boxShadow: "0 1px 12px oklch(0.42 0.18 265 / 0.04)" }}>
            <div className="flex items-center gap-2 px-6 py-4 border-b"
              style={{ background: "oklch(0.97 0.014 248)", borderColor: "oklch(0.90 0.025 245)" }}>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: "oklch(0.93 0.06 295 / 0.4)" }}>
                <BarChart3 className="h-4 w-4" style={{ color: "oklch(0.48 0.18 295)" }} />
              </div>
              <span className="text-base font-bold text-slate-800">Weekly View</span>
            </div>
            <div className="p-6 h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.timelineData} margin={{ left: 0, right: 0, top: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="oklch(0.93 0.015 245)" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'oklch(0.60 0.04 245)', fontSize: 11, fontWeight: 600 }} dy={8} />
                  <YAxis hide />
                  <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 8px 24px rgba(99,102,241,0.12)', fontWeight: 'bold', fontSize: '12px' }} />
                  <Area type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2.5} fillOpacity={1} fill="url(#areaGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center pt-4 pb-2">
          <p className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-300 hover:text-primary transition-colors cursor-default">Powered by Botivate</p>
        </div>
      </div>

      {/* Dialogs */}
      {[
        { key: "pending" as const, title: "Pending Orders", Icon: Activity, color: "bg-amber-500", orders: stats.pendingOrdersList, showStage: true },
        { key: "completed" as const, title: "Completed Orders", Icon: CheckCircle2, color: "bg-emerald-500", orders: stats.completedOrdersList },
        { key: "dispatch" as const, title: "Dispatch Planning", Icon: Layers, color: "bg-indigo-500", orders: stats.dispatchPlanningList, showStage: true },
        { key: "damages" as const, title: "Damaged Orders", Icon: AlertTriangle, color: "bg-rose-500", orders: stats.damagesOrdersList, showStage: true },
        { key: "invoices" as const, title: "Invoice Tracking", Icon: FileText, color: "bg-violet-500", orders: stats.invoicesOrdersList, showStage: true },
        { key: "delayed" as const, title: "Delayed Orders", Icon: AlertTriangle, color: "bg-rose-500", orders: stats.delayedOrdersList, showStage: true },
        { key: "rejected" as const, title: "Rejected Orders", Icon: XCircle, color: "bg-slate-500", orders: stats.cancelledOrdersList },
        { key: "total" as const, title: "All Orders", Icon: Package, color: "bg-indigo-500", orders: stats.totalOrdersList, showStage: true },
      ].map(({ key, title, Icon, color, orders, showStage }) => (
        <Dialog key={key} open={dialogs[key]} onOpenChange={() => closeDialog(key)}>
          <OrderListPopup title={title} icon={<Icon className="h-4 w-4 text-white" />}
            orders={orders} colorClass={color} showStage={showStage} onClose={() => closeDialog(key)} />
        </Dialog>
      ))}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
//  ORDER GROUP ROW  (parent = base order no, children = sub-orders)
// ═══════════════════════════════════════════════════════════════════════════
function OrderGroupRow({ group, stages, isExpanded, onToggle }: {
  group: { baseNo: string; subOrders: any[] }
  stages: typeof STAGES
  isExpanded: boolean
  onToggle: () => void
}) {
  const { baseNo, subOrders } = group
  const count = subOrders.length

  // Summary: pick the "worst" (most-behind) sub-order for overall status
  const firstSub = subOrders[0]
  const currentStageData = stages[firstSub?.stageIndex ?? 0] || stages[0]
  const allDone = subOrders.every(o => o.status === 'completed')

  // Mini dot summary across all sub-orders — show the first sub-order's dots
  const sampleProgress: any[] = firstSub?.stageProgress || []

  return (
    <div className="transition-all duration-200">
      {/* ── COLLAPSED PARENT ROW ── */}
      <button onClick={onToggle}
        className="w-full text-left px-5 py-3.5 hover:bg-slate-50/70 transition-colors group flex items-center gap-3">
        {/* Chevron */}
        <div className="flex h-6 w-6 items-center justify-center rounded-full shrink-0 transition-all duration-200"
          style={{ background: isExpanded ? "oklch(0.93 0.06 265 / 0.4)" : "oklch(0.95 0.02 245)" }}>
          <ChevronDown
            className="h-3.5 w-3.5 transition-transform duration-300"
            style={{ color: isExpanded ? "oklch(0.42 0.18 265)" : "#94a3b8", transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }} />
        </div>

        {/* Base Order No + sub-count badge */}
        <div className="flex items-center gap-2 min-w-[120px]">
          <span className="font-black text-slate-800 text-sm tracking-tight">{baseNo}</span>
          {count > 1 && (
            <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full text-[10px] font-black text-white"
              style={{ background: "oklch(0.42 0.18 265)" }}>
              {count}
            </span>
          )}
        </div>

        {/* Company (first sub) */}
        <span className="text-xs text-slate-500 font-medium flex-1 truncate hidden sm:block">
          {firstSub?.customerName || "—"}
        </span>

        {/* Stage pill */}
        {!allDone ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold shrink-0"
            style={{ background: `${currentStageData?.color || "#6366f1"}18`, color: currentStageData?.color || "#6366f1" }}>
            <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
            {currentStageData?.label || "—"}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold shrink-0"
            style={{ background: "#d1fae5", color: "#065f46" }}>
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            Completed
          </span>
        )}

        {/* Mini dot preview */}
        <div className="hidden lg:flex items-center gap-0.5 mx-2">
          {stages.map((s, i) => {
            const p = sampleProgress[i]
            const done = p?.done ?? (i === 0)
            const stuck = i === (firstSub?.stageIndex ?? 0) && !done
            return (
              <div key={i} className="h-2 w-2 rounded-full"
                style={{ background: done ? s.color : stuck ? "#f59e0b" : "#e2e8f0", boxShadow: stuck ? "0 0 4px #f59e0b" : "none" }} />
            )
          })}
        </div>

        {/* Sub-order count label */}
        <span className="text-[11px] text-slate-400 font-bold shrink-0 hidden md:block">
          {count} sub-order{count > 1 ? "s" : ""}
        </span>
      </button>

      {/* ── EXPANDED: show each sub-order with its own pipeline ── */}
      {isExpanded && (
        <div className="border-t" style={{ background: "oklch(0.985 0.008 248)", borderColor: "oklch(0.91 0.025 245)" }}>
          {/* Sub-order header */}
          <div className="px-6 py-2 flex items-center gap-2 border-b" style={{ borderColor: "oklch(0.92 0.02 245)" }}>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              {count} sub-order{count > 1 ? "s" : ""} under {baseNo}
            </span>
          </div>

          {/* Each sub-order */}
          {subOrders.map((order, idx) => {
            const rawNo = order.doNumber || order.orderNo || ""
            const stageProgress: any[] = order.stageProgress || []
            const stageIndex = order.stageIndex ?? 0
            const completedCount = order.completedStages ?? 0
            const pct = Math.round((completedCount / stages.length) * 100)
            const currentStageDef = stages[stageIndex] || stages[0]

            return (
              <div key={idx}
                className={`px-6 py-4 ${idx < subOrders.length - 1 ? 'border-b' : ''}`}
                style={{ borderColor: "oklch(0.92 0.02 245)" }}>
                {/* Sub-order header row */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 w-4">{String.fromCharCode(65 + idx)}</span>
                    <span className="font-black text-slate-700 text-sm">{rawNo}</span>
                    <span className="text-xs text-slate-400 font-medium">{order.customerName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold"
                      style={{ background: `${currentStageDef?.color || "#6366f1"}18`, color: currentStageDef?.color || "#6366f1" }}>
                      <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
                      {currentStageDef?.label || order.stage}
                    </span>
                    <span className="text-[11px] font-black text-slate-400">{completedCount}/{stages.length}</span>
                  </div>
                </div>

                {/* Individual stage pipeline */}
                <div className="overflow-x-auto pb-1">
                  <div className="flex items-start min-w-max gap-0">
                    {stages.map((stage, i) => {
                      const prog = stageProgress[i]
                      const isDone = prog?.done ?? (i === 0)
                      const isStuck = i === stageIndex && !isDone

                      return (
                        <div key={stage.id} className="flex items-start">
                          <div className="flex flex-col items-center gap-1.5" style={{ minWidth: 52 }}>
                            {/* Circle node */}
                            <div
                              className="h-8 w-8 rounded-full flex items-center justify-center text-[10px] font-black relative shrink-0"
                              style={isDone ? {
                                background: stage.color,
                                boxShadow: `0 0 0 2px white, 0 0 0 4px ${stage.color}55`,
                                color: "white"
                              } : isStuck ? {
                                background: "#fffbeb",
                                border: "2.5px solid #f59e0b",
                                color: "#78350f",
                                boxShadow: "0 0 10px #f59e0b66"
                              } : {
                                background: "#f8fafc",
                                border: "1.5px solid #e2e8f0",
                                color: "#94a3b8"
                              }}
                            >
                              {isDone ? (
                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              ) : isStuck ? "!" : <span>{i + 1}</span>}
                              {isStuck && (
                                <span className="absolute inset-0 rounded-full animate-ping opacity-20" style={{ background: "#f59e0b" }} />
                              )}
                            </div>
                            {/* Short label */}
                            <span className="text-[8px] font-bold text-center leading-tight"
                              style={{ color: isDone ? stage.color : isStuck ? "#92400e" : "#94a3b8", maxWidth: 50, wordBreak: "break-word" }}>
                              {stage.shortLabel}
                            </span>
                            {/* Status badge */}
                            <span className="text-[7px] font-black uppercase px-1.5 py-0.5 rounded"
                              style={isDone ? { background: `${stage.color}20`, color: stage.color }
                                : isStuck ? { background: "#fef3c7", color: "#92400e" }
                                : { background: "#f1f5f9", color: "#94a3b8" }}>
                              {isDone ? "✓" : isStuck ? "!" : "—"}
                            </span>
                          </div>

                          {/* Connector */}
                          {i < stages.length - 1 && (
                            <div className="flex items-start mt-3.5 shrink-0">
                              <div className="h-[2px] w-3 rounded-full"
                                style={{
                                  background: isDone && stageProgress[i + 1]?.done
                                    ? `linear-gradient(90deg, ${stage.color}, ${stages[i + 1].color})`
                                    : "#e2e8f0"
                                }} />
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-2 flex items-center gap-3">
                  <div className="flex-1 h-1.5 rounded-full overflow-hidden max-w-[300px]" style={{ background: "#e2e8f0" }}>
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${pct}%`,
                        background: pct >= 80 ? "linear-gradient(90deg,#10b981,#34d399)"
                          : pct >= 40 ? "linear-gradient(90deg,#6366f1,#8b5cf6)"
                          : "linear-gradient(90deg,#f59e0b,#fbbf24)"
                      }} />
                  </div>
                  <span className="text-[10px] font-black text-slate-400">{pct}% complete</span>
                  {stageProgress[stageIndex] && !stageProgress[stageIndex].done && (
                    <span className="text-[10px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-lg">
                      ⚠ Stuck: {stages[stageIndex]?.shortLabel}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
//  KPI CARD
// ═══════════════════════════════════════════════════════════════════════════
function KPICard({ title, value, icon: Icon, color, trend, alert = false, onClick }: any) {
  return (
    <div onClick={onClick} className="group relative overflow-hidden rounded-2xl border cursor-pointer transition-all duration-200 card-premium bg-white"
      style={{ borderColor: "oklch(0.88 0.025 245)" }}>
      <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-2xl" style={{ background: color }} />
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-300 group-hover:scale-110 group-hover:-rotate-3"
            style={{ background: `${color}18` }}>
            <Icon className="h-5 w-5" style={{ color }} />
          </div>
          <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest ${alert ? 'animate-pulse' : ''}`}
            style={alert ? { background: color, color: "white" } : { background: "oklch(0.94 0.02 245)", color: "oklch(0.52 0.04 245)" }}>
            {trend}
          </span>
        </div>
        <div>
          <h3 className="text-3xl font-black text-slate-900 tracking-tight leading-none">{value}</h3>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 group-hover:text-slate-600 transition-colors mt-1.5">{title}</p>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
//  MINI STAT CARD
// ═══════════════════════════════════════════════════════════════════════════
function MiniStatCard({ icon: Icon, label, value, badge, badgeColor, iconColor, cardBg, borderColor, subData, onClick }: any) {
  return (
    <div onClick={onClick} className="flex flex-col justify-between p-5 rounded-xl border cursor-pointer transition-all duration-200 min-h-[150px] card-premium"
      style={{ background: cardBg, borderColor }}>
      <div className="flex items-start justify-between">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white shrink-0" style={{ boxShadow: "0 1px 4px oklch(0 0 0 / 0.08)" }}>
          <Icon className="h-4 w-4" style={{ color: iconColor }} />
        </div>
        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md text-white" style={{ background: badgeColor }}>{badge}</span>
      </div>
      <div>
        <h4 className="text-4xl font-black text-slate-800 tracking-tighter">{value}</h4>
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">{label}</p>
        {subData && (
          <div className="flex gap-3 mt-2">
            {subData.map((d: any) => (
              <div key={d.label} className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: d.color }} />
                <span className="text-[10px] font-bold text-slate-500">{d.label}: {d.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
//  ORDER LIST POPUP
// ═══════════════════════════════════════════════════════════════════════════
function OrderListPopup({ title, icon, orders, colorClass, onClose, showStage = false }: any) {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const filtered = orders.filter((o: any) => {
    const no = getBaseOrderNo(o.soNumber || o.doNumber || o.orderNo || "").toLowerCase()
    const co = (o.customerName || "").toLowerCase()
    const s = search.toLowerCase()
    return !s || no.includes(s) || co.includes(s)
  })

  return (
    <DialogContent className="max-w-[750px] p-0 overflow-hidden rounded-2xl border shadow-2xl bg-white"
      style={{ borderColor: "oklch(0.88 0.025 245)" }}>
      <DialogHeader className="p-6 pb-4 border-b flex flex-row items-center justify-between"
        style={{ background: "oklch(0.97 0.014 248)", borderColor: "oklch(0.90 0.025 245)" }}>
        <DialogTitle className="text-xl font-black text-slate-900 flex items-center gap-3 tracking-tight">
          <div className={`p-2 ${colorClass} rounded-xl shadow-md`}>{icon}</div>
          {title}
        </DialogTitle>
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl mr-6" style={{ background: "oklch(0.93 0.04 265 / 0.4)" }}>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total</span>
          <span className="text-lg font-black" style={{ color: "oklch(0.42 0.18 265)" }}>{orders.length}</span>
          <Package className="h-4 w-4" style={{ color: "oklch(0.42 0.18 265)" }} />
        </div>
      </DialogHeader>

      <div className="px-6 py-3 border-b" style={{ borderColor: "oklch(0.90 0.025 245)" }}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          <input className="w-full pl-8 pr-4 h-9 text-sm rounded-xl border border-slate-200 bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-400/30"
            placeholder="Search by order no. or company…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <ScrollArea className="h-[380px]">
        <Table>
          <TableHeader style={{ background: "oklch(0.98 0.01 245)" }}>
            <TableRow style={{ borderColor: "oklch(0.90 0.025 245)" }}>
              <TableHead className="pl-6 py-3 text-[10px] font-black uppercase tracking-wider" style={{ color: "oklch(0.52 0.04 245)" }}>Order No.</TableHead>
              <TableHead className="py-3 text-[10px] font-black uppercase tracking-wider text-center" style={{ color: "oklch(0.52 0.04 245)" }}>Customer</TableHead>
              <TableHead className="pr-6 py-3 text-[10px] font-black uppercase tracking-wider text-right" style={{ color: "oklch(0.52 0.04 245)" }}>{showStage ? "Current Stage" : "Status"}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((order: any, i: number) => {
              const stageData = STAGES.find(s => s.id === order.stage)
              const displayNo = order.soNumber || order.doNumber || order.orderNo || "N/A"
              return (
                <TableRow key={i} className="group hover:bg-slate-50 transition-all cursor-pointer"
                  style={{ borderColor: "oklch(0.93 0.015 245)" }}
                  onClick={() => { router.push(stageData?.url || "/"); onClose() }}>
                  <TableCell className="pl-6 py-3 font-bold text-slate-800 text-sm group-hover:text-indigo-600 transition-colors">{displayNo}</TableCell>
                  <TableCell className="py-3 text-center text-sm text-slate-700 font-semibold">{order.customerName || "—"}</TableCell>
                  <TableCell className="pr-6 py-3 text-right">
                    {showStage
                      ? <span className="text-[11px] font-bold" style={{ color: stageData?.color || "#64748b" }}>{order.stage}</span>
                      : <span className="text-[11px] font-bold uppercase text-slate-400">{order.status || "—"}</span>}
                  </TableCell>
                </TableRow>
              )
            })}
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={3} className="text-center py-14">
                <div className="flex flex-col items-center gap-2 opacity-30">
                  <Package className="h-8 w-8 text-slate-300" />
                  <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">No items found</p>
                </div>
              </TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </ScrollArea>
    </DialogContent>
  )
}


