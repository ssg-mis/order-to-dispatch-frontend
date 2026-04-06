"use client"

import { useEffect, useState, useMemo, useRef, useCallback } from "react"
import { SidebarTrigger } from "@/components/ui/sidebar"
import {
  BarChart2, Download, Search, X, RefreshCw, TrendingUp, Package,
  Truck, CheckCircle2, Clock, AlertTriangle, ChevronDown, ChevronRight,
  FileText, Filter, Calendar, Layers
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts"
import { useQuery } from "@tanstack/react-query"
import { 
  useReactTable, 
  getCoreRowModel, 
  getPaginationRowModel,
  flexRender,
  ColumnDef
} from "@tanstack/react-table"
import { 
  ChevronLeft, 
  ChevronRight as ChevronRightIcon,
  ChevronsLeft,
  ChevronsRight
} from "lucide-react"
import { reportsApi } from "@/lib/api-service"
import { Skeleton } from "@/components/ui/skeleton"

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001/api/v1"

const OIL_TYPES = ["All", "Soya", "Rice", "Palm", "Other"]

// ─── helpers ───────────────────────────────────────────────────────────────
const fmt = (n: number, decimals = 1) => (n || 0).toLocaleString("en-IN", { maximumFractionDigits: decimals })
const fmtDate = (d: string | null) => {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
}
const fmtDelay = (days: number | null) => {
  if (days === null) return "—"
  if (days === 0) return <span className="text-emerald-600 font-bold text-xs">On time</span>
  if (days > 0) return <span className="text-rose-600 font-bold text-xs">+{days}d late</span>
  return <span className="text-blue-500 font-bold text-xs">{Math.abs(days)}d early</span>
}

/** Normalize oil type display: SBO → Soya Oil, RBO → Rice Bran Oil, etc. */
const normalizeOilType = (raw: string | null): string => {
  if (!raw) return "—"
  const u = raw.trim().toLowerCase()
  if (u === "sbo" || u === "soya" || u === "soya oil" || u.includes("soya")) return "Soya Oil"
  if (u === "rbo" || u === "rice" || u === "rice oil" || u === "rice bran oil" || u.includes("rbo") || u.includes("rice")) return "Rice Bran Oil"
  if (u === "palm" || u === "palm oil" || u.includes("palm")) return "Palm Oil"
  if (u === "unknown" || u === "") return "—"
  return raw
}

/** Download as CSV */
function downloadCSV(data: any[], filename: string) {
  if (!data.length) return
  const keys = Object.keys(data[0])
  const csv = [keys.join(","), ...data.map(row => keys.map(k => `"${(row[k] ?? "")}"`)
    .join(","))].join("\n")
  const blob = new Blob([csv], { type: "text/csv" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a"); a.href = url; a.download = filename + ".csv"; a.click()
  URL.revokeObjectURL(url)
}

function downloadExcel(data: any[], filename: string) {
  downloadCSV(data, filename)
}

function downloadPDF() {
  window.print()
}

// ─── Main Report Page ──────────────────────────────────────────────────────
export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<"summary" | "skus" | "timeline">("summary")
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null)

  // Filters
  const [filterOrderNo, setFilterOrderNo] = useState("")
  const [filterCompany, setFilterCompany] = useState("")
  const [filterOilType, setFilterOilType] = useState("All")
  const [filterSku, setFilterSku] = useState("")
  const [filterFrom, setFilterFrom] = useState("")
  const [filterTo, setFilterTo] = useState("")

  const hasFilters = filterOrderNo || filterCompany || (filterOilType !== "All") || filterSku || filterFrom || filterTo

  // TanStack Query
  const { data: reportResp, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["reports", filterOrderNo, filterCompany, filterOilType, filterSku, filterFrom, filterTo],
    queryFn: async () => {
      const params: any = {}
      if (filterOrderNo) params.order_no = filterOrderNo
      if (filterCompany) params.customer_name = filterCompany
      if (filterOilType !== "All") params.oil_type = filterOilType
      if (filterSku) params.sku_name = filterSku
      if (filterFrom) params.from_date = filterFrom
      if (filterTo) params.to_date = filterTo

      const res = await reportsApi.getReport(params)
      return res.success ? res.data : null
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  const data = reportResp

  const clearFilters = () => {
    setFilterOrderNo(""); setFilterCompany(""); setFilterOilType("All")
    setFilterSku(""); setFilterFrom(""); setFilterTo("")
  }

  const summary = data?.summary || {}
  const topSkus: any[] = data?.topSkus || []
  const orderTimeline: any[] = data?.orderTimeline || []

  // ─── TANSTACK TABLE FOR SUMMARY/TIMELINE ───
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 15 })

  const summaryTable = useReactTable({
    data: orderTimeline,
    columns: [], // We use manual columns for now to match exactly your layout
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onPaginationChange: setPagination,
    state: { pagination },
  })

  // Reset pagination when data changes (e.g. filter applied)
  useEffect(() => {
    setPagination(prev => ({ ...prev, pageIndex: 0 }))
  }, [filterOrderNo, filterCompany, filterOilType, filterSku, filterFrom, filterTo])

  // Chart data for top SKUs — full names for tooltip, short label for Y axis
  const chartData = topSkus.slice(0, 10).map(s => ({
    name: s.sku.length > 18 ? s.sku.slice(0, 18) + "…" : s.sku,
    fullName: s.sku,
    kg: Math.round(s.total_kg),
    oil: s.oil_type
  }))

  const OIL_COLORS: Record<string, string> = { Soya: "#6366f1", Rice: "#10b981", Palm: "#f59e0b", Unknown: "#94a3b8" }
  const getColor = (oil: string) => {
    if (!oil) return "#94a3b8"
    const u = oil.toLowerCase()
    if (u.includes("soya") || u === "sbo") return "#6366f1"
    if (u.includes("rice") || u.includes("rbo")) return "#10b981"
    if (u.includes("palm")) return "#f59e0b"
    return "#94a3b8"
  }

  // CSV export datasets
  const summaryExportData = [{
    "Total Received": summary.totalReceived || 0,
    "Total Received (KG)": fmt(summary.totalReceivedKg),
    "Pending Count": summary.totalPendingCount || 0,
    "Pending (KG)": fmt(summary.totalPendingKg),
    "Dispatched Count": summary.totalDispatchedCount || 0,
    "Dispatched (KG)": fmt(summary.totalDispatchedKg),
    "Completed Count": summary.totalCompletedCount || 0,
    "Completed (KG)": fmt(summary.totalCompletedKg),
    "Remaining (KG)": fmt(summary.totalRemainingKg),
  }]

  const skuExportData = topSkus.map(s => ({
    "Oil Type": normalizeOilType(s.oil_type),
    "SKU / Product": s.sku,
    "Total KG": Math.round(s.total_kg),
    "SKU Qty (Box)": Math.round(s.total_qty) || 0,
    "Order Count": s.count,
  }))

  const timelineExportData = orderTimeline.flatMap(o =>
    o.stages.map((s: any) => ({
      "Order No.": o.order_no,
      "Customer": o.customer_name,
      "Oil Type": normalizeOilType(o.oil_type),
      "SKU": o.sku_name,
      "QTY (KG)": o.order_quantity,
      "Stage": s.stage,
      "Planned Date": fmtDate(s.planned),
      "Actual Date": fmtDate(s.actual),
      "Delay (Days)": s.delayDays ?? "",
    }))
  )

  return (
    <div className="min-h-screen" style={{ background: "oklch(0.97 0.012 245)" }}>

      {/* ─── HEADER ─── */}
      <div className="sticky top-0 z-30 flex items-center justify-between px-6 py-3 border-b print:hidden"
        style={{ background: "rgba(255,255,255,0.9)", backdropFilter: "blur(12px)", borderColor: "oklch(0.88 0.025 245)", boxShadow: "0 1px 12px oklch(0.42 0.18 265 / 0.06)" }}>
        <div className="flex items-center gap-3">
          <SidebarTrigger className="-ml-1" />
          <div className="h-5 w-px bg-border mx-1" />
          <div className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: "oklch(0.42 0.18 265 / 0.12)" }}>
            <BarChart2 className="h-4 w-4" style={{ color: "oklch(0.42 0.18 265)" }} />
          </div>
          <h1 className="text-xl font-black tracking-tight text-slate-900">Reports &amp; Analytics</h1>
        </div>

        {/* Export buttons */}
        <div className="flex items-center gap-2 print:hidden">
          <Button variant="outline" size="sm" className="rounded-xl text-xs font-bold gap-1.5 hover:bg-emerald-50 hover:border-emerald-400 hover:text-emerald-700 transition-colors"
            onClick={() => {
              const exportData = activeTab === "skus" ? skuExportData : activeTab === "timeline" ? timelineExportData : summaryExportData
              downloadCSV(exportData, `oms-report-${activeTab}`)
            }}>
            <Download className="h-3.5 w-3.5" /> CSV
          </Button>
          <Button variant="outline" size="sm" className="rounded-xl text-xs font-bold gap-1.5 hover:bg-blue-50 hover:border-blue-400 hover:text-blue-700 transition-colors"
            onClick={() => {
              const exportData = activeTab === "skus" ? skuExportData : activeTab === "timeline" ? timelineExportData : summaryExportData
              downloadExcel(exportData, `oms-report-${activeTab}`)
            }}>
            <FileText className="h-3.5 w-3.5" /> Excel
          </Button>
          <Button variant="outline" size="sm" className="rounded-xl text-xs font-bold gap-1.5 hover:bg-rose-50 hover:border-rose-400 hover:text-rose-700 transition-colors"
            onClick={downloadPDF}>
            <FileText className="h-3.5 w-3.5" /> PDF
          </Button>
          <Button size="sm" className="rounded-xl text-xs font-bold gap-1.5" style={{ background: "oklch(0.42 0.18 265)" }}
            onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
            {isFetching ? "Loading…" : "Apply Filters"}
          </Button>
        </div>
      </div>

      <div className="p-5 md:p-7 max-w-[1600px] mx-auto space-y-5">

        {/* ─── FILTERS ─── */}
        <div className="rounded-2xl border bg-white p-5 print:hidden"
          style={{ borderColor: "oklch(0.88 0.025 245)", boxShadow: "0 1px 8px oklch(0.42 0.18 265 / 0.04)" }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4" style={{ color: "oklch(0.42 0.18 265)" }} />
              <span className="font-black text-sm text-slate-700">Filters</span>
              {hasFilters && <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full text-white" style={{ background: "oklch(0.42 0.18 265)" }}>Active</span>}
            </div>
            {hasFilters && (
              <button onClick={clearFilters} className="flex items-center gap-1 text-xs font-bold text-rose-500 hover:text-rose-700 transition-colors">
                <X className="h-3.5 w-3.5" /> Clear All
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            {/* Order No */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
              <Input placeholder="Order No." value={filterOrderNo} onChange={e => setFilterOrderNo(e.target.value)}
                className="pl-8 h-9 text-sm rounded-xl border-slate-200 bg-slate-50" />
            </div>
            {/* Company */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
              <Input placeholder="Company Name" value={filterCompany} onChange={e => setFilterCompany(e.target.value)}
                className="pl-8 h-9 text-sm rounded-xl border-slate-200 bg-slate-50" />
            </div>
            {/* Oil Type */}
            <select value={filterOilType} onChange={e => setFilterOilType(e.target.value)}
              className="h-9 px-3 text-sm rounded-xl border border-slate-200 bg-slate-50 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-400/30">
              {OIL_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
            {/* SKU */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
              <Input placeholder="SKU / Product" value={filterSku} onChange={e => setFilterSku(e.target.value)}
                className="pl-8 h-9 text-sm rounded-xl border-slate-200 bg-slate-50" />
            </div>
            {/* Date range */}
            <Input type="date" placeholder="From Date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)}
              className="h-9 text-sm rounded-xl border-slate-200 bg-slate-50" />
            <Input type="date" placeholder="To Date" value={filterTo} onChange={e => setFilterTo(e.target.value)}
              className="h-9 text-sm rounded-xl border-slate-200 bg-slate-50" />
          </div>
        </div>

        {/* ─── SUMMARY KPI CARDS ─── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {[
            { label: "Total Received", count: summary.totalReceived, kg: summary.totalReceivedKg, icon: Package, color: "#6366f1" },
            { label: "Pending", count: summary.totalPendingCount, kg: summary.totalPendingKg, icon: Clock, color: "#f59e0b" },
            { label: "Dispatched", count: summary.totalDispatchedCount, kg: summary.totalDispatchedKg, icon: Truck, color: "#3b82f6" },
            { label: "Completed", count: summary.totalCompletedCount, kg: summary.totalCompletedKg, icon: CheckCircle2, color: "#10b981" },
            { label: "Remaining KG", count: null, kg: summary.totalRemainingKg, icon: AlertTriangle, color: "#f43f5e" },
          ].map(card => (
            <div key={card.label} className="rounded-2xl border bg-white p-5 relative overflow-hidden group hover:scale-[1.02] transition-all duration-200"
              style={{ borderColor: "oklch(0.88 0.025 245)", boxShadow: "0 1px 8px oklch(0.42 0.18 265 / 0.04)" }}>
              <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-2xl" style={{ background: card.color }} />
              <div className="flex items-center justify-between mb-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl transition-transform group-hover:scale-110"
                  style={{ background: `${card.color}18` }}>
                  <card.icon className="h-4 w-4" style={{ color: card.color }} />
                </div>
              </div>
              {isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-8 w-16" />
                  <Skeleton className="h-5 w-24" />
                </div>
              ) : (
                <>
                  {card.count !== null && (
                    <div className="text-3xl font-black text-slate-900 tracking-tight leading-none">{fmt(card.count, 0)}</div>
                  )}
                  <div className="text-lg font-black mt-0.5" style={{ color: card.color }}>
                    {fmt(card.kg || 0)} kg
                  </div>
                </>
              )}
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">{card.label}</div>
            </div>
          ))}
        </div>

        {/* ─── TABS ─── */}
        <div className="flex gap-1 p-1 rounded-xl border bg-white w-fit print:hidden"
          style={{ borderColor: "oklch(0.88 0.025 245)" }}>
          {[
            { key: "summary", label: "Order Summary", icon: Layers },
            { key: "skus", label: "Top SKUs", icon: TrendingUp },
            { key: "timeline", label: "Stage Timeline", icon: Calendar },
          ].map(tab => (
            <button key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all duration-200"
              style={activeTab === tab.key ? {
                background: "oklch(0.42 0.18 265)",
                color: "white",
                boxShadow: "0 2px 8px oklch(0.42 0.18 265 / 0.30)"
              } : { color: "oklch(0.52 0.04 245)" }}>
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* ─── ORDER SUMMARY TAB ─── */}
        {activeTab === "summary" && (
          <div className="rounded-2xl border bg-white overflow-hidden"
            style={{ borderColor: "oklch(0.88 0.025 245)", boxShadow: "0 1px 8px oklch(0.42 0.18 265 / 0.04)" }}>
            <div className="px-6 py-4 border-b flex items-center justify-between"
              style={{ background: "oklch(0.97 0.014 248)", borderColor: "oklch(0.90 0.025 245)" }}>
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4" style={{ color: "oklch(0.42 0.18 265)" }} />
                <span className="font-black text-slate-800">Order Summary</span>
                <span className="text-slate-400 text-xs">({orderTimeline.length} orders)</span>
              </div>
            </div>
            <ScrollArea style={{ height: "540px" }}>
              <Table>
                <TableHeader style={{ background: "oklch(0.98 0.01 245)", position: "sticky", top: 0, zIndex: 1 }}>
                  <TableRow style={{ borderColor: "oklch(0.90 0.025 245)" }}>
                    {["Order No.", "Customer", "Oil Type", "SKU / Product", "Order Qty", "Order QTY (KG)", "UOM", "Delivery Date", "Status"].map(h => (
                      <TableHead key={h} className="py-3 text-[10px] font-black uppercase tracking-wider first:pl-6 last:pr-6"
                        style={{ color: "oklch(0.52 0.04 245)" }}>{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array(5).fill(0).map((_, i) => (
                      <TableRow key={i} style={{ borderColor: "oklch(0.93 0.015 245)" }}>
                        {Array(9).fill(0).map((_, j) => (
                          <TableCell key={j} className={j === 0 ? "pl-6 py-4" : j === 8 ? "pr-6 py-4" : "py-4"}>
                            <Skeleton className="h-5 w-full" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : summaryTable.getRowModel().rows.map(({ original: o }, i) => {
                    const isCompleted = o.stages.some((s: any) => s.stage === "Gate Out" && s.actual)
                    return (
                      <TableRow key={i} className="hover:bg-slate-50/80 transition-colors" style={{ borderColor: "oklch(0.93 0.015 245)" }}>
                        <TableCell className="pl-6 py-3 font-bold text-slate-800 text-sm">{o.order_no}</TableCell>
                        <TableCell className="py-3 text-sm text-slate-700 max-w-[160px] truncate" title={o.customer_name}>{o.customer_name || "—"}</TableCell>
                        <TableCell className="py-3">
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-md"
                            style={{ background: `${getColor(o.oil_type)}18`, color: getColor(o.oil_type) }}>
                            {normalizeOilType(o.oil_type)}
                          </span>
                        </TableCell>
                        <TableCell className="py-3 text-sm text-slate-700 max-w-[200px]">
                          <span className="whitespace-normal break-words leading-snug">{o.sku_name || "—"}</span>
                        </TableCell>
                        <TableCell className="py-3 font-bold text-slate-700 tabular-nums text-sm">
                          {fmt(o.order_quantity, 0)}
                        </TableCell>
                        <TableCell className="py-3 font-black text-slate-800 tabular-nums">
                          <div className="flex flex-col">
                            <span className="text-sm">{fmt(o.order_quantity_kg ?? parseFloat(o.order_quantity) ?? 0, 1)} kg</span>
                            {o.sku_weight > 0 && (
                              <span className="text-[9px] text-slate-400 font-medium">{fmt(o.order_quantity, 0)} × {o.sku_weight}kg</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-3 text-xs text-slate-500 font-semibold">
                          {o.uom || "—"}
                        </TableCell>
                        <TableCell className="py-3 text-slate-600 text-xs">{fmtDate(o.delivery_date)}</TableCell>
                        <TableCell className="pr-6 py-3">
                          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${isCompleted ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                            {isCompleted ? "Completed" : "Pending"}
                          </span>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                  {orderTimeline.length === 0 && !isLoading && (
                    <TableRow><TableCell colSpan={9} className="text-center py-20 text-slate-400 text-sm font-bold">No data found — try adjusting filters</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>

            {/* Pagination Controls */}
            {!isLoading && orderTimeline.length > pagination.pageSize && (
              <div className="px-6 py-3 border-t bg-slate-50/50 flex items-center justify-between" style={{ borderColor: "oklch(0.90 0.025 245)" }}>
                <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                  Showing <span className="text-slate-900 mx-1">{Math.min(orderTimeline.length, pagination.pageIndex * pagination.pageSize + 1)}</span>
                  to <span className="text-slate-900 mx-1">{Math.min(orderTimeline.length, (pagination.pageIndex + 1) * pagination.pageSize)}</span>
                  of <span className="text-slate-900 mx-1">{orderTimeline.length}</span> orders
                </div>
                <div className="flex items-center gap-1.5 font-black">
                  <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg"
                    onClick={() => summaryTable.previousPage()} disabled={!summaryTable.getCanPreviousPage()}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  {Array.from({ length: summaryTable.getPageCount() }).map((_, i) => {
                    // Only show 5 pages around current
                    if (Math.abs(i - pagination.pageIndex) > 2 && i !== 0 && i !== summaryTable.getPageCount() - 1) return null
                    if (Math.abs(i - pagination.pageIndex) === 3) return <span key={i} className="px-1 text-slate-400 opacity-50">...</span>
                    return (
                      <Button key={i} variant={pagination.pageIndex === i ? "default" : "outline"} size="icon"
                        className="h-8 w-8 rounded-lg text-xs" style={pagination.pageIndex === i ? { background: "oklch(0.42 0.18 265)" } : {}}
                        onClick={() => summaryTable.setPageIndex(i)}>
                        {i + 1}
                      </Button>
                    )
                  })}
                  <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg"
                    onClick={() => summaryTable.nextPage()} disabled={!summaryTable.getCanNextPage()}>
                    <ChevronRightIcon className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── TOP SKUs TAB ─── */}
        {activeTab === "skus" && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            {/* Chart — wider Y axis for full names */}
            <div className="rounded-2xl border bg-white overflow-hidden"
              style={{ borderColor: "oklch(0.88 0.025 245)", boxShadow: "0 1px 8px oklch(0.42 0.18 265 / 0.04)" }}>
              <div className="px-6 py-4 border-b flex items-center gap-2"
                style={{ background: "oklch(0.97 0.014 248)", borderColor: "oklch(0.90 0.025 245)" }}>
                <TrendingUp className="h-4 w-4" style={{ color: "oklch(0.42 0.18 265)" }} />
                <span className="font-black text-slate-800">Top 10 SKUs by Volume (KG)</span>
              </div>
              <div className="p-5" style={{ height: 420 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 30, top: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="oklch(0.93 0.015 245)" />
                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: 'oklch(0.60 0.04 245)', fontSize: 10, fontWeight: 600 }} />
                    <YAxis type="category" dataKey="name" axisLine={false} tickLine={false}
                      tick={{ fill: 'oklch(0.45 0.04 245)', fontSize: 9, fontWeight: 700 }} width={140} />
                    <Tooltip
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 8px 24px rgba(99,102,241,0.12)', fontSize: '12px', fontWeight: 'bold' }}
                      formatter={(v: any, _: any, p: any) => [`${v.toLocaleString()} KG`, p.payload.fullName]}
                    />
                    <Bar dataKey="kg" radius={[0, 6, 6, 0]}>
                      {chartData.map((entry, idx) => (
                        <Cell key={idx} fill={getColor(entry.oil)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* SKU Details Table */}
            <div className="rounded-2xl border bg-white overflow-hidden"
              style={{ borderColor: "oklch(0.88 0.025 245)", boxShadow: "0 1px 8px oklch(0.42 0.18 265 / 0.04)" }}>
              <div className="px-6 py-4 border-b flex items-center gap-2"
                style={{ background: "oklch(0.97 0.014 248)", borderColor: "oklch(0.90 0.025 245)" }}>
                <Package className="h-4 w-4" style={{ color: "oklch(0.42 0.18 265)" }} />
                <span className="font-black text-slate-800">SKU Details — Oil Type Wise</span>
              </div>
              <ScrollArea style={{ height: 420 }}>
                <Table>
                  <TableHeader style={{ background: "oklch(0.98 0.01 245)" }}>
                    <TableRow style={{ borderColor: "oklch(0.90 0.025 245)" }}>
                      <TableHead className="pl-4 py-3 text-[10px] font-black uppercase w-8" style={{ color: "oklch(0.52 0.04 245)" }}>#</TableHead>
                      <TableHead className="py-3 text-[10px] font-black uppercase" style={{ color: "oklch(0.52 0.04 245)" }}>Oil Type</TableHead>
                      <TableHead className="py-3 text-[10px] font-black uppercase" style={{ color: "oklch(0.52 0.04 245)" }}>SKU / Product</TableHead>
                      <TableHead className="py-3 text-[10px] font-black uppercase text-right" style={{ color: "oklch(0.52 0.04 245)" }}>SKU Wt</TableHead>
                      <TableHead className="py-3 text-[10px] font-black uppercase text-right" style={{ color: "oklch(0.52 0.04 245)" }}>Total KG</TableHead>
                      <TableHead className="py-3 text-[10px] font-black uppercase text-right" style={{ color: "oklch(0.52 0.04 245)" }}>SKU Qty (Box)</TableHead>
                      <TableHead className="pr-4 py-3 text-[10px] font-black uppercase text-right" style={{ color: "oklch(0.52 0.04 245)" }}>SKU Qty (KG)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topSkus.map((s, i) => (
                      <TableRow key={i} className="hover:bg-slate-50/80 transition-colors" style={{ borderColor: "oklch(0.93 0.015 245)" }}>
                        <TableCell className="pl-4 py-3 text-[11px] font-black text-slate-400">{i + 1}</TableCell>
                        <TableCell className="py-3">
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-md whitespace-nowrap"
                            style={{ background: `${getColor(s.oil_type)}18`, color: getColor(s.oil_type) }}>
                            {normalizeOilType(s.oil_type)}
                          </span>
                        </TableCell>
                        {/* SKU name: wrap fully, no truncate */}
                        <TableCell className="py-3 text-sm font-semibold text-slate-700 max-w-[220px]">
                          <span className="whitespace-normal break-words leading-snug">{s.sku}</span>
                        </TableCell>
                        {/* SKU Weight per unit */}
                        <TableCell className="py-3 text-right text-[11px] font-bold text-slate-500 tabular-nums">
                          {s.sku_weight ? `${s.sku_weight} kg` : "—"}
                        </TableCell>
                        <TableCell className="py-3 text-right font-black text-slate-800 tabular-nums">{fmt(s.total_kg)}</TableCell>
                        {/* SKU Qty (Box) */}
                        <TableCell className="py-3 text-right text-slate-600 tabular-nums font-bold">
                          {s.total_qty ? fmt(s.total_qty, 0) : "—"}
                        </TableCell>
                        {/* SKU Qty in KG = total_qty × sku_weight */}
                        <TableCell className="pr-4 py-3 text-right font-black text-indigo-700 tabular-nums">
                          {s.total_qty_kg ? fmt(s.total_qty_kg) : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                    {topSkus.length === 0 && (
                      <TableRow><TableCell colSpan={5} className="text-center py-16 text-slate-400 text-sm font-bold">No SKU data</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          </div>
        )}

        {/* ─── STAGE TIMELINE TAB ─── */}
        {activeTab === "timeline" && (
          <div className="rounded-2xl border bg-white overflow-hidden"
            style={{ borderColor: "oklch(0.88 0.025 245)", boxShadow: "0 1px 8px oklch(0.42 0.18 265 / 0.04)" }}>
            <div className="px-6 py-4 border-b flex items-center gap-2"
              style={{ background: "oklch(0.97 0.014 248)", borderColor: "oklch(0.90 0.025 245)" }}>
              <Calendar className="h-4 w-4" style={{ color: "oklch(0.42 0.18 265)" }} />
              <span className="font-black text-slate-800">Planned vs Actual vs Delay — Per Order</span>
              <span className="text-xs text-slate-400">Click order to expand stages</span>
            </div>

            <ScrollArea style={{ height: 620 }}>
              <div className="divide-y" style={{ borderColor: "oklch(0.93 0.015 245)" }}>
                {isLoading ? (
                  Array(6).fill(0).map((_, i) => (
                    <div key={i} className="px-6 py-4 flex items-center gap-4">
                      <Skeleton className="h-6 w-6 rounded-full" />
                      <Skeleton className="h-5 w-24" />
                      <Skeleton className="h-5 flex-1" />
                      <Skeleton className="h-5 w-20" />
                    </div>
                  ))
                ) : summaryTable.getRowModel().rows.map(({ original: order }, i) => (
                  <div key={i}>
                    {/* Order header row */}
                    <button
                      onClick={() => setExpandedOrder(expandedOrder === order.order_no ? null : order.order_no)}
                      className="w-full flex items-center gap-4 px-6 py-3.5 hover:bg-slate-50 transition-colors text-left group">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full shrink-0"
                        style={{ background: expandedOrder === order.order_no ? "oklch(0.42 0.18 265)" : "oklch(0.93 0.03 245)" }}>
                        <ChevronRight className="h-3.5 w-3.5 transition-transform duration-200"
                          style={{
                            color: expandedOrder === order.order_no ? "white" : "#94a3b8",
                            transform: expandedOrder === order.order_no ? "rotate(90deg)" : "rotate(0)"
                          }} />
                      </div>
                      <span className="font-black text-slate-800 text-sm min-w-[100px]">{order.order_no}</span>
                      <span className="text-slate-500 text-xs font-medium flex-1 truncate">{order.customer_name}</span>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-md hidden sm:inline"
                        style={{ background: `${getColor(order.oil_type)}18`, color: getColor(order.oil_type) }}>
                        {normalizeOilType(order.oil_type)}
                      </span>
                      <span className="text-xs font-bold text-slate-500 hidden md:inline">{order.sku_name || "—"}</span>
                      <span className="text-xs font-black tabular-nums" style={{ color: "oklch(0.42 0.18 265)" }}>
                        {fmt(parseFloat(order.order_quantity) || 0)} KG
                      </span>
                      <span className="text-[10px] text-slate-400">{order.stages.length} stages</span>
                    </button>

                    {/* Expanded stage rows */}
                    {expandedOrder === order.order_no && (
                      <div className="border-t" style={{ background: "oklch(0.985 0.008 248)", borderColor: "oklch(0.92 0.02 245)" }}>
                        <table className="w-full">
                          <thead>
                            <tr style={{ borderBottom: "1px solid oklch(0.92 0.02 245)" }}>
                              <th className="pl-12 py-2 text-[10px] font-black uppercase text-left text-slate-400">Stage</th>
                              <th className="py-2 text-[10px] font-black uppercase text-left text-slate-400">Planned Date</th>
                              <th className="py-2 text-[10px] font-black uppercase text-left text-slate-400">Actual Date</th>
                              <th className="pr-6 py-2 text-[10px] font-black uppercase text-right text-slate-400">Delay</th>
                            </tr>
                          </thead>
                          <tbody>
                            {order.stages.map((s: any, j: number) => (
                              <tr key={j} className="hover:bg-white/60 transition-colors"
                                style={{ borderBottom: "1px solid oklch(0.93 0.015 245)" }}>
                                <td className="pl-12 py-2">
                                  <span className="text-[12px] font-semibold text-slate-700">{s.stage}</span>
                                </td>
                                <td className="py-2 text-xs text-slate-500 tabular-nums">{fmtDate(s.planned)}</td>
                                <td className="py-2 text-xs text-slate-700 font-semibold tabular-nums">{fmtDate(s.actual)}</td>
                                <td className="pr-6 py-2 text-right">{fmtDelay(s.delayDays)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}
                {orderTimeline.length === 0 && !isLoading && (
                  <div className="text-center py-20 text-slate-400 text-sm font-bold">No data found — try adjusting filters</div>
                )}
              </div>
            </ScrollArea>

            {/* Pagination Controls */}
            {!isLoading && orderTimeline.length > pagination.pageSize && (
              <div className="px-6 py-3 border-t bg-slate-50/50 flex items-center justify-between" style={{ borderColor: "oklch(0.90 0.025 245)" }}>
                <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                  Showing <span className="text-slate-900 mx-1">{Math.min(orderTimeline.length, pagination.pageIndex * pagination.pageSize + 1)}</span>
                  to <span className="text-slate-900 mx-1">{Math.min(orderTimeline.length, (pagination.pageIndex + 1) * pagination.pageSize)}</span>
                  of <span className="text-slate-900 mx-1">{orderTimeline.length}</span> orders
                </div>
                <div className="flex items-center gap-1.5 font-black">
                  <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg"
                    onClick={() => summaryTable.previousPage()} disabled={!summaryTable.getCanPreviousPage()}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  {Array.from({ length: summaryTable.getPageCount() }).map((_, i) => {
                    // Only show 5 pages around current
                    if (Math.abs(i - pagination.pageIndex) > 2 && i !== 0 && i !== summaryTable.getPageCount() - 1) return null
                    if (Math.abs(i - pagination.pageIndex) === 3) return <span key={i} className="px-1 text-slate-400 opacity-50">...</span>
                    return (
                      <Button key={i} variant={pagination.pageIndex === i ? "default" : "outline"} size="icon"
                        className="h-8 w-8 rounded-lg text-xs" style={pagination.pageIndex === i ? { background: "oklch(0.42 0.18 265)" } : {}}
                        onClick={() => summaryTable.setPageIndex(i)}>
                        {i + 1}
                      </Button>
                    )
                  })}
                  <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg"
                    onClick={() => summaryTable.nextPage()} disabled={!summaryTable.getCanNextPage()}>
                    <ChevronRightIcon className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Loading overlay for fetching more data */}
        {isFetching && !isLoading && (
          <div className="flex items-center justify-center py-12 gap-3 text-slate-400">
            <div className="h-5 w-5 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
            <span className="text-sm font-bold">Updating report…</span>
          </div>
        )}
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body { background: white !important; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  )
}
