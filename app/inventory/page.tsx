"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useAuth } from "@/hooks/use-auth"
import { inventoryApi } from "@/lib/api-service"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2, Warehouse, RefreshCw, TrendingUp, TrendingDown, Package, X } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type InventoryRow = {
  depot_name: string
  product_name: string
  sku_id: string
  stock_in: number
  stock_out: number
  sales: number
  opening_qty: number
  opening_qty_updated_at: string | null
  production_qty: number
}

export default function InventoryPage() {
  const router = useRouter()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  // Filters
  const [selectedDepo, setSelectedDepo] = useState<string>("all")
  const [selectedProduct, setSelectedProduct] = useState<string>("all")
  const [skuWiseMode, setSkuWiseMode] = useState(false)


  // Drill-down modal
  type DrillDown = { depot: string; product: string; type: 'stockIn' | 'stockOut' | 'sales' | 'closingStock' | 'openingQty'; row: any }
  const [drillDown, setDrillDown] = useState<DrillDown | null>(null)
  const [detailRows, setDetailRows] = useState<any[]>([])
  const [detailLoading, setDetailLoading] = useState(false)

  const openDrillDown = async (row: any, type: DrillDown['type']) => {
    if (row._skuWise) return
    setDrillDown({ depot: row.depot_name, product: row.product_name, type, row })
    if (type === 'closingStock' || type === 'openingQty') return
    setDetailLoading(true)
    setDetailRows([])
    try {
      const apiType = type === 'stockIn' ? 'stock_in' : type === 'stockOut' ? 'stock_out' : 'sales'
      const res = await inventoryApi.getDetail(row.depot_name, row.product_name, apiType)
      setDetailRows(res.success ? res.data : [])
    } finally {
      setDetailLoading(false)
    }
  }

  const { data: rawData, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["inventory-data"],
    queryFn: async () => {
      const res = await inventoryApi.getData()
      return res.success ? (res.data as InventoryRow[]) : []
    },
    staleTime: 30_000,
  })

  // Filter raw data to only depots the user has access to (strict deny-by-default, same as Dispatch Planning)
  const filteredRawData = useMemo(() => {
    const allowed = user?.depo_access?.['Inventory'] || []
    if (allowed.length === 0) return []
    return (rawData || []).filter(r =>
      allowed.some(d => d.toLowerCase() === r.depot_name.toLowerCase())
    )
  }, [rawData, user?.depo_access])

  // Unique depot options — derived from allowed access list so all granted depots appear even if they have no data
  const depoOptions = useMemo(() =>
    [...(user?.depo_access?.['Inventory'] || [])].sort()
  , [user?.depo_access])

  // Product options — scoped to selected depot (for the Depo/Product filters)
  const productOptions = useMemo(() => {
    const source = selectedDepo === "all"
      ? filteredRawData
      : filteredRawData.filter((r) => r.depot_name === selectedDepo)
    return Array.from(new Set(source.map((r) => r.product_name))).sort()
  }, [filteredRawData, selectedDepo])

  // Reset product filter when depot changes and selected product no longer exists
  useEffect(() => {
    if (selectedProduct !== "all" && !productOptions.includes(selectedProduct)) {
      setSelectedProduct("all")
    }
  }, [productOptions, selectedProduct])

  // Mutual exclusion: SKU wise clears depo/product filters; depo/product clears SKU wise
  const handleSkuWiseToggle = () => {
    setSkuWiseMode((prev) => {
      if (!prev) { setSelectedDepo("all"); setSelectedProduct("all") }
      return !prev
    })
  }
  const handleDepoChange = (val: string) => {
    setSelectedDepo(val)
    if (val !== "all") setSkuWiseMode(false)
  }
  const handleProductChange = (val: string) => {
    setSelectedProduct(val)
    if (val !== "all") setSkuWiseMode(false)
  }

  const rows = useMemo(() => {
    // ── SKU Wise mode: one row per unique product, totals across all depots ──
    if (skuWiseMode) {
      const productMap = new Map<string, any>()
      ;filteredRawData.forEach((r) => {
        const openingQty   = Number(r.opening_qty)    || 0
        const productionQt = Number(r.production_qty) || 0
        const stockIn      = Number(r.stock_in)       || 0
        const stockOut     = Number(r.stock_out)      || 0
        const sales        = Number(r.sales)          || 0
        if (!productMap.has(r.product_name)) {
          productMap.set(r.product_name, {
            key: `sku-wise|||${r.product_name}`,
            depot_name: "All Depots",
            product_name: r.product_name,
            sku_id: r.sku_id ?? "",
            openingQty: 0, production: 0, stockIn: 0, stockOut: 0, sales: 0, closingStock: 0,
            _skuWise: true,
          })
        }
        const entry = productMap.get(r.product_name)!
        entry.openingQty += openingQty
        entry.production += productionQt
        entry.stockIn    += stockIn
        entry.stockOut   += stockOut
        entry.sales      += sales
      })
      return Array.from(productMap.values())
        .map((e) => ({ ...e, closingStock: e.openingQty + e.production + e.stockIn - e.stockOut - e.sales }))
        .sort((a, b) => a.product_name.localeCompare(b.product_name))
    }

    // ── Normal mode: depo + product filters ──
    return filteredRawData
      .filter((row) => {
        if (selectedDepo    !== "all" && row.depot_name    !== selectedDepo)    return false
        if (selectedProduct !== "all" && row.product_name  !== selectedProduct) return false
        return true
      })
      .map((row) => {
        const key          = `${row.depot_name}|||${row.product_name}`
        const openingQty   = Number(row.opening_qty)    || 0
        const production   = Number(row.production_qty) || 0
        const stockIn      = Number(row.stock_in)       || 0
        const stockOut     = Number(row.stock_out)      || 0
        const sales        = Number(row.sales)          || 0
        const closingStock = openingQty + production + stockIn - stockOut - sales
        return { ...row, key, openingQty, production, stockIn, stockOut, sales, closingStock, _skuWise: false }
      })
  }, [filteredRawData, selectedDepo, selectedProduct, skuWiseMode])

  const totals = useMemo(() => ({
    openingQty: rows.reduce((s, r) => s + r.openingQty, 0),
    production: rows.reduce((s, r) => s + r.production, 0),
    stockIn: rows.reduce((s, r) => s + r.stockIn, 0),
    stockOut: rows.reduce((s, r) => s + r.stockOut, 0),
    sales: rows.reduce((s, r) => s + r.sales, 0),
    closingStock: rows.reduce((s, r) => s + r.closingStock, 0),
  }), [rows])

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: "oklch(0.54 0.22 265)" }} />
          <p className="text-sm text-slate-500">Loading inventory data…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ background: "oklch(0.54 0.22 265 / 0.12)" }}
          >
            <Warehouse className="h-5 w-5" style={{ color: "oklch(0.54 0.22 265)" }} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Inventory</h1>
            <p className="text-sm text-slate-500">Stock levels by depot and SKU</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="gap-2 text-sm"
        >
          {isFetching ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Refresh
        </Button>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Depot filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-500 whitespace-nowrap">Depo</span>
          <Select value={selectedDepo} onValueChange={handleDepoChange} disabled={skuWiseMode}>
            <SelectTrigger className="h-9 w-48 text-sm">
              <SelectValue placeholder="All Depots" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Depots</SelectItem>
              {depoOptions.map((d) => (
                <SelectItem key={d} value={d}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Product filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-500 whitespace-nowrap">Product</span>
          <Select value={selectedProduct} onValueChange={handleProductChange} disabled={skuWiseMode}>
            <SelectTrigger className="h-9 w-56 text-sm">
              <SelectValue placeholder="All Products" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Products</SelectItem>
              {productOptions.map((p) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Divider */}
        <div className="h-6 w-px bg-slate-200" />

        {/* Depo Wise toggle */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-500 whitespace-nowrap">Depo Wise</span>
          <button
            onClick={handleSkuWiseToggle}
            className={cn(
              "h-9 px-4 rounded-md text-sm font-medium transition-colors border",
              skuWiseMode
                ? "bg-amber-500 text-white border-amber-500 hover:bg-amber-600"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            )}
          >
            {skuWiseMode ? "Off" : "On"}
          </button>
        </div>

        {/* Clear all */}
        {(selectedDepo !== "all" || selectedProduct !== "all" || skuWiseMode) && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 gap-1.5 text-slate-500 hover:text-slate-700"
            onClick={() => { setSelectedDepo("all"); setSelectedProduct("all"); setSkuWiseMode(false) }}
          >
            <X className="h-3.5 w-3.5" />
            Clear
          </Button>
        )}

        {/* Active filter chips */}
        <div className="flex items-center gap-1.5 ml-auto">
          {selectedDepo !== "all" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 border border-blue-200">
              {selectedDepo}
              <button onClick={() => setSelectedDepo("all")} className="ml-0.5 hover:text-blue-900">
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          {selectedProduct !== "all" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-medium text-purple-700 border border-purple-200">
              {selectedProduct}
              <button onClick={() => setSelectedProduct("all")} className="ml-0.5 hover:text-purple-900">
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          {skuWiseMode && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 border border-amber-200">
              Depo Wise
              <button onClick={() => setSkuWiseMode(false)} className="ml-0.5 hover:text-amber-900">
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
        </div>
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <SummaryCard label="Total Stock In" value={totals.stockIn} color="green" icon={TrendingUp} />
        <SummaryCard label="Total Stock Out" value={totals.stockOut} color="orange" icon={TrendingDown} />
        <SummaryCard label="Total Sales" value={totals.sales} color="red" icon={Package} />
        <SummaryCard
          label="Net Closing Stock"
          value={totals.closingStock}
          color={totals.closingStock >= 0 ? "blue" : "red"}
          icon={Warehouse}
        />
      </div>

      {/* ── Table ── */}
      <Card className="overflow-hidden border-slate-200 shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 hover:bg-slate-50">
                  <TableHead className="font-semibold text-slate-700 whitespace-nowrap">SKU ID</TableHead>
                  <TableHead className="font-semibold text-slate-700 whitespace-nowrap">Depo Name</TableHead>
                  <TableHead className="font-semibold text-slate-700 whitespace-nowrap">SKU Name</TableHead>
                  <TableHead className="font-semibold text-slate-700 text-center whitespace-nowrap">Opening Qty</TableHead>
                  <TableHead className="font-semibold text-slate-700 text-center whitespace-nowrap">Stock In</TableHead>
                  <TableHead className="font-semibold text-slate-700 text-center whitespace-nowrap">Stock Out</TableHead>
                  <TableHead className="font-semibold text-slate-700 text-center whitespace-nowrap">Production</TableHead>
                  <TableHead className="font-semibold text-slate-700 text-center whitespace-nowrap">Sales</TableHead>
                  <TableHead className="font-semibold text-slate-700 text-center whitespace-nowrap">Closing Stock</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-2 text-slate-400">
                        <Warehouse className="h-10 w-10 opacity-30" />
                        <p className="text-sm font-medium">No inventory data found</p>
                        {(selectedDepo !== "all" || selectedProduct !== "all") ? (
                          <p className="text-xs">No records match the selected filters</p>
                        ) : (
                          <p className="text-xs">Data appears once Stock Transfer or Sales orders complete CMR or Gate Out stages</p>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => (
                    <TableRow key={row.key} className="hover:bg-slate-50/60 transition-colors">
                      {/* SKU ID */}
                      <TableCell className="font-mono text-xs text-slate-500 whitespace-nowrap">
                        {row.sku_id || "—"}
                      </TableCell>

                      {/* Depo Name */}
                      <TableCell className="whitespace-nowrap">
                        {row._skuWise ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200">
                            All Depots
                          </span>
                        ) : (
                          <span className="font-medium text-slate-800">{row.depot_name}</span>
                        )}
                      </TableCell>

                      {/* SKU Name */}
                      <TableCell className="text-slate-700 whitespace-nowrap">
                        {row.product_name}
                      </TableCell>

                      {/* Opening Qty */}
                      <TableCell className="text-center">
                        {row.openingQty !== 0 && !row._skuWise ? (
                          <button onClick={() => openDrillDown(row, 'openingQty')} className="text-sm font-semibold text-slate-700 underline decoration-dotted underline-offset-2 hover:text-slate-900 cursor-pointer">
                            {row.openingQty}
                          </button>
                        ) : (
                          <span className="text-sm font-semibold text-slate-700">{row.openingQty}</span>
                        )}
                      </TableCell>

                      {/* Stock In */}
                      <TableCell className="text-center">
                        {row.stockIn !== 0 && !row._skuWise ? (
                          <button onClick={() => openDrillDown(row, 'stockIn')} className="text-sm font-medium text-emerald-700 underline decoration-dotted underline-offset-2 hover:text-emerald-900 cursor-pointer">
                            {row.stockIn}
                          </button>
                        ) : (
                          <span className="text-sm font-medium text-emerald-700">{row.stockIn}</span>
                        )}
                      </TableCell>

                      {/* Stock Out */}
                      <TableCell className="text-center">
                        {row.stockOut !== 0 && !row._skuWise ? (
                          <button onClick={() => openDrillDown(row, 'stockOut')} className="text-sm font-medium text-orange-600 underline decoration-dotted underline-offset-2 hover:text-orange-800 cursor-pointer">
                            {row.stockOut}
                          </button>
                        ) : (
                          <span className="text-sm font-medium text-orange-600">{row.stockOut}</span>
                        )}
                      </TableCell>

                      {/* Production */}
                      <TableCell className="text-center">
                        <span className={cn("text-sm font-medium", row.production > 0 ? "text-violet-700" : "text-slate-400")}>
                          {row.production}
                        </span>
                      </TableCell>

                      {/* Sales */}
                      <TableCell className="text-center">
                        {row.sales !== 0 && !row._skuWise ? (
                          <button onClick={() => openDrillDown(row, 'sales')} className="text-sm font-medium text-rose-600 underline decoration-dotted underline-offset-2 hover:text-rose-800 cursor-pointer">
                            {row.sales}
                          </button>
                        ) : (
                          <span className="text-sm font-medium text-rose-600">{row.sales}</span>
                        )}
                      </TableCell>

                      {/* Closing Stock */}
                      <TableCell className="text-center">
                        {row.closingStock !== 0 && !row._skuWise ? (
                          <button
                            onClick={() => openDrillDown(row, 'closingStock')}
                            className={cn(
                              "text-sm font-bold underline decoration-dotted underline-offset-2 cursor-pointer",
                              row.closingStock > 0 ? "text-emerald-700 hover:text-emerald-900" : "text-rose-600 hover:text-rose-800"
                            )}
                          >
                            {row.closingStock}
                          </button>
                        ) : (
                          <span className={cn("text-sm font-bold", row.closingStock > 0 ? "text-emerald-700" : row.closingStock < 0 ? "text-rose-600" : "text-slate-500")}>
                            {row.closingStock}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>

              {/* Totals footer */}
              {rows.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-slate-200 bg-slate-50">
                    <td colSpan={3} className="px-4 py-3 text-sm font-semibold text-slate-600">
                      Totals ({rows.length} row{rows.length !== 1 ? "s" : ""})
                    </td>
                    <td className="px-4 py-3 text-center text-sm font-semibold text-slate-700">
                      {totals.openingQty}
                    </td>
                    <td className="px-4 py-3 text-center text-sm font-bold text-emerald-700">
                      {totals.stockIn}
                    </td>
                    <td className="px-4 py-3 text-center text-sm font-bold text-orange-600">
                      {totals.stockOut}
                    </td>
                    <td className="px-4 py-3 text-center text-sm font-semibold text-slate-400">0</td>
                    <td className="px-4 py-3 text-center text-sm font-bold text-rose-600">
                      {totals.sales}
                    </td>
                    <td
                      className={cn(
                        "px-4 py-3 text-center text-sm font-bold",
                        totals.closingStock >= 0 ? "text-emerald-700" : "text-rose-600"
                      )}
                    >
                      {totals.closingStock}
                    </td>
                  </tr>
                </tfoot>
              )}
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Formula note */}
      <p className="text-xs text-slate-400 text-center">
        Closing Stock = Opening Qty + Production + Stock In − Stock Out − Sales
      </p>

      {/* Drill-down modal */}
      <Dialog open={!!drillDown} onOpenChange={(open) => { if (!open) setDrillDown(null) }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-base">
              {drillDown?.type === 'openingQty' && 'Opening Qty — Details'}
              {drillDown?.type === 'stockIn' && 'Stock In — Source Records'}
              {drillDown?.type === 'stockOut' && 'Stock Out — Source Records'}
              {drillDown?.type === 'sales' && 'Sales — Source Records'}
              {drillDown?.type === 'closingStock' && 'Closing Stock — Breakdown'}
            </DialogTitle>
            {drillDown && (
              <p className="text-xs text-slate-500 mt-0.5">
                {drillDown.depot} · {drillDown.product}
              </p>
            )}
          </DialogHeader>

          {drillDown?.type === 'openingQty' ? (
            <div className="space-y-3 pt-2">
              <div className="flex justify-between items-center py-2 border-b border-slate-100 text-sm">
                <span className="text-slate-500 font-medium">Depot</span>
                <span className="font-semibold text-slate-800">{drillDown.row.depot_name}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-100 text-sm">
                <span className="text-slate-500 font-medium">SKU</span>
                <span className="font-semibold text-slate-800">{drillDown.row.product_name}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-100 text-sm">
                <span className="text-slate-500 font-medium">Opening Qty</span>
                <span className="font-mono font-bold text-slate-800 text-base">{drillDown.row.openingQty}</span>
              </div>
              <div className="flex justify-between items-center py-2 text-sm">
                <span className="text-slate-500 font-medium">Last Updated</span>
                <span className="text-slate-600">
                  {drillDown.row.opening_qty_updated_at
                    ? new Date(drillDown.row.opening_qty_updated_at).toLocaleString('en-IN')
                    : '—'}
                </span>
              </div>
            </div>
          ) : drillDown?.type === 'closingStock' ? (
            <div className="space-y-2 pt-2">
              {[
                { label: 'Opening Qty', value: drillDown.row.openingQty, color: 'text-slate-700' },
                { label: 'Stock In', value: drillDown.row.stockIn, color: 'text-emerald-700' },
                { label: 'Stock Out', value: -drillDown.row.stockOut, color: 'text-orange-600' },
                { label: 'Sales', value: -drillDown.row.sales, color: 'text-rose-600' },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex justify-between items-center py-2 border-b border-slate-100 text-sm">
                  <span className="text-slate-500 font-medium">{label}</span>
                  <span className={cn("font-mono font-semibold", color)}>{value >= 0 ? '+' : ''}{value}</span>
                </div>
              ))}
              <div className="flex justify-between items-center pt-2 text-sm font-bold">
                <span className="text-slate-800">Closing Stock</span>
                <span className={cn("font-mono text-base", drillDown.row.closingStock >= 0 ? "text-emerald-700" : "text-rose-600")}>
                  {drillDown.row.closingStock}
                </span>
              </div>
            </div>
          ) : detailLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : detailRows.length === 0 ? (
            <p className="text-center text-sm text-slate-400 py-10">No records found</p>
          ) : (
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50">
                  <tr className="border-b border-slate-200">
                    <th className="text-left px-3 py-2 text-xs font-semibold text-slate-600 uppercase tracking-wider">Order No</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-slate-600 uppercase tracking-wider">Customer</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-slate-600 uppercase tracking-wider">Date</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-slate-600 uppercase tracking-wider">Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {detailRows.map((r, i) => (
                    <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/60">
                      <td className="px-3 py-2 font-mono text-xs text-slate-700">{r.order_no || '—'}</td>
                      <td className="px-3 py-2 text-slate-700">{r.customer_name || '—'}</td>
                      <td className="px-3 py-2 text-slate-500 text-xs">{r.date ? new Date(r.date).toLocaleDateString('en-IN') : '—'}</td>
                      <td className="px-3 py-2 text-right font-semibold text-slate-800">{r.qty}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="sticky bottom-0 bg-white border-t border-slate-200">
                  <tr>
                    <td colSpan={3} className="px-3 py-2 text-xs font-semibold text-slate-500">Total ({detailRows.length} records)</td>
                    <td className="px-3 py-2 text-right font-bold text-slate-800">
                      {detailRows.reduce((s, r) => s + (r.qty || 0), 0)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Summary Card Component ───────────────────────────────────────────────────

type Color = "green" | "orange" | "red" | "blue"

const colorMap: Record<Color, { bg: string; text: string; border: string }> = {
  green:  { bg: "bg-emerald-50",  text: "text-emerald-700", border: "border-emerald-200" },
  orange: { bg: "bg-orange-50",   text: "text-orange-700",  border: "border-orange-200" },
  red:    { bg: "bg-rose-50",     text: "text-rose-700",    border: "border-rose-200" },
  blue:   { bg: "bg-blue-50",     text: "text-blue-700",    border: "border-blue-200" },
}

function SummaryCard({
  label,
  value,
  color,
  icon: Icon,
}: {
  label: string
  value: number
  color: Color
  icon: React.ElementType
}) {
  const c = colorMap[color]
  return (
    <Card className={cn("border", c.border)}>
      <CardContent className={cn("flex items-center gap-3 p-4", c.bg)}>
        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", c.bg)}>
          <Icon className={cn("h-5 w-5", c.text)} />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-slate-500 truncate">{label}</p>
          <p className={cn("text-xl font-bold", c.text)}>{value.toLocaleString()}</p>
        </div>
      </CardContent>
    </Card>
  )
}
