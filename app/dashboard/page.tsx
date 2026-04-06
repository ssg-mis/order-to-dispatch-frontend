"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  Activity, 
  CheckCircle2, 
  Clock, 
  FileText, 
  TrendingUp,
  Package,
  AlertCircle,
  RefreshCw
} from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { useQuery } from "@tanstack/react-query"
import { dashboardApi } from "@/lib/api-service"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"

export default function DashboardPage() {
  const { data: dashboardData, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const res = await dashboardApi.getStats()
      return res.success ? res.data : { stats: null, recentActivity: [] }
    },
  })

  const stats = dashboardData?.stats
  const recentActivity = dashboardData?.recentActivity || []

  if (error) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-destructive bg-destructive/10 p-8 rounded-2xl border border-destructive/20">
          <AlertCircle className="h-12 w-12" />
          <div className="text-center">
            <h2 className="text-xl font-bold">Failed to load dashboard</h2>
            <p className="text-sm opacity-80">Please check your connection and try again</p>
          </div>
          <Button variant="outline" onClick={() => refetch()} className="mt-2 border-destructive/50 text-destructive hover:bg-destructive/10">
            Retry Loading
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8 p-8 max-w-[1600px] mx-auto animate-in fade-in duration-700">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-slate-900">Dashboard</h1>
          <p className="text-slate-500 mt-1 font-medium">Monitoring your order dispatch workflow in real-time</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm font-bold text-slate-400 bg-slate-100 px-3 py-1 rounded-full">
            Last seen: {new Date().toLocaleTimeString()}
          </div>
          <Button 
            variant="outline" 
            size="icon" 
            onClick={() => refetch()} 
            disabled={isFetching}
            className="rounded-full hover:bg-indigo-50 hover:text-indigo-600 transition-all border-slate-200"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {[
          { title: "Total Orders", key: "totalOrders", icon: Package, color: "text-indigo-600", bg: "bg-indigo-50", desc: "Across all stages" },
          { title: "Pending Pre-Approval", key: "pendingPreApproval", icon: Clock, color: "text-orange-500", bg: "bg-orange-50", desc: "Awaiting Stage 1" },
          { title: "Pending Approval", key: "pendingApproval", icon: FileText, color: "text-blue-500", bg: "bg-blue-50", desc: "Awaiting Stage 2" },
          { title: "Completed", key: "completedOrders", icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-50", desc: "Processed orders" }
        ].map((item, idx) => (
          <Card key={idx} className="border-none shadow-sm bg-white overflow-hidden group hover:shadow-md transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-black uppercase tracking-wider text-slate-400">{item.title}</CardTitle>
              <div className={`p-2 rounded-xl ${item.bg} ${item.color}`}>
                <item.icon className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-9 w-20 mb-1" />
              ) : (
                <div className="text-3xl font-black text-slate-900 tabular-nums">
                  {stats?.[item.key] || 0}
                </div>
              )}
              <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-tighter">
                {item.desc}
              </p>
            </CardContent>
            <div className={`h-1 w-full absolute bottom-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${item.bg.replace('bg-', 'bg-')}`} style={{ backgroundColor: item.color.includes('indigo') ? '#4f46e5' : item.color.includes('orange') ? '#f97316' : item.color.includes('blue') ? '#3b82f6' : '#10b981' }} />
          </Card>
        ))}
      </div>

      {/* Recent Activity */}
      <Card className="border-none shadow-sm bg-white overflow-hidden">
        <CardHeader className="border-b border-slate-50 flex flex-row items-center justify-between bg-slate-50/50">
          <div>
            <CardTitle className="text-lg font-black text-slate-800">Recent Activity</CardTitle>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-tighter mt-0.5">Latest updates from the workflow</p>
          </div>
          <Activity className="h-5 w-5 text-indigo-500 opacity-50" />
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/30">
              <TableRow className="border-none">
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-8">Order No</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">Customer</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">Date</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400 pr-8">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array(5).fill(0).map((_, i) => (
                  <TableRow key={i} className="border-slate-50">
                    <TableCell className="pl-8"><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell className="pr-8"><Skeleton className="h-8 w-24 rounded-full" /></TableCell>
                  </TableRow>
                ))
              ) : recentActivity.length > 0 ? (
                recentActivity.map((order: any) => (
                  <TableRow key={order.id} className="group hover:bg-indigo-50/30 transition-colors border-slate-50">
                    <TableCell className="font-black text-slate-800 text-sm pl-8">{order.order_no}</TableCell>
                    <TableCell className="font-medium text-slate-600">{order.customer_name}</TableCell>
                    <TableCell className="text-slate-400 text-sm">{new Date(order.created_at).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}</TableCell>
                    <TableCell className="pr-8">
                      <Badge variant="outline" className={`rounded-full px-3 py-0.5 border-none font-black text-[10px] uppercase tracking-tighter ${
                        order.overall_status_of_order?.includes('Completed') ? 'bg-emerald-100 text-emerald-700' : 
                        order.overall_status_of_order?.includes('Pending') ? 'bg-orange-100 text-orange-700' : 'bg-indigo-100 text-indigo-700'
                      }`}>
                        {order.overall_status_of_order || 'Processing'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="h-40 text-center text-slate-400 font-bold">
                    <div className="flex flex-col items-center gap-2">
                       <Package className="h-8 w-8 opacity-20" />
                       No recent activity found
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
