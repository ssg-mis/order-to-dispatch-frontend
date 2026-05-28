"use client"

import { useState, useCallback } from "react"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FileDown, Download, Loader2, ChevronDown, ChevronRight } from "lucide-react"
import { reportsApi } from "@/lib/api-service"

// ── Column definitions ────────────────────────────────────────────────────────

interface ColDef {
  key: string
  label: string
  available: boolean
}

interface ColGroup {
  label: string
  columns: ColDef[]
}

const COLUMN_GROUPS: ColGroup[] = [
  {
    label: "Dispatch Info",
    columns: [
      { key: "sn",               label: "SN",                available: true  },
      { key: "dispatch_date",    label: "Dispatch Date",      available: true  },
      { key: "dispatch_no",      label: "Dispatch No.",       available: true  },
      { key: "dispatch_type",    label: "Dispatch Type",      available: true  },
      { key: "do_no",            label: "DO No.",             available: true  },
      { key: "sauda_no",         label: "Sauda No.",          available: true  },
      { key: "sauda_date",       label: "Sauda Date",         available: true  },
      { key: "sauda_end_date",   label: "Sauda End Date",     available: true  },
      { key: "fulfillment_status", label: "Fulfillment Status", available: true },
    ],
  },
  {
    label: "Vehicle",
    columns: [
      { key: "vehicle_no",       label: "Vehicle No.",        available: true  },
      { key: "road_tax",         label: "Road Tax",           available: true  },
      { key: "pollution",        label: "Pollution",          available: true  },
      { key: "insurance",        label: "Insurance",          available: true  },
      { key: "fitness",          label: "Fitness",            available: true  },
      { key: "state_permit",     label: "State Permit",       available: true  },
      { key: "national_permit",  label: "National Permit",    available: true  },
    ],
  },
  {
    label: "Transport & Freight",
    columns: [
      { key: "godown_id",                  label: "Godown ID",                   available: true  },
      { key: "godown_name",                label: "Godown Name",                 available: true  },
      { key: "destination",               label: "Destination",                 available: true  },
      { key: "delivery_type",             label: "Delivery Type",               available: true  },
      { key: "transport_type",            label: "Transport Type",              available: true  },
      { key: "transporter_id",            label: "Transporter ID",              available: true  },
      { key: "transporter_name",          label: "Transporter Name",            available: true  },
      { key: "transporter_gstin",         label: "Transporter GSTIN",           available: true  },
      { key: "freight_rate_per_mt",       label: "Freight Rate per MT",         available: true  },
      { key: "total_freight",             label: "Total Freight",               available: true  },
      { key: "advance_freight_cash_bank", label: "Advance Freight Cash/Bank",   available: true  },
      { key: "advance_freight_diesel",    label: "Advance Freight Diesel",      available: true  },
      { key: "bhada_type",                label: "Bhada Type",                  available: true  },
    ],
  },
  {
    label: "Driver",
    columns: [
      { key: "driver_name",         label: "Driver Name",            available: true  },
      { key: "driver_mobile",       label: "Driver Mobile Number",   available: true  },
      { key: "driving_licence_no",  label: "Driving Licence No.",    available: true  },
      { key: "licence_expiry",      label: "Licence Expiry Date",    available: true  },
    ],
  },
  {
    label: "Sales & Broker",
    columns: [
      { key: "salesman_id",   label: "Salesman ID",    available: true  },
      { key: "salesman_name", label: "Salesman Name",  available: true  },
      { key: "broker_id",     label: "Broker ID",      available: true  },
      { key: "broker_name",   label: "Broker Name",    available: true  },
      { key: "broker_gstin",  label: "Broker GSTIN",   available: false },
    ],
  },
  {
    label: "Customer",
    columns: [
      { key: "customer_id",      label: "Customer ID",      available: true  },
      { key: "customer_name",    label: "Customer Name",    available: true  },
      { key: "customer_gstin",   label: "Customer GSTIN",   available: true  },
      { key: "place_area",       label: "Place / Area",     available: true  },
      { key: "customer_address", label: "Customer Address", available: true  },
    ],
  },
  {
    label: "Transfer / Billing",
    columns: [
      { key: "sauda_transfer",  label: "Sauda Transfer",  available: true  },
      { key: "bill_to",         label: "Bill To",         available: true  },
      { key: "bill_to_gstin",   label: "Bill To GSTIN",   available: false },
      { key: "bill_to_address", label: "Bill To Address", available: true  },
      { key: "ship_to",         label: "Ship To",         available: true  },
      { key: "ship_to_gstin",   label: "Ship To GSTIN",   available: false },
      { key: "ship_to_address", label: "Ship To Address", available: true  },
    ],
  },
  {
    label: "SKU / Product",
    columns: [
      { key: "sku_id",               label: "SKU ID",                         available: true  },
      { key: "sku_name",             label: "SKU Name",                       available: true  },
      { key: "filling_pcs",          label: "Filling Pcs",                    available: true  },
      { key: "rate_per_pcs",         label: "Rate per Pcs",                   available: true  },
      { key: "qty_box_tin",          label: "Qty (Box/TIN)",                  available: true  },
      { key: "balance_qty",          label: "Balance Qty",                    available: true  },
      { key: "sauda_rate",           label: "Sauda Rate",                     available: true  },
      { key: "freight_rate",         label: "Freight Rate",                   available: true  },
      { key: "net_rate",             label: "Net Rate",                       available: true  },
      { key: "gst_rate",             label: "GST Rate",                       available: true  },
      { key: "rate_wo_gst",          label: "Rate w/o GST",                   available: true  },
      { key: "item_amount",          label: "Item Amount",                    available: true  },
      { key: "item_taxable_amount",  label: "Item Taxable Amount",            available: true  },
      { key: "item_igst",            label: "Item IGST",                      available: false },
      { key: "item_cgst",            label: "Item CGST",                      available: true  },
      { key: "item_sgst",            label: "Item SGST",                      available: true  },
    ],
  },
  {
    label: "Invoice",
    columns: [
      { key: "invoice_date",   label: "Invoice Date",    available: true  },
      { key: "invoice_no",     label: "Invoice No.",     available: true  },
      { key: "taxable_amount", label: "Taxable Amount",  available: true  },
      { key: "igst",           label: "IGST",            available: false },
      { key: "cgst",           label: "CGST",            available: true  },
      { key: "sgst",           label: "SGST",            available: true  },
      { key: "total",          label: "Total",           available: true  },
      { key: "round_off",      label: "Round Off",       available: true  },
      { key: "invoice_amount", label: "Invoice Amount",  available: true  },
      { key: "bill_amount",    label: "Bill Amount",     available: true  },
    ],
  },
  {
    label: "Weight",
    columns: [
      { key: "rst_no",        label: "RST No.",        available: true  },
      { key: "rst_gross_wt",  label: "RST Gross Wt",   available: true  },
      { key: "rst_tare_wt",   label: "RST Tare Wt",    available: true  },
      { key: "rst_net_wt",    label: "RST Net Wt",     available: true  },
      { key: "extra_mat_wt",  label: "Extra Mat Wt",   available: true  },
      { key: "rst_wt",        label: "RST Wt",         available: true  },
      { key: "sku_gross_wt",  label: "SKU Gross Wt",   available: true  },
      { key: "total_gross_wt",label: "Total Gross Wt", available: true  },
      { key: "gross_wt",      label: "Gross Wt",       available: true  },
      { key: "wt_diff",       label: "Wt Diff",        available: true  },
      { key: "wt_diff_reason",label: "Wt Diff Reason", available: true  },
      { key: "sku_wt",        label: "SKU Wt",         available: true  },
      { key: "oil_wt",        label: "Oil Wt",         available: true  },
      { key: "total_sku_wt",  label: "Total SKU Wt",   available: true  },
      { key: "total_oil_wt",  label: "Total Oil Wt",   available: true  },
      { key: "bill_sku_wt",   label: "Bill SKU Wt",    available: false },
      { key: "bill_oil_wt",   label: "Bill Oil Wt",    available: false },
    ],
  },
]

const ALL_KEYS = COLUMN_GROUPS.flatMap(g => g.columns.map(c => c.key))

const DEFAULT_SELECTED = new Set(
  COLUMN_GROUPS.flatMap(g => g.columns.filter(c => c.available).map(c => c.key))
)

const COL_MAP = new Map<string, ColDef>(
  COLUMN_GROUPS.flatMap(g => g.columns.map(c => [c.key, c]))
)

// ── Helpers ───────────────────────────────────────────────────────────────────

const DATE_KEYS = new Set([
  "dispatch_date", "invoice_date", "sauda_date", "sauda_end_date", "licence_expiry",
  "road_tax", "pollution", "insurance", "fitness", "state_permit", "national_permit",
])

function looksLikeDate(v: string): boolean {
  return /^\d{4}-\d{2}-\d{2}(T[\d:.Z+\-]*)?$/.test(v)
}

function fmtDate(val: any): string {
  try {
    const d = new Date(val)
    if (!isNaN(d.getTime()))
      return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
  } catch { /* fall through */ }
  return String(val)
}

function fmtVal(val: any, key: string, available: boolean): string {
  if (!available) return "Not available in table"
  if (val === null || val === undefined || val === "") return ""

  if (key.endsWith("_date") || DATE_KEYS.has(key)) return fmtDate(val)

  if (key === "gst_rate") return `${(parseFloat(val) * 100).toFixed(0)}%`

  if (typeof val === "number") return val % 1 !== 0 ? val.toFixed(2) : String(val)

  if (typeof val === "string") {
    if (/^-?\d+(\.\d+)?$/.test(val.trim())) {
      const n = parseFloat(val)
      return n % 1 !== 0 ? n.toFixed(2) : String(Math.round(n))
    }
    if (looksLikeDate(val)) return fmtDate(val)
  }

  if (key === "vehicle_no") return String(val).toUpperCase()

  return String(val)
}

function csvCell(val: string): string {
  // Wrap in quotes; escape any quotes inside by doubling them
  return `"${val.replace(/"/g, '""')}"`
}

function generateCsv(rows: any[], selectedKeys: string[]): void {
  const cols = selectedKeys.map(k => COL_MAP.get(k)!)

  const header = cols.map(c => csvCell(c.label)).join(",")
  const body = rows.map(row =>
    cols.map(c => csvCell(fmtVal(row[c.key], c.key, c.available))).join(",")
  ).join("\r\n")

  const csv = header + "\r\n" + body
  // BOM so Excel opens UTF-8 correctly
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `CP_Dispatch_Report_${new Date().toISOString().split("T")[0]}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ExportPdfModal() {
  const [open, setOpen] = useState(false)

  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const [customerName, setCustomerName] = useState("")
  const [dispatchNo, setDispatchNo] = useState("")
  const [orderNo, setOrderNo] = useState("")

  const [selected, setSelected] = useState<Set<string>>(new Set(DEFAULT_SELECTED))
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggleCol = (key: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const toggleGroup = (group: ColGroup) => {
    const keys = group.columns.map(c => c.key)
    const allOn = keys.every(k => selected.has(k))
    setSelected(prev => {
      const next = new Set(prev)
      keys.forEach(k => allOn ? next.delete(k) : next.add(k))
      return next
    })
  }

  const selectAll = () => setSelected(new Set(ALL_KEYS))
  const deselectAll = () => setSelected(new Set())

  const toggleGroupCollapse = (label: string) => {
    setCollapsed(prev => ({ ...prev, [label]: !prev[label] }))
  }

  const handleGenerate = useCallback(async () => {
    if (selected.size === 0) {
      setError("Please select at least one column.")
      return
    }
    setLoading(true)
    setError(null)
    try {
      const params: Record<string, string> = {}
      if (fromDate)     params.from_date     = fromDate
      if (toDate)       params.to_date       = toDate
      if (customerName) params.customer_name = customerName
      if (dispatchNo)   params.dispatch_no   = dispatchNo
      if (orderNo)      params.order_no      = orderNo

      const res = await reportsApi.getDispatchReport(Object.keys(params).length ? params : undefined)
      if (!res.success) throw new Error(res.message || "Failed to fetch data")

      const rows: any[] = res.data || []
      if (rows.length === 0) {
        setError("No records found for the selected filters.")
        return
      }

      const selectedKeys = ALL_KEYS.filter(k => selected.has(k))
      generateCsv(rows, selectedKeys)
      setOpen(false)
    } catch (e: any) {
      setError(e.message || "An error occurred.")
    } finally {
      setLoading(false)
    }
  }, [selected, fromDate, toDate, customerName, dispatchNo, orderNo])

  const selectedCount = selected.size

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="rounded-xl text-xs font-bold gap-1.5 hover:bg-emerald-50 hover:border-emerald-400 hover:text-emerald-700 transition-colors"
        >
          <FileDown className="h-3.5 w-3.5" /> Export CSV
        </Button>
      </DialogTrigger>

      <DialogContent
        className="max-w-4xl w-full p-0 gap-0 flex flex-col overflow-hidden"
        style={{ maxHeight: "90vh" }}
      >
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b shrink-0" style={{ background: "oklch(0.97 0.012 245)" }}>
          <DialogTitle className="flex items-center gap-2 text-base font-black text-slate-900">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: "oklch(0.42 0.18 265 / 0.12)" }}>
              <FileDown className="h-4 w-4" style={{ color: "oklch(0.42 0.18 265)" }} />
            </div>
            Export CSV Report
            <span className="ml-auto text-xs font-medium text-slate-400 normal-case">
              {selectedCount} column{selectedCount !== 1 ? "s" : ""} selected
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="px-6 py-4 space-y-5">

            {/* Filters */}
            <div>
              <div className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-2">Filters</div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">From Date</label>
                  <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
                    className="h-8 text-xs rounded-lg border-slate-200 bg-slate-50" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">To Date</label>
                  <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
                    className="h-8 text-xs rounded-lg border-slate-200 bg-slate-50" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">Customer Name</label>
                  <Input placeholder="Filter by customer…" value={customerName} onChange={e => setCustomerName(e.target.value)}
                    className="h-8 text-xs rounded-lg border-slate-200 bg-slate-50" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">Dispatch No.</label>
                  <Input placeholder="e.g. DSR-001" value={dispatchNo} onChange={e => setDispatchNo(e.target.value)}
                    className="h-8 text-xs rounded-lg border-slate-200 bg-slate-50" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">DO No.</label>
                  <Input placeholder="e.g. DO-416" value={orderNo} onChange={e => setOrderNo(e.target.value)}
                    className="h-8 text-xs rounded-lg border-slate-200 bg-slate-50" />
                </div>
              </div>
            </div>

            {/* Column selection header */}
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">Select Columns</div>
              <div className="flex gap-2">
                <button onClick={selectAll}
                  className="text-[11px] font-bold px-2 py-1 rounded-lg hover:bg-indigo-50 text-indigo-600 transition-colors">
                  Select All
                </button>
                <button onClick={deselectAll}
                  className="text-[11px] font-bold px-2 py-1 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
                  Deselect All
                </button>
              </div>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 text-[10px] font-medium text-slate-500">
              <span className="flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" />
                Available in DB
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full bg-slate-300" />
                Not in DB (shows "Not available in table")
              </span>
            </div>

            {/* Column groups */}
            <div className="space-y-2">
              {COLUMN_GROUPS.map(group => {
                const groupKeys = group.columns.map(c => c.key)
                const allOn = groupKeys.every(k => selected.has(k))
                const someOn = !allOn && groupKeys.some(k => selected.has(k))
                const isCollapsed = collapsed[group.label]

                return (
                  <div key={group.label}
                    className="border rounded-xl overflow-hidden"
                    style={{ borderColor: "oklch(0.88 0.025 245)" }}>

                    <div
                      className="flex items-center gap-2 px-4 py-2.5 cursor-pointer select-none hover:bg-slate-50 transition-colors"
                      style={{ background: "oklch(0.98 0.01 245)" }}
                      onClick={() => toggleGroupCollapse(group.label)}
                    >
                      <div
                        onClick={e => { e.stopPropagation(); toggleGroup(group) }}
                        className="flex items-center justify-center w-4 h-4 rounded border cursor-pointer transition-colors shrink-0"
                        style={{
                          background: allOn ? "oklch(0.42 0.18 265)" : someOn ? "oklch(0.75 0.12 265)" : "white",
                          borderColor: (allOn || someOn) ? "oklch(0.42 0.18 265)" : "oklch(0.80 0.025 245)",
                        }}
                      >
                        {(allOn || someOn) && (
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                            {allOn
                              ? <path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                              : <path d="M2 5h6" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                            }
                          </svg>
                        )}
                      </div>

                      <span className="font-black text-sm text-slate-700 flex-1">{group.label}</span>
                      <span className="text-[10px] font-bold text-slate-400">
                        {groupKeys.filter(k => selected.has(k)).length}/{group.columns.length}
                      </span>
                      {isCollapsed
                        ? <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                        : <ChevronDown  className="h-3.5 w-3.5 text-slate-400" />
                      }
                    </div>

                    {!isCollapsed && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1 p-3 border-t"
                        style={{ borderColor: "oklch(0.92 0.02 245)" }}>
                        {group.columns.map(col => {
                          const isOn = selected.has(col.key)
                          return (
                            <label key={col.key}
                              className="flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors hover:bg-slate-50 select-none">
                              <div
                                onClick={() => toggleCol(col.key)}
                                className="flex items-center justify-center w-4 h-4 rounded border cursor-pointer shrink-0 transition-colors"
                                style={{
                                  background: isOn ? "oklch(0.42 0.18 265)" : "white",
                                  borderColor: isOn ? "oklch(0.42 0.18 265)" : "oklch(0.80 0.025 245)",
                                }}
                              >
                                {isOn && (
                                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                    <path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                )}
                              </div>

                              <span
                                className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
                                style={{ background: col.available ? "#34d399" : "#d1d5db" }}
                              />

                              <span className={`text-[11px] font-medium leading-tight ${isOn ? "text-slate-800" : "text-slate-400"}`}>
                                {col.label}
                              </span>
                            </label>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {error && (
              <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm font-bold text-rose-700">
                {error}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t shrink-0 flex items-center justify-between bg-white"
          style={{ borderColor: "oklch(0.90 0.025 245)" }}>
          <p className="text-xs text-slate-400 font-medium">
            CSV downloads instantly and opens in Excel.
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="rounded-xl gap-1.5 font-bold"
              style={{ background: "oklch(0.42 0.18 265)" }}
              onClick={handleGenerate}
              disabled={loading || selectedCount === 0}
            >
              {loading
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Fetching…</>
                : <><Download className="h-3.5 w-3.5" /> Download CSV</>
              }
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
