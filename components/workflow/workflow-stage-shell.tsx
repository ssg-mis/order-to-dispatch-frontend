"use client"

import React from "react"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, Filter, RotateCcw } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface WorkflowStageShellProps {
  title: string
  description: string
  pendingCount: number
  children: React.ReactNode
  historyData: any[]
  historyContent?: React.ReactNode
  partyNames?: string[]
  onFilterChange?: (filters: { search: string; status: string; startDate: string; endDate: string; partyName: string }) => void
  remarksColName?: string
  showStatusFilter?: boolean
}

export function WorkflowStageShell({
  title,
  description,
  pendingCount,
  children,
  historyData,
  historyContent,
  partyNames = [],
  onFilterChange,
  remarksColName,
  showStatusFilter = false,
}: WorkflowStageShellProps) {
  const [filters, setFilters] = React.useState({
      search: "",
      status: "",
      startDate: "",
      endDate: "",
      partyName: ""
  })

  const updateFilter = (key: keyof typeof filters, value: string) => {
      const newFilters = { ...filters, [key]: value }
      setFilters(newFilters)
      if (onFilterChange) {
          onFilterChange(newFilters)
      }
  }

  return (
    <SidebarInset>
      <div className="p-6 space-y-4 w-full">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="h-6" />
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
          </div>
          <Badge variant="outline" className="px-4 py-1 text-sm bg-primary/5 text-primary border-primary/20">
            {pendingCount} Pending Items
          </Badge>
        </div>

      <Tabs defaultValue="pending" className="w-full">
        <TabsList className="grid w-full max-w-[400px] grid-cols-2 mb-2 bg-muted/50 p-1 rounded-lg h-9">
          <TabsTrigger value="pending" className="rounded-md text-xs py-1">
            Pending Tasks
          </TabsTrigger>
          <TabsTrigger value="history" className="rounded-md text-xs py-1">
            Stage History
          </TabsTrigger>
        </TabsList>

        <div className="flex flex-col gap-2 bg-card p-3 rounded-xl border shadow-sm mb-4">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search DO Number, Customer..." 
                className="pl-9 bg-transparent h-9" 
                value={filters.search}
                onChange={(e) => updateFilter("search", e.target.value)}
              />
            </div>
            <Button variant="outline" size="icon" className="bg-transparent h-9 w-9">
              <Filter className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="bg-transparent h-9 w-9" onClick={() => {
                const reset = { search: "", status: "", startDate: "", endDate: "", partyName: "" };
                setFilters(reset);
                if (onFilterChange) onFilterChange(reset);
            }}>
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Extended Filters */}
          <div className={`grid grid-cols-1 gap-2 ${showStatusFilter ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
             {/* Status Select */}
             {showStatusFilter && (
               <div className="space-y-1">
                 <Label className="text-xs font-medium text-muted-foreground">Status</Label>
                 <Select value={filters.status} onValueChange={(val) => updateFilter("status", val)}>
                    <SelectTrigger className="w-full h-8 bg-background px-3 text-sm">
                       <SelectValue placeholder="Select Status" />
                    </SelectTrigger>
                    <SelectContent>
                       <SelectItem value="all">All Status</SelectItem>
                       <SelectItem value="on-time">On Time</SelectItem>
                       <SelectItem value="expire">Expire</SelectItem>
                    </SelectContent>
                 </Select>
               </div>
             )}
             
             {/* Start Date */}
             <div className="space-y-1">
                <Label className="text-xs font-medium text-muted-foreground">Start Date</Label>
                <Input 
                   type="date" 
                   className="w-full h-8 bg-background px-3 text-sm block" 
                   value={filters.startDate}
                   onChange={(e) => updateFilter("startDate", e.target.value)}
                />
             </div>
             
             {/* End Date */}
             <div className="space-y-1">
                <Label className="text-xs font-medium text-muted-foreground">End Date</Label>
                <Input 
                   type="date" 
                   className="w-full h-8 bg-background px-3 text-sm block" 
                   value={filters.endDate}
                   onChange={(e) => updateFilter("endDate", e.target.value)}
                />
             </div>
             
             {/* Party Name Select */}
             <div className="space-y-1">
               <Label className="text-xs font-medium text-muted-foreground">Party Name</Label>
               <Select value={filters.partyName} onValueChange={(val) => updateFilter("partyName", val)}>
                  <SelectTrigger className="w-full h-8 bg-background px-3 text-sm">
                     <SelectValue placeholder="Select Party Name" />
                  </SelectTrigger>
                  <SelectContent>
                     <SelectItem value="all">All Parties</SelectItem>
                     {partyNames.map((name, i) => (
                        <SelectItem key={i} value={name}>{name}</SelectItem>
                     ))}
                  </SelectContent>
               </Select>
             </div>
          </div>
        </div>

        <TabsContent value="pending" className="space-y-2">
          {children}
        </TabsContent>

        <TabsContent value="history">
          {historyContent ? (
            <div className="mt-4">{historyContent}</div>
          ) : (
            <Card className="border-none shadow-sm overflow-hidden">
              {historyData && historyData.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm table-fixed">
                    <thead className="bg-muted/30 border-b">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold w-[15%]">Date</th>
                        <th className="px-4 py-3 text-left font-semibold w-[20%]">Order No.</th>
                        <th className="px-4 py-3 text-left font-semibold w-[20%]">Party Name</th>
                        <th className="px-4 py-3 text-left font-semibold w-[15%] text-center">Status</th>
                        <th className="px-4 py-3 text-left font-semibold w-[30%]">{remarksColName || "Remarks"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyData.map((item, i) => (
                        <tr key={i} className="border-b hover:bg-muted/20">
                          <td className="px-4 py-3">{item.date || "-"}</td>
                          <td className="px-4 py-3 font-semibold text-blue-700">{item.orderNo || "-"}</td>
                          <td className="px-4 py-3">{item.customerName || "-"}</td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`inline-block px-2 py-1 rounded text-[10px] font-black uppercase tracking-tight ${
                                item.status === "Approved" || item.status === "Completed"
                                  ? "bg-green-100 text-green-700 border border-green-200"
                                  : item.status === "Rejected"
                                    ? "bg-red-100 text-red-700 border border-red-200"
                                    : "bg-slate-100 text-slate-700 border border-slate-200"
                                }`}
                            >
                              {item.status || "-"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground italic">
                            {item.remarks || "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-8 text-center text-muted-foreground">No history records found.</div>
              )}
            </Card>
          )}
        </TabsContent>
      </Tabs>
      </div>
    </SidebarInset>
  )
}
