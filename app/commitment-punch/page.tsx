"use client"

import { useState, useCallback, useEffect } from "react"
import type React from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Save, Plus, Trash2, CheckCircle2, RefreshCw, ChevronRight, CalendarIcon } from "lucide-react"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"
import { customerApi, commitmentPunchApi, brokerApi, salespersonApi, skuDetailsApi, depotApi } from "@/lib/api-service"
import { AsyncCombobox } from "@/components/ui/async-combobox"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format } from "date-fns"
import { cn } from "@/lib/utils"

// ─── Types ────────────────────────────────────────────────────

type ProductRow = {
  id: string
  oil_type: string
  quantity: string
  unit: string
  rate: string
}

type PendingCommitment = {
  id: number
  commitment_no: string
  commitment_date: string
  party_name: string
  oil_type: string
  quantity: number
  unit: string
  rate: number
  order_type: string
  transport_type: string
  planned1: string
  processed_qty: number
  remaining_qty: number
}

type SkuRow = {
  id: string
  sku: string
  qty: string
  rate: string
  mt?: number
}

// ─── Constants ────────────────────────────────────────────────

const OIL_TYPES = ["Palm Oil", "Soya Oil", "Rice Oil"]
const TRANSPORT_TYPES = ["Self", "Party", "Company", "Ex-Depot"]

// ═══════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════

export default function CommitmentPunchPage() {
  const { toast } = useToast()
  const { user } = useAuth()

  // ── Pending table state ─────────────────────────────────────
  const [pendingList, setPendingList] = useState<PendingCommitment[]>([])
  const [isLoadingPending, setIsLoadingPending] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

  // ── Add Commitment dialog ───────────────────────────────────
  const [isAddOpen, setIsAddOpen] = useState(false)

  // ── Process dialog ──────────────────────────────────────────
  const [isProcessOpen, setIsProcessOpen] = useState(false)
  const [processPoNo, setProcessPoNo] = useState("")
  const [processPoDate, setProcessPoDate] = useState("")
  const [processDeliveryPurpose, setProcessDeliveryPurpose] = useState("week-on-week")
  const [processDepoName, setProcessDepoName] = useState("Banari")
  const [processAdvancePaymentTaken, setProcessAdvancePaymentTaken] = useState("NO")
  const [processAdvancePayment, setProcessAdvancePayment] = useState("")
  const [processPaymentTerms, setProcessPaymentTerms] = useState("7days")
  const [processOrderTypeThrough, setProcessOrderTypeThrough] = useState("")
  const [processOrderType, setProcessOrderType] = useState("regular")
  const [processStartDate, setProcessStartDate] = useState("")
  const [processEndDate, setProcessEndDate] = useState("")
  const [processActualDeliveryDate, setProcessActualDeliveryDate] = useState("")
  const [processUploadCopy, setProcessUploadCopy] = useState<File | null>(null)
  const [processRemarks, setProcessRemarks] = useState("")
  const [processDeliveryDateError, setProcessDeliveryDateError] = useState("")
  const [processFuturePeriodDate, setProcessFuturePeriodDate] = useState("")
  const [processOrderCategory, setProcessOrderCategory] = useState("Sales")
  const [isFuturePeriodDatePickerOpen, setIsFuturePeriodDatePickerOpen] = useState(false)
  const [isActualDeliveryPickerOpen, setIsActualDeliveryPickerOpen] = useState(false)
  const [skuRows, setSkuRows] = useState<SkuRow[]>([
    { id: "1", sku: "", qty: "", rate: "" },
  ])
  const [isProcessing, setIsProcessing] = useState(false)
  const [skuRegistry, setSkuRegistry] = useState<Record<string, any>>({})

  // ── PO Raised Details popup ────────────────────────────────────────
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [detailsRow, setDetailsRow] = useState<PendingCommitment | null>(null)
  const [detailsData, setDetailsData] = useState<any>(null)
  const [isLoadingDetails, setIsLoadingDetails] = useState(false)

  // ── Add Commitment form state ───────────────────────────────
  const [commitmentDate, setCommitmentDate] = useState(new Date().toISOString().split("T")[0])
  const [partyName, setPartyName] = useState("")
  const [contactPerson, setContactPerson] = useState("")
  const [whatsappNo, setWhatsappNo] = useState("")
  const [customerAddress, setCustomerAddress] = useState("")
  const [customerList, setCustomerList] = useState<any[]>([])
  const [orderType, setOrderType] = useState("")
  const [transportType, setTransportType] = useState("")
  const [brokerName, setBrokerName] = useState("")
  const [salespersonName, setSalespersonName] = useState("")
  const [rows, setRows] = useState<ProductRow[]>([
    { id: "1", oil_type: "Rice Oil", quantity: "", unit: "Metric Ton", rate: "" },
  ])
  const [isSubmitting, setIsSubmitting] = useState(false)

  // ── Load pending commitments ────────────────────────────────
  const loadPending = useCallback(async () => {
    setIsLoadingPending(true)
    try {
      const res = await commitmentPunchApi.getPending()
      if (res.success) {
        setPendingList(res.data?.commitments || [])
      }
    } catch {
      toast({ title: "Error", description: "Failed to load pending commitments.", variant: "destructive" })
    } finally {
      setIsLoadingPending(false)
    }
  }, [toast])

  useEffect(() => { loadPending() }, [loadPending])

  // ── Fetch commitment details for popup ─────────────────────────────────────
  const openDetails = async (row: PendingCommitment, e: React.MouseEvent) => {
    e.stopPropagation()
    setDetailsRow(row)
    setDetailsData(null)
    setIsDetailsOpen(true)
    setIsLoadingDetails(true)
    try {
      const res = await commitmentPunchApi.getDetails(row.id)
      if (res.success) setDetailsData(res.data)
    } catch {
      toast({ title: "Error", description: "Failed to load commitment details.", variant: "destructive" })
    } finally {
      setIsLoadingDetails(false)
    }
  }

  // Auto-fill Start Date to today and End Date to +7 when Process dialog opens
  useEffect(() => {
    if (isProcessOpen && !processStartDate) {
      const today = new Date().toISOString().split("T")[0]
      const end = new Date()
      end.setDate(end.getDate() + 7)
      const endDate = end.toISOString().split("T")[0]
      setProcessStartDate(today)
      setProcessEndDate(endDate)
    }
  }, [isProcessOpen])

  // Auto-select Reliance customer when Add Commitment dialog opens
  useEffect(() => {
    if (isAddOpen && !partyName) {
      const relianceName = "Reliance Consumer Products Limited"
      setPartyName(relianceName)
      // Fetch customer details from API to auto-fill contact info
      customerApi.getAll({ search: "Reliance", limit: 30 }).then((res: any) => {
        const items = res.success ? (res.data.customers || (Array.isArray(res.data) ? res.data : [])) : []
        const found = items.find((c: any) =>
          (c.customer_name || "").toLowerCase().includes("reliance consumer products")
        ) || items.find((c: any) =>
          (c.customer_name || "").toLowerCase().includes("reliance")
        )
        if (found) {
          setContactPerson(found.contact_person || "")
          setWhatsappNo(found.contact || "")
          const parts = [found.address_line_1, found.address_line_2, found.state, found.pincode].filter(Boolean)
          setCustomerAddress(parts.join(", "))
          // Cache it too
          setCustomerList((prev: any[]) => {
            const exists = prev.find((c: any) => c.id === found.id)
            return exists ? prev : [...prev, found]
          })
        }
      }).catch(() => { })
    }
  }, [isAddOpen])

  // ── Customer / Broker / Salesperson fetch callbacks ─────────
  const fetchCustomerOptions = useCallback(async (search: string, page: number) => {
    try {
      const res = await customerApi.getAll({ search: search || "Reliance", page, limit: 30 })
      const items = res.success ? (res.data.customers || (Array.isArray(res.data) ? res.data : [])) : []
      const seen = new Map<string, boolean>()
      const options = items
        .filter((c: any) => (c.customer_name || "").toLowerCase().includes("reliance"))
        .map((c: any) => ({ value: c.customer_name, label: c.customer_name, original: c }))
        .filter((o: any) => {
          if (!o.value || seen.has(o.value)) return false
          seen.set(o.value, true)
          return true
        })
      // Update customer list for auto-fill
      setCustomerList((prev: any[]) => {
        const newItems = items.filter((c: any) => !prev.find((p: any) => p.id === c.id))
        return newItems.length ? [...prev, ...newItems] : prev
      })
      return { options, hasMore: false }
    } catch { return { options: [], hasMore: false } }
  }, [])


  const fetchBrokerOptions = useCallback(async (search: string, page: number) => {
    try {
      const res = await brokerApi.getAll({ search, page, limit: 30 })
      const items = res.success ? (res.data.brokers || (Array.isArray(res.data) ? res.data : [])) : []
      const options = items
        .map((b: any) => { const n = b.salesman_name || b.broker_name || b.name || ""; return { value: n, label: n } })
        .filter((o: any) => o.value)
      return { options, hasMore: options.length === 30 }
    } catch { return { options: [], hasMore: false } }
  }, [])

  const fetchSalespersonOptions = useCallback(async (search: string, page: number) => {
    try {
      const res = await salespersonApi.getAll({ search, page, limit: 30 })
      const items = res.success ? (res.data.salespersons || res.data.brokers || (Array.isArray(res.data) ? res.data : [])) : []
      const options = items
        .map((s: any) => { const n = s.salesman_name || s.salesperson_name || s.name || ""; return { value: n, label: n } })
        .filter((o: any) => o.value)
      return { options, hasMore: options.length === 30 }
    } catch { return { options: [], hasMore: false } }
  }, [])

  const fetchDepoOptions = useCallback(async (search: string, page: number) => {
    try {
      const res = await depotApi.getAll({ search, page, limit: 30 })
      const items = res.success ? (res.data.depots || (Array.isArray(res.data) ? res.data : [])) : []
      const options = items
        .map((d: any) => ({ value: d.depot_name, label: d.depot_name }))
        .filter((o: any) => o.value)
      return { options, hasMore: options.length === 30 }
    } catch { return { options: [], hasMore: false } }
  }, [])

  // Fetch SKU options — only show "Good Life" SKUs (client-side filtered)
  const fetchSkuOptions = useCallback(async (search: string, _page: number) => {
    try {
      // Pass search="Good Life" when no user search, so initial load shows Good Life SKUs
      const res = await skuDetailsApi.getAll({ search: search || "Good Life", limit: 100 })
      const items = res.success
        ? (res.data.skuDetails || res.data.skus || res.data.sku_details || (Array.isArray(res.data) ? res.data : []))
        : []
      // Client-side filter: only keep items whose sku_name contains "Good Life"
      const goodLifeItems = items.filter((s: any) =>
        (s.sku_name || s.name || "").toLowerCase().includes("good life")
      )
      const seen = new Set<string>()
      const newlyFetched: Record<string, any> = {}
      const options = goodLifeItems
        .map((s: any) => {
          const n = s.sku_name || s.name || ""
          newlyFetched[n] = s
          return { value: n, label: n }
        })
        .filter((o: any) => { if (!o.value || seen.has(o.value)) return false; seen.add(o.value); return true })

      setSkuRegistry(prev => ({ ...prev, ...newlyFetched }))
      return { options, hasMore: false }
    } catch { return { options: [], hasMore: false } }
  }, [])

  // ── Checkbox selection ──────────────────────────────────────
  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === pendingList.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(pendingList.map(r => r.id)))
    }
  }

  // ── Add Commitment helpers ──────────────────────────────────
  const resetAddForm = () => {
    setCommitmentDate(new Date().toISOString().split("T")[0])
    setPartyName("")
    setContactPerson("")
    setWhatsappNo("")
    setCustomerAddress("")
    setBrokerName("")
    setSalespersonName("")
    setOrderType("")
    setTransportType("")
    setRows([{ id: "1", oil_type: "Rice Oil", quantity: "", unit: "Metric Ton", rate: "" }])
  }

  const addRow = () =>
    setRows(prev => [...prev, { id: Math.random().toString(36).substr(2, 9), oil_type: "Rice Oil", quantity: "", unit: "Metric Ton", rate: "" }])

  const removeRow = (id: string) => {
    if (rows.length > 1) setRows(prev => prev.filter(r => r.id !== id))
  }

  const updateRow = (id: string, field: keyof ProductRow, value: string) => {
    setRows(prev => prev.map(r => {
      if (r.id === id) {
        const updated = { ...r, [field]: value };
        // Auto-select unit to Metric Ton when oil type is selected
        if (field === "oil_type" && value) {
          updated.unit = "Metric Ton";
        }
        return updated;
      }
      return r;
    }))
  }

  const handleOrderTypeChange = (val: string) => {
    setOrderType(val)
    setBrokerName("")
    setSalespersonName("")
  }

  // ── Submit Add Commitment ───────────────────────────────────
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!partyName) { toast({ title: "Validation Error", description: "Customer name is required.", variant: "destructive" }); return }
    if (!commitmentDate) { toast({ title: "Validation Error", description: "Commitment date is required.", variant: "destructive" }); return }
    if (orderType === "broker" && !brokerName) { toast({ title: "Validation Error", description: "Broker name is required.", variant: "destructive" }); return }
    if (orderType === "salesperson" && !salespersonName) { toast({ title: "Validation Error", description: "Salesperson is required.", variant: "destructive" }); return }
    if (rows.some(r => !r.oil_type || !r.quantity || !r.rate)) {
      toast({ title: "Validation Error", description: "Fill Oil Type, Quantity and Rate for all rows.", variant: "destructive" }); return
    }

    setIsSubmitting(true)
    try {
      const payload = {
        commitment_date: commitmentDate,
        party_name: partyName,
        customer_contact_person_name: contactPerson || null,
        whatsapp_no: whatsappNo || null,
        address: customerAddress || null,
        rows: rows.map(r => ({
          oil_type: r.oil_type,
          quantity: parseFloat(r.quantity),
          unit: r.unit || null,
          rate: parseFloat(r.rate),
        })),
      }
      const res = await commitmentPunchApi.create(payload)
      if (res.success) {
        toast({ title: "✅ Commitment Created!", description: `Commitment No: ${res.data?.commitment_no}`, duration: 6000 })
        resetAddForm()
        setIsAddOpen(false)
        loadPending()
      } else {
        throw new Error(res.message || "Failed to create commitment")
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Could not save commitment.", variant: "destructive" })
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── SKU row helpers ─────────────────────────────────────────
  const addSkuRow = () =>
    setSkuRows(prev => [...prev, { id: Math.random().toString(36).substr(2, 9), sku: "", qty: "", rate: "" }])

  const removeSkuRow = (id: string) => {
    if (skuRows.length > 1) setSkuRows(prev => prev.filter(r => r.id !== id))
  }

  const updateSkuRow = (id: string, field: keyof SkuRow, value: string) => {
    setSkuRows(prev => prev.map(r => {
      if (r.id === id) {
        const updated = { ...r, [field]: value }

        // Recalculate MT
        const skuData = skuRegistry[field === "sku" ? value : updated.sku]
        if (skuData) {
          const qty = parseFloat(field === "qty" ? value : updated.qty) || 0
          const skuWeight = parseFloat(skuData.sku_weight || 0)
          updated.mt = (skuWeight / 1000) * qty
        }
        return updated
      }
      return r
    }))
  }

  const resetProcess = () => {
    setProcessPoNo("")
    setProcessPoDate("")
    setProcessDeliveryPurpose("week-on-week")
    setProcessDepoName("Banari")
    setProcessAdvancePaymentTaken("NO")
    setProcessAdvancePayment("")
    setProcessPaymentTerms("7days")
    setProcessOrderTypeThrough("")
    setProcessOrderType("regular")
    setProcessStartDate("")
    setProcessEndDate("")
    setProcessActualDeliveryDate("")
    setProcessFuturePeriodDate("")
    setProcessUploadCopy(null)
    setProcessRemarks("")
    setProcessDeliveryDateError("")
    setIsActualDeliveryPickerOpen(false)
    setIsFuturePeriodDatePickerOpen(false)
    setProcessOrderCategory("Sales")
    setSkuRows([{ id: "1", sku: "", qty: "", rate: "", mt: 0 }])
  }

  // ── Submit Process ──────────────────────────────────────────
  const handleProcessSubmit = async () => {
    if (!processPoNo) { toast({ title: "Validation Error", description: "PO No. is required.", variant: "destructive" }); return }
    if (!processPoDate) { toast({ title: "Validation Error", description: "PO Date is required.", variant: "destructive" }); return }
    if (skuRows.some(r => !r.sku || !r.qty || !r.rate)) {
      toast({ title: "Validation Error", description: "Fill SKU, Qty and Rate for all rows.", variant: "destructive" }); return
    }

    // MT Validation
    const totalReqMt = skuRows.reduce((sum, r) => sum + (r.mt || 0), 0)
    const selectedCm = pendingList.find(p => selectedIds.has(p.id))
    const remainingMt = selectedCm ? (selectedCm.remaining_qty ?? selectedCm.quantity) : 0

    if (totalReqMt > remainingMt + 0.0001) {
      toast({
        title: "Validation Error",
        description: `Total weight (${totalReqMt.toFixed(4)} MT) exceeds remaining balance (${remainingMt.toFixed(4)} MT).`,
        variant: "destructive"
      });
      return
    }

    setIsProcessing(true)
    try {
      const ids = Array.from(selectedIds)
      let successCount = 0
      let errorMsgs: string[] = []
      let generatedOrderNos: string[] = []

      // Handle SO copy upload if selected
      let uploadedCopyUrl: string | null = null
      if (processUploadCopy) {
        try {
          // @ts-ignore
          const uploadRes = await (await import("@/lib/api-service")).orderApi.uploadFile(processUploadCopy)
          if (uploadRes.success) uploadedCopyUrl = uploadRes.data.url
        } catch { /* ignore upload error */ }
      }

      for (const id of ids) {
        // For each selected commitment, submit each SKU row as a separate detail record
        for (const skuRow of skuRows) {
          const payload = {
            po_no: processPoNo,
            po_date: processPoDate,
            sku: skuRow.sku,
            sku_quantity: parseFloat(skuRow.qty),
            sku_rate: parseFloat(skuRow.rate),
            order_type: orderType || null,
            transport_type: transportType || null,
            broker_name: orderType === "broker" ? brokerName : null,
            salesperson_name: orderType === "salesperson" ? salespersonName : null,
            order_type_delivery_purpose: processDeliveryPurpose,
            depo_name: processDepoName,
            advance_payment: processAdvancePayment,
            advance_payment_taken: processAdvancePaymentTaken,
            payment_terms: processPaymentTerms,
            is_order_through: processOrderTypeThrough || null,
            order_type_regular_preapproval: processOrderType || null,
            start_date: processStartDate || null,
            end_date: processEndDate || null,
            actual_delivery_date: processActualDeliveryDate || null,
            future_period_date: processFuturePeriodDate || null,
            upload_copy: uploadedCopyUrl,
            remarks: processRemarks || null,
            order_category: processOrderCategory,
          }
          const res = await commitmentPunchApi.processCommitment(id, payload)
          if (res.success) {
            successCount++
            if (res.data?.order_no) generatedOrderNos.push(res.data.order_no)
          } else {
            errorMsgs.push(res.message || `Failed for commitment ID ${id}`)
          }
        }
      }

      if (errorMsgs.length > 0) {
        toast({ title: "Partial Error", description: errorMsgs[0], variant: "destructive" })
      } else {
        const orderList = generatedOrderNos.length > 0 ? ` Orders: ${generatedOrderNos.join(", ")}` : ""
        toast({ title: "✅ Processed!", description: `${successCount} order(s) created.${orderList}`, duration: 7000 })
      }
      setIsProcessOpen(false)
      setSelectedIds(new Set())
      resetProcess()
      loadPending()
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Could not process commitments.", variant: "destructive" })
    } finally {
      setIsProcessing(false)
    }
  }

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════

  return (
    <div className="p-6 max-w-full space-y-6" suppressHydrationWarning>

      {/* ── Page Header ── */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <SidebarTrigger className="-ml-1" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Commitment Punch</h1>
            <p className="text-muted-foreground">Manage and process customer oil commitments.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadPending} disabled={isLoadingPending}>
            <RefreshCw className={`h-4 w-4 mr-1 ${isLoadingPending ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            className="gap-2 bg-blue-600 hover:bg-blue-700"
            onClick={() => { resetAddForm(); setIsAddOpen(true) }}
          >
            <Plus className="h-4 w-4" />
            Add Commitment
          </Button>
        </div>
      </div>

      {/* ── Pending Commitments Table ── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between py-4">
          <div>
            <CardTitle>Commitment Name</CardTitle>
            <CardDescription>
              Showing pending commitments ({pendingList.length} record{pendingList.length !== 1 ? "s" : ""})
            </CardDescription>
          </div>
          {selectedIds.size > 0 && (
            <Button
              className="gap-2 bg-emerald-600 hover:bg-emerald-700"
              onClick={() => setIsProcessOpen(true)}
            >
              <ChevronRight className="h-4 w-4" />
              Process ({selectedIds.size} selected)
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto rounded-b-xl">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="w-[48px] text-center">
                    <Checkbox
                      checked={pendingList.length > 0 && selectedIds.size === pendingList.length}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Commitment No.</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer Name</TableHead>
                  <TableHead>Oil Type</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="text-right">Qty (MT)</TableHead>
                  <TableHead className="text-right">PO Raised (MT)</TableHead>
                  <TableHead className="text-right">Remaining Balance (MT)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingPending ? (
                  [...Array(4)].map((_, i) => (
                    <TableRow key={i} className="opacity-40">
                      {[...Array(9)].map((__, j) => (
                        <TableCell key={j}><div className="h-4 w-full bg-slate-200 animate-pulse rounded" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : pendingList.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-16 text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <CheckCircle2 className="h-10 w-10 text-slate-300" />
                        <p className="font-medium">No pending commitments</p>
                        <p className="text-sm text-slate-400">Click "Add Commitment" to create one.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  pendingList.map(row => (
                    <TableRow
                      key={row.id}
                      className={`hover:bg-slate-50 cursor-pointer transition-colors ${selectedIds.has(row.id) ? "bg-blue-50 hover:bg-blue-50" : ""}`}
                      onClick={() => toggleSelect(row.id)}
                    >
                      <TableCell className="text-center" onClick={e => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.has(row.id)}
                          onCheckedChange={() => toggleSelect(row.id)}
                        />
                      </TableCell>
                      <TableCell className="font-mono font-semibold text-blue-700">{row.commitment_no}</TableCell>
                      <TableCell>{row.commitment_date ? new Date(row.commitment_date).toLocaleDateString("en-IN") : "—"}</TableCell>
                      <TableCell className="font-medium">{row.party_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{row.oil_type || "—"}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">₹{row.rate ?? "—"}</TableCell>
                      <TableCell className="text-right font-mono">{row.quantity ?? "—"}</TableCell>
                      <TableCell className="text-right font-mono text-blue-600 font-semibold">
                        {Number(row.processed_qty || 0) > 0 ? (
                          <button
                            onClick={(e) => openDetails(row, e)}
                            className="text-blue-600 underline hover:text-blue-800 font-semibold font-mono cursor-pointer bg-transparent border-none p-0"
                          >
                            {Number(row.processed_qty || 0).toFixed(4)}
                          </button>
                        ) : (
                          <span className="text-slate-400">0.0000</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-emerald-600 font-bold">{Number(row.remaining_qty ?? row.quantity).toFixed(4)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* ═══════════════════════════════════════════════════════
          ADD COMMITMENT DIALOG
      ═══════════════════════════════════════════════════════ */}
      <Dialog open={isAddOpen} onOpenChange={open => { setIsAddOpen(open); if (!open) resetAddForm() }}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Commitment</DialogTitle>
            <DialogDescription>Enter commitment details. A unique Commitment No. will be auto-generated.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddSubmit} className="space-y-5" suppressHydrationWarning>
            {/* Row 1 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="d-commitmentDate">Commitment Date <span className="text-red-500">*</span></Label>
                <Input id="d-commitmentDate" type="date" value={commitmentDate} onChange={e => setCommitmentDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Customer Name <span className="text-red-500">*</span></Label>
                <AsyncCombobox
                  fetchOptions={fetchCustomerOptions}
                  value={partyName}
                  onValueChange={setPartyName}
                  onSelectOption={(opt: any) => {
                    if (opt.original) {
                      setCustomerList((prev: any[]) => {
                        const exists = prev.find((c: any) => c.id === opt.original.id)
                        return exists ? prev : [...prev, opt.original]
                      })
                      const c = opt.original
                      setContactPerson(c.contact_person || "")
                      setWhatsappNo(c.contact || "")
                      const parts = [c.address_line_1, c.address_line_2, c.state, c.pincode].filter(Boolean)
                      setCustomerAddress(parts.join(", "))
                    }
                  }}
                  placeholder="Select customer"
                  searchPlaceholder="Search customer..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="d-contactPerson">Contact Person Name</Label>
                <Input id="d-contactPerson" disabled placeholder="Enter contact person" value={contactPerson} onChange={e => setContactPerson(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="d-whatsapp">WhatsApp No.</Label>
                <Input id="d-whatsapp" disabled placeholder="Enter WhatsApp number" value={whatsappNo} onChange={e => setWhatsappNo(e.target.value)} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="d-address">Customer Address</Label>
                <Input id="d-address" disabled placeholder="Enter full address" value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} />
              </div>
            </div>

            {/* Product rows */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Oil / Product Details</Label>
                <Button type="button" variant="outline" size="sm" onClick={addRow} className="gap-1">
                  <Plus className="h-3 w-3" /> Add Row
                </Button>
              </div>

              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="w-8 text-center py-2 px-2 font-medium text-slate-600">#</th>
                      <th className="py-2 px-3 text-left font-medium text-slate-600">Oil Type *</th>
                      <th className="py-2 px-3 text-left font-medium text-slate-600">Quantity *</th>
                      <th className="py-2 px-3 text-left font-medium text-slate-600">Unit</th>
                      <th className="py-2 px-3 text-left font-medium text-slate-600">Rate (PMT) *</th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, idx) => (
                      <tr key={row.id} className="border-b last:border-0">
                        <td className="text-center py-2 px-2 text-xs font-bold text-slate-400">{String.fromCharCode(65 + idx)}</td>
                        <td className="py-1.5 px-2">
                          <Select value={row.oil_type} onValueChange={v => updateRow(row.id, "oil_type", v)}>
                            <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select oil" /></SelectTrigger>
                            <SelectContent>
                              {OIL_TYPES.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="py-1.5 px-2">
                          <Input type="number" min="0" step="0.0001" value={row.quantity} onChange={e => updateRow(row.id, "quantity", e.target.value)} placeholder="0.0000" className="h-8 text-sm" />
                        </td>
                        <td className="py-1.5 px-2">
                          <Input type="text" value={row.unit} onChange={e => updateRow(row.id, "unit", e.target.value)} placeholder="e.g. Ltr" className="h-8 text-sm" />
                        </td>
                        <td className="py-1.5 px-2">
                          <Input type="number" min="0" step="0.01" value={row.rate} onChange={e => updateRow(row.id, "rate", e.target.value)} placeholder="₹ 0.00" className="h-8 text-sm" />
                        </td>
                        <td className="py-1.5 px-2 text-center">
                          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => removeRow(row.id)} disabled={rows.length === 1}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)} disabled={isSubmitting}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting} className="gap-2 bg-blue-600 hover:bg-blue-700 min-w-[140px]">
                <Save className="h-4 w-4" />
                {isSubmitting ? "Saving..." : "Save Commitment"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════
          PROCESS DIALOG
      ═══════════════════════════════════════════════════════ */}
      <Dialog open={isProcessOpen} onOpenChange={open => { setIsProcessOpen(open); if (!open) resetProcess() }}>
        <DialogContent className="sm:max-w-[900px] max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Process Commitment</DialogTitle>
            <DialogDescription>
              Processing {selectedIds.size} commitment{selectedIds.size !== 1 ? "s" : ""}. Fill PO details and SKU allocation.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-1">

            {/* ── Selected Commitment Info ── */}
            {Array.from(selectedIds).map(id => {
              const c = pendingList.find(p => p.id === id)
              if (!c) return null
              const totalReqMt = skuRows.reduce((sum, r) => sum + (r.mt || 0), 0)
              const isOverLimit = totalReqMt > (c.remaining_qty ?? c.quantity) + 0.0001

              return (
                <div key={id} className={`rounded-lg border transition-all px-4 py-3 flex flex-wrap gap-6 text-sm ${isOverLimit ? "border-red-200 bg-red-50" : "border-blue-100 bg-blue-50/60"}`}>
                  <div>
                    <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Company Name</p>
                    <p className="font-semibold text-slate-800 mt-0.5">{c.party_name || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Oil Type</p>
                    <p className="font-semibold text-slate-800 mt-0.5">{c.oil_type || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Total Qty</p>
                    <p className="font-semibold text-slate-800 mt-0.5">{c.quantity ?? "—"} {c.unit || ""}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Remaining Balance</p>
                    <p className={`font-semibold mt-0.5 ${isOverLimit ? "text-red-600" : "text-emerald-700"}`}>
                      {Number(c.remaining_qty ?? c.quantity).toFixed(4)} MT
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Requested Total</p>
                    <p className={`font-bold mt-0.5 ${isOverLimit ? "text-red-700" : "text-blue-700"}`}>
                      {totalReqMt.toFixed(4)} MT
                    </p>
                  </div>
                </div>
              )
            })}

            {/* ── Order Submission Details ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-b pb-4">
              {/* Order Type is Through (is_order_through) */}
              <div className="space-y-2">
                <Label htmlFor="p-orderTypeThrough">Order Type is Through <span className="text-red-500">*</span></Label>
                <Select value={processOrderTypeThrough} onValueChange={(val) => {
                  setProcessOrderTypeThrough(val)
                  setBrokerName("")
                  setSalespersonName("")
                }}>
                  <SelectTrigger id="p-orderTypeThrough"><SelectValue placeholder="Select order type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="direct">Direct</SelectItem>
                    <SelectItem value="broker">Broker</SelectItem>
                    <SelectItem value="salesperson">Salesperson</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {/* Order Type: Regular / Pre-Approval */}
              <div className="space-y-2">
                <Label htmlFor="p-orderType">Order Type</Label>
                <Select value={processOrderType} onValueChange={setProcessOrderType}>
                  <SelectTrigger id="p-orderType"><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="regular">Regular</SelectItem>
                    <SelectItem value="pre-approval">Pre-Approval</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-transportType">Transport Type <span className="text-red-500">*</span></Label>
                <Select value={transportType} onValueChange={setTransportType}>
                  <SelectTrigger id="p-transportType"><SelectValue placeholder="Select transport type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FOR">FOR</SelectItem>
                    <SelectItem value="EX-Depot">EX-Depot</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Conditional Broker / Salesperson */}
              {processOrderTypeThrough === "broker" && (
                <div className="space-y-2 col-span-full">
                  <Label>Broker Name <span className="text-red-500">*</span></Label>
                  <AsyncCombobox fetchOptions={fetchBrokerOptions} value={brokerName} onValueChange={setBrokerName} placeholder="Select broker" searchPlaceholder="Search broker..." />
                </div>
              )}
              {processOrderTypeThrough === "salesperson" && (
                <div className="space-y-2 col-span-full">
                  <Label>Salesperson <span className="text-red-500">*</span></Label>
                  <AsyncCombobox fetchOptions={fetchSalespersonOptions} value={salespersonName} onValueChange={setSalespersonName} placeholder="Select salesperson" searchPlaceholder="Search salesperson..." />
                </div>
              )}

              {/* Delivery Purpose & Depot */}
              <div className="space-y-2">
                <Label>Delivery Purpose</Label>
                <Select value={processDeliveryPurpose} onValueChange={setProcessDeliveryPurpose}>
                  <SelectTrigger><SelectValue placeholder="Select purpose" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="week-on-week">Week On Week</SelectItem>
                    <SelectItem value="future-period">Future Period</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {processDeliveryPurpose === "future-period" && (
                <div className="space-y-2">
                  <Label>Future Period Date</Label>
                  <Popover open={isFuturePeriodDatePickerOpen} onOpenChange={setIsFuturePeriodDatePickerOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !processFuturePeriodDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {processFuturePeriodDate
                          ? format(new Date(processFuturePeriodDate), "PPP")
                          : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={processFuturePeriodDate ? new Date(processFuturePeriodDate) : undefined}
                        onSelect={(date) => {
                          if (date) {
                            setProcessFuturePeriodDate(format(date, "yyyy-MM-dd"))
                            setIsFuturePeriodDatePickerOpen(false)
                          }
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <p className="text-[10px] text-blue-600 font-medium">ℹ️ Date for future delivery scheduling</p>
                </div>
              )}
              <div className="space-y-2">
                <Label>Depo Name</Label>
                <AsyncCombobox fetchOptions={fetchDepoOptions} value={processDepoName} onValueChange={setProcessDepoName} placeholder="Select Depo" searchPlaceholder="Search depots..." />
              </div>

              {/* Start Date / End Date */}
              <div className="space-y-2">
                <Label htmlFor="p-startDate">Start Date</Label>
                <Input
                  id="p-startDate"
                  type="date"
                  value={processStartDate}
                  onChange={e => {
                    const val = e.target.value
                    setProcessStartDate(val)
                    setProcessDeliveryDateError("")
                    if (val) {
                      const d = new Date(val)
                      d.setDate(d.getDate() + 7)
                      setProcessEndDate(d.toISOString().split("T")[0])
                    } else {
                      setProcessEndDate("")
                    }
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-endDate">End Date</Label>
                <Input
                  id="p-endDate"
                  type="date"
                  value={processEndDate}
                  readOnly
                  className="bg-muted cursor-not-allowed"
                />
              </div>

              {/* Actual Delivery Date - Calendar with in-range highlight */}
              <div className="space-y-2">
                <Label>Actual Delivery Date</Label>
                <Popover open={isActualDeliveryPickerOpen} onOpenChange={setIsActualDeliveryPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !processActualDeliveryDate && "text-muted-foreground",
                        processDeliveryDateError && "border-red-500"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {processActualDeliveryDate
                        ? format(new Date(processActualDeliveryDate), "PPP")
                        : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={processActualDeliveryDate ? new Date(processActualDeliveryDate) : undefined}
                      onSelect={(date) => {
                        if (date) {
                          const val = format(date, "yyyy-MM-dd")
                          setProcessActualDeliveryDate(val)
                          setIsActualDeliveryPickerOpen(false)
                          // Validate within start-end range
                          if (processStartDate && processEndDate) {
                            const d = new Date(val)
                            const start = new Date(processStartDate)
                            const end = new Date(processEndDate)
                            if (d < start || d > end) {
                              setProcessDeliveryDateError(`Date must be between ${processStartDate} and ${processEndDate}`)
                            } else {
                              setProcessDeliveryDateError("")
                            }
                          } else {
                            setProcessDeliveryDateError("")
                          }
                        }
                      }}
                      initialFocus
                      modifiers={{
                        inRange: (date) => {
                          if (!processStartDate || !processEndDate) return false
                          const start = new Date(processStartDate)
                          const end = new Date(processEndDate)
                          return date >= start && date <= end
                        }
                      }}
                      modifiersClassNames={{
                        inRange: "bg-blue-100 text-blue-900 hover:bg-blue-200"
                      }}
                    />
                  </PopoverContent>
                </Popover>
                {processDeliveryDateError && (
                  <p className="text-xs text-red-600 font-medium">{processDeliveryDateError}</p>
                )}
              </div>

              {/* Advance Payment & Payment Terms */}
              <div className="space-y-2">
                <Label>Advance Payment to Be Taken</Label>
                <Select value={processAdvancePaymentTaken} onValueChange={setProcessAdvancePaymentTaken}>
                  <SelectTrigger><SelectValue placeholder="Select YES/NO" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NO">NO</SelectItem>
                    <SelectItem value="YES">YES</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                {processAdvancePaymentTaken === "YES" ? (
                  <>
                    <Label>Advance Amount (₹)</Label>
                    <Input type="number" value={processAdvancePayment} onChange={e => setProcessAdvancePayment(e.target.value)} placeholder="0.00" />
                  </>
                ) : (
                  <div className="opacity-50 pointer-events-none">
                    <Label>Advance Amount (₹)</Label>
                    <Input disabled placeholder="0.00" />
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label>Payment Terms</Label>
                <Select value={processPaymentTerms} onValueChange={setProcessPaymentTerms}>
                  <SelectTrigger><SelectValue placeholder="Select terms" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="advance">Advance</SelectItem>
                    <SelectItem value="7days">7 Days After Delivery</SelectItem>
                    <SelectItem value="delivery">On Delivery</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Order Category</Label>
                <Select value={processOrderCategory} onValueChange={setProcessOrderCategory}>
                  <SelectTrigger><SelectValue placeholder="Select Category" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Sales">Sales</SelectItem>
                    <SelectItem value="Stock Transfer">Stock Transfer</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Upload SO Copy */}
              <div className="space-y-2">
                <Label htmlFor="p-uploadCopy">Upload SO Copy</Label>
                <Input
                  id="p-uploadCopy"
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={e => setProcessUploadCopy(e.target.files?.[0] || null)}
                  className="cursor-pointer"
                />
                {processUploadCopy && (
                  <p className="text-xs text-emerald-600">✅ {processUploadCopy.name}</p>
                )}
              </div>

              {/* Remarks */}
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="p-remarks">Remarks</Label>
                <Input id="p-remarks" placeholder="Enter any remarks..." value={processRemarks} onChange={e => setProcessRemarks(e.target.value)} />
              </div>
            </div>

            {/* ── PO Details ── */}
            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b pb-1">PO Details</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="po_no">PO No. <span className="text-red-500">*</span></Label>
                  <Input
                    id="po_no"
                    value={processPoNo}
                    onChange={e => setProcessPoNo(e.target.value)}
                    placeholder="Enter PO number"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="po_date">PO Date <span className="text-red-500">*</span></Label>
                  <Input
                    id="po_date"
                    type="date"
                    value={processPoDate}
                    onChange={e => setProcessPoDate(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* ── SKU Rows ── */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b pb-1">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">SKU Details <span className="text-slate-400 font-normal normal-case">(Good Life only)</span></p>
                <Button type="button" variant="outline" size="sm" onClick={addSkuRow} className="gap-1 h-7 text-xs">
                  <Plus className="h-3 w-3" /> Add Sku
                </Button>
              </div>

              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="w-7 text-center py-2 px-1 font-medium text-slate-500 text-xs">#</th>
                      <th className="py-2 px-2 text-left font-medium text-slate-600 text-xs text-nowrap">SKU Name *</th>
                      <th className="py-2 px-2 text-left font-medium text-slate-600 text-xs w-[110px]">Qty (Box) *</th>
                      <th className="py-2 px-2 text-left font-medium text-slate-600 text-xs w-[120px]">Weight (MT)</th>
                      <th className="py-2 px-2 text-left font-medium text-slate-600 text-xs w-[150px]">Rate *</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {skuRows.map((row, idx) => {
                      const packType = (() => {
                        if (!row.sku) return "";
                        const u = row.sku.toUpperCase();
                        if (u.includes("JAR")) return "JAR";
                        if (u.includes("PP") || u.includes("POUCH")) return "PP";
                        if (u.includes("TIN")) return "TIN";
                        if (u.includes("CAN")) return "CAN";
                        if (u.includes("PKT") || u.includes("PACKET")) return "PKT";
                        return "";
                      })();

                      return (
                        <tr key={row.id} className="border-b last:border-0">
                          <td className="text-center py-1.5 px-1 text-xs font-bold text-slate-400">{idx + 1}</td>
                          <td className="py-1 px-2">
                            <AsyncCombobox
                              fetchOptions={fetchSkuOptions}
                              value={row.sku}
                              onValueChange={v => updateSkuRow(row.id, "sku", v)}
                              placeholder="Select Good Life SKU"
                              searchPlaceholder="Search SKU..."
                              className="h-8 text-sm"
                            />
                          </td>
                          <td className="py-1 px-2">
                            <Input
                              type="number" min="0" step="0.0001"
                              value={row.qty}
                              onChange={e => updateSkuRow(row.id, "qty", e.target.value)}
                              placeholder="0.0000"
                              className="h-8 text-sm w-full"
                            />
                          </td>
                          <td className="py-1 px-2">
                            <div className="h-8 flex items-center px-2 bg-slate-50 border rounded text-xs font-mono text-slate-600">
                              {row.mt ? row.mt.toFixed(4) : "0.0000"}
                            </div>
                          </td>
                          <td className="py-1 px-2">
                            <div className="flex items-center gap-1.5">
                              <Input
                                type="number" min="0" step="0.01"
                                value={row.rate}
                                onChange={e => updateSkuRow(row.id, "rate", e.target.value)}
                                placeholder="0.00"
                                className="h-8 text-sm flex-1"
                              />
                              {packType && (
                                <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1 py-0.5 rounded border border-blue-100 whitespace-nowrap">
                                  {packType}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-1 px-1 text-center">
                            <Button
                              type="button" variant="ghost" size="icon"
                              className="h-7 w-7 text-red-400 hover:text-red-600 hover:bg-red-50"
                              onClick={() => removeSkuRow(row.id)}
                              disabled={skuRows.length === 1}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsProcessOpen(false)} disabled={isProcessing}>Cancel</Button>
            <Button
              onClick={handleProcessSubmit}
              disabled={isProcessing}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 min-w-[130px]"
            >
              <ChevronRight className="h-4 w-4" />
              {isProcessing ? "Processing..." : "Confirm Process"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════
          PO RAISED DETAILS POPUP
      ═══════════════════════════════════════════════════════ */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="sm:max-w-[1250px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>PO Raised Details — {detailsRow?.commitment_no}</DialogTitle>
            <DialogDescription>
              Commitment: <span className="font-semibold">{detailsRow?.party_name}</span>
              {" | "}
              Oil Type: <span className="font-semibold">{detailsRow?.oil_type}</span>
              {" | "}
              Total Qty: <span className="font-semibold">{detailsRow?.quantity} {detailsRow?.unit}</span>
            </DialogDescription>
          </DialogHeader>

          {isLoadingDetails ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <RefreshCw className="h-5 w-5 animate-spin mr-2" /> Loading details...
            </div>
          ) : detailsData ? (
            <div className="space-y-4">
              {/* Summary row */}
              <div className="flex flex-wrap gap-6 rounded-lg border border-blue-100 bg-blue-50/60 px-4 py-3 text-sm">
                <div>
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Commitment No.</p>
                  <p className="font-mono font-semibold text-blue-700 mt-0.5">{detailsRow?.commitment_no}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Total PO Raised (MT)</p>
                  <p className="font-semibold text-slate-800 mt-0.5">{Number(detailsData.total_processed_mt).toFixed(4)} MT</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">No. of Times Raised</p>
                  <p className="font-semibold text-slate-800 mt-0.5">{detailsData.raise_count} time{detailsData.raise_count !== 1 ? "s" : ""}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Commitment Date</p>
                  <p className="font-semibold text-slate-800 mt-0.5">
                    {detailsRow?.commitment_date ? new Date(detailsRow.commitment_date).toLocaleDateString("en-IN") : "—"}
                  </p>
                </div>
              </div>

              {/* Details table */}
              {detailsData.details?.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No PO raised yet for this commitment.</p>
              ) : (
                <div className="rounded-lg border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b">
                      <tr>
                        <th className="py-2 px-3 text-left font-medium text-slate-600 text-xs">#</th>
                        <th className="py-2 px-3 text-left font-medium text-slate-600 text-xs">Raised On</th>
                        <th className="py-2 px-3 text-left font-medium text-slate-600 text-xs">DO No.</th>
                        <th className="py-2 px-3 text-left font-medium text-slate-600 text-xs text-nowrap">PO No.</th>
                        <th className="py-2 px-3 text-left font-medium text-slate-600 text-xs">PO Date</th>
                        <th className="py-2 px-3 text-left font-medium text-slate-600 text-xs">SKU</th>
                        <th className="py-2 px-3 text-right font-medium text-slate-600 text-xs">Qty (Box)</th>
                        <th className="py-2 px-3 text-right font-medium text-slate-600 text-xs">Weight (MT)</th>
                        <th className="py-2 px-3 text-right font-medium text-slate-600 text-xs">Rate</th>
                        <th className="py-2 px-3 text-left font-medium text-slate-600 text-xs">Category</th>
                        <th className="py-2 px-3 text-left font-medium text-slate-600 text-xs">Order Type</th>
                        <th className="py-2 px-3 text-left font-medium text-slate-600 text-xs">Depo</th>
                        <th className="py-2 px-3 text-left font-medium text-slate-600 text-xs">Payment Terms</th>
                        <th className="py-2 px-3 text-left font-medium text-slate-600 text-xs">Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailsData.details.map((d: any, idx: number) => (
                        <tr key={d.id} className="border-b last:border-0 hover:bg-slate-50">
                          <td className="py-2 px-3 text-xs font-bold text-slate-400">{idx + 1}</td>
                          <td className="py-2 px-3 text-xs">
                            {d.actual1 ? new Date(d.actual1).toLocaleDateString("en-IN") : "—"}
                          </td>
                          <td className="py-2 px-3 font-mono text-xs font-bold text-emerald-700">{d.order_no || "—"}</td>
                          <td className="py-2 px-3 font-mono text-xs font-semibold text-blue-700">{d.po_no || "—"}</td>
                          <td className="py-2 px-3 text-xs">
                            {d.po_date ? new Date(d.po_date).toLocaleDateString("en-IN") : "—"}
                          </td>
                          <td className="py-2 px-3 text-xs max-w-[160px] truncate" title={d.sku}>{d.sku || "—"}</td>
                          <td className="py-2 px-3 text-right font-mono text-xs">{d.sku_quantity ?? "—"}</td>
                          <td className="py-2 px-3 text-right font-mono text-xs font-semibold text-emerald-700">
                            {d.sku_weight_mt ? Number(d.sku_weight_mt).toFixed(4) : "—"}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-xs">
                            {d.sku_rate ? `₹${d.sku_rate}` : "—"}
                          </td>
                          <td className="py-2 px-3 text-xs">
                            <Badge variant="outline" className={cn(
                              "text-[10px] px-1.5 py-0 h-4 uppercase font-bold border",
                              d.order_category === "Stock Transfer" ? "border-purple-200 bg-purple-50 text-purple-700" : "border-blue-200 bg-blue-50 text-blue-700"
                            )}>
                              {d.order_category || "Sales"}
                            </Badge>
                          </td>
                          <td className="py-2 px-3 text-xs">{d.order_type || "—"}</td>
                          <td className="py-2 px-3 text-xs">{d.depo_name || "—"}</td>
                          <td className="py-2 px-3 text-xs">{d.payment_terms || "—"}</td>
                          <td className="py-2 px-3 text-xs max-w-[140px] truncate" title={d.remarks}>{d.remarks || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50 border-t">
                      <tr>
                        <td colSpan={7} className="py-2 px-3 text-xs font-semibold text-slate-600 text-right">Total Weight:</td>
                        <td className="py-2 px-3 text-right font-mono text-xs font-bold text-emerald-700">
                          {Number(detailsData.total_processed_mt).toFixed(4)} MT
                        </td>
                        <td colSpan={5} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">No data available.</p>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDetailsOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}
