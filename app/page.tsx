"use client"

import { useEffect, useState, useMemo } from "react"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { 
  Package, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight,
  TrendingUp,
  MoreHorizontal,
  FileBarChart,
  Truck,
  Activity,
  User,
  ShieldCheck,
  FileText,
  FileCheck,
  LogOut,
  ChevronRight,
  History,
  AlertTriangle,
  XCircle,
  BarChart3,
  Calendar,
  Layers,
  Zap,
  Filter,
  ChevronDown
} from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  Cell,
  AreaChart,
  Area
} from 'recharts'
import { useRouter } from "next/navigation"

// --- Constants ---

const STAGES = [
  { id: "Order Punch", label: "Order Punch", icon: FileBarChart, color: "text-blue-600", bg: "bg-blue-50", url: "/order-punch" },
  { id: "Pre-Approval", label: "Pre Approval", icon: ShieldCheck, color: "text-indigo-600", bg: "bg-indigo-50", url: "/pre-approval" }, // Mapping "Pre-Approval" to "Pre Approval"
  { id: "Approval Of Order", label: "Approval of Order", icon: FileCheck, color: "text-violet-600", bg: "bg-violet-50", url: "/approval-of-order" },
  { id: "Dispatch Planning", label: "Dispatch Planning", icon: Box, color: "text-purple-600", bg: "bg-purple-50", url: "/dispatch-material" },
  { id: "Actual Dispatch", label: "Actual Dispatch", icon: Send, color: "text-fuchsia-600", bg: "bg-fuchsia-50", url: "/actual-dispatch" },
  { id: "Vehicle Details", label: "Vehicle Details", icon: Car, color: "text-pink-600", bg: "bg-pink-50", url: "/vehicle-details" },
  { id: "Material Load", label: "Material Load", icon: Truck, color: "text-rose-600", bg: "bg-rose-50", url: "/material-load" },
  { id: "Security Approval", label: "Security Guard Approval", icon: ShieldCheck, color: "text-orange-600", bg: "bg-orange-50", url: "/security-approval" },
  { id: "Make Invoice", label: "Invoice (Proforma)", icon: FileText, color: "text-amber-600", bg: "bg-amber-50", url: "/make-invoice" },
  { id: "Check Invoice", label: "Check Invoice", icon: CheckCircle2, color: "text-yellow-600", bg: "bg-yellow-50", url: "/check-invoice" },
  { id: "Gate Out", label: "Gate Out", icon: LogOut, color: "text-lime-600", bg: "bg-lime-50", url: "/gate-out" },
  { id: "Material Receipt", label: "Confirm Material Receipt", icon: Package, color: "text-emerald-600", bg: "bg-emerald-50", url: "/material-receipt" },
  { id: "Damage Adjustment", label: "Damage Adjustment", icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50", url: "/damage-adjustment" },
  { id: "Final Delivery", label: "Final Delivery", icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50", url: "/" }
]

// Icons were missing from my import, let's add them
import { Package as Box, Send, Car } from "lucide-react"

const ROLES = [
  { id: "admin", label: "Admin", description: "Full visibility and control" },
  { id: "approver", label: "Approver", description: "Pre-approvals & Order approvals" },
  { id: "dispatcher", label: "Dispatcher", description: "Planning, Logistics & Loading" },
  { id: "security", label: "Security", description: "Gate Entry & Exit" },
  { id: "finance", label: "Finance", description: "Invoicing & Payments" }
]

const ROLE_STAGE_MAPPING: Record<string, string[]> = {
  admin: STAGES.map(s => s.id),
  approver: ["Pre-Approval", "Approval Of Order"],
  dispatcher: ["Dispatch Planning", "Actual Dispatch", "Vehicle Details", "Material Load"],
  security: ["Security Approval", "Gate Out"],
  finance: ["Make Invoice", "Check Invoice"]
}

// --- Dashboard Component ---

export default function Dashboard() {
  const router = useRouter()
  const [role, setRole] = useState("admin")
  const [timeRange, setTimeRange] = useState("today") 
  const [history, setHistory] = useState<any[]>([])
  const [lastSync, setLastSync] = useState(new Date())
  const [isMounted, setIsMounted] = useState(false)
  const [isPendingDialogOpen, setIsPendingDialogOpen] = useState(false)
  const [isCompletedDialogOpen, setIsCompletedDialogOpen] = useState(false)
  const [isDispatchDialogOpen, setIsDispatchDialogOpen] = useState(false)
  const [isDamagesDialogOpen, setIsDamagesDialogOpen] = useState(false)
  const [isInvoicesDialogOpen, setIsInvoicesDialogOpen] = useState(false)
  const [isDelayedDialogOpen, setIsDelayedDialogOpen] = useState(false)
  const [isRejectedDialogOpen, setIsRejectedDialogOpen] = useState(false)
  const [isTotalDialogOpen, setIsTotalDialogOpen] = useState(false)
  const [backendData, setBackendData] = useState<any>(null)

  useEffect(() => {
    setIsMounted(true)
    
    const loadData = async () => {
        try {
            // Fetch from backend API
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api/v1'}/dashboard/overview`)
            if (response.ok) {
                const result = await response.json()
                if (result.success) {
                    setBackendData(result.data)
                    
                    // Transform backend data to history format for compatibility
                    const transformedHistory = result.data.recentOrders || []
                    setHistory(transformedHistory)
                }
            }
            
            // Load User Role from localStorage
            const storedRole = localStorage.getItem("userRole")
            if (storedRole) {
                setRole(storedRole)
            }
        } catch (error) {
            console.error("Failed to fetch dashboard data:", error)
        }
    }

    loadData() // Initial load

    const interval = setInterval(() => {
        loadData()
        setLastSync(new Date())
    }, 5000) // Polling every 5s for "Real-time" feel
    
    return () => clearInterval(interval)
  }, [])

  // Process Data
  const stats = useMemo(() => {
    // If we have backend data, use it directly
    if (backendData) {
      return {
        total: backendData.total || 0,
        active: backendData.active || 0,
        completed: backendData.completed || 0,
        delayed: backendData.delayed || 0,
        cancelled: backendData.cancelled || 0,
        stageCounts: backendData.stageCounts || [],
        attentionItems: backendData.attentionItems || [],
        recentOrders: backendData.recentOrders || [],
        createdToday: backendData.createdToday || 0,
        dispatchedToday: backendData.dispatchedToday || 0,
        invoicedToday: backendData.invoicedToday || 0,
        deliveredToday: backendData.deliveredToday || 0,
        chartData: (backendData.stageCounts || []).map((s: any) => ({ name: s.label, count: s.count })),
        timelineData: [],  // Can be enhanced later
        pendingOrdersList: backendData.recentOrders?.filter((o: any) => o.status === 'pending') || [],
        completedOrdersList: backendData.recentOrders?.filter((o: any) => o.status === 'completed') || [],
        dispatchPlanningList: [],
        damagesOrdersList: [],
        invoicesOrdersList: [],
        delayedOrdersList: [],
        cancelledOrdersList: [],
        totalOrdersList: backendData.recentOrders || []
      }
    }

    // Fallback to empty stats if no backend data yet
    return {
      total: 0,
      active: 0,
      completed: 0,
      delayed: 0,
      cancelled: 0,
      stageCounts: STAGES.map(s => ({ ...s, count: 0, pending: 0, completed: 0 })),
      attentionItems: [],
      recentOrders: [],
      createdToday: 0,
      dispatchedToday: 0,
      invoicedToday: 0,
      deliveredToday: 0,
      chartData: [],
      timelineData: [],
      pendingOrdersList: [],
      completedOrdersList: [],
      dispatchPlanningList: [],
      damagesOrdersList: [],
      invoicesOrdersList: [],
      delayedOrdersList: [],
      cancelledOrdersList: [],
      totalOrdersList: []
    }
  }, [backendData])



  // Component logic
  const visibleStages = useMemo(() => {
    const IMPORTANT_STAGES = [
        "Order Punch", 
        "Actual Dispatch", 
        "Material Load", 
        "Material Receipt", 
        "Damage Adjustment"
    ]
    return stats.stageCounts.filter(s => 
        ROLE_STAGE_MAPPING[role].includes(s.id) && IMPORTANT_STAGES.includes(s.id)
    )
  }, [role, stats.stageCounts])

  return (
    <div className="p-8 max-w-[1600px] mx-auto min-h-screen space-y-8 animate-in fade-in duration-700">
      
      {/* Header with Role & Time Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-100 pb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <SidebarTrigger className="-ml-1" />
            <h1 className="text-4xl font-black tracking-tight text-slate-900">
               Dashboard
            </h1>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-100/50">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600">Live Status</span>
            </div>
          </div>
          <p className="text-base text-slate-500 font-medium flex items-center gap-2">
            OMS Enterprise Operational Overview
            <span className="h-4 w-px bg-slate-200 mx-1" />
            <span className="text-slate-400 text-sm" suppressHydrationWarning>
                Last Synced: {isMounted ? lastSync.toLocaleTimeString() : "--:--:--"}
            </span>
          </p>
        </div>
        
        <div className="flex items-center gap-4 group cursor-pointer self-start md:self-center">
            <div className="flex flex-col items-end text-right hidden sm:flex">
                <span className="text-base font-black text-slate-900 capitalize tracking-tight leading-none">
                    {role || "Administrator"}
                </span>
            </div>
            <div className="relative">
                <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center group-hover:bg-white group-hover:shadow-lg group-hover:border-primary/20 transition-all duration-300">
                    <User className="h-6 w-6 text-slate-400 group-hover:text-primary transition-colors" />
                </div>
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full shadow-sm" />
            </div>
        </div>
      </div>

      {/* Top KPI Cards (Global Metrics) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
        <KPIBox 
            title="Total Orders" 
            value={stats.total} 
            icon={Package} 
            color="indigo" 
            trend="Total"
        />
        <KPIBox 
            title="Active Orders" 
            value={stats.active} 
            icon={Activity} 
            color="amber" 
            trend="In Progress"
        />
        <KPIBox 
            title="Completed" 
            value={stats.completed} 
            icon={CheckCircle2} 
            color="emerald" 
            trend="Fulfilled"
        />
        <KPIBox 
            title="Delayed / Attention" 
            value={stats.delayed} 
            icon={AlertTriangle} 
            color="rose" 
            trend="Review SLA"
            alert={stats.delayed > 0}
        />
        <KPIBox 
            title="Rejected" 
            value={stats.cancelled} 
            icon={XCircle} 
            color="slate" 
            trend="Failed"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Stage-Wise Pipeline Overview (Column Span 12) */}
        <Card className="lg:col-span-12 shadow-xl border-none rounded-2xl overflow-hidden bg-white/70 backdrop-blur-xl border border-white/20">
            <CardHeader className="border-b bg-slate-50/50 flex flex-row items-center justify-between py-4 px-6">
                <div>
                    <CardTitle className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <Layers className="h-5 w-5 text-primary" />
                        Order Overview
                    </CardTitle>
                </div>
                <div className="flex gap-2 items-center">
                    <Tabs value={timeRange} onValueChange={setTimeRange} className="w-auto">
                        <TabsList className="bg-slate-200/50 backdrop-blur-md h-10 p-1 gap-1 rounded-xl border border-slate-300/50 shadow-inner">
                            <TabsTrigger 
                                value="today" 
                                className="rounded-lg px-4 text-[10px] font-black uppercase tracking-[0.15em] h-8 transition-all duration-300 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-lg data-[state=active]:scale-105 active:scale-95 text-slate-500 hover:text-slate-900"
                            >
                                Today
                            </TabsTrigger>
                            <TabsTrigger 
                                value="week" 
                                className="rounded-lg px-4 text-[10px] font-black uppercase tracking-[0.15em] h-8 transition-all duration-300 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-lg data-[state=active]:scale-105 active:scale-95 text-slate-500 hover:text-slate-900"
                            >
                                This Week
                            </TabsTrigger>
                            <TabsTrigger 
                                value="month" 
                                className="rounded-lg px-4 text-[10px] font-black uppercase tracking-[0.15em] h-8 transition-all duration-300 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-lg data-[state=active]:scale-105 active:scale-95 text-slate-500 hover:text-slate-900"
                            >
                                Month
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>
            </CardHeader>
            <CardContent className="p-6">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                        {/* Pending Order Card */}
                        <div 
                            onClick={() => setIsPendingDialogOpen(true)}
                            className="bg-amber-50/50 rounded-2xl p-5 border border-amber-100 flex flex-col justify-between hover:shadow-lg transition-all cursor-pointer min-h-[160px]"
                        >
                            <div className="flex justify-between items-start">
                                <div className="p-2.5 bg-white rounded-xl shadow-sm border border-amber-200">
                                    <Activity className="h-5 w-5 text-amber-600" />
                                </div>
                                <Badge variant="outline" className="text-[10px] font-black uppercase text-amber-700 bg-amber-100/50 border-amber-200">Live Status</Badge>
                            </div>
                            <div>
                                <h4 className="text-4xl font-black text-slate-800 tracking-tighter">{stats.active}</h4>
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Pending Orders</p>
                            </div>
                        </div>

                        {/* Complete Order Card */}
                        <div 
                            onClick={() => setIsCompletedDialogOpen(true)}
                            className="bg-emerald-50/50 rounded-2xl p-5 border border-emerald-100 flex flex-col justify-between hover:shadow-lg transition-all cursor-pointer min-h-[160px]"
                        >
                            <div className="flex justify-between items-start">
                                <div className="p-2.5 bg-white rounded-xl shadow-sm border border-emerald-200">
                                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                                </div>
                                <Badge variant="outline" className="text-[10px] font-black uppercase text-emerald-700 bg-emerald-100/50 border-emerald-200">Success</Badge>
                            </div>
                            <div>
                                <h4 className="text-4xl font-black text-slate-800 tracking-tighter">{stats.completed}</h4>
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Complete Orders</p>
                            </div>
                        </div>

                        {/* Dispatch Planning Card */}
                        <div 
                            onClick={() => setIsDispatchDialogOpen(true)}
                            className="bg-indigo-50/50 rounded-2xl p-5 border border-indigo-100 flex flex-col justify-between hover:shadow-lg transition-all cursor-pointer min-h-[160px]"
                        >
                            <div className="flex justify-between items-start">
                                <div className="p-2.5 bg-white rounded-xl shadow-sm border border-indigo-200">
                                    <Layers className="h-5 w-5 text-indigo-600" />
                                </div>
                                <div className="flex flex-col gap-1 items-end">
                                    <span className="text-[9px] font-black text-indigo-500 uppercase">Planning Stage</span>
                                </div>
                            </div>
                            <div className="flex items-end justify-between">
                                <div>
                                    <h4 className="text-4xl font-black text-slate-800 tracking-tighter">
                                        {(stats.stageCounts.find(s => s.id === "Dispatch Planning")?.pending || 0) + (stats.stageCounts.find(s => s.id === "Dispatch Planning")?.completed || 0)}
                                    </h4>
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Dispatch Planning</p>
                                </div>
                                <div className="flex flex-col gap-1 mb-1">
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                        <span className="text-[10px] font-bold text-slate-500">P: {stats.stageCounts.find(s => s.id === "Dispatch Planning")?.pending || 0}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                        <span className="text-[10px] font-bold text-slate-500">C: {stats.stageCounts.find(s => s.id === "Dispatch Planning")?.completed || 0}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Damages Card */}
                        <div 
                            onClick={() => setIsDamagesDialogOpen(true)}
                            className="bg-rose-50/50 rounded-2xl p-5 border border-rose-100 flex flex-col justify-between hover:shadow-lg transition-all cursor-pointer min-h-[160px]"
                        >
                            <div className="flex justify-between items-start">
                                <div className="p-2.5 bg-white rounded-xl shadow-sm border border-rose-200">
                                    <AlertTriangle className="h-5 w-5 text-rose-600" />
                                </div>
                                <Badge variant="destructive" className="text-[10px] font-black uppercase bg-rose-500 hover:bg-rose-600">Critical</Badge>
                            </div>
                            <div>
                                <h4 className="text-4xl font-black text-slate-800 tracking-tighter">
                                    {stats.stageCounts.find(s => s.id === "Damage Adjustment")?.count || 0}
                                </h4>
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Damages (Count)</p>
                            </div>
                        </div>

                        {/* Payments Card */}
                        <div 
                            onClick={() => setIsInvoicesDialogOpen(true)}
                            className="bg-violet-50/50 rounded-2xl p-5 border border-violet-100 flex flex-col justify-between hover:shadow-lg transition-all cursor-pointer min-h-[160px]"
                        >
                            <div className="flex justify-between items-start">
                                <div className="p-2.5 bg-white rounded-xl shadow-sm border border-violet-200">
                                    <FileText className="h-5 w-5 text-violet-600" />
                                </div>
                                <Badge variant="outline" className="text-[10px] font-black uppercase text-violet-700 bg-violet-100/50 border-violet-200 px-2 py-0.5">Payment</Badge>
                            </div>
                            <div>
                                <h4 className="text-4xl font-black text-slate-800 tracking-tighter">
                                    {stats.stageCounts.find(s => s.id === "Make Invoice")?.completed || 0}
                                </h4>
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Total Payment</p>
                            </div>
                        </div>
                    </div>

                    {/* System Pending Table Section */}
                    <div className="lg:col-span-4 bg-slate-50/50 rounded-2xl border border-slate-200 overflow-hidden flex flex-col">
                        <div className="bg-slate-100/80 px-4 py-2 border-b border-slate-200 flex justify-between items-center">
                            <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider">System Stage Overview</span>
                        </div>
                        <ScrollArea className="h-[340px]">
                            <Table>
                                <TableHeader className="bg-white/50 sticky top-0 z-10 backdrop-blur-sm">
                                    <TableRow className="hover:bg-transparent border-b border-slate-200">
                                        <TableHead className="h-8 text-[10px] font-black uppercase text-slate-500 py-0 pl-4">Stage Name</TableHead>
                                        <TableHead className="h-8 text-[10px] font-black uppercase text-amber-600 py-0 text-center">Pending</TableHead>
                                        <TableHead className="h-8 text-[10px] font-black uppercase text-emerald-600 py-0 text-right pr-4">Done</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {stats.stageCounts.map((s, i) => (
                                        <TableRow key={i} className="hover:bg-white/80 transition-colors border-b border-slate-100/50">
                                            <TableCell className="py-2 pl-4 text-[11px] font-bold text-slate-600">{s.label}</TableCell>
                                            <TableCell className="py-2 text-center text-[11px] font-black text-amber-600 bg-amber-50/30">{s.pending}</TableCell>
                                            <TableCell className="py-2 text-right pr-4 text-[11px] font-black text-emerald-600 bg-emerald-50/30">{s.completed}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </ScrollArea>
                    </div>
                </div>
            </CardContent>
        </Card>

        {/* Live Order Tracker */}
        <Card className="lg:col-span-12 shadow-xl border-none rounded-2xl overflow-hidden bg-white">
            <CardHeader className="border-b pt-3 pb-5 px-8 flex flex-row items-center justify-between">
                <div>
                   <CardTitle className="text-xl font-bold text-slate-800 flex items-center gap-2">
                     <Zap className="h-5 w-5 text-amber-500" /> Live Order Journey Tracker
                   </CardTitle>
                </div>
            </CardHeader>
            <ScrollArea className="h-[350px]">
                <div className="p-0">
                    <Table>
                        <TableHeader className="bg-slate-50/50">
                            <TableRow>
                                <TableHead className="pl-8 font-bold text-slate-600">DO Number</TableHead>
                                <TableHead className="font-bold text-slate-600">Current Stage</TableHead>
                                <TableHead className="font-bold text-slate-600">Progress</TableHead>
                                <TableHead className="pr-8 text-right font-bold text-slate-600">Last Active</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {stats.recentOrders.map((order, i) => {
                                const stageIndex = STAGES.findIndex(s => s.id === order.stage)
                                const progress = Math.round(((stageIndex + 1) / STAGES.length) * 100)
                                return (
                                    <TableRow key={i} className="group hover:bg-slate-50/80 transition-all border-b border-slate-50">
                                        <TableCell className="pl-8 py-5">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-slate-800">{order.soNumber || order.doNumber || order.orderNo}</span>
                                                <span className="text-xs text-slate-400 font-medium">{order.customerName || "N/A"}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <div className={`h-2 w-2 rounded-full animate-pulse bg-emerald-500`} />
                                                <span className="font-semibold text-slate-700">{order.stage}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="w-[200px]">
                                            <div className="space-y-1.5">
                                                <div className="flex justify-between items-center text-[10px] uppercase font-bold text-slate-500">
                                                    <span>{progress}% Completed</span>
                                                </div>
                                                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden shadow-inner">
                                                    <div 
                                                        className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-1000"
                                                        style={{ width: `${progress}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="pr-8 text-right">
                                            <span className="text-sm font-medium text-slate-500" suppressHydrationWarning>
                                                {formatTime(order.timestamp || order.date)}
                                            </span>
                                        </TableCell>
                                    </TableRow>
                                )
                            })}
                            {stats.recentOrders.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center py-20 text-slate-400 font-medium">
                                        No active orders found
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </ScrollArea>
        </Card>


        {/* Today's Activity Snapshot & Charts */}
        <div className="lg:col-span-12 grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Snapshot */}
            <Card className="shadow-xl border-none rounded-2xl overflow-hidden bg-white/40 backdrop-blur-md border border-white/20">
                <CardHeader className="py-6 px-8">
                    <CardTitle className="text-xl font-bold flex items-center gap-2">
                        <Calendar className="h-5 w-5 text-primary" /> Today's Activity Snapshot
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-8 pt-0">
                    <div className="grid grid-cols-2 gap-4">
                        <ActivitySmallBox label="Created" count={stats.createdToday} icon={Plus} color="blue" />
                        <ActivitySmallBox label="Dispatched" count={stats.dispatchedToday} icon={Send} color="amber" />
                        <ActivitySmallBox label="Invoiced" count={stats.invoicedToday} icon={FileText} color="purple" />
                        <ActivitySmallBox label="Delivered" count={stats.deliveredToday} icon={CheckCircle2} color="emerald" />
                    </div>
                    

                </CardContent>
            </Card>

            {/* Performance Charts */}
            <Card className="shadow-xl border-none rounded-2xl overflow-hidden bg-white">
                <CardHeader className="py-6 px-8 flex flex-row items-center justify-between">
                    <CardTitle className="text-xl font-bold flex items-center gap-2">
                        <BarChart3 className="h-5 w-5 text-primary" /> Weekly View
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-6 h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={stats.timelineData} margin={{ left: 25, right: 25, top: 10, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis 
                                dataKey="name" 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{fill: '#94a3b8', fontSize: 12, fontWeight: 600}} 
                                dy={10}
                                interval={0}
                                padding={{ left: 10, right: 10 }}
                            />
                            <YAxis hide domain={[0, 'auto']} />
                            <Tooltip 
                                contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 'bold'}}
                            />
                            <Area 
                                type="monotone" 
                                dataKey="count" 
                                stroke="#3b82f6" 
                                strokeWidth={4}
                                fillOpacity={1} 
                                fill="url(#colorCount)" 
                                animationDuration={2000}
                             />
                        </AreaChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

        </div>

      </div>

      <Dialog open={isPendingDialogOpen} onOpenChange={setIsPendingDialogOpen}>
        <OrderListPopup 
            title="Pending Orders" 
            icon={<Activity className="h-4 w-4 text-white" />}
            orders={stats.pendingOrdersList}
            colorClass="bg-primary"
            showStage={true}
            onClose={() => setIsPendingDialogOpen(false)}
        />
      </Dialog>

      <Dialog open={isCompletedDialogOpen} onOpenChange={setIsCompletedDialogOpen}>
        <OrderListPopup 
            title="Completed Orders" 
            icon={<CheckCircle2 className="h-4 w-4 text-white" />}
            orders={stats.completedOrdersList}
            colorClass="bg-emerald-500"
            hideTypeSubtext={true}
            onClose={() => setIsCompletedDialogOpen(false)}
        />
      </Dialog>

      <Dialog open={isDispatchDialogOpen} onOpenChange={setIsDispatchDialogOpen}>
        <OrderListPopup 
            title="Dispatch Planning" 
            icon={<Layers className="h-4 w-4 text-white" />}
            orders={stats.dispatchPlanningList}
            colorClass="bg-indigo-500"
            onClose={() => setIsDispatchDialogOpen(false)}
        />
      </Dialog>

      <Dialog open={isDamagesDialogOpen} onOpenChange={setIsDamagesDialogOpen}>
        <OrderListPopup 
            title="Damaged Orders" 
            icon={<AlertTriangle className="h-4 w-4 text-white" />}
            orders={stats.damagesOrdersList}
            colorClass="bg-rose-500"
            onClose={() => setIsDamagesDialogOpen(false)}
        />
      </Dialog>

      <Dialog open={isInvoicesDialogOpen} onOpenChange={setIsInvoicesDialogOpen}>
        <OrderListPopup 
            title="Invoice Tracking" 
            icon={<FileText className="h-4 w-4 text-white" />}
            orders={stats.invoicesOrdersList}
            colorClass="bg-violet-500"
            onClose={() => setIsInvoicesDialogOpen(false)}
        />
      </Dialog>

      <Dialog open={isDelayedDialogOpen} onOpenChange={setIsDelayedDialogOpen}>
        <OrderListPopup 
            title="Delayed Orders" 
            icon={<AlertTriangle className="h-4 w-4 text-white" />}
            orders={stats.delayedOrdersList}
            colorClass="bg-rose-500"
            onClose={() => setIsDelayedDialogOpen(false)}
        />
      </Dialog>

      <Dialog open={isRejectedDialogOpen} onOpenChange={setIsRejectedDialogOpen}>
        <OrderListPopup 
            title="Rejected Orders" 
            icon={<XCircle className="h-4 w-4 text-white" />}
            orders={stats.cancelledOrdersList}
            colorClass="bg-slate-500"
            onClose={() => setIsRejectedDialogOpen(false)}
        />
      </Dialog>

      <Dialog open={isTotalDialogOpen} onOpenChange={setIsTotalDialogOpen}>
        <OrderListPopup 
            title="All Orders" 
            icon={<Package className="h-4 w-4 text-white" />}
            orders={stats.totalOrdersList}
            colorClass="bg-indigo-500"
            onClose={() => setIsTotalDialogOpen(false)}
        />
      </Dialog>

      <div className="flex items-center justify-center pt-12 border-t border-slate-100 opacity-100">
           <p className="text-[10px] font-black text-slate-1000 uppercase tracking-[0.5em] hover:text-primary transition-colors cursor-default">
             Powered by Botivate
           </p>
      </div>

    </div>
  )
}

// --- Sub-components ---

function KPIBox({ title, value, icon: Icon, color, trend, active = false, alert = false, onClick }: any) {
    const colorMap: any = {
        indigo: "text-indigo-600 bg-indigo-50/50 border-indigo-100",
        amber: "text-amber-600 bg-amber-50/50 border-amber-100",
        emerald: "text-emerald-600 bg-emerald-50/50 border-emerald-100",
        rose: "text-rose-600 bg-rose-50/50 border-rose-100",
        slate: "text-slate-600 bg-slate-50/50 border-slate-100"
    }

    return (
        <Card 
            onClick={onClick}
            className={`group relative overflow-hidden border border-slate-200 shadow-sm rounded-2xl transition-all duration-300 hover:shadow-xl hover:border-primary/20 cursor-pointer bg-white/50 backdrop-blur-sm ${active ? 'ring-2 ring-primary ring-offset-2' : ''}`}
        >
            <CardContent className="p-4">
                <div className="flex justify-between items-start mb-3">
                    <div className={`p-2.5 rounded-xl ${colorMap[color]} border transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-3`}>
                        <Icon className="h-5 w-5" />
                    </div>
                    <div className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-wider ${alert ? 'bg-rose-500 text-white animate-pulse' : 'bg-slate-100 text-slate-500'}`}>
                        {trend}
                    </div>
                </div>
                <div className="space-y-1">
                   <h3 className="text-2xl font-black text-slate-900 tracking-tight leading-none">{value}</h3>
                   <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 group-hover:text-primary transition-colors">{title}</p>
                </div>
                
                {/* Subtle Background Accent */}
                <div className={`absolute -right-4 -bottom-4 w-24 h-24 rounded-full opacity-[0.03] group-hover:opacity-[0.08] transition-opacity duration-500 ${colorMap[color].split(' ')[1]}`} />
            </CardContent>
        </Card>
    )
}

function StageCard({ stage, totalOrders, onClick }: any) {
    const percentage = totalOrders > 0 ? Math.round((stage.count / totalOrders) * 100) : 0
    const pendingCount = stage.count
    const successCount = stage.completed
    const grandTotal = pendingCount + successCount

    return (
        <div 
            onClick={onClick}
            className="flex flex-col p-4 rounded-2xl border-2 border-slate-50 bg-white hover:border-primary/20 hover:shadow-xl transition-all duration-300 group cursor-pointer relative overflow-hidden active:scale-95 h-full justify-between"
        >
            <div className="flex justify-between items-start mb-2">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 group-hover:scale-110 ${stage.bg} ${stage.color} shadow-sm`}>
                    <stage.icon className="h-6 w-6" />
                </div>
                {stage.overdue > 0 && (
                    <Badge variant="destructive" className="rounded-full px-2 py-0.5 h-6 text-[10px] flex items-center gap-1 animate-pulse">
                         <AlertCircle className="h-3 w-3" /> {stage.overdue}
                    </Badge>
                )}
            </div>
            
            <div className="mb-2 relative z-10 flex flex-col items-center text-center space-y-2">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400 group-hover:text-primary/80 transition-colors w-full">{stage.label}</p>
                <div className="flex items-center justify-center">
                    <h3 className="text-4xl font-black text-slate-800 tracking-tighter">
                        {stage.breakdown ? stage.breakdown.total : grandTotal}
                    </h3>
                </div>
            </div>

            <div className="mt-auto space-y-2">
                <div className="flex justify-around items-center bg-slate-50 rounded-lg p-2 border border-slate-100">
                    {stage.breakdown ? (
                        <>
                             <div className="flex flex-col items-center">
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">{stage.breakdown.label1}</span>
                                <span className="text-sm font-black text-indigo-600">{stage.breakdown.value1}</span>
                             </div>
                             <div className="h-6 w-px bg-slate-200"></div>
                             <div className="flex flex-col items-center">
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">{stage.breakdown.label2}</span>
                                <span className="text-sm font-black text-blue-600">{stage.breakdown.value2}</span>
                             </div>
                        </>
                    ) : (
                        <>
                             <div className="flex flex-col items-center">
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Success</span>
                                <span className="text-sm font-black text-emerald-500">{successCount}</span>
                             </div>
                             <div className="h-6 w-px bg-slate-200"></div>
                             <div className="flex flex-col items-center">
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Pending</span>
                                <span className="text-sm font-black text-amber-500">{pendingCount}</span>
                             </div>
                        </>
                    )}
                </div>

            </div>
        </div>
    )
}

function ActivitySmallBox({ label, count, icon: Icon, color }: any) {
    const colors: any = {
        blue: "text-blue-600 bg-blue-50",
        amber: "text-amber-600 bg-amber-50",
        purple: "text-purple-600 bg-purple-50",
        emerald: "text-emerald-600 bg-emerald-50"
    }

    return (
        <div className="flex items-center gap-4 p-4 rounded-2xl bg-white border border-slate-50 shadow-sm hover:shadow-md transition-all cursor-default group">
            <div className={`h-10 w-10 flex items-center justify-center rounded-xl shadow-inner group-hover:scale-110 transition-transform ${colors[color]}`}>
                <Icon className="h-5 w-5" />
            </div>
            <div>
                <p className="text-xl font-black text-slate-800">{count}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
            </div>
        </div>
    )
}

// --- Helpers ---

const formatTime = (isoString?: string) => {
    if (!isoString) return "N/A"
    const date = new Date(isoString)
    const diff = (new Date().getTime() - date.getTime()) / 60000 // minutes
    
    if (diff < 1) return "Just now"
    if (diff < 60) return `${Math.floor(diff)}m ago`
    if (diff < 1440) return `${Math.floor(diff/60)}h ago`
    return date.toLocaleDateString()
}

const calculateDelay = (isoString?: string) => {
    if (!isoString) return "0h"
    const date = new Date(isoString)
    const hours = (new Date().getTime() - date.getTime()) / 3600000
    if (hours < 1) return `${Math.floor(hours * 60)}m`
    return `${Math.floor(hours)}h`
}

function OrderListPopup({ title, icon, orders, colorClass, onClose, showStage = false, hideTypeSubtext = false }: any) {
    const router = useRouter()
    return (
        <DialogContent className="max-w-[750px] p-0 overflow-hidden rounded-3xl border border-blue-100 shadow-2xl bg-white">
            <DialogHeader className="p-6 pb-4 flex flex-row items-center justify-between border-b border-blue-50 bg-slate-50/30">
                <div className="space-y-1">
                    <DialogTitle className="text-xl font-black text-slate-900 flex items-center gap-3 tracking-tight">
                        <div className={`p-2 ${colorClass} rounded-xl shadow-lg`}>
                            {icon}
                        </div>
                        {title}
                    </DialogTitle>
                </div>
                <div className="flex items-center gap-4 mr-4">
                    <div className="px-4 py-2 rounded-2xl bg-blue-50/50 border border-blue-100/50 flex items-center gap-3">
                         <div className="flex flex-col">
                            <span className="text-[8px] font-black text-blue-400 uppercase tracking-widest leading-none">Total Items</span>
                            <span className="text-lg font-black text-primary leading-none mt-1">{orders.length}</span>
                         </div>
                         <Package className="h-4 w-4 text-primary/60" />
                    </div>
                </div>
            </DialogHeader>

            <div className="p-0">
                <ScrollArea className="h-[350px]">
                    <div className="w-full">
                        <Table>
                            <TableHeader className="bg-blue-50/30 sticky top-0 z-10 backdrop-blur-sm">
                                <TableRow className="border-b border-blue-100/30">
                                    <TableHead className="pl-6 py-3 text-[9px] font-black uppercase text-blue-600/60 tracking-wider w-1/3">Order Number</TableHead>
                                    <TableHead className="py-3 text-[9px] font-black uppercase text-blue-600/60 tracking-wider w-[30%] text-center">Customer Name</TableHead>
                                    <TableHead className="pr-6 py-3 text-[9px] font-black uppercase text-blue-600/60 tracking-wider text-right w-[36%]">
                                        {showStage ? "Current Stage" : "Order Type"}
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {orders.map((order: any, i: number) => {
                                    const stageInfo = STAGES.find(s => s.id === order.stage) || STAGES[0]
                                    const displayOrderNo = order.soNumber || order.doNumber || order.orderNo || "N/A"
                                    const rawType = (order.orderType || "").toLowerCase()
                                    const isPreApproval = rawType.includes("pre") && rawType.includes("approval")
                                    const typeLabel = isPreApproval ? "Pre-Approval" : "Regular"
                                    
                                    return (
                                        <TableRow 
                                            key={i} 
                                            className="group hover:bg-blue-50/20 transition-all border-b border-slate-50/50 cursor-pointer"
                                            onClick={() => {
                                                const stageUrl = STAGES.find(s => s.id === order.stage)?.url || "/"
                                                router.push(stageUrl)
                                                onClose()
                                            }}
                                        >
                                            <TableCell className="pl-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="font-extrabold text-slate-950 text-[13px] tracking-tight group-hover:text-primary transition-colors">{displayOrderNo}</span>
                                                    {!hideTypeSubtext && (
                                                        <span className={`text-[9px] font-bold uppercase tracking-tight ${isPreApproval ? 'text-indigo-500' : 'text-slate-400'}`}>
                                                            {typeLabel}
                                                        </span>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="py-4 text-center">
                                                <span className="text-[13px] text-slate-700 font-bold tracking-tight">{order.customerName || "External Client"}</span>
                                            </TableCell>
                                            <TableCell className="pr-6 py-4 text-right">
                                                {showStage ? (
                                                    <div className="flex items-center justify-end gap-2">
                                                        <div className={`w-1.5 h-1.5 rounded-full ${stageInfo.color.replace('text-', 'bg-')} shadow-[0_0_6px_rgba(59,130,246,0.2)]`} />
                                                        <span className={`${stageInfo.color} font-black text-[9px] uppercase tracking-wider`}>
                                                            {order.stage}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className={`text-[10px] font-black uppercase tracking-wider ${
                                                        isPreApproval 
                                                        ? 'text-indigo-600' 
                                                        : 'text-slate-500'
                                                    }`}>
                                                        {typeLabel}
                                                    </span>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}
                                {orders.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={3} className="text-center py-20">
                                            <div className="flex flex-col items-center gap-3 opacity-20">
                                                <Package className="h-10 w-10 text-blue-200" />
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No Items Found</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </ScrollArea>
            </div>
        </DialogContent>
    )
}

import { Plus } from "lucide-react"
