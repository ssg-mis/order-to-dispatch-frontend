"use client"

import { useState, useMemo, Fragment, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { ownerDashboardApi } from "@/lib/api-service"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
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
  Dialog, DialogContent,
} from "@/components/ui/dialog"
import {
  Package, TrendingUp, Truck, LogOut as GateOutIcon, CheckCircle2,
  AlertTriangle, FileText, IndianRupee, RefreshCw, AlertCircle,
  Users, Clock, ChevronDown, ChevronUp, Search, Filter, Activity,
  BarChart2, Droplets, Building2, ArrowUpDown, Layers, LayoutDashboard,
  Calendar, MapPin, Briefcase, Zap, Target, Globe, Eye,
  Award, CheckCheck, XCircle
} from "lucide-react"
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  BarChart as ReBarChart, Bar as ReBar, Cell, PieChart, Pie, Legend
} from 'recharts'

// ─── tiny helpers ────────────────────────────────────────────────────────────
const fmt = (n: number) => n?.toLocaleString("en-IN") ?? "0"
const fmtRs = (n: number) =>
  n >= 1_00_00_000
    ? `₹${(n / 1_00_00_000).toFixed(2)} Cr`
    : n >= 1_00_000
    ? `₹${(n / 1_00_000).toFixed(2)} L`
    : n >= 1000
    ? `₹${(n / 1000).toFixed(1)} K`
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

// ─── main page ───────────────────────────────────────────────────────────────
export default function OwnerDashboardPage() {
  // Filter state
  const [depot,     setDepot]     = useState("all")
  const [orderType, setOrderType] = useState("all")
  const [dateFrom,  setDateFrom]  = useState("")
  const [dateTo,    setDateTo]    = useState("")

  // User detail modal
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)
  const [selectedUserName, setSelectedUserName] = useState<string>("")
  const [activeStageTab, setActiveStageTab] = useState<number>(0)

  // Drill-down modals
  const [drillDown, setDrillDown] = useState<{ type: 'customer' | 'order' | 'stage' | 'oiltype'; key: string; title: string } | null>(null)
  const openDrill = (type: 'customer' | 'order' | 'stage' | 'oiltype', key: string, title: string) => setDrillDown({ type, key, title })

  // Table Pagination & Search
  const [partyPage, setPartyPage] = useState(1)
  const [agingPage, setAgingPage] = useState(1)
  const [partySearch, setPartySearch] = useState("")
  const [agingSearch, setAgingSearch] = useState("")
  const [agingStage,  setAgingStage]  = useState("all")

  // Grouping for drill-down
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})
  const toggleGroup = (orderNo: string) => {
    setExpandedGroups(prev => ({ ...prev, [orderNo]: !prev[orderNo] }))
  }

  const groupOrders = (orders: any[]) => {
    if (!orders) return [];
    const groups: Record<string, any> = {};
    orders.forEach(o => {
      // Improved regex to handle trailing letters (A, B, C) and trailing numeric suffixes (-1, -2)
      const baseNo = o.orderNo.replace(/([A-Z]|-\d+)+$/, '');
      if (!groups[baseNo]) {
        groups[baseNo] = {
          ...o,
          orderNo: baseNo,
          quantity: 0,
          amount: 0,
          items: [],
          isGroup: true
        };
      }
      groups[baseNo].quantity += o.quantity;
      groups[baseNo].amount += o.amount;
      groups[baseNo].items.push(o);
    });
    return Object.values(groups);
  };
  
  const itemsPerPage = 10

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
      agingOffset: (agingPage - 1) * itemsPerPage,
      search: agingSearch,
      partySearch: partySearch,
    }
    if (depot     !== "all") f.depot      = depot
    if (orderType !== "all") f.order_type = orderType
    if (dateFrom)            f.date_from  = dateFrom
    if (dateTo)              f.date_to    = dateTo
    setActiveFilters(f)
  }

  useEffect(() => {
    applyFilters()
  }, [partyPage, agingPage, agingSearch, partySearch])

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
    refetchInterval: 5 * 60 * 1000,
    staleTime: 60 * 1000,
  })

  const { data: userDetail, isLoading: userDetailLoading } = useQuery({
    queryKey: ["user-detail", selectedUserId, activeFilters],
    queryFn: async () => {
      if (!selectedUserId) return null
      const res = await ownerDashboardApi.getUserDetail(selectedUserId, {
        depot:      activeFilters.depot,
        order_type: activeFilters.order_type,
        date_from:  activeFilters.date_from,
        date_to:    activeFilters.date_to,
      })
      return res.success ? res.data : null
    },
    enabled: !!selectedUserId,
    staleTime: 60 * 1000,
  })

  const dfilt = { depot: activeFilters.depot, order_type: activeFilters.order_type, date_from: activeFilters.date_from, date_to: activeFilters.date_to }
  const { data: ddCustomer, isLoading: ddCustLoading } = useQuery({
    queryKey: ["dd-customer", drillDown?.key, activeFilters],
    queryFn: async () => { const r = await ownerDashboardApi.getCustomerOrders(drillDown!.key, dfilt); return r.success ? r.data : [] },
    enabled: drillDown?.type === 'customer',
    staleTime: 60 * 1000,
  })
  const { data: ddOrder, isLoading: ddOrderLoading } = useQuery({
    queryKey: ["dd-order", drillDown?.key],
    queryFn: async () => { const r = await ownerDashboardApi.getOrderJourney(drillDown!.key); return r.success ? r.data : null },
    enabled: drillDown?.type === 'order',
    staleTime: 60 * 1000,
  })
  const { data: ddStage, isLoading: ddStageLoading } = useQuery({
    queryKey: ["dd-stage", drillDown?.key, activeFilters],
    queryFn: async () => { const r = await ownerDashboardApi.getStageOrders(drillDown!.key, dfilt); return r.success ? r.data : [] },
    enabled: drillDown?.type === 'stage',
    staleTime: 60 * 1000,
  })
  const { data: ddOil, isLoading: ddOilLoading } = useQuery({
    queryKey: ["dd-oil", drillDown?.key, activeFilters],
    queryFn: async () => { const r = await ownerDashboardApi.getOilTypeOrders(drillDown!.key, dfilt); return r.success ? r.data : [] },
    enabled: drillDown?.type === 'oiltype',
    staleTime: 60 * 1000,
  })

  const kpi                 = raw?.kpi             ?? {}
  const pipeline:  any[]      = raw?.stagePipeline   ?? []
  const users:     any[]      = raw?.userActivity    ?? []
  const partyRes              = raw?.partyView       ?? { data: [], total: 0 }
  const oilTypes:  any[]      = raw?.oilTypeView     ?? []
  const agingRes              = raw?.agingReport     ?? { data: [], total: 0 }
  const depots:    string[]   = raw?.depots          ?? []
  const clientFreq:any[]      = raw?.clientFreq      ?? []
  const productFreq:any[]     = raw?.productFreq     ?? []
  const deliveryPerf:any      = raw?.deliveryPerf    ?? { avg_delivery_hours: 0, on_time_percent: 0 }
  const revTrends:any[]       = raw?.revTrends       ?? []
  const slaTrends:any[]       = raw?.slaTrends       ?? []

  const parties = partyRes.data || []
  const aging   = agingRes.data || []
  const groupedAging = useMemo(() => groupOrders(aging), [aging])
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
            <p className="text-slate-500 mt-2">We encountered an error while fetching your business data.</p>
          </div>
          <Button onClick={() => refetch()} className="w-full bg-indigo-600 hover:bg-indigo-700 py-6 text-lg font-semibold rounded-xl">
            Retry Connection
          </Button>
        </div>
      </div>
    )
  }

  return (
    <>
    <div className="min-h-screen bg-[#F4F7FE] pb-12 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      
      {/* ── STICKY TOP BAR ─────────────────────────── */}
      <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-4">
        <div className="max-w-[1700px] mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2.5 rounded-xl shadow-lg shadow-indigo-200">
              <Zap className="h-5 w-5 text-white" />
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-5">
          {[
            { label: "Business Volume", val: kpi.totalOrders, icon: Package, color: "indigo", desc: "Total active pipeline" },
            { label: "New Orders Today", val: kpi.newToday, icon: TrendingUp, color: "emerald", desc: "Punched in last 24h" },
            { label: "Daily Revenue", val: fmtRs(kpi.totalAmountToday), icon: IndianRupee, color: "blue", desc: "Gross Invoiced Today", raw: true },
            { label: "Total Revenue", val: fmtRs(kpi.totalRevenue), icon: BarChart2, color: "purple", desc: "Total Portfolio Value", raw: true },
            { label: "On-Time Delivery", val: `${Math.round(deliveryPerf.on_time_percent || 0)}%`, icon: Target, color: "emerald", desc: "SLA Adherence", raw: true },
            { label: "Operational Delay", val: kpi.delayedOrders, icon: AlertTriangle, color: "rose", desc: "Orders past SLA targets" },
          ].map((item, i) => (
            <Card key={i} className="border-none shadow-sm hover:shadow-lg transition-all duration-300 rounded-2xl group overflow-hidden bg-white">
              <CardContent className="p-6 relative">
                <div className={`absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 rounded-full opacity-[0.05] group-hover:scale-125 transition-all duration-500 bg-${item.color}-600`} />
                <div className="flex items-start justify-between mb-4">
                  <div className={`p-3 rounded-2xl bg-${item.color}-50 text-${item.color}-600 group-hover:scale-110 transition-transform`}>
                    <item.icon className="h-5 w-5" />
                  </div>
                  <Badge variant="outline" className={`bg-${item.color}-50 text-${item.color}-600 text-[10px] font-black uppercase tracking-widest border-none`}>LIVE</Badge>
                </div>
                {isLoading ? <Skeleton className="h-10 w-24 mb-2 rounded-lg" /> : (
                  <div className="text-2xl font-black text-slate-900 tracking-tight leading-none mb-1">
                    {item.raw ? item.val : fmt(item.val as number)}
                  </div>
                )}
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">{item.label}</div>
                <p className="text-[10px] font-medium text-slate-400">{item.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ── ANALYTICAL TRENDS (Graphed) ─────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* REVENUE TREND CHART */}
          <Card className="border-none shadow-sm bg-white rounded-3xl overflow-hidden">
            <CardHeader className="px-8 py-6 border-b border-slate-50 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-indigo-500" />
                  Booking Value Performance Trend
                </CardTitle>
                <CardDescription>7-day rolling performance based on order booking dates</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-8">
              <div className="h-[350px] w-full">
                {isLoading ? <Skeleton className="h-full w-full rounded-2xl" /> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={revTrends}>
                      <defs>
                        <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis 
                        dataKey="day" 
                        tickFormatter={(val) => new Date(val).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }}
                      />
                      <YAxis 
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(val) => `₹${val/1000}k`}
                        tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }}
                      />
                      <RechartsTooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        formatter={(val: number) => [fmtRs(val), 'Booking Value']}
                      />
                      <Area type="monotone" dataKey="revenue" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>

          {/* SLA TREND CHART */}
          <Card className="border-none shadow-sm bg-white rounded-3xl overflow-hidden">
            <CardHeader className="px-8 py-6 border-b border-slate-50 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Clock className="h-5 w-5 text-emerald-500" />
                  Operational SLA Performance
                </CardTitle>
                <CardDescription>7-day trend of average order-to-gate-out time</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-8">
              <div className="h-[350px] w-full">
                {isLoading ? <Skeleton className="h-full w-full rounded-2xl" /> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={slaTrends}>
                      <defs>
                        <linearGradient id="colorSla" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis 
                        dataKey="day" 
                        tickFormatter={(val) => new Date(val).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }}
                      />
                      <YAxis 
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(val) => `${Math.round(val/60)}h`}
                        tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }}
                      />
                      <RechartsTooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        formatter={(val: number) => [`${Math.round(val)} mins`, 'Avg Process Time']}
                      />
                      <Area type="monotone" dataKey="avg_wait_mins" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorSla)" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* OPERATIONAL STAFF ACTIVITY */}
          <Card className="lg:col-span-2 border-none shadow-sm bg-white rounded-3xl overflow-hidden h-[500px] flex flex-col">
            <CardHeader className="px-8 py-6 border-b border-slate-50 shrink-0">
              <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Users className="h-5 w-5 text-indigo-500" />
                Operational Staff Activity
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-hidden">
              <ScrollArea className="h-full">
                <Table>
                  <TableHeader className="bg-slate-50/50 sticky top-0 z-10">
                    <TableRow className="border-slate-50 hover:bg-transparent">
                      <TableHead className="pl-8 text-[11px] font-black uppercase text-slate-400 py-4">User Details</TableHead>
                      <TableHead className="text-[11px] font-black uppercase text-slate-400">Stage Pending</TableHead>
                      <TableHead className="text-right text-[11px] font-black uppercase text-slate-400">Backlog</TableHead>
                      <TableHead className="text-right text-[11px] font-black uppercase text-slate-400">Today's Output</TableHead>
                      <TableHead className="pr-8 text-right text-[11px] font-black uppercase text-slate-400">Detail</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map(u => (
                      <TableRow key={u.userId} className="hover:bg-slate-50/80 transition-colors group border-slate-50">
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
                            {(u.stages ?? []).filter((s: any) => s.pending > 0).slice(0, 3).map((s: any, si: number) => (
                              <Badge key={si} variant="outline" className="text-[10px] font-bold px-2 py-0.5 rounded-lg border-amber-200 text-amber-700 bg-amber-50/50">
                                {s.label}
                                <span className="ml-1.5 px-1 bg-amber-500 text-white rounded text-[9px]">{s.pending}</span>
                              </Badge>
                            ))}
                            {(u.stages ?? []).filter((s: any) => s.pending === 0).length > 0 && (u.stages ?? []).filter((s: any) => s.pending > 0).length === 0 && (
                              <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                                <CheckCheck className="h-3 w-3" /> All Clear
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={`font-black text-sm ${u.totalPending > 0 ? "text-amber-600" : "text-slate-400"}`}>
                            {u.totalPending}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-black text-emerald-600">{u.totalCompletedToday}</TableCell>
                        <TableCell className="pr-8 text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 rounded-xl hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                            onClick={() => {
                              setSelectedUserId(u.userId)
                              setSelectedUserName(u.username)
                              setActiveStageTab(0)
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* USER DETAIL MODAL */}
          <Dialog open={!!selectedUserId} onOpenChange={(open) => { if (!open) setSelectedUserId(null) }}>
            <DialogContent
              showCloseButton={false}
              className="w-[calc(100vw-1rem)] sm:w-[calc(100vw-2rem)] sm:max-w-7xl p-0 gap-0 overflow-hidden rounded-2xl sm:rounded-3xl border-none shadow-2xl bg-white h-[95dvh] sm:h-[88vh] flex flex-col"
            >
              {/* ── GRADIENT HEADER ─────────────────────────── */}
              <div className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-700 px-4 sm:px-8 pt-5 pb-4 sm:pt-6 sm:pb-5 shrink-0">
                {/* Top row: avatar + name + close */}
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-11 w-11 sm:h-13 sm:w-13 shrink-0 rounded-xl sm:rounded-2xl bg-white/20 text-white flex items-center justify-center font-black text-lg sm:text-xl">
                      {selectedUserName?.[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-white font-black text-base sm:text-xl capitalize truncate">{selectedUserName}</h2>
                      <p className="text-indigo-200 text-xs font-medium">Staff Performance Detail</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                    {userDetail && (
                      <div className="hidden sm:flex items-center gap-3">
                        <div className="text-center">
                          <div className="text-white font-black text-2xl leading-none">{userDetail.performance?.onTimePct ?? 0}%</div>
                          <div className="text-indigo-200 text-[9px] font-bold uppercase tracking-wider mt-0.5">On-Time</div>
                        </div>
                        <div className={`h-14 w-14 rounded-xl flex flex-col items-center justify-center ${(userDetail.performance?.onTimePct ?? 0) >= 80 ? "bg-emerald-400/30" : (userDetail.performance?.onTimePct ?? 0) >= 60 ? "bg-amber-400/30" : "bg-red-400/30"}`}>
                          <Award className="h-5 w-5 text-white" />
                          <span className="text-white text-[9px] font-bold mt-0.5 leading-tight text-center">
                            {(userDetail.performance?.onTimePct ?? 0) >= 80 ? "Excellent" : (userDetail.performance?.onTimePct ?? 0) >= 60 ? "Average" : "Needs Work"}
                          </span>
                        </div>
                      </div>
                    )}
                    <button
                      onClick={() => setSelectedUserId(null)}
                      className="h-8 w-8 rounded-xl bg-white/15 hover:bg-white/25 transition-colors flex items-center justify-center text-white"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                </div>

                {/* KPI Cards — 2 cols on mobile, 4 cols on desktop */}
                {userDetail && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                    {[
                      { label: "Completed", value: userDetail.performance?.totalCompleted ?? 0, icon: CheckCheck, color: "text-emerald-300" },
                      { label: "On Time", value: userDetail.performance?.totalOnTime ?? 0, icon: CheckCircle2, color: "text-emerald-300" },
                      { label: "Late", value: userDetail.performance?.totalLate ?? 0, icon: XCircle, color: "text-red-300" },
                      { label: "Pending", value: (userDetail.stageDetails ?? []).reduce((s: number, st: any) => s + (st.pending?.length ?? 0), 0), icon: Clock, color: "text-amber-300" },
                    ].map((card, i) => (
                      <div key={i} className="bg-white/10 rounded-xl px-3 py-2.5 flex items-center gap-2.5 sm:flex-col sm:items-center sm:gap-1 sm:py-3 sm:rounded-2xl">
                        <card.icon className={`h-4 w-4 shrink-0 ${card.color}`} />
                        <div className="sm:text-center">
                          <div className="text-white font-black text-lg sm:text-xl leading-none">{card.value}</div>
                          <div className="text-indigo-200 text-[9px] sm:text-[9px] font-bold uppercase tracking-wider mt-0.5">{card.label}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {/* Mobile on-time rate pill */}
                {userDetail && (
                  <div className="flex sm:hidden items-center gap-2 mt-3">
                    <div className="flex-1 h-2 rounded-full bg-white/20 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${(userDetail.performance?.onTimePct ?? 0) >= 80 ? "bg-emerald-400" : (userDetail.performance?.onTimePct ?? 0) >= 60 ? "bg-amber-400" : "bg-red-400"}`}
                        style={{ width: `${userDetail.performance?.onTimePct ?? 0}%` }}
                      />
                    </div>
                    <span className="text-white font-black text-sm shrink-0">{userDetail.performance?.onTimePct ?? 0}% On-Time</span>
                  </div>
                )}
              </div>

              {/* ── BODY ──────────────────────────────────────── */}
              {userDetailLoading ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="h-10 w-10 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin" />
                    <span className="text-slate-400 text-sm font-medium">Loading details…</span>
                  </div>
                </div>
              ) : userDetail ? (
                <div className="flex-1 overflow-hidden flex flex-col min-h-0">

                  {/* Stage Tab Bar */}
                  <div className="flex gap-0.5 px-3 sm:px-5 pt-3 border-b border-slate-100 overflow-x-auto shrink-0">
                    {(userDetail.stageDetails ?? []).map((stage: any, i: number) => (
                      <button
                        key={i}
                        onClick={() => setActiveStageTab(i)}
                        className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 rounded-t-lg sm:rounded-t-xl text-[10px] sm:text-[11px] font-bold uppercase tracking-wide whitespace-nowrap transition-all border-b-2 ${
                          activeStageTab === i
                            ? "border-indigo-500 text-indigo-600 bg-indigo-50"
                            : "border-transparent text-slate-400 hover:text-slate-600"
                        }`}
                      >
                        {stage.label}
                        {stage.pending?.length > 0 ? (
                          <span className={`px-1.5 py-0.5 rounded-full text-[8px] sm:text-[9px] font-black ${activeStageTab === i ? "bg-indigo-500 text-white" : "bg-amber-100 text-amber-700"}`}>
                            {stage.pending.length}
                          </span>
                        ) : (
                          <CheckCheck className="h-3 w-3 text-emerald-500" />
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Stage Panel */}
                  <div className="flex-1 overflow-hidden min-h-0 flex flex-col">
                    {(userDetail.stageDetails ?? []).map((stage: any, i: number) => i === activeStageTab && (
                      <div key={i} className="flex-1 flex flex-col min-h-0">

                        {/* Stage Stats Strip */}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 sm:px-6 py-2.5 bg-slate-50 border-b border-slate-100 shrink-0">
                          <span className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
                            <span className="h-2 w-2 rounded-full bg-amber-400 shrink-0" />
                            {stage.pending?.length ?? 0} Pending
                          </span>
                          <span className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
                            <span className="h-2 w-2 rounded-full bg-emerald-400 shrink-0" />
                            {stage.onTime ?? 0} On Time
                          </span>
                          <span className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
                            <span className="h-2 w-2 rounded-full bg-red-400 shrink-0" />
                            {stage.late ?? 0} Late
                          </span>
                          {(stage.onTime + stage.late) > 0 && (
                            <span className="flex items-center gap-2 sm:ml-auto">
                              <div className="w-16 sm:w-24 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${Math.round(stage.onTime / (stage.onTime + stage.late) * 100) >= 80 ? "bg-emerald-500" : Math.round(stage.onTime / (stage.onTime + stage.late) * 100) >= 60 ? "bg-amber-500" : "bg-red-500"}`}
                                  style={{ width: `${Math.round(stage.onTime / (stage.onTime + stage.late) * 100)}%` }}
                                />
                              </div>
                              <span className="text-xs font-black text-slate-700">
                                {Math.round(stage.onTime / (stage.onTime + stage.late) * 100)}%
                              </span>
                            </span>
                          )}
                        </div>

                        {/* Orders List */}
                        <div className="flex-1 overflow-y-auto min-h-0 w-full">
                          {stage.pending?.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                              <div className="h-14 w-14 rounded-2xl bg-emerald-50 flex items-center justify-center mb-3">
                                <CheckCheck className="h-7 w-7 text-emerald-500" />
                              </div>
                              <div className="font-bold text-slate-700">All Clear!</div>
                              <div className="text-slate-400 text-sm mt-1">No pending orders in this stage</div>
                            </div>
                          ) : (
                            <div className="min-w-full">
                              {/* Desktop Table */}
                              <div className="hidden sm:block overflow-x-auto">
                                <Table>
                                  <TableHeader className="bg-slate-50/80 sticky top-0 z-10">
                                    <TableRow className="border-slate-100 hover:bg-transparent">
                                      <TableHead className="pl-6 text-[10px] font-black uppercase text-slate-400 py-3 w-32">Order No</TableHead>
                                      <TableHead className="text-[10px] font-black uppercase text-slate-400">Customer</TableHead>
                                      <TableHead className="text-[10px] font-black uppercase text-slate-400">Product / SKU</TableHead>
                                      <TableHead className="text-[10px] font-black uppercase text-slate-400 w-28">Planned Date</TableHead>
                                      <TableHead className="text-[10px] font-black uppercase text-slate-400 w-32">Status</TableHead>
                                      <TableHead className="pr-6 text-[10px] font-black uppercase text-slate-400 w-36">Time Used</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {(stage.pending ?? []).map((order: any, oi: number) => {
                                      const overdue = order.daysOverdue
                                      const isOverdue = overdue > 0
                                      const pct = Math.min(order.progressPct ?? 0, 100)
                                      const overdueClass = overdue > 7 ? "text-red-600 bg-red-50 border-red-200" : overdue > 3 ? "text-orange-600 bg-orange-50 border-orange-200" : overdue > 0 ? "text-amber-600 bg-amber-50 border-amber-200" : "text-emerald-600 bg-emerald-50 border-emerald-200"
                                      const barColor = pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-orange-500" : pct >= 60 ? "bg-amber-500" : "bg-emerald-500"
                                      return (
                                        <TableRow key={oi} className={`border-slate-50 hover:bg-slate-50/80 transition-colors ${isOverdue && overdue > 7 ? "bg-red-50/20" : isOverdue && overdue > 3 ? "bg-orange-50/20" : isOverdue ? "bg-amber-50/10" : ""}`}>
                                          <TableCell className="pl-6 py-3.5">
                                            <span className="font-black text-sm text-indigo-600 font-mono">{order.orderNo}</span>
                                            {order.depot && <div className="flex items-center gap-1 text-slate-400 text-[10px] mt-0.5"><MapPin className="h-2.5 w-2.5" />{order.depot}</div>}
                                          </TableCell>
                                          <TableCell>
                                            <div className="font-semibold text-slate-800 text-sm leading-tight">{order.customer}</div>
                                            <div className="text-[10px] text-slate-400 mt-0.5">{order.orderType}</div>
                                          </TableCell>
                                          <TableCell>
                                            <div className="font-semibold text-slate-800 text-sm">{order.skuName || order.sku_name || order.productName || order.product_name || order.oilType || '—'}</div>
                                          </TableCell>
                                          <TableCell>
                                            <div className="text-xs font-semibold text-slate-700">{order.plannedDate ? new Date(order.plannedDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}</div>
                                            <div className="text-[10px] text-slate-400 mt-0.5">{order.plannedDate ? new Date(order.plannedDate).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : ""}</div>
                                          </TableCell>
                                          <TableCell>
                                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-black border ${overdueClass}`}>
                                              {isOverdue ? <><AlertTriangle className="h-3 w-3" />{overdue.toFixed(1)}d over</> : <><Clock className="h-3 w-3" />{Math.abs(overdue).toFixed(1)}d left</>}
                                            </span>
                                          </TableCell>
                                          <TableCell className="pr-6">
                                            <div className="flex flex-col gap-1">
                                              <div className="flex justify-between items-center">
                                                <span className="text-[10px] font-bold text-slate-400">{pct.toFixed(0)}%</span>
                                                {pct >= 100 && <span className="text-[9px] font-black text-red-500">Exceeded</span>}
                                              </div>
                                              <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                                                <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                                              </div>
                                            </div>
                                          </TableCell>
                                        </TableRow>
                                      )
                                    })}
                                  </TableBody>
                                </Table>
                              </div>

                              {/* Mobile Card List */}
                              <div className="sm:hidden flex flex-col gap-2 p-3">
                                {(stage.pending ?? []).map((order: any, oi: number) => {
                                  const overdue = order.daysOverdue
                                  const isOverdue = overdue > 0
                                  const pct = Math.min(order.progressPct ?? 0, 100)
                                  const overdueClass = overdue > 7 ? "text-red-600 bg-red-50 border-red-200" : overdue > 3 ? "text-orange-600 bg-orange-50 border-orange-200" : overdue > 0 ? "text-amber-600 bg-amber-50 border-amber-200" : "text-emerald-600 bg-emerald-50 border-emerald-200"
                                  const barColor = pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-orange-500" : pct >= 60 ? "bg-amber-500" : "bg-emerald-500"
                                  const rowBg = isOverdue && overdue > 7 ? "border-red-100 bg-red-50/30" : isOverdue && overdue > 3 ? "border-orange-100 bg-orange-50/30" : isOverdue ? "border-amber-100 bg-amber-50/20" : "border-slate-100 bg-white"
                                  return (
                                    <div key={oi} className={`rounded-xl border p-3 ${rowBg}`}>
                                      <div className="flex items-start justify-between gap-2 mb-2">
                                        <div className="min-w-0">
                                          <span className="font-black text-sm text-indigo-600 font-mono block">{order.orderNo}</span>
                                          <div className="font-semibold text-slate-800 text-xs mt-0.5 truncate">{order.customer}</div>
                                          {order.depot && (
                                            <div className="flex items-center gap-1 text-slate-400 text-[10px] mt-0.5">
                                              <MapPin className="h-2.5 w-2.5 shrink-0" />{order.depot}
                                            </div>
                                          )}
                                        </div>
                                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black border shrink-0 ${overdueClass}`}>
                                          {isOverdue ? <><AlertTriangle className="h-2.5 w-2.5" />{overdue.toFixed(1)}d over</> : <><Clock className="h-2.5 w-2.5" />{Math.abs(overdue).toFixed(1)}d left</>}
                                        </span>
                                      </div>
                                      <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1.5">
                                        <span>{order.plannedDate ? new Date(order.plannedDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}</span>
                                        <span className="font-bold text-slate-600">{pct.toFixed(0)}% used{pct >= 100 ? " · Exceeded" : ""}</span>
                                      </div>
                                      <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                                        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <span className="text-slate-400 text-sm">No data available</span>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* COMMODITY LINE STATUS */}
          <Card className="border-none shadow-sm bg-white rounded-3xl overflow-hidden h-[500px] flex flex-col">
            <CardHeader className="px-8 py-6 border-b border-slate-50 shrink-0">
              <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Droplets className="h-5 w-5 text-indigo-500" />
                Commodity Line Status
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-hidden">
              <ScrollArea className="h-full p-6">
                <div className="flex flex-col gap-4">
                  {oilTypes.map((ot, i) => (
                    <button key={i} onClick={() => openDrill('oiltype', ot.oilType, `${ot.oilType} — All Orders`)} className="group w-full text-left p-4 rounded-2xl bg-slate-50 hover:bg-indigo-50/50 transition-all border border-transparent hover:border-indigo-100 cursor-pointer">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest group-hover:text-indigo-600 transition-colors">{ot.oilType}</span>
                        <Badge className="bg-white text-indigo-600 border-indigo-100 shadow-sm text-[10px] font-bold">{fmt(ot.totalOrders)} Orders</Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col">
                          <span className="text-lg font-black text-slate-900 leading-none">{fmt(ot.newToday)}</span>
                          <span className="text-[9px] font-bold text-slate-400 uppercase mt-1">Punched Today</span>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="text-lg font-black text-indigo-600 leading-none">{fmtRs(ot.totalValue)}</span>
                          <span className="text-[9px] font-bold text-slate-400 uppercase mt-1">Portfolio Value</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 mt-3 text-[9px] font-black text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Eye className="h-2.5 w-2.5" /> View orders
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* ── FREQUENCY ANALYSIS ────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* TOP RECURRING CUSTOMERS */}
          <Card className="border-none shadow-sm bg-white rounded-3xl overflow-hidden">
            <CardHeader className="px-8 py-6 border-b border-slate-50">
              <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Globe className="h-5 w-5 text-indigo-500" />
                Top Recurring Customers
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-slate-50/50">
                  <TableRow>
                    <TableHead className="pl-8 text-[11px] font-black uppercase text-slate-400">Customer Name</TableHead>
                    <TableHead className="text-center text-[11px] font-black uppercase text-slate-400">Order Freq</TableHead>
                    <TableHead className="pr-8 text-right text-[11px] font-black uppercase text-slate-400">Total Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientFreq.map((c, i) => (
                    <TableRow key={i} onClick={() => openDrill('customer', c.customer_name, c.customer_name)} className="hover:bg-indigo-50/40 transition-colors cursor-pointer group">
                      <TableCell className="pl-8 py-4 font-bold text-slate-700 text-sm group-hover:text-indigo-700 transition-colors">{c.customer_name}</TableCell>
                      <TableCell className="text-center">
                        <Badge className="bg-indigo-50 text-indigo-600 border-none font-black text-[10px]">{c.order_count} Orders</Badge>
                      </TableCell>
                      <TableCell className="pr-8 text-right font-black text-slate-900">{fmtRs(parseFloat(c.total_value))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* POPULAR PRODUCT LINES */}
          <Card className="border-none shadow-sm bg-white rounded-3xl overflow-hidden">
            <CardHeader className="px-8 py-6 border-b border-slate-50">
              <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Package className="h-5 w-5 text-indigo-500" />
                Popular Product Lines
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-slate-50/50">
                  <TableRow>
                    <TableHead className="pl-8 text-[11px] font-black uppercase text-slate-400">Product (SKU)</TableHead>
                    <TableHead className="text-center text-[11px] font-black uppercase text-slate-400">Demand Freq</TableHead>
                    <TableHead className="pr-8 text-right text-[11px] font-black uppercase text-slate-400">Total Qty</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productFreq.map((p, i) => (
                    <TableRow key={i} className="hover:bg-slate-50 transition-colors">
                      <TableCell className="pl-8 py-4 font-bold text-slate-700 text-sm truncate max-w-[200px]">{p.sku_name}</TableCell>
                      <TableCell className="text-center">
                        <Badge className="bg-emerald-50 text-emerald-600 border-none font-black text-[10px]">{p.order_count} Requests</Badge>
                      </TableCell>
                      <TableCell className="pr-8 text-right font-black text-slate-900">{fmt(parseFloat(p.total_qty))} <span className="text-[10px] text-slate-400 font-bold uppercase ml-1">{p.uom}</span></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
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
                <button
                  key={i}
                  onClick={() => stage.pendingCount > 0 && openDrill('stage', stage.stageName, `${stage.stageName} — Pending Orders`)}
                  className={`shrink-0 flex flex-col gap-3 rounded-2xl border-2 p-5 w-[160px] transition-all text-left ${stageBlockColor(stage.avgWaitMinutes)} shadow-sm ${stage.pendingCount > 0 ? 'hover:translate-y-[-4px] hover:shadow-lg cursor-pointer' : 'cursor-default opacity-70'}`}
                >
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
                    {stage.pendingCount > 0 && <div className="text-[9px] font-black opacity-50 flex items-center gap-1 mt-1"><Eye className="h-2.5 w-2.5" /> Click to view</div>}
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

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
                  <TableRow key={i} onClick={() => openDrill('customer', p.customerName, p.customerName)} className="hover:bg-indigo-50/40 transition-colors border-slate-50 cursor-pointer group">
                    <TableCell className="pl-8 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-900 text-sm truncate max-w-[200px] group-hover:text-indigo-700 transition-colors">{p.customerName}</span>
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
              <span className="text-xs font-bold text-slate-400">Showing {parties.length} of {partyRes.total} clients</span>
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


      </div>
    </div>

    {/* ═══════════════════════════════════════════════════════
        UNIFIED DRILL-DOWN MODAL
    ═══════════════════════════════════════════════════════ */}
    <Dialog open={!!drillDown} onOpenChange={(open) => { if (!open) setDrillDown(null) }}>
      <DialogContent
        showCloseButton={false}
        className="w-[calc(100vw-1rem)] sm:w-[calc(100vw-2rem)] sm:max-w-7xl p-0 gap-0 overflow-hidden rounded-2xl sm:rounded-3xl border-none shadow-2xl bg-white h-[92dvh] sm:h-[85vh] flex flex-col"
      >
        {/* Header */}
        <div className={`px-5 sm:px-8 py-4 sm:py-5 shrink-0 flex items-center justify-between gap-3 ${
          drillDown?.type === 'order' ? 'bg-gradient-to-r from-slate-800 to-slate-900'
          : drillDown?.type === 'stage' ? 'bg-gradient-to-r from-orange-600 to-rose-600'
          : drillDown?.type === 'oiltype' ? 'bg-gradient-to-r from-teal-600 to-emerald-700'
          : 'bg-gradient-to-r from-indigo-600 to-violet-700'
        }`}>
          <div className="min-w-0">
            <h2 className="text-white font-black text-base sm:text-lg truncate">{drillDown?.title}</h2>
            <p className="text-white/60 text-xs font-medium mt-0.5">
              {drillDown?.type === 'customer' && 'Complete order history for this customer'}
              {drillDown?.type === 'order' && 'Full stage-by-stage journey of this order'}
              {drillDown?.type === 'stage' && 'All orders currently pending at this stage'}
              {drillDown?.type === 'oiltype' && 'All orders for this commodity type'}
            </p>
          </div>
          <button onClick={() => setDrillDown(null)} className="h-8 w-8 shrink-0 rounded-xl bg-white/15 hover:bg-white/25 transition-colors flex items-center justify-center text-white">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden min-h-0">

          {/* ── CUSTOMER ORDERS ── */}
          {drillDown?.type === 'customer' && (
            ddCustLoading ? <DDLoader /> : (
              <ScrollArea className="h-full">
                {(!ddCustomer || ddCustomer.length === 0) ? <DDEmpty label="No orders found for this customer" /> : (
                  <>
                    {/* Summary strip */}
                    <div className="flex flex-wrap gap-4 px-6 py-3 bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-600">
                      <span>{ddCustomer.length} items</span>
                      <span className="text-indigo-600">{fmtRs(ddCustomer.reduce((s: number, o: any) => s + (o.amount || 0), 0))} total value</span>
                      <span className="text-amber-600">{ddCustomer.filter((o: any) => o.status === 'pending').length} pending</span>
                      <span className="text-emerald-600">{ddCustomer.filter((o: any) => o.status === 'completed').length} completed</span>
                    </div>
                    {/* Desktop table */}
                    <div className="hidden sm:block">
                      <Table>
                        <TableHeader className="bg-slate-50/80 sticky top-0 z-10">
                          <TableRow className="border-slate-100 hover:bg-transparent">
                            {['Order No','Product / SKU','Depot','Qty','Amount','Stage','Date'].map(h => (
                              <TableHead key={h} className="text-[10px] font-black uppercase text-slate-400 py-3 first:pl-6 last:pr-6">{h}</TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {groupOrders(ddCustomer).map((group: any, i: number) => (
                            <Fragment key={i}>
                              <TableRow 
                                onClick={() => toggleGroup(group.orderNo)} 
                                className={`border-slate-50 hover:bg-indigo-50/30 cursor-pointer transition-colors group ${expandedGroups[group.orderNo] ? 'bg-indigo-50/50' : ''}`}
                              >
                                <TableCell className="pl-6 py-3 font-black text-indigo-600 font-mono text-sm flex items-center gap-2">
                                  {group.items.length > 1 ? (expandedGroups[group.orderNo] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />) : null}
                                  {group.orderNo}
                                  {group.items.length > 1 && <Badge variant="outline" className="ml-2 text-[9px]">{group.items.length}</Badge>}
                                </TableCell>
                                <TableCell>
                                  <div className="font-semibold text-slate-800 text-sm">{group.skuName || group.sku_name || group.productName || group.product_name || group.oilType || '—'}</div>
                                  <div className="text-[10px] text-slate-400">{group.orderType}</div>
                                </TableCell>
                                <TableCell className="text-xs text-slate-500">{group.depot || '—'}</TableCell>
                                <TableCell className="text-xs font-bold text-slate-700">{fmt(group.quantity)} <span className="text-[10px] text-slate-400">{group.uom}</span></TableCell>
                                <TableCell className="font-black text-slate-900 text-sm">{fmtRs(group.amount)}</TableCell>
                                <TableCell>
                                  <Badge className={`text-[10px] font-black border-none px-2 py-0.5 ${group.status === 'completed' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{group.currentStage}</Badge>
                                </TableCell>
                                <TableCell className="pr-6 text-[11px] text-slate-400 font-bold">{group.createdAt ? new Date(group.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}</TableCell>
                              </TableRow>
                              
                              {expandedGroups[group.orderNo] && group.items.length > 1 && group.items.map((item: any, ii: number) => (
                                <TableRow key={`${i}-${ii}`} className="bg-slate-50/40 border-slate-50 hover:bg-slate-50 transition-colors" onClick={() => setDrillDown({ type: 'order', key: item.orderNo, title: `Order Journey — ${item.orderNo}` })}>
                                  <TableCell className="pl-12 py-2 font-bold text-indigo-400 font-mono text-xs italic">{item.orderNo}</TableCell>
                                  <TableCell className="py-2 text-xs text-slate-600">{item.skuName || item.sku_name || item.productName || item.product_name || item.oilType || '—'}</TableCell>
                                  <TableCell className="py-2 text-[10px] text-slate-400">{item.depot}</TableCell>
                                  <TableCell className="py-2 text-xs font-medium text-slate-500">{fmt(item.quantity)} {item.uom}</TableCell>
                                  <TableCell className="py-2 text-xs font-bold text-slate-600">{fmtRs(item.amount)}</TableCell>
                                  <TableCell className="py-2">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase">{item.currentStage}</span>
                                  </TableCell>
                                  <TableCell className="py-2 text-[10px] text-slate-400 font-medium">
                                    {item.createdAt ? new Date(item.createdAt).toLocaleDateString("en-IN", { day: '2-digit', month: 'short' }) : '—'}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </Fragment>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    {/* Mobile cards */}
                    <div className="sm:hidden flex flex-col gap-2 p-3">
                      {groupOrders(ddCustomer).map((group: any, i: number) => (
                        <div key={i} className="border border-slate-100 rounded-xl overflow-hidden">
                          <div 
                            onClick={() => toggleGroup(group.orderNo)}
                            className="p-3 cursor-pointer hover:bg-indigo-50/20 transition-all flex flex-col"
                          >
                            <div className="flex items-start justify-between gap-2 mb-1.5">
                              <span className="font-black text-indigo-600 font-mono text-sm flex items-center gap-1">
                                {group.orderNo} {group.items.length > 1 && <span className="text-[10px] text-slate-400">({group.items.length})</span>}
                              </span>
                              <Badge className={`text-[9px] font-black border-none px-2 py-0.5 shrink-0 ${group.status === 'completed' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{group.currentStage}</Badge>
                            </div>
                            <div className="text-xs font-semibold text-slate-700">{group.skuName || group.sku_name || group.productName || group.product_name || group.oilType || '—'}</div>
                            <div className="flex justify-between mt-1.5 text-[10px] font-bold text-slate-400">
                              <span>{group.depot || '—'} · {fmt(group.quantity)} {group.uom}</span>
                              <span className="text-indigo-600">{fmtRs(group.amount)}</span>
                            </div>
                          </div>
                          {expandedGroups[group.orderNo] && group.items.length > 1 && (
                            <div className="bg-slate-50 p-2 border-t border-slate-100 flex flex-col gap-2">
                              {group.items.map((item: any, ii: number) => (
                                <div key={ii} onClick={() => setDrillDown({ type: 'order', key: item.orderNo, title: `Order Journey — ${item.orderNo}` })} className="bg-white p-2 rounded-lg border border-slate-200 flex justify-between items-center">
                                  <span className="text-[10px] font-bold text-indigo-400 font-mono">{item.orderNo}</span>
                                  <span className="text-[10px] font-black text-slate-600">{fmtRs(item.amount)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </ScrollArea>
            )
          )}

          {/* ── ORDER JOURNEY ── */}
          {drillDown?.type === 'order' && (
            ddOrderLoading ? <DDLoader /> : !ddOrder ? <DDEmpty label="Order not found" /> : (
              <ScrollArea className="h-full">
                {/* Order summary card */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-5 bg-slate-50 border-b border-slate-100">
                  {[
                    { label: 'Customer', val: ddOrder.customer },
                    { label: 'Product', val: ddOrder.skuName || ddOrder.sku_name || ddOrder.productName || ddOrder.product_name || ddOrder.oilType || '—' },
                    { label: 'Quantity', val: `${fmt(ddOrder.quantity)} ${ddOrder.uom}` },
                    { label: 'Value', val: fmtRs(ddOrder.amount) },
                  ].map((item, i) => (
                    <div key={i} className="bg-white rounded-xl px-3 py-2.5 border border-slate-100">
                      <div className="text-[9px] font-black uppercase text-slate-400 tracking-wider mb-1">{item.label}</div>
                      <div className="font-black text-slate-900 text-sm truncate">{item.val}</div>
                    </div>
                  ))}
                </div>
                {/* Stage timeline */}
                <div className="p-5 flex flex-col gap-0">
                  {(ddOrder.stages || []).map((stage: any, i: number) => {
                    const isDone = stage.status === 'done'
                    const isPending = stage.status === 'pending'
                    const notStarted = stage.status === 'not_started'
                    const isLate = isDone && stage.onTime === false
                    const isOnTime = isDone && stage.onTime === true
                    return (
                      <div key={i} className="flex gap-4 relative">
                        {/* Vertical connector */}
                        {i < (ddOrder.stages.length - 1) && (
                          <div className={`absolute left-[19px] top-10 bottom-0 w-0.5 ${isDone ? 'bg-emerald-200' : isPending ? 'bg-amber-200' : 'bg-slate-100'}`} />
                        )}
                        {/* Circle */}
                        <div className={`h-10 w-10 shrink-0 rounded-full flex items-center justify-center z-10 mt-1 ${
                          isDone && isOnTime ? 'bg-emerald-100 text-emerald-600' :
                          isDone && isLate   ? 'bg-orange-100 text-orange-600' :
                          isPending          ? 'bg-amber-100 text-amber-600' :
                                               'bg-slate-100 text-slate-300'
                        }`}>
                          {isDone ? <CheckCheck className="h-4 w-4" /> : isPending ? <Clock className="h-4 w-4" /> : <div className="h-2 w-2 rounded-full bg-slate-300" />}
                        </div>
                        {/* Content */}
                        <div className={`flex-1 pb-6 ${notStarted ? 'opacity-40' : ''}`}>
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div>
                              <span className="font-black text-slate-900 text-sm">{stage.label}</span>
                              {isPending && stage.overdueDays !== null && (
                                <span className={`ml-2 text-[10px] font-black px-2 py-0.5 rounded-full ${stage.overdueDays > 0 ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
                                  {stage.overdueDays > 0 ? `${stage.overdueDays}d overdue` : `${Math.abs(stage.overdueDays)}d left`}
                                </span>
                              )}
                              {isDone && (
                                <span className={`ml-2 text-[9px] font-black px-2 py-0.5 rounded-full ${isOnTime ? 'bg-emerald-100 text-emerald-600' : 'bg-orange-100 text-orange-600'}`}>
                                  {isOnTime ? 'On Time' : 'Late'}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-4 mt-1.5 text-[11px] text-slate-500 font-medium">
                            <span><span className="font-bold text-slate-400">Planned: </span>{stage.plannedAt ? new Date(stage.plannedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}</span>
                            {stage.actualAt && <span><span className="font-bold text-slate-400">Actual: </span>{new Date(stage.actualAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>}
                            <span><span className="font-bold text-slate-400">Responsible: </span><span className="text-indigo-600 font-bold">{stage.responsible}</span></span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </ScrollArea>
            )
          )}

          {/* ── STAGE ORDERS ── */}
          {drillDown?.type === 'stage' && (
            ddStageLoading ? <DDLoader /> : (
              <ScrollArea className="h-full">
                {(!ddStage || ddStage.length === 0) ? <DDEmpty label="No orders pending at this stage" /> : (
                  <>
                    <div className="flex flex-wrap gap-4 px-6 py-3 bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-600">
                      <span>{ddStage.length} items pending</span>
                      <span className="text-orange-600">{ddStage.filter((o: any) => o.daysOverdue > 0).length} overdue</span>
                    </div>
                    <div className="hidden sm:block">
                      <Table>
                        <TableHeader className="bg-slate-50/80 sticky top-0 z-10">
                          <TableRow className="border-slate-100 hover:bg-transparent">
                            {['Order No','Customer','Product / SKU','Depot','Order Date','Planned At','Overdue'].map(h => (
                              <TableHead key={h} className="text-[10px] font-black uppercase text-slate-400 py-3 first:pl-6 last:pr-6">{h}</TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {groupOrders(ddStage).map((group: any, i: number) => (
                            <Fragment key={i}>
                              <TableRow 
                                onClick={() => toggleGroup(group.orderNo)} 
                                className={`border-slate-50 hover:bg-indigo-50/30 cursor-pointer transition-colors group ${expandedGroups[group.orderNo] ? 'bg-indigo-50/50' : ''}`}
                              >
                                <TableCell className="pl-6 py-3 font-black text-indigo-600 font-mono text-sm flex items-center gap-2">
                                  {group.items.length > 1 ? (expandedGroups[group.orderNo] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />) : null}
                                  {group.orderNo}
                                  {group.items.length > 1 && <Badge variant="outline" className="ml-2 text-[9px]">{group.items.length}</Badge>}
                                </TableCell>
                                <TableCell className="font-semibold text-slate-800 text-sm max-w-[160px] truncate">{group.customer}</TableCell>
                                <TableCell className="text-xs text-slate-500">{group.skuName || group.sku_name || group.productName || group.product_name || group.oilType || '—'}</TableCell>
                                <TableCell className="text-xs text-slate-500">{group.depot || '—'}</TableCell>
                                <TableCell className="text-xs text-slate-400 font-bold">{group.createdAt ? new Date(group.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}</TableCell>
                                <TableCell className="text-xs text-slate-600">{group.plannedAt ? new Date(group.plannedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}</TableCell>
                                <TableCell className="pr-6">
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black border ${group.daysOverdue > 7 ? 'text-red-600 bg-red-50 border-red-200' : group.daysOverdue > 3 ? 'text-orange-600 bg-orange-50 border-orange-200' : group.daysOverdue > 0 ? 'text-amber-600 bg-amber-50 border-amber-200' : 'text-emerald-600 bg-emerald-50 border-emerald-200'}`}>
                                    {group.daysOverdue > 0 ? <><AlertTriangle className="h-2.5 w-2.5" />{group.daysOverdue.toFixed(1)}d overdue</> : <><Clock className="h-2.5 w-2.5" />{Math.abs(group.daysOverdue).toFixed(1)}d left</>}
                                  </span>
                                </TableCell>
                              </TableRow>
                              {expandedGroups[group.orderNo] && group.items.length > 1 && group.items.map((item: any, ii: number) => (
                                <TableRow key={`${i}-${ii}`} className="bg-slate-50/40 border-slate-50 hover:bg-slate-50 transition-colors" onClick={() => setDrillDown({ type: 'order', key: item.orderNo, title: `Order Journey — ${item.orderNo}` })}>
                                  <TableCell className="pl-12 py-2 font-bold text-indigo-400 font-mono text-xs italic">{item.orderNo}</TableCell>
                                  <TableCell className="py-2 text-xs text-slate-600 italic opacity-80">{item.customer}</TableCell>
                                  <TableCell className="py-2 text-xs text-slate-500">{item.skuName || item.sku_name || item.productName || item.product_name || item.oilType || '—'}</TableCell>
                                  <TableCell className="py-2 text-xs text-slate-400 italic opacity-80">{item.depot}</TableCell>
                                  <TableCell className="py-2 text-xs text-slate-500 italic opacity-80">
                                    {item.createdAt ? new Date(item.createdAt).toLocaleDateString("en-IN", { day: '2-digit', month: 'short' }) : '—'}
                                  </TableCell>
                                  <TableCell className="py-2 text-xs text-slate-500 italic opacity-80">
                                    {item.plannedAt ? new Date(item.plannedAt).toLocaleDateString("en-IN", { day: '2-digit', month: 'short' }) : '—'}
                                    <span className="ml-1 opacity-50">({fmt(item.quantity)})</span>
                                  </TableCell>
                                  <TableCell className="py-2 text-right">
                                    <span className={`text-[10px] font-bold italic ${item.daysOverdue > 0 ? "text-orange-500" : "text-emerald-500"}`}>
                                      {item.daysOverdue > 0 ? `${item.daysOverdue}d` : "on time"}
                                    </span>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </Fragment>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="sm:hidden flex flex-col gap-2 p-3">
                      {groupOrders(ddStage).map((group: any, i: number) => {
                        const od = group.daysOverdue
                        const cls = od > 7 ? 'border-red-100 bg-red-50/30' : od > 3 ? 'border-orange-100 bg-orange-50/30' : od > 0 ? 'border-amber-100 bg-amber-50/20' : 'border-slate-100 bg-white'
                        const badge = od > 7 ? 'text-red-600 bg-red-50' : od > 3 ? 'text-orange-600 bg-orange-50' : od > 0 ? 'text-amber-600 bg-amber-50' : 'text-emerald-600 bg-emerald-50'
                        return (
                          <div key={i} className={`border rounded-xl overflow-hidden transition-all ${cls}`}>
                            <div 
                              onClick={() => toggleGroup(group.orderNo)}
                              className="p-3 cursor-pointer"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <span className="font-black text-indigo-600 font-mono text-sm">{group.orderNo} {group.items.length > 1 && <span className="text-[10px] text-slate-400">({group.items.length})</span>}</span>
                                <span className={`text-[9px] font-black px-2 py-0.5 rounded-full shrink-0 ${badge}`}>{od > 0 ? `${od.toFixed(1)}d over` : `${Math.abs(od).toFixed(1)}d left`}</span>
                              </div>
                              <div className="text-xs font-semibold text-slate-800 mt-1 truncate">{group.customer}</div>
                              <div className="text-[10px] text-slate-400 mt-0.5">{group.depot} · {group.plannedAt ? new Date(group.plannedAt).toLocaleDateString('en-IN') : '—'}</div>
                            </div>
                            {expandedGroups[group.orderNo] && group.items.length > 1 && (
                              <div className="bg-slate-50/50 p-2 border-t border-slate-100 flex flex-col gap-2">
                                {group.items.map((item: any, ii: number) => (
                                  <div key={ii} onClick={() => setDrillDown({ type: 'order', key: item.orderNo, title: `Order Journey — ${item.orderNo}` })} className="bg-white p-2 rounded-lg border border-slate-200 flex justify-between items-center">
                                    <span className="text-[10px] font-bold text-indigo-400 font-mono">{item.orderNo}</span>
                                    <span className="text-[10px] font-black text-slate-600">{fmt(item.quantity)} {item.uom}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </>
                )}
              </ScrollArea>
            )
          )}

          {/* ── OIL TYPE ORDERS ── */}
          {drillDown?.type === 'oiltype' && (
            ddOilLoading ? <DDLoader /> : (
              <ScrollArea className="h-full">
                {(!ddOil || ddOil.length === 0) ? <DDEmpty label="No orders found for this commodity" /> : (
                  <>
                    <div className="flex flex-wrap gap-4 px-6 py-3 bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-600">
                      <span>{ddOil.length} items</span>
                      <span className="text-indigo-600">{fmtRs(ddOil.reduce((s: number, o: any) => s + (o.amount || 0), 0))} total value</span>
                      <span className="text-amber-600">{ddOil.filter((o: any) => o.status === 'pending').length} in progress</span>
                      <span className="text-emerald-600">{ddOil.filter((o: any) => o.status === 'completed').length} completed</span>
                    </div>
                    <div className="hidden sm:block">
                      <Table>
                        <TableHeader className="bg-slate-50/80 sticky top-0 z-10">
                          <TableRow className="border-slate-100 hover:bg-transparent">
                            {['Order No','Customer','SKU','Depot','Qty','Amount','Stage','Date'].map(h => (
                              <TableHead key={h} className="text-[10px] font-black uppercase text-slate-400 py-3 first:pl-6 last:pr-6">{h}</TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {groupOrders(ddOil).map((group: any, i: number) => (
                            <Fragment key={i}>
                              <TableRow 
                                onClick={() => toggleGroup(group.orderNo)} 
                                className={`border-slate-50 hover:bg-teal-50/30 cursor-pointer transition-colors group ${expandedGroups[group.orderNo] ? 'bg-teal-50/50' : ''}`}
                              >
                                <TableCell className="pl-6 py-3 font-black text-indigo-600 font-mono text-sm flex items-center gap-2">
                                  {group.items.length > 1 ? (expandedGroups[group.orderNo] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />) : null}
                                  {group.orderNo}
                                  {group.items.length > 1 && <Badge variant="outline" className="ml-2 text-[9px]">{group.items.length}</Badge>}
                                </TableCell>
                                <TableCell className="font-semibold text-slate-800 text-sm max-w-[140px] truncate">{group.customer}</TableCell>
                                <TableCell className="text-xs text-slate-500 max-w-[120px] truncate">{group.skuName || '—'}</TableCell>
                                <TableCell className="text-xs text-slate-500">{group.depot || '—'}</TableCell>
                                <TableCell className="text-xs font-bold text-slate-700">{fmt(group.quantity)} <span className="text-[10px] text-slate-400">{group.uom}</span></TableCell>
                                <TableCell className="font-black text-slate-900 text-sm">{fmtRs(group.amount)}</TableCell>
                                <TableCell>
                                  <Badge className={`text-[10px] font-black border-none px-2 py-0.5 ${group.status === 'completed' ? 'bg-emerald-50 text-emerald-700' : 'bg-teal-50 text-teal-700'}`}>{group.currentStage}</Badge>
                                </TableCell>
                                <TableCell className="pr-6 text-[11px] text-slate-400 font-bold">{group.createdAt ? new Date(group.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}</TableCell>
                              </TableRow>
                              {expandedGroups[group.orderNo] && group.items.length > 1 && group.items.map((item: any, ii: number) => (
                                <TableRow key={`${i}-${ii}`} className="bg-teal-50/20 border-slate-50 hover:bg-teal-50/40 transition-colors" onClick={() => setDrillDown({ type: 'order', key: item.orderNo, title: `Order Journey — ${item.orderNo}` })}>
                                  <TableCell className="pl-12 py-2 font-bold text-indigo-400 font-mono text-xs italic">{item.orderNo}</TableCell>
                                  <TableCell className="py-2 text-xs text-slate-600 italic opacity-80">{item.customer}</TableCell>
                                  <TableCell className="py-2 text-xs text-slate-500 italic opacity-80">{item.skuName || '—'}</TableCell>
                                  <TableCell className="py-2 text-xs text-slate-400 italic opacity-80">{item.depot}</TableCell>
                                  <TableCell className="py-2 text-xs font-medium text-slate-500">{fmt(item.quantity)} {item.uom}</TableCell>
                                  <TableCell className="py-2 text-xs font-bold text-slate-600">{fmtRs(item.amount)}</TableCell>
                                  <TableCell className="py-2">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase italic">{item.currentStage}</span>
                                  </TableCell>
                                  <TableCell className="py-2 text-[10px] text-slate-400 font-medium">
                                    {item.createdAt ? new Date(item.createdAt).toLocaleDateString("en-IN", { day: '2-digit', month: 'short' }) : '—'}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </Fragment>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="sm:hidden flex flex-col gap-2 p-3">
                      {groupOrders(ddOil).map((group: any, i: number) => (
                        <div key={i} className="border border-slate-100 rounded-xl overflow-hidden transition-all">
                          <div 
                            onClick={() => toggleGroup(group.orderNo)}
                            className="p-3 cursor-pointer hover:bg-teal-50/20"
                          >
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <span className="font-black text-indigo-600 font-mono text-sm">{group.orderNo} {group.items.length > 1 && <span className="text-[10px] text-slate-400">({group.items.length})</span>}</span>
                              <Badge className={`text-[9px] font-black border-none px-2 py-0.5 shrink-0 ${group.status === 'completed' ? 'bg-emerald-50 text-emerald-700' : 'bg-teal-50 text-teal-700'}`}>{group.currentStage}</Badge>
                            </div>
                            <div className="text-xs font-semibold text-slate-800 truncate">{group.customer}</div>
                            <div className="flex justify-between mt-1.5 text-[10px] font-bold text-slate-400">
                              <span>{group.skuName || '—'} · {fmt(group.quantity)} {group.uom}</span>
                              <span className="text-indigo-600">{fmtRs(group.amount)}</span>
                            </div>
                          </div>
                          {expandedGroups[group.orderNo] && group.items.length > 1 && (
                            <div className="bg-teal-50/30 p-2 border-t border-slate-100 flex flex-col gap-2">
                              {group.items.map((item: any, ii: number) => (
                                <div key={ii} onClick={() => setDrillDown({ type: 'order', key: item.orderNo, title: `Order Journey — ${item.orderNo}` })} className="bg-white p-2 rounded-lg border border-teal-100 flex justify-between items-center">
                                  <span className="text-[10px] font-bold text-indigo-400 font-mono">{item.orderNo}</span>
                                  <span className="text-[10px] font-black text-slate-600">{fmtRs(item.amount)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </ScrollArea>
            )
          )}

        </div>
      </DialogContent>
    </Dialog>
    </>
  )
}

// ── Helper sub-components ─────────────────────────────────────────
function DDLoader() {
  return (
    <div className="flex-1 flex items-center justify-center h-full py-20">
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin" />
        <span className="text-slate-400 text-sm font-medium">Loading data…</span>
      </div>
    </div>
  )
}
function DDEmpty({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full py-20 text-center px-4">
      <div className="h-14 w-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
        <FileText className="h-7 w-7 text-slate-300" />
      </div>
      <div className="font-bold text-slate-500">{label}</div>
    </div>
  )
}
