"use client"

import { useState, useEffect, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { inventoryApi, productionApi } from "@/lib/api-service"
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

  const [viewDate, setViewDate] = useState<string>(() => new Date().toISOString().split('T')[0])
  const [viewData, setViewData] = useState<{ sku_name: string; qty: number }[]>([])
  const [isLoadingView, setIsLoadingView] = useState(false)

  const { data: inventoryDataRaw } = useQuery({
    queryKey: ['inventory-data-production'],
    queryFn: async () => {
      const res = await inventoryApi.getData()
      return res.success ? res.data : []
    },
    staleTime: 5 * 60 * 1000,
  })

  const banariSkus = useMemo(() => {
    return Array.from(new Set<string>(
      (inventoryDataRaw || [])
        .filter((r: any) => r.depot_name?.toLowerCase() === 'banari')
        .map((r: any) => r.product_name as string)
    )).sort()
  }, [inventoryDataRaw])

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
    setIsLoadingView(true)
    setViewData([])
    productionApi.getByDate(viewDate)
      .then(res => {
        if (res.success) setViewData(res.data.filter((r: any) => r.qty > 0))
      })
      .catch(() => {})
      .finally(() => setIsLoadingView(false))
  }, [viewDate])

  const handleSaveProduction = async () => {
    setIsSavingProduction(true)
    try {
      const items = Object.entries(productionQtyMap)
        .filter(([_, qty]) => qty !== '')
        .map(([sku_name, qty]) => ({ sku_name, qty: parseInt(qty) || 0 }))
      const res = await productionApi.bulkUpsert({ date: productionDate, items })
      if (res.success) {
        toast({ title: "Saved", description: "Production data saved successfully" })
        if (viewDate === productionDate) {
          setViewData(items.filter(i => i.qty > 0).map(i => ({ sku_name: i.sku_name, qty: i.qty })))
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
                      <TableHead className="font-semibold text-slate-700">SKU Name</TableHead>
                      <TableHead className="font-semibold text-slate-700 text-right w-48">Boxes Produced</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {banariSkus.map((skuName) => (
                      <TableRow key={skuName} className="hover:bg-slate-50/60">
                        <TableCell className="font-medium text-slate-800">{skuName}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            className="w-36 text-right ml-auto"
                            placeholder="0"
                            min="0"
                            value={productionQtyMap[skuName] ?? ''}
                            onChange={e => setProductionQtyMap(prev => ({ ...prev, [skuName]: e.target.value }))}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                    {banariSkus.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={2} className="text-center py-12 text-slate-400">No SKUs found for Banari depot</TableCell>
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
              <CardDescription>View production recorded for any date</CardDescription>
              <Input
                type="date"
                className="w-44"
                value={viewDate}
                min="2026-04-01"
                onChange={e => setViewDate(e.target.value)}
              />
            </div>
            <CardContent className="p-0">
              {isLoadingView ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                </div>
              ) : viewData.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-2">
                  <CalendarSearch className="h-8 w-8 text-slate-300" />
                  <p className="text-slate-400 text-sm">No data entered on {formatDate(viewDate)}</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 hover:bg-slate-50">
                      <TableHead className="font-semibold text-slate-700">SKU Name</TableHead>
                      <TableHead className="font-semibold text-slate-700 text-right w-48">Boxes Produced</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {viewData.map((row) => (
                      <TableRow key={row.sku_name} className="hover:bg-slate-50/60">
                        <TableCell className="font-medium text-slate-800">{row.sku_name}</TableCell>
                        <TableCell className="text-right font-semibold text-slate-800 pr-8">{row.qty}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
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
