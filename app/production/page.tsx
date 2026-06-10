"use client"

import { useState, useEffect, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { skuDetailsApi, productionApi } from "@/lib/api-service"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, Save, Factory, CalendarSearch } from "lucide-react"
import { PageHeader } from "@/components/page-header"

export default function ProductionPage() {
  const { toast } = useToast()
  const { isReadOnly } = useAuth()

  const [productionDate, setProductionDate] = useState<string>(() => new Date().toISOString().split('T')[0])
  const [productionQtyMap, setProductionQtyMap] = useState<Record<string, string>>({})
  const [isSavingProduction, setIsSavingProduction] = useState(false)
  const [isLoadingProduction, setIsLoadingProduction] = useState(false)

  const [fromDate, setFromDate] = useState<string>(() => {
    const d = new Date(); d.setDate(d.getDate() - 6); return d.toISOString().split('T')[0]
  })
  const [toDate, setToDate] = useState<string>(() => new Date().toISOString().split('T')[0])
  const [rangeData, setRangeData] = useState<{ sku_name: string; date: string; qty: number }[]>([])
  const [isLoadingView, setIsLoadingView] = useState(false)

  const { data: skuListRaw } = useQuery({
    queryKey: ['sku-details-production'],
    queryFn: async () => {
      const res = await skuDetailsApi.getAll({ all: 'true' })
      return res.success ? (res.data.skuDetails || res.data) : []
    },
    staleTime: 5 * 60 * 1000,
  })

  const banariSkus = useMemo(() => {
    return (skuListRaw || [])
      .map((r: any) => ({ name: r.sku_name as string, sku_id: r.sku_code as string, status: r.status as string }))
      .sort((a: any, b: any) => a.name.localeCompare(b.name))
  }, [skuListRaw])

  useEffect(() => {
    setIsLoadingProduction(true)
    setProductionQtyMap({})
    productionApi.getByDate(productionDate)
      .then(res => {
        if (res.success) {
          const map: Record<string, string> = {}
          res.data.forEach((row: any) => { if (row.qty > 0) map[row.sku_name] = String(row.qty) })
          setProductionQtyMap(map)
        }
      })
      .catch(() => {})
      .finally(() => setIsLoadingProduction(false))
  }, [productionDate])

  useEffect(() => {
    if (!fromDate || !toDate || fromDate > toDate) return
    setIsLoadingView(true)
    setRangeData([])
    productionApi.getByRange(fromDate, toDate)
      .then(res => { if (res.success) setRangeData(res.data) })
      .catch(() => {})
      .finally(() => setIsLoadingView(false))
  }, [fromDate, toDate])

  const handleSaveProduction = async () => {
    setIsSavingProduction(true)
    try {
      const items = Object.entries(productionQtyMap)
        .filter(([_, qty]) => qty !== '')
        .map(([sku_name, qty]) => ({ sku_name, qty: parseInt(qty) || 0 }))
      const res = await productionApi.bulkUpsert({ date: productionDate, items })
      if (res.success) {
        toast({ title: "Saved", description: "Production data saved successfully" })
        // re-fetch history range if saved date falls within it
        if (productionDate >= fromDate && productionDate <= toDate) {
          productionApi.getByRange(fromDate, toDate)
            .then(r => { if (r.success) setRangeData(r.data) })
            .catch(() => {})
        }
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to save", variant: "destructive" })
    } finally {
      setIsSavingProduction(false)
    }
  }

  const formatDate = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-')
    return `${d}/${m}/${y}`
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Production"
        description="Record daily boxes produced per SKU"
      />

      <Card className="shadow-xl border-none rounded-2xl bg-white">
        <Tabs defaultValue="records">
          <CardHeader className="bg-slate-50/50 border-b p-6 pb-0">
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <Factory className="h-5 w-5 text-primary" />
                <CardTitle className="text-xl font-bold">Production — Banari</CardTitle>
              </div>
              <TabsList className="w-fit">
                <TabsTrigger value="records">Records</TabsTrigger>
                <TabsTrigger value="history">History</TabsTrigger>
              </TabsList>
            </div>
          </CardHeader>

          {/* Records Tab */}
          <TabsContent value="records" className="m-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 py-4 border-b">
              <CardDescription>Enter boxes produced per SKU for the selected date</CardDescription>
              <div className="flex items-center gap-3">
                <Input
                  type="date"
                  className="w-44"
                  value={productionDate}
                  min="2026-04-01"
                  onChange={e => setProductionDate(e.target.value)}
                />
                <Button onClick={handleSaveProduction} disabled={isSavingProduction || isReadOnly}>
                  {isSavingProduction ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save All
                </Button>
              </div>
            </div>
            <CardContent className="p-0">
              {isLoadingProduction ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 hover:bg-slate-50">
                      <TableHead className="font-semibold text-slate-700 w-32">ID</TableHead>
                      <TableHead className="font-semibold text-slate-700">SKU Name</TableHead>
                      <TableHead className="font-semibold text-slate-700 w-28">Status</TableHead>
                      <TableHead className="font-semibold text-slate-700 text-right w-48">Boxes Produced</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {banariSkus.map((sku: { name: string; sku_id: string; status: string }) => (
                      <TableRow key={sku.name} className="hover:bg-slate-50/60">
                        <TableCell className="text-xs text-slate-500 font-mono">{sku.sku_id || "—"}</TableCell>
                        <TableCell className="font-medium text-slate-800">{sku.name}</TableCell>
                        <TableCell>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${sku.status === 'Active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                            {sku.status || 'Active'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            className="w-36 text-right ml-auto"
                            placeholder="0"
                            min="0"
                            value={productionQtyMap[sku.name] ?? ''}
                            onChange={e => setProductionQtyMap(prev => ({ ...prev, [sku.name]: e.target.value }))}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                    {banariSkus.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-12 text-slate-400">No SKUs found for Banari depot</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="m-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 py-4 border-b">
              <CardDescription>View production across a date range</CardDescription>
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  className="w-40"
                  value={fromDate}
                  min="2026-04-01"
                  onChange={e => setFromDate(e.target.value)}
                />
                <span className="text-slate-400 text-sm">to</span>
                <Input
                  type="date"
                  className="w-40"
                  value={toDate}
                  min="2026-04-01"
                  onChange={e => setToDate(e.target.value)}
                />
              </div>
            </div>
            <CardContent className="p-0">
              {isLoadingView ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                </div>
              ) : (() => {
                const dates = Array.from(new Set(rangeData.map(r => r.date))).sort()
                const bySkuMap: Record<string, Record<string, number>> = {}
                rangeData.forEach(r => {
                  if (!bySkuMap[r.sku_name]) bySkuMap[r.sku_name] = {}
                  bySkuMap[r.sku_name][r.date] = r.qty
                })
                const pivotRows = Object.entries(bySkuMap).sort(([a], [b]) => a.localeCompare(b))
                if (pivotRows.length === 0) return (
                  <div className="flex flex-col items-center justify-center py-16 gap-2">
                    <CalendarSearch className="h-8 w-8 text-slate-300" />
                    <p className="text-slate-400 text-sm">No data for selected range</p>
                  </div>
                )
                return (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50 hover:bg-slate-50">
                          <TableHead className="font-semibold text-slate-700 sticky left-0 bg-slate-50 z-10">SKU Name</TableHead>
                          {dates.map(d => (
                            <TableHead key={d} className="font-semibold text-slate-700 text-center whitespace-nowrap">
                              {formatDate(d)}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pivotRows.map(([skuName, dateMap]) => (
                          <TableRow key={skuName} className="hover:bg-slate-50/60">
                            <TableCell className="font-medium text-slate-800 sticky left-0 bg-white z-10">{skuName}</TableCell>
                            {dates.map(d => (
                              <TableCell key={d} className="text-center text-slate-700">
                                {dateMap[d] ?? <span className="text-slate-300">—</span>}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )
              })()}
            </CardContent>
          </TabsContent>
        </Tabs>
      </Card>

      <div className="flex items-center justify-center pt-6 border-t border-slate-100">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.5em] hover:text-primary transition-colors cursor-default">
          Powered by Botivate
        </p>
      </div>
    </div>
  )
}
