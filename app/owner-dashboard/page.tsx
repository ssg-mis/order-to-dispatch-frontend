"use client"

import { useState, useMemo, Fragment, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { ownerDashboardApi } from "@/lib/api-service"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import {
  Package, TrendingUp, Truck, LogOut as GateOutIcon, CheckCircle2,
  AlertTriangle, FileText, IndianRupee, RefreshCw, AlertCircle,
  Users, Clock, ChevronDown, ChevronUp, Search, Filter, Activity,
  BarChart2, Droplets, Building2, ArrowUpDown, Layers, LayoutDashboard,
  Calendar, MapPin, Briefcase
} from "lucide-react"

// ─── tiny helpers ────────────────────────────────────────────────────────────
const fmt = (n: number) => n?.toLocaleString("en-IN") ?? "0"
const fmtRs = (n: number) =>
  n >= 1_00_000
    ? `₹${(n / 1_00_000).toFixed(2)}L`
    : n >= 1000
    ? `₹${(n / 1000).toFixed(1)}K`
    : `₹${n}`

const agingColor = (b: string) => {
  const m: Record<string, string> = {
    fresh:    "bg-emerald-50 text-emerald-700 border-emerald-200",
    normal:   "bg-sky-50 text-sky-700 border-sky-200",
    delayed:  "bg-amber-50 text-amber-700 border-amber-200",
    critical: "bg-orange-50 text-orange-700 border-orange-200",
    severe:   "bg-red-50 text-red-700 border-red-200",
  }
  return m[b] ?? "bg-slate-50 text-slate-600 border-slate-200"
}

const agingRowBg = (b: string) => {
  const m: Record<string, string> = {
    fresh:    "",
    normal:   "",
    delayed:  "bg-amber-50/20",
    critical: "bg-orange-50/30",
    severe:   "bg-red-50/40",
  }
  return m[b] ?? ""
}

const waitColor = (mins: number) => {
  if (mins > 4320) return "text-red-600 font-bold"
  if (mins > 1440) return "text-orange-600 font-bold"
  if (mins > 240)  return "text-amber-600 font-semibold"
  return "text-emerald-600 font-medium"
}

const stageBlockColor = (mins: number) => {
  if (mins === 0) return "bg-white border-slate-200 text-slate-400"
  if (mins > 4320) return "bg-red-50 border-red-200 text-red-700"
  if (mins > 1440) return "bg-orange-50 border-orange-200 text-orange-700"
  if (mins > 240)  return "bg-amber-50 border-amber-200 text-amber-700"
  return "bg-emerald-50 border-emerald-200 text-emerald-700"
}

const formatDuration = (mins: number) => {
  if (!mins) return "—"
  const d = Math.floor(mins / 1440)
  const h = Math.floor((mins % 1440) / 60)
  const m = Math.floor(mins % 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

// ─── types ───────────────────────────────────────────────────────────────────
interface KPI {
  totalOrders: number; newToday: number; dispatchedToday: number
  gateOutToday: number; deliveredToday: number; delayedOrders: number
  pendingInvoices: number; totalAmountToday: number; pendingApproval: number
  pendingDispatchPlanning: number
}

// ─── main page ───────────────────────────────────────────────────────────────
export default function OwnerDashboardPage() {
  // Filter state
  const [depot,     setDepot]     = useState("all")
  const [orderType, setOrderType] = useState("all")
  const [dateFrom,  setDateFrom]  = useState("")
  const [dateTo,    setDateTo]    = useState("")

  // Table Pagination & Search
  const [partyPage, setPartyPage] = useState(1)
  const [agingPage, setAgingPage] = useState(1)
  const [partySearch, setPartySearch] = useState("")
  const [agingSearch, setAgingSearch] = useState("")
  const [agingStage,  setAgingStage]  = useState("all")
  
  const itemsPerPage = 10

  // Collapsible user rows
  const [expandedUser, setExpandedUser] = useState<number | null>(null)

  // Active query filters
  const [activeFilters, setActiveFilters] = useState<Record<string, any>>({
    partyLimit: itemsPerPage,
    partyOffset: 0,
    agingLimit: itemsPerPage,
    agingOffset: 0
  })

  const applyFilters = () => {
    const f: Record<string, any> = {
      partyLimit: itemsPerPage,
      partyOffset: (partyPage - 1) * itemsPerPage,
      agingLimit: itemsPerPage,
      agingOffset: (agingPage - 1) * itemsPerPage
    }
    if (depot     !== "all") f.depot      = depot
    if (orderType !== "all") f.order_type = orderType
    if (dateFrom)            f.date_from  = dateFrom
    if (dateTo)              f.date_to    = dateTo
    setActiveFilters(f)
  }

  useEffect(() => {
    applyFilters()
  }, [partyPage, agingPage])

  const clearFilters = () => {
    setDepot("all"); setOrderType("all"); setDateFrom(""); setDateTo("")
    setPartyPage(1); setAgingPage(1)
    setActiveFilters({
      partyLimit: itemsPerPage,
      partyOffset: 0,
      agingLimit: itemsPerPage,
      agingOffset: 0
    })
  }

  const { data: raw, isLoading, error, refetch, isFetching, dataUpdatedAt } = useQuery({
    queryKey: ["owner-dashboard", activeFilters],
    queryFn: async () => {
      const res = await ownerDashboardApi.getFull(activeFilters)
      return res.success ? res.data : null
    },
    refetchInterval: 5 * 60 * 1000, // auto-refresh every 5 min
    staleTime: 60 * 1000,
  })

  const kpi:       KPI        = raw?.kpi             ?? {}
  const today                 = raw?.todayActivity   ?? {}
  const pipeline:  any[]      = raw?.stagePipeline   ?? []
  const users:     any[]      = raw?.userActivity    ?? []
  const partyRes              = raw?.partyView       ?? { data: [], total: 0 }
  const oilTypes:  any[]      = raw?.oilTypeView     ?? []
  const agingRes              = raw?.agingReport     ?? { data: [], total: 0 }
  const orderTypes:any[]      = raw?.orderTypeBreakdown ?? []
  const depots:    string[]   = raw?.depots          ?? []

  const parties = partyRes.data || []
  const aging   = agingRes.data || []

  const lastUpdated = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString() : "—"

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-6 bg-white p-12 rounded-3xl shadow-xl border border-red-100 max-w-md w-full text-center">
          <div className="bg-red-100 p-4 rounded-full">
            <AlertCircle className="h-10 w-10 text-red-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Dashboard Unavailable</h2>
            <p className="text-slate-500 mt-2">We encountered an error while fetching your business data. Please try again or contact support.</p>
          </div>
          <Button onClick={() => refetch()} className="w-full bg-indigo-600 hover:bg-indigo-700 py-6 text-lg font-semibold rounded-xl">
            Retry Connection
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-12 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      
      {/* ── STICKY TOP BAR ─────────────────────────── */}
      <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-4">
        <div className="max-w-[1700px] mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-xl shadow-lg shadow-indigo-200">
              <LayoutDashboard className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Executive Dashboard</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-100 text-[10px] font-bold px-1.5 py-0">LIVE</Badge>
                <span className="text-[10px] font-medium text-slate-400">Last sync: {lastUpdated}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center bg-slate-100 rounded-xl p-1 gap-1">
              <Button variant="ghost" size="sm" className="h-8 text-xs font-bold bg-white text-indigo-600 shadow-sm rounded-lg">Overview</Button>
              <Button variant="ghost" size="sm" className="h-8 text-xs font-bold text-slate-500 hover:text-slate-900 rounded-lg">Performance</Button>
            </div>
            <Button
              variant="outline" size="icon"
              onClick={() => refetch()}
              disabled={isFetching}
              className="rounded-xl h-10 w-10 hover:bg-white hover:border-indigo-200 hover:text-indigo-600 border-slate-200 shadow-sm transition-all active:scale-95"
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-[1700px] mx-auto px-6 mt-8 flex flex-col gap-8">

        {/* ── FILTER SECTION ─────────────────────────── */}
        <Card className="border-none shadow-sm bg-white rounded-2xl overflow-hidden">
          <CardContent className="p-4 md:p-6">
            <div className="flex flex-wrap items-end gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider ml-1">Location / Depot</label>
                <Select value={depot} onValueChange={setDepot}>
                  <SelectTrigger className="w-[200px] h-11 bg-slate-50 border-slate-100 rounded-xl font-semibold text-slate-700 focus:ring-indigo-500">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 text-slate-400" />
                      <SelectValue placeholder="All Depots" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Depots</SelectItem>
                    {depots.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider ml-1">Business Type</label>
                <Select value={orderType} onValueChange={setOrderType}>
                  <SelectTrigger className="w-[180px] h-11 bg-slate-50 border-slate-100 rounded-xl font-semibold text-slate-700 focus:ring-indigo-500">
                    <div className="flex items-center gap-2">
                      <Briefcase className="h-3.5 w-3.5 text-slate-400" />
                      <SelectValue placeholder="All Types" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Business Types</SelectItem>
                    <SelectItem value="Regular">Regular Flow</SelectItem>
                    <SelectItem value="Pre Approval">Pre-Approval Flow</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider ml-1">Time Period (From)</label>
                <div className="relative">
                  <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                    className="h-11 w-[180px] bg-slate-50 border-slate-100 pl-10 rounded-xl font-medium focus:ring-indigo-500" />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider ml-1">Time Period (To)</label>
                <div className="relative">
                  <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                    className="h-11 w-[180px] bg-slate-50 border-slate-100 pl-10 rounded-xl font-medium focus:ring-indigo-500" />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button onClick={applyFilters} className="h-11 px-8 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-100 transition-all active:scale-95">
                  Analyze Data
                </Button>
                {(depot !== "all" || orderType !== "all" || dateFrom || dateTo) && (
                  <Button onClick={clearFilters} variant="ghost" className="h-11 px-4 text-slate-500 hover:text-red-600 font-bold rounded-xl">
                    Reset
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── KEY PERFORMANCE INDICATORS ─────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-5">
          {[
            { label: "Business Volume", val: kpi.totalOrders, icon: Package, color: "indigo", desc: "Total active pipeline" },
            { label: "New Leads", val: kpi.newToday, icon: TrendingUp, color: "emerald", desc: "Acquired in last 24h" },
            { label: "Daily Revenue", val: fmtRs(kpi.totalAmountToday), icon: IndianRupee, color: "blue", desc: "Gross invoiced today", raw: true },
            { label: "Operational Delay", val: kpi.delayedOrders, icon: AlertTriangle, color: "rose", desc: "Orders past SLA targets" },
            { label: "Invoicing Load", val: kpi.pendingInvoices, icon: FileText, color: "amber", desc: "Awaiting billing" },
          ].map((item, i) => (
            <Card key={i} className="border-none shadow-sm hover:shadow-md transition-all duration-300 rounded-2xl group overflow-hidden">
              <CardContent className="p-6 relative">
                <div className={`absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 rounded-full opacity-[0.03] group-hover:scale-125 transition-all duration-500 bg-${item.color}-600`} />
                <div className="flex items-start justify-between mb-4">
                  <div className={`p-3 rounded-2xl bg-${item.color}-50 text-${item.color}-600 group-hover:scale-110 transition-transform`}>
                    <item.icon className="h-5 w-5" />
                  </div>
                  <Badge variant="outline" className={`bg-${item.color}-50 text-${item.color}-600 text-[10px] font-black uppercase tracking-widest border-none`}>Trend</Badge>
                </div>
                {isLoading ? (
                  <Skeleton className="h-10 w-24 mb-2 rounded-lg" />
                ) : (
                  <div className="text-3xl font-black text-slate-900 tracking-tight leading-none mb-1">
                    {item.raw ? item.val : fmt(item.val as number)}
                  </div>
                )}
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">{item.label}</div>
                <p className="text-[10px] font-medium text-slate-400">{item.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ── PIPELINE FLOW ANALYSIS ─────────────────────── */}
        <Card className="border-none shadow-sm bg-white rounded-3xl overflow-hidden">
          <CardHeader className="bg-slate-50/50 px-8 py-6 flex flex-row items-center justify-between border-b border-slate-100">
            <div>
              <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Layers className="h-5 w-5 text-indigo-500" />
                Pipeline Bottleneck Analysis
              </CardTitle>
              <CardDescription className="text-slate-500 mt-1">Real-time status of orders stuck at each operational stage</CardDescription>
            </div>
            <div className="flex items-center gap-4 text-[11px] font-bold uppercase tracking-wider">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Healthy</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Normal</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-orange-500" /> Critical</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Severe</span>
            </div>
          </CardHeader>
          <CardContent className="p-8">
            <div className="flex gap-4 overflow-x-auto pb-6 -mx-2 px-2 scrollbar-hide">
              {isLoading ? (
                Array(10).fill(0).map((_, i) => <Skeleton key={i} className="h-32 w-44 shrink-0 rounded-2xl" />)
              ) : pipeline.map((stage, i) => (
                <div key={i} className={`shrink-0 flex flex-col gap-3 rounded-2xl border-2 p-5 w-[160px] transition-all hover:translate-y-[-4px] cursor-default ${stageBlockColor(stage.avgWaitMinutes)} shadow-sm`}>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-60 truncate">{stage.stageName}</span>
                    <span className="text-3xl font-black">{fmt(stage.pendingCount)}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3 w-3 opacity-60" />
                      <span className="text-[10px] font-bold">{stage.pendingCount > 0 ? `${formatDuration(stage.avgWaitMinutes)} avg` : "CLEARED"}</span>
                    </div>
                    {stage.pendingCount > 0 && stage.oldestAt && (
                      <div className="text-[9px] font-medium opacity-50">Since {new Date(stage.oldestAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* USER EFFICIENCY */}
          <Card className="lg:col-span-2 border-none shadow-sm bg-white rounded-3xl overflow-hidden">
            <CardHeader className="px-8 py-6 border-b border-slate-50">
              <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Users className="h-5 w-5 text-indigo-500" />
                Operational Staff Activity
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-slate-50/50">
                  <TableRow className="border-slate-50 hover:bg-transparent">
                    <TableHead className="pl-8 text-[11px] font-black uppercase text-slate-400 py-4">User Details</TableHead>
                    <TableHead className="text-[11px] font-black uppercase text-slate-400">Assignment Focus</TableHead>
                    <TableHead className="text-right text-[11px] font-black uppercase text-slate-400">Backlog</TableHead>
                    <TableHead className="pr-8 text-right text-[11px] font-black uppercase text-slate-400">Today's Output</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map(u => (
                    <Fragment key={u.userId}>
                      <TableRow 
                        className="hover:bg-slate-50/80 cursor-pointer transition-colors group"
                        onClick={() => setExpandedUser(expandedUser === u.userId ? null : u.userId)}
                      >
                        <TableCell className="pl-8 py-5">
                          <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm ring-2 ring-indigo-100 ring-offset-2">
                              {u.username?.[0]?.toUpperCase()}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 text-sm capitalize">{u.username}</div>
                              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{u.stages?.length ?? 0} modules</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1.5">
                            {(u.stages ?? []).slice(0, 3).map((s: any, si: number) => (
                              <Badge key={si} variant="outline" className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border-slate-200 ${s.pending > 0 ? "text-amber-700 bg-amber-50/50" : "text-slate-400 bg-white"}`}>
                                {s.label}
                                {s.pending > 0 && <span className="ml-1.5 px-1 bg-amber-500 text-white rounded text-[9px]">{s.pending}</span>}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={`text-sm font-black ${u.totalPending > 10 ? "text-red-600" : u.totalPending > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                            {u.totalPending}
                          </span>
                        </TableCell>
                        <TableCell className="pr-8 text-right">
                          <div className="flex items-center justify-end gap-3">
                            <span className="text-sm font-black text-emerald-600">{u.totalCompletedToday}</span>
                            <div className="bg-slate-100 p-1.5 rounded-lg group-hover:bg-white group-hover:shadow-sm transition-all">
                              {expandedUser === u.userId ? <ChevronUp className="h-3 w-3 text-slate-500" /> : <ChevronDown className="h-3 w-3 text-slate-500" />}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    </Fragment>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* PRODUCT BREAKDOWN */}
          <Card className="border-none shadow-sm bg-white rounded-3xl overflow-hidden">
            <CardHeader className="px-8 py-6 border-b border-slate-50">
              <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Droplets className="h-5 w-5 text-indigo-500" />
                Product Line Performance
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 flex flex-col gap-4">
              {oilTypes.slice(0, 6).map((ot, i) => (
                <div key={i} className="group p-4 rounded-2xl bg-slate-50 hover:bg-indigo-50/50 transition-all border border-transparent hover:border-indigo-100">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{ot.oilType}</span>
                    <Badge className="bg-white text-indigo-600 border-indigo-100 shadow-sm text-[10px] font-bold">{fmt(ot.totalOrders)} Orders</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col">
                      <span className="text-lg font-black text-slate-900 leading-none">{fmt(ot.newToday)}</span>
                      <span className="text-[9px] font-bold text-slate-400 uppercase mt-1">Today</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-lg font-black text-indigo-600 leading-none">{fmtRs(ot.totalValue)}</span>
                      <span className="text-[9px] font-bold text-slate-400 uppercase mt-1">Gross Value</span>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* ── PARTY / CUSTOMER INTELLIGENCE ──────────────── */}
        <Card className="border-none shadow-sm bg-white rounded-3xl overflow-hidden">
          <CardHeader className="bg-slate-50/30 px-8 py-6 border-b border-slate-100">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-indigo-500" />
                  Client Portfolio Intelligence
                </CardTitle>
                <CardDescription className="text-slate-500">Commercial visibility into top customers and credit health</CardDescription>
              </div>
              <div className="relative w-72">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input 
                  placeholder="Search clients..." 
                  className="pl-10 h-11 bg-white border-slate-200 rounded-xl font-medium focus:ring-indigo-500"
                  value={partySearch}
                  onChange={e => setPartySearch(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow className="border-slate-50">
                  <TableHead className="pl-8 py-4 text-[11px] font-black uppercase text-slate-400">Party Identity</TableHead>
                  <TableHead className="text-[11px] font-black uppercase text-slate-400">Flow Status</TableHead>
                  <TableHead className="text-right text-[11px] font-black uppercase text-slate-400">Activity (M)</TableHead>
                  <TableHead className="text-right text-[11px] font-black uppercase text-slate-400">Total Orders</TableHead>
                  <TableHead className="text-right text-[11px] font-black uppercase text-slate-400">Gross Value</TableHead>
                  <TableHead className="text-center text-[11px] font-black uppercase text-slate-400">Credit Health</TableHead>
                  <TableHead className="pr-8 text-right text-[11px] font-black uppercase text-slate-400">Recency</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parties.filter((p: any) => !partySearch || p.customerName?.toLowerCase().includes(partySearch.toLowerCase())).map((p: any, i: number) => (
                  <TableRow key={i} className="hover:bg-slate-50/50 transition-colors border-slate-50">
                    <TableCell className="pl-8 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-900 text-sm truncate max-w-[200px]">{p.customerName}</span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{p.customerType}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col">
                          <span className={`text-xs font-black ${p.ordersToday > 0 ? "text-indigo-600" : "text-slate-300"}`}>{p.ordersToday} Today</span>
                          <span className={`text-[10px] font-bold ${p.preDispatchPending > 0 ? "text-amber-600" : "text-emerald-500"}`}>{p.preDispatchPending} Pending</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-sm font-bold text-slate-700">{fmt(p.thisMonth)}</TableCell>
                    <TableCell className="text-right text-sm font-bold text-slate-700">{fmt(p.totalOrders)}</TableCell>
                    <TableCell className="text-right text-sm font-black text-indigo-600">{fmtRs(p.totalValue)}</TableCell>
                    <TableCell className="text-center">
                      <Badge className={`text-[10px] font-black border-none px-2 py-0.5 rounded-lg ${
                        String(p.creditStatus).toLowerCase().includes("hold") ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"
                      }`}>
                        {String(p.creditStatus).toLowerCase().includes("hold") ? "CREDIT HOLD" : "EXCELLENT"}
                      </Badge>
                    </TableCell>
                    <TableCell className="pr-8 text-right text-[11px] font-bold text-slate-400">
                      {p.lastOrderAt ? new Date(p.lastOrderAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="p-6 border-t border-slate-50 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400">Showing {parties.length} of {partyRes.total} key clients</span>
              <Pagination className="justify-end w-auto mx-0">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious className="cursor-pointer h-9 rounded-xl border-slate-200" onClick={() => setPartyPage(Math.max(1, partyPage - 1))} />
                  </PaginationItem>
                  <PaginationItem>
                    <span className="px-4 text-sm font-bold text-slate-900">Page {partyPage}</span>
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationNext className="cursor-pointer h-9 rounded-xl border-slate-200" onClick={() => setPartyPage(partyPage + 1)} />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          </CardContent>
        </Card>

        {/* ── DETAILED AGING REPORT ──────────────────────── */}
        <Card className="border-none shadow-sm bg-white rounded-3xl overflow-hidden mb-12">
          <CardHeader className="bg-slate-900 px-8 py-7 flex flex-row items-center justify-between">
            <div className="flex flex-col gap-1">
              <CardTitle className="text-white text-xl font-bold flex items-center gap-3">
                <Clock className="h-6 w-6 text-indigo-400" />
                Strategic Aging Audit
              </CardTitle>
              <CardDescription className="text-slate-400 font-medium">Critical focus on orders stagnating beyond operational SLA targets</CardDescription>
            </div>
            <div className="flex items-center gap-3">
               <Select value={agingStage} onValueChange={setAgingStage}>
                <SelectTrigger className="w-52 h-11 bg-slate-800 border-none text-slate-300 rounded-xl font-bold focus:ring-indigo-500">
                  <SelectValue placeholder="All Workflow Stages" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Every Workflow Stage</SelectItem>
                  {pipeline.map(s => <SelectItem key={s.stageName} value={s.stageName}>{s.stageName}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="relative w-64">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <Input 
                  placeholder="Audit by Order / Party..." 
                  className="pl-10 h-11 bg-slate-800 border-none text-white rounded-xl placeholder:text-slate-600 focus:ring-indigo-500"
                  value={agingSearch}
                  onChange={e => setAgingSearch(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-slate-50/80">
                <TableRow className="border-slate-100">
                  {["Reference", "Counterparty", "Commodity", "Load & Unit", "Node", "Workflow Node", "Idle Since", "Wait Time", "Risk Status"].map(h => (
                    <TableHead key={h} className="text-[11px] font-black uppercase text-slate-400 first:pl-8 last:pr-8 py-5">{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {aging.map((r: any, i: number) => (
                  <TableRow key={i} className={`border-slate-50 hover:bg-slate-50 transition-all ${agingRowBg(r.agingBracket)}`}>
                    <TableCell className="pl-8 py-5 font-black text-slate-900 text-sm tracking-tight">{r.orderNo}</TableCell>
                    <TableCell className="font-bold text-slate-700 text-sm max-w-[180px] truncate">{r.customerName}</TableCell>
                    <TableCell className="text-[11px] font-bold text-slate-500">{r.oilType}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm font-black text-slate-800">{fmt(r.quantity)}</span>
                        <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">{r.uom}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs font-bold text-slate-500">{r.depot}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] font-black px-2 py-0.5 bg-white border-indigo-100 text-indigo-600 rounded-lg">{r.currentStage}</Badge>
                    </TableCell>
                    <TableCell className="text-xs font-bold text-slate-400">
                      {r.stageEnteredAt ? new Date(r.stageEnteredAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}
                    </TableCell>
                    <TableCell>
                      <span className={`text-sm font-black ${waitColor(r.pendingMinutes)}`}>{r.pendingDuration}</span>
                    </TableCell>
                    <TableCell className="pr-8">
                      <Badge className={`text-[10px] font-black border px-2.5 py-1 rounded-full ${agingColor(r.agingBracket)}`}>
                        {r.agingBracket?.toUpperCase()}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="p-8 border-t border-slate-100 flex items-center justify-between bg-slate-50/30">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Global Risk Inventory — {agingRes.total} total exceptions found</span>
              <Pagination className="justify-end w-auto mx-0">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious className="cursor-pointer h-10 rounded-xl bg-white border-slate-200 font-bold" onClick={() => setAgingPage(Math.max(1, agingPage - 1))} />
                  </PaginationItem>
                  <PaginationItem>
                    <div className="h-10 flex items-center px-6 bg-white border border-slate-200 rounded-xl text-sm font-black text-indigo-600 shadow-sm">
                      {agingPage}
                    </div>
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationNext className="cursor-pointer h-10 rounded-xl bg-white border-slate-200 font-bold" onClick={() => setAgingPage(agingPage + 1)} />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  )
}
