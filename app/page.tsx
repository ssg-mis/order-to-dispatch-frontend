"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
  Activity
} from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"

// --- Types & Helpers ---
type OrderStatus = "In Progress" | "Completed" | "Approved" | "Damaged" | "Delivered"

const getOrderState = (lastStage: string, lastStatus: string): OrderStatus => {
  if (lastStage === "Damage Adjustment") return "Damaged"
  if (lastStage === "Material Receipt" && lastStatus === "Delivered") return "Delivered"
  if (lastStage === "Material Receipt" && lastStatus === "Damaged") return "Damaged"
  return "In Progress"
}

export default function Dashboard() {
  const [metrics, setMetrics] = useState({
    total: 0,
    active: 0,
    completed: 0,
    damaged: 0
  })
  
  const [pipelineData, setPipelineData] = useState([
    { title: "Approvals & Entry", count: 0, color: "bg-blue-500", icon: FileBarChart },
    { title: "Dispatch & Loading", count: 0, color: "bg-orange-500", icon: Truck },
    { title: "Invoice & Gate", count: 0, color: "bg-indigo-500", icon: CheckCircle2 },
    { title: "Final Delivery", count: 0, color: "bg-emerald-500", icon: Package }
  ])

  const [recentActivity, setRecentActivity] = useState<any[]>([])
  const [actionItems, setActionItems] = useState<any[]>([])

  useEffect(() => {
    const rawHistory = localStorage.getItem("workflowHistory")
    if (!rawHistory) return;

    const history = JSON.parse(rawHistory)
    const latestOrderMap = new Map()
    
    // Group by Order ID to find latest state
    history.forEach((entry: any) => {
       const id = entry.doNumber || entry.orderNo
       if (!id) return
       latestOrderMap.set(id, entry)
    })

    const uniqueOrders = Array.from(latestOrderMap.values())

    let active = 0, completed = 0, damaged = 0
    let s1 = 0, s2 = 0, s3 = 0, s4 = 0 // Stage counters

    const actions: any[] = []

    uniqueOrders.forEach((order: any) => {
      const state = getOrderState(order.stage, order.status)
      if (state === "In Progress") active++
      if (state === "Delivered") completed++
      if (state === "Damaged") damaged++

      const s = order.stage
      if (["Order Punch", "Pre-Approval", "Approval Of Order"].includes(s)) s1++
      else if (["Dispatch Planning", "Actual Dispatch", "Vehicle Details", "Material Load"].includes(s)) s2++
      else if (["Security Approval", "Make Invoice", "Check Invoice", "Gate Out"].includes(s)) s3++
      else if (["Material Receipt", "Damage Adjustment", "Confirm Material Receipt"].includes(s)) s4++

      if (order.status === "Completed" || order.status === "Approved") {
         if (s === "Order Punch") actions.push({ label: "Review Pre-Approval", id: order.orderNo })
         else if (s === "Pre-Approval") actions.push({ label: "Approve Order", id: order.doNumber || order.orderNo })
         else if (s === "Approval Of Order") actions.push({ label: "Plan Dispatch", id: order.doNumber })
         else if (s === "Material Load") actions.push({ label: "Security Check", id: order.doNumber })
         else if (s === "Security Approval") actions.push({ label: "Generate Invoice", id: order.doNumber })
         else if (s === "Make Invoice") actions.push({ label: "Check Invoice", id: order.doNumber })
         else if (s === "Gate Out") actions.push({ label: "Confirm Receipt", id: order.doNumber })
      }
    })

    setMetrics({ total: uniqueOrders.length, active, completed, damaged })
    setPipelineData([
      { title: "Approvals & Entry", count: s1, color: "bg-blue-500", icon: FileBarChart },
      { title: "Dispatch & Loading", count: s2, color: "bg-amber-500", icon: Truck },
      { title: "Invoice & Gate", count: s3, color: "bg-indigo-500", icon: Activity },
      { title: "Final Delivery", count: s4, color: "bg-emerald-500", icon: CheckCircle2 }
    ])
    setRecentActivity([...history].reverse().slice(0, 10))
    
    const actionGroups = actions.reduce((acc: any, curr) => {
        acc[curr.label] = (acc[curr.label] || 0) + 1
        return acc
    }, {})
    
    setActionItems(Object.entries(actionGroups).map(([label, count]) => ({ label, count })).sort((a: any, b: any) => b.count - a.count))

  }, [])

  return (
    <div className="p-10 max-w-[1800px] mx-auto min-h-screen bg-transparent">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-10">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Dashboard</h1>
          <p className="text-base text-muted-foreground mt-1">
            Overview for {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-6 md:grid-cols-4 mb-10">
        <MetricCard title="Total Volume" value={metrics.total} icon={Package} />
        <MetricCard title="Active Orders" value={metrics.active} icon={Clock} highlight />
        <MetricCard title="Fulfilled" value={metrics.completed} icon={CheckCircle2} />
        <MetricCard title="Attention Needed" value={metrics.damaged} icon={AlertCircle} alert />
      </div>

      <div className="grid gap-10 grid-cols-1 lg:grid-cols-3">
        
        {/* Main Feed */}
        <div className="lg:col-span-2 space-y-10">
           
           {/* Pipeline Snapshot */}
           <Card className="shadow-sm border rounded-xl overflow-hidden">
             <CardHeader className="pb-4 border-b bg-muted/10">
                <CardTitle className="text-lg font-semibold">Live Pipeline</CardTitle>
             </CardHeader>
             <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                   {pipelineData.map((item, i) => (
                      <div key={i} className="flex flex-col p-5 rounded-2xl border border-slate-100 border-b-[4px] bg-white hover:border-b-primary/50 hover:border-b-[6px] hover:-translate-y-2 hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)] transition-all duration-300 group cursor-pointer relative overflow-hidden">
                         <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110 shadow-sm ${item.color.replace('bg-', 'bg-').replace('500', '100')} ${item.color.replace('bg-', 'text-').replace('500', '600')}`}>
                            <item.icon className="h-6 w-6" />
                         </div>
                         <div className="mb-2 relative z-10">
                             <p className="text-sm font-semibold text-slate-500">{item.title}</p>
                             <p className="text-3xl font-extrabold text-slate-900 tracking-tight">{item.count}</p>
                         </div>
                         <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mt-auto shadow-inner">
                            <div 
                              className={`h-full ${item.color} rounded-full shadow-[0_2px_4px_rgba(0,0,0,0.1)]`}
                              style={{ width: `${metrics.total ? (item.count / metrics.total) * 100 : 0}%` }}
                            />
                         </div>
                      </div>
                   ))}
                </div>
             </CardContent>
           </Card>

           {/* Recent Transactions */}
           <Card className="shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 border-b-[6px] rounded-2xl overflow-hidden hover:shadow-xl transition-all duration-300">
             <CardHeader className="flex flex-row items-center justify-between py-6 px-6 bg-gradient-to-b from-white to-slate-50/50 border-b">
                <CardTitle className="text-xl font-bold text-slate-800">Recent Activity</CardTitle>
                <Button variant="outline" size="icon" className="h-9 w-9 bg-white shadow-sm border-b-[3px] active:border-b active:translate-y-[2px] transition-all"><MoreHorizontal className="h-5 w-5" /></Button>
             </CardHeader>
             <div className="p-0">
               <Table>
                  <TableHeader>
                     <TableRow className="bg-slate-50/50 hover:bg-slate-50">
                        <TableHead className="w-[140px] text-xs uppercase tracking-wider font-bold text-slate-500 h-10 text-center">Order ID</TableHead>
                        <TableHead className="text-xs uppercase tracking-wider font-bold text-slate-500 text-center">Stage</TableHead>
                        <TableHead className="text-xs uppercase tracking-wider font-bold text-slate-500 text-center">Status</TableHead>
                        <TableHead className="text-right text-xs uppercase tracking-wider font-bold text-slate-500">Time</TableHead>
                     </TableRow>
                  </TableHeader>
                  <TableBody>
                     {recentActivity.map((item, i) => (
                        <TableRow key={i} className="group cursor-pointer hover:bg-slate-50 transition-all h-16 border-b border-slate-100 last:border-0 relative">
                           <TableCell className="font-mono text-sm font-semibold text-slate-700 relative z-10 group-hover:text-primary transition-colors text-center">
                              <span className="bg-slate-100 px-2 py-1 rounded-md border border-slate-200 group-hover:border-primary/20 group-hover:bg-primary/5 transition-colors">
                                 {item.doNumber || item.orderNo}
                              </span>
                           </TableCell>
                           <TableCell className="text-sm font-medium text-slate-600 group-hover:text-slate-900 transition-colors relative z-10 text-center">{item.stage}</TableCell>
                           <TableCell className="relative z-10 text-center">
                              <div className="flex justify-center">
                                 <StatusBadge status={item.status} />
                              </div>
                           </TableCell>
                           <TableCell className="text-right text-sm text-slate-500 relative z-10 font-medium">
                              {new Date(item.timestamp || item.date).toLocaleTimeString([], { hour: '2-digit', minute:'2-digit' })}
                           </TableCell>
                        </TableRow>
                     ))}
                     {recentActivity.length === 0 && (
                        <TableRow>
                           <TableCell colSpan={4} className="text-center py-10 text-base text-muted-foreground">No recent data</TableCell>
                        </TableRow>
                     )}
                  </TableBody>
               </Table>
             </div>
           </Card>

        </div>

        {/* Sidebar */}
        <div className="space-y-8">
           {/* Action Items */}
           <Card className="shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 border-b-[6px] rounded-2xl overflow-hidden hover:shadow-xl transition-all duration-300">
              <CardHeader className="pb-4 border-b bg-gradient-to-b from-white to-slate-50/50">
                 <CardTitle className="text-xl font-bold flex items-center gap-3 text-slate-800">
                    Pending Actions 
                    {actionItems.length > 0 && <span className="bg-orange-500 text-white shadow-md text-xs px-2.5 py-0.5 rounded-full animate-pulse">{actionItems.reduce((a,b)=>a+b.count,0)}</span>}
                 </CardTitle>
              </CardHeader>
              <ScrollArea className="h-[400px]">
                 <div className="p-3">
                    {actionItems.map((item, i) => (
                       <div key={i} className="flex items-center justify-between p-4 mb-3 bg-white rounded-xl border border-slate-100 border-b-[3px] shadow-sm hover:border-b-[5px] hover:-translate-y-1 hover:shadow-md hover:border-primary/30 transition-all duration-200 cursor-pointer group">
                          <div>
                             <p className="text-base font-bold text-slate-700 group-hover:text-primary transition-colors">{item.label}</p>
                             <div className="flex items-center gap-2 mt-1">
                                <span className="h-1.5 w-1.5 rounded-full bg-orange-400"></span>
                                <p className="text-sm text-slate-500 font-medium">{item.count} orders waiting</p>
                             </div>
                          </div>
                          <div className="h-10 w-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center group-hover:bg-primary group-hover:text-white group-hover:shadow-lg transition-all duration-300">
                            <ArrowRight className="h-5 w-5 transform group-hover:translate-x-0.5" />
                          </div>
                       </div>
                    ))}
                    {actionItems.length === 0 && (
                       <div className="p-10 text-center text-sm text-muted-foreground">
                          All caught up! No actions pending.
                       </div>
                    )}
                 </div>
              </ScrollArea>
           </Card>

           {/* Quick Stats / System Health */}
           <Card className="shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 border-b-[6px] rounded-2xl bg-white hover:shadow-xl transition-all duration-300">
              <CardContent className="pt-8 px-6">
                 <div className="flex items-center justify-between mb-6">
                    <span className="text-lg font-bold text-slate-700">System Status</span>
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 shadow-sm">
                        <span className="relative flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                        </span>
                        <span className="text-xs font-bold uppercase tracking-wider">Operational</span>
                    </div>
                 </div>
                 <Separator className="my-6" />
                 <div className="text-sm text-slate-500 space-y-4">
                    <p className="flex justify-between items-center group p-2 hover:bg-slate-50 rounded-lg transition-colors cursor-default">
                        <span className="font-medium">Database Connection</span> 
                        <span className="text-slate-900 font-bold bg-green-100 px-2 py-0.5 rounded text-green-700 text-xs">Stable</span>
                    </p>
                    <p className="flex justify-between items-center group p-2 hover:bg-slate-50 rounded-lg transition-colors cursor-default">
                        <span className="font-medium">Last Sync</span> 
                        <span className="text-slate-900 font-bold">Just now</span>
                    </p>
                    <div className="flex justify-between items-center group p-2 hover:bg-slate-50 rounded-lg transition-colors cursor-default">
                        <span className="font-medium">Server Load</span> 
                        <div className="flex items-center gap-2">
                             <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                                 <div className="h-full bg-blue-500 w-[12%] rounded-full"></div>
                             </div>
                             <span className="text-slate-900 font-bold">12%</span>
                        </div>
                    </div>
                 </div>
              </CardContent>
           </Card>
        </div>

      </div>
    </div>
  )
}

// --- Components ---

function MetricCard({ title, value, icon: Icon, highlight = false, alert = false }: any) {
   return (
      <Card className="shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 border-b-[6px] rounded-2xl hover:shadow-[0_20px_50px_rgb(0,0,0,0.1)] hover:-translate-y-2 hover:border-b-primary/50 transition-all duration-300 cursor-default group relative overflow-hidden bg-gradient-to-br from-white to-slate-50/50">
          <div className="absolute inset-x-0 bottom-0 h-1.5 bg-gradient-to-r from-transparent via-primary/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity blur-sm" />
         <CardContent className="p-5 md:p-6 relative z-10">
            <div className="flex items-center justify-between space-y-0 pb-6">
               <p className="text-sm uppercase tracking-wider font-bold text-slate-500 group-hover:text-primary transition-colors">{title}</p>
               <div className={`p-3 rounded-xl shadow-sm border-b-[3px] ${alert ? 'bg-red-50 text-red-600 border-red-100' : 'bg-white text-slate-600 border-slate-100 group-hover:bg-primary group-hover:text-white group-hover:border-primary/50 group-hover:shadow-lg'} transition-all duration-300 group-hover:scale-110`}>
                 <Icon className="h-6 w-6" />
               </div>
            </div>
            <div className="flex items-baseline gap-3">
               <div className={`text-4xl font-extrabold tracking-tight ${alert ? 'text-red-700' : 'text-slate-900'}`}>{value}</div>
               {highlight && (
                   <span className="text-sm text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full flex items-center">
                      <TrendingUp className="h-3 w-3 mr-1" /> +4.2%
                   </span>
               )}
            </div>
         </CardContent>
      </Card>
   )
}

function StatusBadge({ status }: { status: string }) {
   if (status === "Completed" || status === "Approved") {
      return <Badge variant="outline" className="px-3 py-1 text-sm font-medium text-emerald-700 bg-emerald-50 border-emerald-200">Approved</Badge>
   } 
   if (status === "Rejected" || status === "Damaged") {
      return <Badge variant="outline" className="px-3 py-1 text-sm font-medium text-red-700 bg-red-50 border-red-200">{status}</Badge>
   }
   return <Badge variant="secondary" className="px-3 py-1 text-sm font-medium bg-slate-100 text-slate-600 hover:bg-slate-200">{status}</Badge>
}
