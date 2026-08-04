"use client"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"

import { useState, useEffect, useMemo, useRef, useCallback, Fragment } from "react"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { WorkflowStageShell } from "@/components/workflow/workflow-stage-shell"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { Checkbox } from "@/components/ui/checkbox"
import { AsyncCombobox } from "@/components/ui/async-combobox"
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ColumnToggleContent } from "@/components/ui/column-toggle-content"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Settings2, ChevronDown, ChevronUp, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { dispatchPlanningApi, customerApi, depotApi, skuApi } from "@/lib/api-service"
import { isStaleWriteError } from "@/lib/stale-write"
import { generateDispatchSlipPdf } from "@/lib/dispatch-slip-pdf"
import { cn } from "@/lib/utils"
import { useAuth } from "@/hooks/use-auth"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { StageHistoryTab } from "@/components/workflow/stage-history-tab"
import { Loader2, ChevronLeft, ChevronRight, XCircle, FileText, ExternalLink, Printer, Download } from "lucide-react"
import { usePersistedColumns } from "@/hooks/use-persisted-columns"
import { useColumnOrder } from "@/hooks/use-column-order"
import { SortableTableHead } from "@/components/ui/sortable-table-head"
import { ColumnDragProvider } from "@/components/ui/column-drag-provider"

export default function DispatchMaterialPage() {
  const queryClient = useQueryClient()
  const router = useRouter()
  const { toast } = useToast()
  const { isReadOnly, user, isAdmin, isFeatureEnabled, role } = useAuth()
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending")
  const [pendingPage, setPendingPage] = useState(1);
  const limit = 25;

  const [filterValues, setFilterValues] = useState({
    search: "",
    status: "",
    startDate: "",
    endDate: "",
    partyName: "",
    manualSaudaNo: ""
  })
  const [activeDepots, setActiveDepots] = useState<any[]>([])
  const [selectedDepoTab, setSelectedDepoTab] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [selectedGroup, setSelectedGroup] = useState<any>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [dispatchData, setDispatchData] = useState({
    dispatchDate: "",
    dispatchTime: "",
    warehouseLocation: "",
    materialReady: false,
    packagingComplete: false,
    labelsAttached: false,
  })
  const [dispatchDetails, setDispatchDetails] = useState<Record<string, {
    qty: string,
    transportType?: string,
    deliveryFrom?: string,
    transfer?: string,
    transferData?: {
      billTo: { company: string; address: string };
      shipTo: { company: string; address: string };
      freightRate: string;
    }
  }>>({})
  const [expandedOrders, setExpandedOrders] = useState<string[]>([])
  const [revertRemarks, setRevertRemarks] = useState("")

  const [allCustomers, setAllCustomers] = useState<any[]>([])
  const [isTransferPopupOpen, setIsTransferPopupOpen] = useState(false)
  const [currentTransferRowKey, setCurrentTransferRowKey] = useState<string | null>(null)
  const [precloseInputs, setPrecloseInputs] = useState<Record<number, string>>({})
  const [openPrecloseId, setOpenPrecloseId] = useState<number | null>(null)
  const [precloseDialogOpen, setPrecloseDialogOpen] = useState(false)
  const [precloseDialogProduct, setPrecloseDialogProduct] = useState<any | null>(null)
  const [precloseAction, setPrecloseAction] = useState<"commitment" | "close">("close")
  const [precloseRemarks, setPrecloseRemarks] = useState("")
  const [skus, setSkus] = useState<any[]>([])
  const [isSlipDialogOpen, setIsSlipDialogOpen] = useState(false)
  const isSavingTransferRef = useRef(false)

  const getSkuWeight = (productName: string): number => {
    if (!productName || skus.length === 0) return 0
    const normalize = (n: string) => n.toUpperCase().replace(/KGS/g, 'KG').replace(/LTRS/g, 'LTR').replace(/\s+/g, ' ').trim()
    const norm = normalize(productName)
    const sku = skus.find(s => s.sku_name?.toUpperCase() === productName.toUpperCase())
      || skus.find(s => normalize(s.sku_name || '') === norm)
      || skus.find(s => { const n = normalize(s.sku_name || ''); return n.includes(norm) || norm.includes(n) })
    return sku?.sku_weight ? parseFloat(sku.sku_weight) : 0
  }

  const getSkuGrossWeight = (productName: string): number => {
    if (!productName || skus.length === 0) return 0
    const normalize = (n: string) => n.toUpperCase().replace(/KGS/g, 'KG').replace(/LTRS/g, 'LTR').replace(/\s+/g, ' ').trim()
    const norm = normalize(productName)
    const sku = skus.find(s => s.sku_name?.toUpperCase() === productName.toUpperCase())
      || skus.find(s => normalize(s.sku_name || '') === norm)
      || skus.find(s => { const n = normalize(s.sku_name || ''); return n.includes(norm) || norm.includes(n) })
    const grossWeight = sku?.gross_weight ? parseFloat(sku.gross_weight) : 0
    const skuWeight = sku?.sku_weight ? parseFloat(sku.sku_weight) : 0
    return grossWeight > 0 ? grossWeight : skuWeight
  }

  const calculateWeight = (productName: string, qty: string | number): number => {
    const quantity = typeof qty === 'string' ? parseFloat(qty) || 0 : qty
    return getSkuWeight(productName) * quantity
  }

  const calculateGrossWeight = (productName: string, qty: string | number): number => {
    const quantity = typeof qty === 'string' ? parseFloat(qty) || 0 : qty
    return getSkuGrossWeight(productName) * quantity
  }

  const getProductQty = (prod: any) => {
    const rowKey = prod._rowKey
    return dispatchDetails[rowKey]?.qty !== undefined
      ? dispatchDetails[rowKey].qty
      : (prod.remainingDispatchQty !== undefined ? prod.remainingDispatchQty : prod.approvalQty)
  }

  const getCustomerName = (record: any) => {
    const candidates = [
      record?.customerName,
      record?.customer_name,
      record?.partyName,
      record?.party_name,
      record?.customer?.customer_name,
      record?.customer?.name,
      record?.data?.orderData?.customerName,
      record?.data?.orderData?.customer_name,
      record?.data?.orderData?.partyName,
      record?.data?.orderData?.party_name,
      record?.orderData?.customerName,
      record?.orderData?.customer_name,
      record?.orderData?.partyName,
      record?.orderData?.party_name,
    ]

    return candidates.find((value) => value && String(value).trim()) || ""
  }

  const getSlipReference = (prod: any) => {
    const orderThrough = String(prod?.isOrderThrough || prod?.is_order_through || prod?.orderThrough || prod?.order_through || "").trim().toLowerCase()
    if (orderThrough === "salesperson") {
      return {
        label: "Salesperson",
        value: prod?.salespersonName || prod?.salesperson_name || prod?.salesperson || "",
      }
    }
    if (orderThrough === "broker") {
      return {
        label: "Broker",
        value: prod?.brokerName || prod?.broker_name || prod?.broker || "",
      }
    }
    if (orderThrough === "direct") {
      return { label: "Direct", value: "" }
    }

    const hasBrokerFlag = Boolean(prod?.isBroker || prod?.is_order_through_broker)
    if (hasBrokerFlag) {
      return {
        label: "Broker",
        value: prod?.brokerName || prod?.broker_name || prod?.broker || "",
      }
    }

    const salespersonName = prod?.salespersonName || prod?.salesperson_name || prod?.salesperson
    if (salespersonName) {
      return { label: "Salesperson", value: salespersonName }
    }

    return { label: "Direct", value: "" }
  }

  const renderSlipContent = () => {
    if (selectedItems.length === 0 || dialogSelectedProducts.length === 0) return null
    const productsForSlip = selectedItems.flatMap((g: any) =>
      (g._allProducts || []).filter((p: any) => dialogSelectedProducts.includes(p._rowKey))
    )
    const partyGroups: Record<string, any[]> = {}
    productsForSlip.forEach((p: any) => {
      const pName = getCustomerName(p) || "Unknown Party"
      if (!partyGroups[pName]) partyGroups[pName] = []
      partyGroups[pName].push(p)
    })
    const OIL_COLORS: Record<string, string> = { "RICE OIL": "#FCE4D6", "SOYA OIL": "#E2EFDA", "PALM OIL": "#C5D9F1", "OTHERS": "#E5E7EB" }
    const OIL_TITLES: Record<string, string> = { "RICE OIL": "Rice Oil", "SOYA OIL": "Soya Oil", "PALM OIL": "Palm Oil", "OTHERS": "Other" }
    const fmtWt = (n: number) => Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 3, maximumFractionDigits: 3 })
    const fmtDT = (s: any) => {
      if (!s) return ""
      const d = new Date(s)
      if (isNaN(d.getTime())) return ""
      const pad = (n: number) => String(n).padStart(2, "0")
      let h = d.getHours()
      const ampm = h >= 12 ? "PM" : "AM"
      h = h % 12 || 12
      return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${String(d.getFullYear()).slice(2)} ${pad(h)}:${pad(d.getMinutes())} ${ampm}`
    }
    return (
      <div className="space-y-8">
        {Object.entries(partyGroups).map(([party, partyProducts]) => {
          const firstProd = partyProducts[0]
          const date = formatDate(firstProd.party_so_date || firstProd.partySoDate)
          const commitmentNo = firstProd.orderNo || "—"
          const reference = getSlipReference(firstProd)
          const place = firstProd.address || firstProd.customer_delivery_address || firstProd.customer_address || "—"
          const partyMo = firstProd.whatsapp || firstProd.customer_contact_person_whatsapp_no || firstProd.party_mo || firstProd.mobile || "—"
          const processId = firstProd.processid || firstProd.process_id || firstProd.processId || "—"
          const punchBy = firstProd.order_punch_user || "—"
          const punchAt = firstProd.created_at || null
          const preApproveBy = firstProd.pre_approval_user || "—"
          const preApproveAt = firstProd.actual_1 || null
          const approveBy = firstProd.order_approval_user || "—"
          const approveAt = firstProd.actual_2 || null
          const status = firstProd.has_prior_dispatch ? "Pending" : "Original"
          const categories: Record<string, any[]> = { "RICE OIL": [], "SOYA OIL": [], "PALM OIL": [], "OTHERS": [] }
          partyProducts.forEach((prod: any) => {
            const name = (prod.productName || "").toUpperCase()
            const qty = parseFloat(String(getProductQty(prod) || "0"))
            const unit = prod.uom || "PCS"
            const item = { name: prod.productName, unit, qty, weight: calculateWeight(prod.productName, qty), grossWeight: calculateGrossWeight(prod.productName, qty) }
            if (name.includes("RBO") || name.includes("RICE")) categories["RICE OIL"].push(item)
            else if (name.includes("SBO") || name.includes("SOYA")) categories["SOYA OIL"].push(item)
            else if (name.includes("PALM")) categories["PALM OIL"].push(item)
            else categories["OTHERS"].push(item)
          })
          return (
            <div key={party} className="border border-black bg-white text-black mb-8 last:mb-0 max-w-[600px] mx-auto">
              <div className="text-center px-2 pt-3 pb-2">
                <h1 className="text-xl font-black">SHRI SHYAM OIL EXTRACTIONS PVT LTD</h1>
                <p className="text-[11px] text-gray-500">Vill: Banari, PO: Banari, Dist: Janjgir-Champa (CG)</p>
                <div className="text-base font-bold mt-1">Oil Dispatch Voucher</div>
              </div>
              <div className="grid grid-cols-2 text-xs border-t border-black">
                <div className="border-b border-r border-black p-1.5"><span className="font-bold">DO no.:</span> {commitmentNo}</div>
                <div className="border-b border-black p-1.5"><span className="font-bold">DO Date:</span> {date}</div>
                <div className="border-b border-r border-black p-1.5"><span className="font-bold">Customer:</span> {party}</div>
                <div className="border-b border-black p-1.5">
                  <span className="font-bold">{reference.label}{reference.label !== "Direct" && reference.value ? ":" : ""}</span>
                  {reference.label !== "Direct" && reference.value ? ` ${reference.value}` : ""}
                </div>
                <div className="border-b border-r border-black p-1.5"><span className="font-bold">Address:</span> {place}</div>
                <div className="border-b border-black p-1.5">
                  <span className="font-bold">Mob.:</span> {partyMo}<br />
                  <span className="font-bold">Status:</span> {status}
                </div>
              </div>
              <table className="w-full border-collapse">
                <thead>
                  <tr style={{ background: "#A6A6A6" }}>
                    <th className="border border-black border-t-0 p-1.5 text-left text-xs w-full">Item Name</th>
                    <th className="border border-black border-t-0 p-1.5 text-center text-xs whitespace-nowrap">QTY</th>
                    <th className="border border-black border-t-0 p-1.5 text-center text-xs whitespace-nowrap">UOM</th>
                    <th className="border border-black border-t-0 p-1.5 text-center text-xs whitespace-nowrap">Net Wt.</th>
                    <th className="border border-black border-t-0 p-1.5 text-center text-xs whitespace-nowrap">Gross Wt.</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(categories).map(([category, items]) => {
                    if (items.length === 0) return null
                    const catQty = items.reduce((s: number, i: any) => s + i.qty, 0)
                    const catWeight = items.reduce((s: number, i: any) => s + i.weight, 0)
                    const catGross = items.reduce((s: number, i: any) => s + i.grossWeight, 0)
                    return (
                      <Fragment key={category}>
                        <tr style={{ background: OIL_COLORS[category] }} className="font-bold text-center"><td colSpan={5} className="border border-black p-1 text-sm">{OIL_TITLES[category]}</td></tr>
                        {items.map((item: any, idx: number) => (
                          <tr key={idx}>
                            <td className="border border-black p-1.5 text-xs">{item.name}</td>
                            <td className="border border-black p-1.5 text-xs text-center">{item.qty}</td>
                            <td className="border border-black p-1.5 text-xs text-center">{item.unit}</td>
                            <td className="border border-black p-1.5 text-xs text-right whitespace-nowrap">{fmtWt(item.weight)} KGS</td>
                            <td className="border border-black p-1.5 text-xs text-right whitespace-nowrap">{fmtWt(item.grossWeight)} KGS</td>
                          </tr>
                        ))}
                        <tr style={{ background: OIL_COLORS[category] }} className="font-bold">
                          <td className="border border-black p-1.5 text-xs text-right whitespace-nowrap">Total {OIL_TITLES[category]}</td>
                          <td className="border border-black p-1.5 text-xs text-center">{catQty}</td>
                          <td className="border border-black p-1.5 text-xs"></td>
                          <td className="border border-black p-1.5 text-xs text-right whitespace-nowrap">{fmtWt(catWeight)} KGS</td>
                          <td className="border border-black p-1.5 text-xs text-right whitespace-nowrap">{fmtWt(catGross)} KGS</td>
                        </tr>
                      </Fragment>
                    )
                  })}
                  <tr className="bg-black text-white font-bold">
                    <td className="border border-black p-1.5 text-xs text-center">Grand Total</td>
                    <td className="border border-black p-1.5 text-xs text-center">{partyProducts.reduce((s: number, p: any) => s + parseFloat(String(getProductQty(p) || "0")), 0)}</td>
                    <td className="border border-black p-1.5 text-xs"></td>
                    <td className="border border-black p-1.5 text-xs text-right whitespace-nowrap">{fmtWt(partyProducts.reduce((s: number, p: any) => s + calculateWeight(p.productName, getProductQty(p)), 0))} KGS</td>
                    <td className="border border-black p-1.5 text-xs text-right whitespace-nowrap">{fmtWt(partyProducts.reduce((s: number, p: any) => s + calculateGrossWeight(p.productName, getProductQty(p)), 0))} KGS</td>
                  </tr>
                  <tr>
                    <td colSpan={5} className="border border-black p-2 align-top">
                      <div className="flex justify-between gap-2 text-[11px]">
                        <div className="text-center flex-1"><span className="underline">Order Punch By: {punchBy}</span><br />({fmtDT(punchAt)})</div>
                        <div className="text-center flex-1"><span className="underline">Pre-Approve By: {preApproveBy}</span><br />({fmtDT(preApproveAt)})</div>
                        <div className="text-center flex-1"><span className="underline">Approve By: {approveBy}</span><br />({fmtDT(approveAt)})</div>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )
        })}
      </div>
    )
  }

  const buildSlipParties = () => {
    const productsForSlip = selectedItems.flatMap((g: any) =>
      (g._allProducts || []).filter((p: any) => dialogSelectedProducts.includes(p._rowKey))
    )
    const partyGroups: Record<string, any[]> = {}
    productsForSlip.forEach((p: any) => {
      const pName = getCustomerName(p) || "Unknown Party"
      if (!partyGroups[pName]) partyGroups[pName] = []
      partyGroups[pName].push(p)
    })
    return Object.entries(partyGroups).map(([party, partyProducts]) => {
      const firstProd = partyProducts[0]
      const reference = getSlipReference(firstProd)
      return {
        party,
        commitmentNo: firstProd.orderNo || "—",
        date: formatDate(firstProd.party_so_date || firstProd.partySoDate),
        referenceLabel: reference.label,
        referenceValue: reference.value,
        place: firstProd.address || firstProd.customer_delivery_address || firstProd.customer_address || "—",
        partyMo: firstProd.whatsapp || firstProd.customer_contact_person_whatsapp_no || firstProd.party_mo || firstProd.mobile || "—",
        status: firstProd.has_prior_dispatch ? "Pending" : "Original",
        processId: firstProd.processid || firstProd.process_id || firstProd.processId || "—",
        punchBy: firstProd.order_punch_user || "—",
        punchAt: firstProd.created_at || null,
        preApproveBy: firstProd.pre_approval_user || "—",
        preApproveAt: firstProd.actual_1 || null,
        approveBy: firstProd.order_approval_user || "—",
        approveAt: firstProd.actual_2 || null,
        products: partyProducts.map((prod: any) => {
          const qty = parseFloat(String(getProductQty(prod) || "0"))
          return {
            productName: prod.productName || "—",
            uom: prod.uom || "PCS",
            qty,
            weight: calculateWeight(prod.productName, qty),
            grossWeight: calculateGrossWeight(prod.productName, qty),
          }
        }),
      }
    })
  }

  const handleDownloadSlip = () => {
    if (selectedItems.length === 0 || dialogSelectedProducts.length === 0) {
      toast({ title: "Error", description: "Please select products to download slip", variant: "destructive" })
      return
    }
    generateDispatchSlipPdf(buildSlipParties(), "dispatch-slip.pdf")
  }

  const handlePrintSlip = () => {
    if (selectedItems.length === 0 || dialogSelectedProducts.length === 0) {
      toast({ title: "Error", description: "Please select products to print slip", variant: "destructive" })
      return
    }
    generateDispatchSlipPdf(buildSlipParties(), "dispatch-slip.pdf", { print: true })
  }

  const PAGE_COLUMNS = [
    { id: "partySoDate", label: "DO Date" },
    { id: "orderNo", label: "DO Number" },
    // { id: "processId", label: "Manual Sauda No." },
    { id: "deliveryPurpose", label: "Order Type (Delivery Purpose)" },
    { id: "orderType", label: "Order Type" },
    { id: "customerType", label: "Customer Type" },
    { id: "startDate", label: "Start Date" },
    { id: "endDate", label: "End Date" },
    { id: "deliveryDate", label: "Delivery Date" },
    { id: "customerName", label: "Customer Name" },
    { id: "oilType", label: "Oil Type" },
    { id: "ratePer15Kg", label: "Rate Per 15 kg" },
    { id: "ratePerLtr", label: "Rate Per Ltr" },
    { id: "rateOfMaterial", label: "Rate of Material" },
    { id: "rate", label: "Rate" },
    { id: "productName", label: "Product Name" },
    { id: "uom", label: "UOM" },
    { id: "orderQty", label: "Order Qty" },
    { id: "altUom", label: "Alt UOM" },
    { id: "altQty", label: "Alt Qty (Kg)" },
    { id: "skuName", label: "SKU Name" },
    { id: "approvalQty", label: "Approval Qty" },
    { id: "qtyToDispatch", label: "Qty to Dispatch" },
    { id: "deliveryFrom", label: "Delivery From" },
    { id: "totalWithGst", label: "Total Amount with GST" },
    { id: "transportType", label: "Type of Transporting" },
    { id: "contactPerson", label: "Customer Contact Person Name" },
    { id: "whatsapp", label: "Customer Contact Person Whatsapp No." },
    { id: "address", label: "Customer Address" },
    { id: "paymentTerms", label: "Payment Terms" },
    { id: "advanceTaken", label: "Advance Payment to be Taken" },
    { id: "advanceAmount", label: "Advance Amount" },
    { id: "isBroker", label: "Is this order Through Broker" },
    { id: "brokerName", label: "Broker Name (If Order Through Broker)" },
    { id: "uploadSo", label: "Upload DO" },
    { id: "orderPunchRemarks", label: "Order Punch Remarks" },
    { id: "remark", label: "Remark" },
    { id: "revertSecurityRemarks", label: "Revert(Security-Guard) Remarks" },
    { id: "revertDispatchRemarks", label: "Revert(Dispatch-Planning) Remarks" },
    { id: "revertPlanningRemarks", label: "Revert(Pre-Approval) Remarks" },
    { id: "status", label: "Status" },
  ]

  const [visibleColumns, setVisibleColumns] = usePersistedColumns(
    "dispatch-material",
    ["partySoDate", "orderNo", "processId", "customerName", "productName", "transportType", "orderPunchRemarks", "revertDispatchRemarks", "status"]
  )
  const [columnOrder, setColumnOrder] = useColumnOrder("dispatch-material", PAGE_COLUMNS.map(c => c.id))
  const orderedVisibleCols = columnOrder
    .map(id => PAGE_COLUMNS.find(c => c.id === id))
    .filter((col): col is typeof PAGE_COLUMNS[0] => !!col && visibleColumns.includes(col.id))
  const handleColumnReorder = useCallback((newVisibleOrder: string[]) => {
    const hiddenCols = columnOrder.filter(id => !visibleColumns.includes(id))
    setColumnOrder([...newVisibleOrder, ...hiddenCols])
  }, [columnOrder, visibleColumns, setColumnOrder])


  // Pending query with numeric pagination
  const {
    data: pendingData,
    isLoading: isPendingLoading,
    refetch: refetchPending,
  } = useQuery({
    queryKey: ["dispatch-pending", filterValues, user?.depo_access?.['Dispatch Planning'], pendingPage, selectedDepoTab],
    queryFn: async () => {
      const response = await dispatchPlanningApi.getPending({
        page: pendingPage,
        limit: limit,
        order_no: filterValues.search,
        start_date: filterValues.startDate,
        end_date: filterValues.endDate,
        customer_name: filterValues.partyName === "all" ? undefined : filterValues.partyName,
        manual_sauda_no: filterValues.manualSaudaNo || undefined,
        depo_names: selectedDepoTab ? [selectedDepoTab] : (user?.depo_access?.['Dispatch Planning'] || [])
      });
      return response.success ? response.data : { dispatches: [], pagination: { total: 0 } };
    },
    enabled: !!selectedDepoTab, // wait until depot is selected
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const pendingOrders = pendingData?.dispatches || [];

  // Reset to page 1 on filter or depot change
  useEffect(() => {
    setPendingPage(1);
  }, [filterValues, selectedDepoTab]);

  const fetchCustomers = async () => {
    try {
      const response = await customerApi.getAll({ all: 'true' });
      if (response.success) {
        const customerList = response.data.customers || (Array.isArray(response.data) ? response.data : []);
        setAllCustomers(customerList);
      }
    } catch (error) {
      console.error("[DISPATCH] Failed to fetch customers:", error);
    }
  };

  const fetchDepots = async () => {
    try {
      const response = await depotApi.getAll({ all: 'false' });
      if (response.success && response.data?.depots) {
        let depots = response.data.depots;

        // Filter by user permissions
        // Filter by user permissions: if missing from depo_access object, we allow all for backward compatibility/admins.
        // If the key exists but is empty [], we show NOTHING.
        // Filter by user permissions: strict deny-by-default even for admins.
        const allowedDepos = user?.depo_access?.['Dispatch Planning'] || [];
        depots = depots.filter((d: any) =>
          allowedDepos.some(ad => ad.toLowerCase() === d.depot_name.toLowerCase())
        );

        const sortedDepots = [...depots].sort((a, b) => {
          const aIsBanari = a.depot_name.toLowerCase() === 'banari'
          const bIsBanari = b.depot_name.toLowerCase() === 'banari'
          if (aIsBanari && !bIsBanari) return -1
          if (!aIsBanari && bIsBanari) return 1
          return a.depot_name.localeCompare(b.depot_name)
        })
        setActiveDepots(sortedDepots);
        // Set default depot: prefer Banari if user has access, otherwise first in list
        if (sortedDepots.length > 0 && !sortedDepots.some((d: any) => d.depot_name === selectedDepoTab)) {
          const banari = sortedDepots.find((d: any) => d.depot_name.toLowerCase() === 'banari');
          setSelectedDepoTab(banari ? banari.depot_name : sortedDepots[0].depot_name);
        }
      }
    } catch (error) {
      console.error("[DISPATCH] Failed to fetch depots:", error);
    }
  };

  const fetchSkus = async () => {
    try {
      const response = await skuApi.getAll({ limit: 1000 })
      let skuArray: any[] = []
      if (response?.data) {
        if (Array.isArray(response.data)) skuArray = response.data
        else skuArray = response.data.skuDetails || response.data.skus || response.data.items || []
      }
      setSkus(skuArray)
    } catch { }
  }

  useEffect(() => {
    fetchCustomers();
    fetchDepots();
    fetchSkus();
  }, [user?.depo_access])

  const availableDepos = useMemo(() => {
    return activeDepots.map(d => d.depot_name);
  }, [activeDepots]);

  useEffect(() => {
    if (availableDepos.length > 0 && (!selectedDepoTab || !availableDepos.includes(selectedDepoTab))) {
      const banari = availableDepos.find(d => d.toLowerCase() === 'banari');
      setSelectedDepoTab(banari ?? availableDepos[0]);
    }
  }, [availableDepos, selectedDepoTab]);

  const [selectedItems, setSelectedItems] = useState<any[]>([])
  const [dialogSelectedProducts, setDialogSelectedProducts] = useState<string[]>([])

  const toggleSelectAll = () => {
    if (selectedItems.length === displayRows.length) {
      setSelectedItems([])
    } else {
      setSelectedItems([...displayRows])
    }
  }

  const toggleSelectItem = (item: any) => {
    const key = item._rowKey
    const isSelected = selectedItems.some(i => i._rowKey === key)

    if (isSelected) {
      setSelectedItems(prev => prev.filter(i => i._rowKey !== key))
    } else {
      setSelectedItems(prev => [...prev, item])
    }
  }

  const handleOpenDialog = () => {
    if (selectedItems.length > 0) {
      setSelectedGroup(selectedItems[0])
      // Default: Select ALL products in all selected groups for dispatch
      const allKeys = selectedItems.flatMap(g => g._allProducts || []).map((p: any) => p._rowKey)
      setDialogSelectedProducts(allKeys)
      setIsDialogOpen(true)
    }
  }

  const toggleSelectDialogProduct = (key: string) => {
    if (dialogSelectedProducts.includes(key)) {
      setDialogSelectedProducts(prev => prev.filter(k => k !== key))
    } else {
      setDialogSelectedProducts(prev => [...prev, key])
    }
  }

  // Get all flattened products from selected Groups
  const allProductsFromSelectedGroups = useMemo(() => {
    return selectedItems.flatMap(group => group._allProducts || [])
  }, [selectedItems])

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "—";
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      return date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    } catch (e) {
      return dateStr;
    }
  };

  const handleBulkDispatch = async () => {
    setIsProcessing(true)
    try {
      if (selectedItems.length === 0 || dialogSelectedProducts.length === 0) {
        toast({
          title: "No Items Selected",
          description: "Please select items to dispatch",
          variant: "destructive",
        });
        return;
      }

      const successfulDispatches: any[] = []
      const failedDispatches: any[] = []

      const itemsToProcess = allProductsFromSelectedGroups.filter((p: any) => dialogSelectedProducts.includes(p._rowKey))

      // 1. Validation Check: Ensure no quantities are 0
      const itemsWithZeroQty = itemsToProcess.filter(item => {
        const rowKey = item._rowKey;
        const qty = dispatchDetails[rowKey]?.qty !== undefined ? dispatchDetails[rowKey].qty : (item.remainingDispatchQty !== undefined ? item.remainingDispatchQty : item.approvalQty);
        return Number(qty) <= 0;
      });

      if (itemsWithZeroQty.length > 0) {
        toast({
          title: "Submission Blocked",
          description: "Select quantity greater than 0 to dispatch items.",
          variant: "destructive",
        });
        setIsProcessing(false);
        return;
      }

      // Submit each item to backend API
      for (const item of itemsToProcess) {
        const orderId = item.id // Use the order_dispatch table ID from backend
        const rowKey = item._rowKey;

        const deliveryVal = dispatchDetails[rowKey]?.deliveryFrom || "in-stock";
        const dispatchQty = dispatchDetails[rowKey]?.qty !== undefined ? dispatchDetails[rowKey].qty : (item.remainingDispatchQty !== undefined ? item.remainingDispatchQty : item.approvalQty);

        try {
          if (orderId) {
            const tData = dispatchDetails[rowKey]?.transferData;
            const dispatchData = {
              dispatch_from: deliveryVal,
              dispatch_qty: dispatchQty,
              user_id: user?.id || null,
              transfer: dispatchDetails[rowKey]?.transfer || item.transfer || 'no',
              bill_company_name: (tData?.billTo?.company ? tData.billTo.company.split('|')[0] : item.bill_company_name) || null,
              bill_address: tData?.billTo?.address || item.bill_address || null,
              ship_company_name: (tData?.shipTo?.company ? tData.shipTo.company.split('|')[0] : item.ship_company_name) || null,
              ship_address: tData?.shipTo?.address || item.ship_address || null,
              freight_rate: tData?.freightRate !== undefined ? tData.freightRate : (item.freight_rate || 0)
            };

            const response = await dispatchPlanningApi.submit(orderId, dispatchData);

            if (response.success) {
              successfulDispatches.push({ item, dsrNumber: response.data?.dsrNumber });
            } else {
              failedDispatches.push({ item, error: response.message || 'Unknown error' });
            }
          }
        } catch (error: any) {
          // Preserve error.code so stale-write (409) conflicts can be told apart below.
          failedDispatches.push({ item, error: error?.message || error?.toString() || 'Unknown error', code: error?.code });
        }
      }

      // Show results
      if (successfulDispatches.length > 0) {
        toast({
          title: "Dispatches Submitted Successfully",
          description: `${successfulDispatches.length} dispatch(es) submitted.`,
        });

        setSelectedItems([]);
        setDispatchDetails({});
        setDialogSelectedProducts([]);
        setIsDialogOpen(false);

        await refetchPending();
        queryClient.invalidateQueries({ queryKey: ["dispatch-history"] });

        // setTimeout(() => {
        //   router.push("/actual-dispatch")
        // }, 1500)
      }

      // Split failures: stale-write conflicts (row already processed/moved by another
      // user) get a dedicated message and always trigger a refetch so the phantom rows
      // drop off the list — even when nothing in this batch succeeded.
      const staleDispatches = failedDispatches.filter((f: any) => isStaleWriteError(f));
      const otherDispatches = failedDispatches.filter((f: any) => !isStaleWriteError(f));

      if (staleDispatches.length > 0) {
        toast({
          title: "Already Processed",
          description: `${staleDispatches.length} order(s) were already processed or moved by another user. Refreshing the list…`,
          variant: "destructive",
        });
        if (successfulDispatches.length === 0) {
          await refetchPending();
          queryClient.invalidateQueries({ queryKey: ["dispatch-history"] });
        }
      }

      if (otherDispatches.length > 0) {
        toast({
          title: "Some Dispatches Failed",
          description: `${otherDispatches.length} dispatch(es) failed.`,
          variant: "destructive",
        })
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false)
    }
  }

  const handleRevert = async () => {
    if (!revertRemarks.trim()) {
      toast({ title: "Validation Error", description: "Revert remarks are required", variant: "destructive" });
      return;
    }

    setIsProcessing(true);
    try {
      const itemsToRevert = allProductsFromSelectedGroups.filter((p: any) => dialogSelectedProducts.includes(p._rowKey));

      if (itemsToRevert.length === 0) {
        toast({ title: "Error", description: "No products selected to revert", variant: "destructive" });
        setIsProcessing(false);
        return;
      }

      const successfulReverts: any[] = [];
      const failedReverts: any[] = [];

      for (const item of itemsToRevert) {
        const orderId = item.id;
        if (!orderId) continue;

        try {
          const res = await dispatchPlanningApi.revert(orderId, user?.username || 'system', revertRemarks.trim());
          if (res.success) {
            successfulReverts.push(orderId);
          } else {
            failedReverts.push({ orderId, message: res.message });
          }
        } catch (err: any) {
          failedReverts.push({ orderId, message: err.message });
        }
      }

      if (successfulReverts.length > 0) {
        toast({
          title: "Revert Successful",
          description: `${successfulReverts.length} item(s) reverted to Pre-Approval.`,
        });

        setIsDialogOpen(false);
        setSelectedItems([]);
        setDialogSelectedProducts([]);
        setDispatchDetails({});
        setRevertRemarks("");

        await refetchPending();
        queryClient.invalidateQueries({ queryKey: ["dispatch-history"] });
      }

      if (failedReverts.length > 0) {
        // Surface the real reason (e.g. a stale-write conflict from another user)
        // instead of a generic count, so the user knows to refresh.
        const messages = Array.from(new Set(failedReverts.map((f) => f.message).filter(Boolean)));
        toast({
          title: successfulReverts.length > 0 ? "Partial Revert Failure" : "Revert Failed",
          description: messages[0] || `Failed to revert ${failedReverts.length} item(s).`,
          variant: "destructive",
        });
        // Refresh so rows already reverted/moved by another user drop off the stale list.
        if (successfulReverts.length === 0) {
          await refetchPending();
          queryClient.invalidateQueries({ queryKey: ["dispatch-history"] });
        }
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "An unexpected error occurred during revert",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancel = async () => {
    if (!revertRemarks.trim()) {
      toast({ title: "Validation Error", description: "Cancellation remarks are required", variant: "destructive" });
      return;
    }

    if (role !== 'super_admin') {
      toast({ title: "Access Denied", description: "Only Super Admin can cancel a Dispatch Planning order", variant: "destructive" });
      return;
    }

    setIsProcessing(true);
    try {
      const itemsToCancel = allProductsFromSelectedGroups.filter((p: any) => dialogSelectedProducts.includes(p._rowKey));

      if (itemsToCancel.length === 0) {
        toast({ title: "Error", description: "No products selected to cancel", variant: "destructive" });
        setIsProcessing(false);
        return;
      }

      const successfulCancels: any[] = [];
      const failedCancels: any[] = [];

      for (const item of itemsToCancel) {
        const orderId = item.id;
        if (!orderId) continue;

        try {
          const res = await dispatchPlanningApi.cancel(orderId, user?.username || 'system', revertRemarks.trim());
          if (res.success) {
            successfulCancels.push(orderId);
          } else {
            failedCancels.push({ orderId, message: res.message });
          }
        } catch (err: any) {
          failedCancels.push({ orderId, message: err.message });
        }
      }

      if (successfulCancels.length > 0) {
        toast({
          title: "Order Cancelled",
          description: `${successfulCancels.length} item(s) cancelled.`,
        });

        setIsDialogOpen(false);
        setSelectedItems([]);
        setDialogSelectedProducts([]);
        setDispatchDetails({});
        setRevertRemarks("");

        await refetchPending();
      }

      if (failedCancels.length > 0) {
        const messages = Array.from(new Set(failedCancels.map((f) => f.message).filter(Boolean)));
        toast({
          title: successfulCancels.length > 0 ? "Partial Cancel Failure" : "Cancel Failed",
          description: messages[0] || `Failed to cancel ${failedCancels.length} item(s).`,
          variant: "destructive",
        });
        if (successfulCancels.length === 0) {
          await refetchPending();
        }
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "An unexpected error occurred during cancellation",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePreclose = async (id: number, qty: number, action: "commitment" | "close", remarks: string) => {
    if (!remarks.trim()) {
      toast({ title: "Reason Required", description: "Please enter a reason for preclosing.", variant: "destructive" });
      return;
    }
    setIsProcessing(true);
    try {
      const res = await dispatchPlanningApi.preclose(id, {
        preclose_qty: qty,
        username: user?.username || 'system',
        action,
        preclose_remarks: remarks.trim()
      });
      if (res.success) {
        toast({ title: "Success", description: `Successfully preclosed ${qty} items.` });
        setPrecloseDialogOpen(false);
        setPrecloseDialogProduct(null);
        setPrecloseRemarks("");
        setPrecloseAction("close");
        setOpenPrecloseId(null);

        // Clear local details for this row if any
        setDispatchDetails(prev => {
          const next = { ...prev };
          Object.keys(next).forEach(key => {
            if (key.endsWith(`-${id}`)) delete next[key];
          });
          return next;
        });

        await refetchPending();
        queryClient.invalidateQueries({ queryKey: ["dispatch-history"] });
      } else {
        toast({ title: "Error", description: res.message || "Failed to preclose", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "An unexpected error occurred", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const allChecked = dispatchData.materialReady && dispatchData.packagingComplete && dispatchData.labelsAttached


  /* Extract unique customer names (No longer used for filter as requested) */
  // const customerNames = Array.from(new Set(pendingOrders.map(order => order.customer_name || order.customerName || "Unknown")))

  const filteredPendingOrders = pendingOrders.filter((order: any) => {
    // API already handles search and date range
    if (!filterValues.status) return true;

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const targetDateStr = order.deliveryDate || order.timestamp
    if (!targetDateStr) return true;

    const targetDate = new Date(targetDateStr)
    targetDate.setHours(0, 0, 0, 0)

    if (filterValues.status === "expire") {
      return targetDate < today
    } else if (filterValues.status === "on-time") {
      return targetDate >= today
    }
    return true
  })

  const displayRows = useMemo(() => {
    const grouped: { [key: string]: any } = {}

    filteredPendingOrders.forEach((order: any) => {
      const orderId = order.order_no || order.orderNo || "DO/26-27/0001"
      // Group by Base DO (e.g. DO/26-27/0001 from DO/26-27/0001A)
      const baseDoMatch = orderId.match(/^(DO[-\/](?:\d{2}-\d{2}\/)?\d+)/i)
      const baseDo = baseDoMatch ? baseDoMatch[1].toUpperCase() : orderId

      const internalOrder = order.data?.orderData || order
      const customerName = getCustomerName(internalOrder) || getCustomerName(order) || "—"
      const groupKey = baseDo // Group by DO instead of Customer Name

      if (!grouped[groupKey]) {
        grouped[groupKey] = {
          ...order,
          customerName,
          customer_name: customerName,
          partyName: customerName,
          party_name: customerName,
          transportType: order.type_of_transporting || order.transportType || "—",
          _displayDo: baseDo,
          _rowKey: groupKey,
          _allProducts: [],
          _productCount: 0,
          _ordersMap: {} // Map to store details for each base DO
        }
      }

      if (!grouped[groupKey]._ordersMap[baseDo]) {
        grouped[groupKey]._ordersMap[baseDo] = {
          ...order,
          baseDo,
          customerName,
          customer_name: customerName,
          partyName: customerName,
          party_name: customerName,
          _products: [],
          // Robust Mapping for Header
          deliveryPurpose: internalOrder.order_type_delivery_purpose || internalOrder.orderPurpose || "—",
          startDate: internalOrder.start_date || internalOrder.startDate || "—",
          endDate: internalOrder.end_date || internalOrder.endDate || "—",
          deliveryDate: internalOrder.delivery_date || internalOrder.deliveryDate || internalOrder.timestamp || "—",
          orderType: internalOrder.order_type || internalOrder.orderType || "—",
          customerType: internalOrder.customer_type || internalOrder.customerType || "—",
          partySoDate: formatDate(internalOrder.party_so_date || internalOrder.soDate),
          totalWithGst: internalOrder.total_amount_with_gst || internalOrder.totalWithGst || "—",
          contactPerson: internalOrder.customer_contact_person_name || internalOrder.contactPerson || "—",
          whatsapp: internalOrder.customer_contact_person_whatsapp_no || internalOrder.whatsappNo || "—",
          address: internalOrder.customer_address || internalOrder.customerAddress || "—",
          paymentTerms: internalOrder.payment_terms || internalOrder.paymentTerms || "—",
          advanceTaken: internalOrder.advance_payment_to_be_taken || internalOrder.advancePaymentTaken || false,
          advanceAmount: internalOrder.advance_amount || internalOrder.advanceAmount || "—",
          isBroker: internalOrder.is_order_through_broker || internalOrder.isBrokerOrder || false,
          isOrderThrough: internalOrder.is_order_through || internalOrder.isOrderThrough || "Broker",
          brokerName: internalOrder.broker_name || internalOrder.brokerName || "",
          salespersonName: internalOrder.salesperson_name || internalOrder.salespersonName || "",
          depoName: internalOrder.depo_name || internalOrder.depoName || "",
          orderPunchRemarks: internalOrder.order_punch_remarks || internalOrder.orderPunchRemarks || "—",
          custContactName: internalOrder.customer_contact_person_name || internalOrder.contactPerson || "—",
          weDealInSku: internalOrder.we_are_dealing_in_ordered_sku || false,
          creditStatus: internalOrder.party_credit_status || internalOrder.creditStatus || "—",
          dispatchConfirmed: internalOrder.dispatch_date_confirmed || false,
          overallStatus: internalOrder.overall_status_of_order || internalOrder.overallStatus || "—",
          custConfirmation: internalOrder.order_confirmation_with_customer || false,
          revertDispatchRemarks: internalOrder.revert_dispatch_remarks || "—",
          uploadSo: internalOrder.upload_copy || internalOrder.upload_so || internalOrder.uploadSo || null,
        }
      }

      // Add product to the group
      const productWithMeta = {
        ...order,
        _rowKey: `${baseDo}-${order.id}`,
        id: order.id,
        customerName,
        customer_name: customerName,
        partyName: customerName,
        party_name: customerName,
        orderNo: order.order_no,
        productName: order.product_name || order._product?.productName || order._product?.oilType,
        oilType: order.oil_type || order._product?.oilType,
        orderQty: order.order_quantity || order._product?.orderQty,
        rate: order.final_rate || order.rate_of_material || order.rate || order._product?.rate,
        approvalQty: order.approval_qty || order.order_quantity,
        remainingDispatchQty: order.remaining_dispatch_qty !== null ? order.remaining_dispatch_qty : (order.approval_qty || order.order_quantity),
      }

      grouped[groupKey]._ordersMap[baseDo]._products.push(productWithMeta)
      grouped[groupKey]._allProducts.push(productWithMeta)
    })

    return Object.values(grouped).map((group: any) => {
      const firstOrderDetails = Object.values(group._ordersMap)[0] as any || {};
      return {
        ...group,
        ...firstOrderDetails, // Flatten all detail fields into the group object
        orderNo: group._displayDo,
        processId: group.processid || group._allProducts[0]?.processid || "—",
        transportType: Array.from(new Set(Object.values(group._ordersMap).map((o: any) => o.transportType))).filter(t => t && t !== "—").join(", ") || "—",
        orderPunchRemarks: Array.from(new Set(Object.values(group._ordersMap).map((o: any) => o.orderPunchRemarks))).filter(Boolean).join("; ") || "—",
        uploadSo: Object.values(group._ordersMap).map((o: any) => o.uploadSo).find(Boolean) || null,
        _productCount: group._allProducts.length
      };
    }).filter(group => {
      if (group._productCount <= 0) return false;
      if (!selectedDepoTab) return true;
      return (group.depoName || "").trim().toUpperCase() === selectedDepoTab.trim().toUpperCase();
    })
  }, [filteredPendingOrders, selectedDepoTab])

  // ── Pending Table Sorting ─────────────────────────────────────
  const [pendingSortField, setPendingSortField] = useState<string>("")
  const [pendingSortDir, setPendingSortDir] = useState<"asc" | "desc">("asc")

  const handlePendingSort = (field: string) => {
    if (pendingSortField === field) {
      setPendingSortDir(prev => prev === "asc" ? "desc" : "asc")
    } else {
      setPendingSortField(field)
      setPendingSortDir("asc")
    }
  }

  const PendingSortIcon = ({ field }: { field: string }) => {
    if (pendingSortField !== field) return <ArrowUpDown className="ml-1 h-3 w-3 text-slate-400 inline" />
    return pendingSortDir === "asc"
      ? <ArrowUp className="ml-1 h-3 w-3 text-blue-600 inline" />
      : <ArrowDown className="ml-1 h-3 w-3 text-blue-600 inline" />
  }

  // Sorts displayRows by any field key — dynamic columns are automatically sortable
  const getSortValue = (row: any, colId: string): string => {
    if (colId === "status") {
      return "Pending"
    }
    if (colId === "productName") {
      return String(row._allProducts?.[0]?.productName || "—")
    }
    const firstProd = row._allProducts?.[0] || {}
    if (colId === "oilType") return String(firstProd.oilType || "—")
    if (colId === "ratePer15Kg") return String(firstProd.ratePer15Kg || "—")
    if (colId === "ratePerLtr") return String(firstProd.ratePerLtr || "—")
    if (colId === "rateOfMaterial") return String(firstProd.rateOfMaterial || "—")
    if (colId === "rate") return String(firstProd.rate || "—")
    if (colId === "uom") return String(firstProd.uom || "—")
    if (colId === "orderQty") return String(firstProd.orderQty || "—")
    if (colId === "altUom") return String(firstProd.altUom || "—")
    if (colId === "altQty") return String(firstProd.altQty || "—")
    if (colId === "skuName") return String(firstProd.skuName || "—")
    if (colId === "approvalQty") return String(firstProd.approvalQty || "—")
    if (colId === "qtyToDispatch") return String(row.qtyToDispatch || 0)
    if (colId === "deliveryFrom") return String(firstProd.deliveryFrom || "—")

    const directVal = row[colId]
    if (directVal !== undefined && directVal !== null && directVal !== "") return String(directVal)

    return "—"
  }

  const sortedDisplayRows = useMemo(() => {
    if (!pendingSortField || displayRows.length === 0) return displayRows
    return [...displayRows].sort((a, b) => {
      const aVal = getSortValue(a, pendingSortField).toLowerCase()
      const bVal = getSortValue(b, pendingSortField).toLowerCase()
      if (aVal < bVal) return pendingSortDir === "asc" ? -1 : 1
      if (aVal > bVal) return pendingSortDir === "asc" ? 1 : -1
      return 0
    })
  }, [displayRows, pendingSortField, pendingSortDir])



  const customerNames = Array.from(new Set((pendingOrders as any[]).map(order =>
    (order.transfer === 'yes' && order.bill_company_name)
      ? order.bill_company_name
      : (order.customer_name || order.customerName || "Unknown Customer")
  ))) as string[]

  const buildDispatchDisplayRow = (row: any) => ({
    orderNo: row.orderNo || row._displayDo || "—",
    processId: row.processId || "—",
    customerName: row.customerName || row.customer_name || "—",
    productName: row._allProducts?.[0]?.productName || "—",
    productCount: row._productCount || row._allProducts?.length || 0,
    transportType: row.transportType || "—",
    orderPunchRemarks: row.orderPunchRemarks || "—",
    revertDispatchRemarks: row.revertDispatchRemarks || "—",
    partySoDate: row.partySoDate || "—",
    depoName: row.depoName || "—",
    deliveryPurpose: row.deliveryPurpose || "—",
    deliveryDate: row.deliveryDate || "—",
    orderType: row.orderType || "—",
    customerType: row.customerType || "—",
    rate: row._allProducts?.[0]?.rate || "—",
    approvalQty: row._allProducts?.reduce((sum: number, p: any) => sum + (Number(p.approvalQty) || 0), 0) || 0,
    remainingQty: row._allProducts?.reduce((sum: number, p: any) => {
      const qty = p.remainingDispatchQty !== undefined ? p.remainingDispatchQty : p.approvalQty
      return sum + (Number(qty) || 0)
    }, 0) || 0,
  })

  return (
    <WorkflowStageShell
      partyNames={customerNames}
      title="Stage 4: Dispatch Planning"
      description="Prepare and Dispatch Plannings for delivery."
      pendingCount={displayRows.length}
      historyData={[]}
      onFilterChange={setFilterValues}
      showStatusFilter={true}
      stageLevel={3}
      onTabChange={setActiveTab}
      showDateFilters={true}
      showSaudaFilter={true}
      dateLabel="DO Date"
      historyContent={
        <StageHistoryTab
          queryKeyPrefix="dispatch-history"
          getHistoryApi={dispatchPlanningApi.getHistory}
          filterValues={filterValues}
          activeTab={activeTab}
          stageName="Dispatch Planning"
          stageLevel={3}
          remarksColName="Dispatch Remarks"
          orderListKey="dispatches"
          extraApiParams={{
            manual_sauda_no: filterValues.manualSaudaNo || undefined,
            depo_names: user?.depo_access ? (user.depo_access['Dispatch Planning'] || []) : undefined,
          }}
          getDate={(order: any) => order.actual_3 || order.timestamp || null}
        />
      }
    >
      <div className="flex flex-col justify-end gap-2 sm:flex-row">
        <Button
          onClick={handleOpenDialog}
          disabled={selectedItems.length === 0}
          className="w-full sm:w-auto"
        >
          {`Dispatch Selected (${selectedItems.length})`}
        </Button>

        {(isAdmin || isFeatureEnabled('can_toggle_columns')) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-full bg-transparent sm:w-auto">
                <Settings2 className="mr-2 h-4 w-4" />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[250px]" collisionPadding={16}>
              <ColumnToggleContent columns={PAGE_COLUMNS} visibleColumns={visibleColumns} setVisibleColumns={setVisibleColumns} />
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {activeDepots.length > 0 && (
        <div className="mt-4 mb-2">
          <Tabs value={selectedDepoTab} onValueChange={setSelectedDepoTab} className="w-full overflow-hidden">
            <TabsList className="w-full bg-slate-100/50 p-1 h-auto flex overflow-x-auto justify-start gap-1 border border-slate-200/60 rounded-xl shadow-sm">
              {activeDepots.map((depo) => (
                <TabsTrigger
                  key={depo.depot_id}
                  value={depo.depot_name}
                  className="shrink-0 px-4 sm:px-6 py-2.5 text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm rounded-lg transition-all"
                >
                  {depo.depot_name}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      )}

      <Card className="border-none shadow-sm overflow-hidden md:max-h-[600px] md:overflow-auto">
        <Table className="hidden md:table">
          <TableHeader className="sticky top-0 z-10 bg-card shadow-sm">
            <TableRow>
              <TableHead className="w-12 text-center">
                <Checkbox
                  checked={displayRows.length > 0 && selectedItems.length === displayRows.length}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Select all"
                />
              </TableHead>
              <ColumnDragProvider columnIds={orderedVisibleCols.map(c => c.id)} onReorder={handleColumnReorder} disabled={!isAdmin && !isFeatureEnabled('can_reorder_columns')}>
                {orderedVisibleCols.map((col) => (
                  <SortableTableHead key={col.id} id={col.id} className="whitespace-nowrap text-center cursor-pointer select-none hover:text-blue-600 transition-colors" onClick={() => handlePendingSort(col.id)}>
                    {col.label}<PendingSortIcon field={col.id} />
                  </SortableTableHead>
                ))}
              </ColumnDragProvider>

            </TableRow>
          </TableHeader>
          <TableBody>
            {isPendingLoading && pendingOrders.length === 0 ? (
              [...Array(5)].map((_, i) => (
                <TableRow key={i} className="opacity-40 border-b border-slate-50">
                  <TableCell className="text-center py-4"><div className="h-4 w-4 bg-slate-200 animate-pulse rounded mx-auto" /></TableCell>
                  {orderedVisibleCols.map(col => (
                    <TableCell key={col.id} className="py-4">
                      <div className={cn(
                        "h-3 bg-slate-200 animate-pulse rounded-full mx-auto",
                        col.id === 'customerName' ? "w-32" : col.id === 'orderNo' ? "w-24" : "w-16"
                      )} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : displayRows.length > 0 ? (
              sortedDisplayRows.map((row: any) => {
                const isSelected = selectedItems.some(i => i._rowKey === row._rowKey);

                return (
                  <TableRow key={row._rowKey} className={isSelected ? "bg-blue-50/50" : ""}>
                    <TableCell className="text-center">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelectItem(row)}
                      />
                    </TableCell>

                    {orderedVisibleCols.map((col) => (
                      <TableCell key={col.id} className="whitespace-nowrap text-center text-xs">
                        {col.id === "status" ? (
                          <div className="flex justify-center flex-col items-center gap-1">
                            <Badge className="bg-orange-100 text-orange-700">Pending</Badge>
                            {row._productCount > 1 && (
                              <span className="text-[10px] text-slate-500 font-medium">({row._productCount} Items)</span>
                            )}
                          </div>
                        ) : col.id === "productName" ? (
                          <div className="flex flex-col items-center">
                            <span className="font-medium text-slate-700">{row._allProducts[0]?.productName}</span>
                            {row._productCount > 1 && (
                              <span className="text-[10px] text-slate-500">+ {row._productCount - 1} more types</span>
                            )}
                          </div>
                        ) : (
                          row[col.id as keyof typeof row] || "—"
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                )
              })
            ) : (
              <TableRow>
                <TableCell colSpan={visibleColumns.length + 1} className="text-center py-8 text-muted-foreground">
                  No orders pending for dispatch
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <div className="space-y-3 p-3 md:hidden">
          {isPendingLoading && pendingOrders.length === 0 ? (
            [...Array(5)].map((_, i) => (
              <div key={i} className="rounded-lg border p-4 space-y-3 opacity-60">
                <div className="h-4 w-32 bg-slate-200 animate-pulse rounded" />
                <div className="grid grid-cols-2 gap-3">
                  {[...Array(6)].map((__, j) => <div key={j} className="h-10 bg-slate-100 animate-pulse rounded" />)}
                </div>
              </div>
            ))
          ) : displayRows.length > 0 ? (
            displayRows.map((row: any) => {
              const display = buildDispatchDisplayRow(row)
              const isSelected = selectedItems.some(i => i._rowKey === row._rowKey)
              return (
                <div
                  key={row._rowKey}
                  className={cn("rounded-lg border bg-white p-4 shadow-sm", isSelected && "border-blue-200 bg-blue-50")}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-sm font-black text-blue-700 break-all">{display.orderNo}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">{display.partySoDate}</p>
                    </div>
                    <Checkbox checked={isSelected} onCheckedChange={() => toggleSelectItem(row)} />
                  </div>

                  <div className="mt-3">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Customer Name</p>
                    <p className="text-sm font-bold text-slate-900 break-words">{display.customerName}</p>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                    {/* <div className="rounded-md bg-slate-50 p-2">
                      <p className="text-[10px] font-black uppercase text-slate-400">Manual Sauda No.</p>
                      <p className="mt-1 font-bold break-words">{display.processId}</p>
                    </div> */}
                    <div className="rounded-md bg-slate-50 p-2">
                      <p className="text-[10px] font-black uppercase text-slate-400">Products</p>
                      <p className="mt-1 font-bold">{display.productCount} items</p>
                    </div>
                    <div className="rounded-md bg-slate-50 p-2">
                      <p className="text-[10px] font-black uppercase text-slate-400">Product</p>
                      <p className="mt-1 font-semibold break-words">{display.productName}</p>
                    </div>
                    <div className="rounded-md bg-slate-50 p-2">
                      <p className="text-[10px] font-black uppercase text-slate-400">Transport</p>
                      <p className="mt-1 font-semibold break-words">{display.transportType}</p>
                    </div>
                    <div className="rounded-md bg-slate-50 p-2">
                      <p className="text-[10px] font-black uppercase text-slate-400">Approval Qty</p>
                      <p className="mt-1 font-mono font-bold">{display.approvalQty}</p>
                    </div>
                    <div className="rounded-md bg-slate-50 p-2">
                      <p className="text-[10px] font-black uppercase text-slate-400">Remaining</p>
                      <p className="mt-1 font-mono font-bold">{display.remainingQty}</p>
                    </div>
                  </div>

                  {display.orderPunchRemarks !== "—" && (
                    <div className="mt-3 rounded-md bg-amber-50 p-3 text-xs">
                      <span className="font-black text-amber-800">Order Remarks:</span> {display.orderPunchRemarks}
                    </div>
                  )}
                  {display.revertDispatchRemarks !== "—" && (
                    <div className="mt-3 rounded-md bg-red-50 p-3 text-xs">
                      <span className="font-black text-red-800">Revert Remarks:</span> {display.revertDispatchRemarks}
                    </div>
                  )}
                  <Badge className="mt-3 bg-orange-100 text-orange-700 hover:bg-orange-100">Pending</Badge>
                </div>
              )
            })
          ) : (
            <div className="py-10 text-center text-muted-foreground">
              No orders pending for dispatch
            </div>
          )}
        </div>

        <div className="px-3 sm:px-6 py-4 border-t bg-slate-50/50 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            Showing Page <span className="text-slate-900 mx-1">{pendingPage}</span>
            {pendingData?.pagination?.totalPages && (
              <> of <span className="text-slate-900 mx-1">{pendingData.pagination.totalPages}</span></>
            )}
            <span className="ml-2 text-slate-300">|</span>
            <span className="ml-2">{pendingData?.pagination?.total || 0} item{(pendingData?.pagination?.total || 0) !== 1 ? 's' : ''} in this depot</span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPendingPage(p => Math.max(1, p - 1))}
              disabled={pendingPage === 1 || isPendingLoading}
              className="h-8 rounded-lg gap-1 px-3 font-bold shadow-sm"
            >
              <ChevronLeft className="h-4 w-4" /> Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPendingPage(p => p + 1)}
              disabled={isPendingLoading || pendingPage >= (pendingData?.pagination?.totalPages || 1)}
              className="h-8 rounded-lg gap-1 px-3 font-bold shadow-sm"
            >
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>


      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="w-[calc(100vw-0.75rem)] max-w-[calc(100vw-0.75rem)] sm:max-w-4xl lg:max-w-6xl max-h-[95vh] overflow-x-hidden overflow-y-auto p-3 sm:p-6 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] [overflow-wrap:anywhere]">
          <DialogHeader className="border-b pb-4 min-w-0 pr-8">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <DialogTitle className="text-lg sm:text-xl font-bold text-slate-900 leading-tight break-words flex flex-wrap items-start gap-3">
                Dispatch Planning
              </DialogTitle>
              <Button
                variant="outline"
                onClick={() => setIsSlipDialogOpen(true)}
                disabled={dialogSelectedProducts.length === 0}
                className="border-blue-600 text-blue-600 hover:bg-blue-50 font-black h-9 shrink-0"
              >
                <FileText className="h-4 w-4 mr-2" />
                Slip
              </Button>
            </div>
            <DialogDescription className="text-slate-500 mt-1.5">
              Review order details and set dispatch quantities for products.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 sm:space-y-8 mt-4 min-w-0">
            <div className="space-y-6 sm:space-y-12 mt-4 sm:mt-6 min-w-0">
              {selectedItems.map((group: any, groupIdx: number) => {
                const custName = group.customerName || group.customer_name || "Unknown";
                const allProducts = group._allProducts || [];

                return (
                  <div key={group._rowKey} className="space-y-4 sm:space-y-6 min-w-0">
                    <h2 className="text-base sm:text-xl font-black text-blue-900 border-b-4 border-blue-100 pb-2 mt-4 uppercase tracking-tight flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <span className="break-words">{custName}</span>
                      <Badge className="w-fit bg-blue-600 text-white px-3 py-1 font-black sm:ml-3">
                        {group._productCount} PRODUCTS
                      </Badge>
                    </h2>

                    {/* Order Details Sections */}
                    {Object.entries(group._ordersMap || {}).map(([baseDo, orderDetails]: [string, any], orderIdx) => {
                      const isExpanded = expandedOrders.includes(baseDo);
                      const toggleExpand = () => {
                        setExpandedOrders(prev => isExpanded ? prev.filter(id => id !== baseDo) : [...prev, baseDo]);
                      };

                      return (
                        <div key={baseDo} className="space-y-4 border-2 border-slate-100 rounded-xl sm:rounded-3xl overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow min-w-0">
                          <div className="bg-blue-600 px-3 sm:px-5 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between cursor-pointer" onClick={toggleExpand}>
                            <div className="min-w-0 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                              <Badge className="max-w-full bg-white text-blue-800 hover:bg-white px-3 sm:px-4 py-1.5 text-xs sm:text-base font-black tracking-tight rounded-full shadow-sm whitespace-normal break-all">
                                ORDER: {baseDo}
                              </Badge>
                              <div className="flex flex-col">
                                <span className="text-[10px] text-blue-100 font-black uppercase tracking-widest leading-none mb-1">Section {orderIdx + 1}</span>
                                <span className="text-xs text-blue-100 font-bold leading-none">{orderDetails._products?.length || 0} Items Selected</span>
                              </div>
                            </div>
                            <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-start">
                              <div className="text-[10px] sm:text-[11px] text-blue-50 font-bold uppercase tracking-widest sm:mr-2">Click to {isExpanded ? 'Hide' : 'Show'} Details</div>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/20 rounded-full">
                                {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                              </Button>
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="px-3 sm:px-5 pb-5 animate-in slide-in-from-top-2 duration-200">
                              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-inner">
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
                                  <div>
                                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">Depo Name</p>
                                    <p className="text-sm font-bold text-slate-900 leading-tight">{orderDetails.depoName || "—"}</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">Delivery Purpose</p>
                                    <p className="text-sm font-bold text-slate-900 leading-tight">{orderDetails.deliveryPurpose}</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">Order Type</p>
                                    <p className="text-sm font-bold text-slate-900 leading-tight">{orderDetails.orderType}</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">Dates</p>
                                    <p className="text-xs font-bold text-slate-900">S: {formatDate(orderDetails.startDate)} | E: {formatDate(orderDetails.endDate)}</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">Delivery Date</p>
                                    <p className="text-sm font-bold text-slate-900 leading-tight">{formatDate(orderDetails.deliveryDate)}</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">Transport</p>
                                    <p className="text-sm font-bold text-slate-900 leading-tight">{orderDetails.transportType}</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">Contact Person</p>
                                    <p className="text-sm font-bold text-slate-900 break-words">{orderDetails.custContactName || "—"}</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">WhatsApp No.</p>
                                    <p className="text-sm font-bold text-slate-900 leading-tight">{orderDetails.whatsapp || "—"}</p>
                                  </div>
                                  <div className="sm:col-span-2">
                                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">Address</p>
                                    <p className="text-sm font-bold text-slate-900 break-words" title={orderDetails.address}>{orderDetails.address}</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">Payment Terms</p>
                                    <p className="text-sm font-bold text-slate-900 leading-tight">{orderDetails.paymentTerms}</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">Advance Amount</p>
                                    <p className="text-base font-black text-blue-700 leading-tight">
                                      ₹{orderDetails.advanceAmount || 0} {orderDetails.advanceTaken ? "(REQ)" : "(NO)"}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">Broker</p>
                                    <p className="text-sm font-bold text-slate-900 leading-tight">{orderDetails.isBroker ? orderDetails.brokerName : "No"}</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">Credit Status</p>
                                    <Badge className={cn("text-[10px] font-bold px-2 py-0.5", orderDetails.creditStatus === 'Good' ? 'bg-green-100 text-green-700 hover:bg-green-100' : 'bg-red-100 text-red-700 hover:bg-red-100')}>
                                      {orderDetails.creditStatus}
                                    </Badge>
                                  </div>
                                  <div className="sm:col-span-2 bg-amber-50 p-4 rounded-xl border border-amber-100 flex items-start gap-4">
                                    <div className="bg-amber-100 p-2 rounded-lg">
                                      <Settings2 className="h-5 w-5 text-amber-600" />
                                    </div>
                                    <div>
                                      <p className="text-[11px] text-amber-800 font-black uppercase tracking-widest mb-1 leading-none">Order Punch Remarks</p>
                                      <p className="text-sm font-medium text-slate-700 italic leading-snug break-words">"{group.orderPunchRemarks || "No special instructions provided."}"</p>
                                    </div>
                                  </div>
                                  <div className={cn(
                                    "sm:col-span-2 p-4 rounded-xl border flex items-start gap-4 transition-all duration-300",
                                    group.uploadSo
                                      ? "bg-blue-50 border-blue-100 hover:bg-blue-100 cursor-pointer group"
                                      : "bg-slate-50 border-slate-100 opacity-60"
                                  )}
                                    onClick={() => {
                                      if (group.uploadSo) {
                                        window.open(group.uploadSo, '_blank');
                                      }
                                    }}>
                                    <div className={cn(
                                      "p-2 rounded-lg",
                                      group.uploadSo ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-400"
                                    )}>
                                      <FileText className="h-5 w-5" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className={cn(
                                        "text-[11px] font-black uppercase tracking-widest mb-1 leading-none",
                                        group.uploadSo ? "text-blue-800" : "text-slate-500"
                                      )}>PO Copy (SO Upload)</p>
                                      {group.uploadSo ? (
                                        <div className="flex items-center gap-1">
                                          <p className="text-sm font-bold text-blue-700 truncate">View Attachment</p>
                                          <ExternalLink className="h-3 w-3 text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </div>
                                      ) : (
                                        <p className="text-sm font-medium text-slate-400 italic">No attachment</p>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    <div className="space-y-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b pb-2">
                        <h3 className="text-base sm:text-lg font-bold text-slate-800 flex items-center gap-2 break-words">
                          Consolidated Product List - {custName}
                        </h3>
                      </div>
                      <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-white min-w-0">
                        <Table className="hidden md:table">
                          <TableHeader className="bg-slate-50">
                            <TableRow>
                              <TableHead className="w-12 text-center text-[10px] uppercase font-black text-slate-500 tracking-wider">
                                <Checkbox
                                  checked={allProducts.length > 0 && allProducts.every((p: any) => dialogSelectedProducts.includes(p._rowKey))}
                                  onCheckedChange={(checked) => {
                                    const keys = allProducts.map((p: any) => p._rowKey);
                                    if (checked) setDialogSelectedProducts(prev => Array.from(new Set([...prev, ...keys])));
                                    else setDialogSelectedProducts(prev => prev.filter(k => !keys.includes(k)));
                                  }}
                                />
                              </TableHead>
                              <TableHead className="text-[10px] uppercase font-black text-slate-500 tracking-wider">Sub-Order</TableHead>
                              <TableHead className="text-[10px] uppercase font-black text-slate-500 tracking-wider">Product Name</TableHead>
                              <TableHead className="text-[10px] uppercase font-black text-slate-500 tracking-wider text-center">Rate</TableHead>
                              <TableHead className="text-[10px] uppercase font-black text-slate-500 tracking-wider text-center">Approval</TableHead>
                              <TableHead className="w-32 text-[10px] uppercase font-black text-slate-500 tracking-wider">Qty to Dispatch</TableHead>
                              <TableHead className="w-40 text-[10px] uppercase font-black text-slate-500 tracking-wider">Delivery From</TableHead>
                              <TableHead className="w-24 text-[10px] uppercase font-black text-slate-500 tracking-wider">Transfer</TableHead>
                              <TableHead className="text-[10px] uppercase font-black text-slate-500 tracking-wider text-center">Remaining</TableHead>
                              <TableHead className="text-[10px] uppercase font-black text-slate-500 tracking-wider text-center">Status</TableHead>
                              <TableHead className="text-[10px] uppercase font-black text-slate-500 tracking-wider text-center">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {allProducts.map((prod: any) => {
                              const rowKey = prod._rowKey;
                              const maxLimit = prod.remainingDispatchQty !== undefined ? prod.remainingDispatchQty : prod.approvalQty;
                              const currentDispatchQty = dispatchDetails[rowKey]?.qty !== undefined ? dispatchDetails[rowKey].qty : maxLimit;

                              return (
                                <TableRow key={rowKey} className={cn(dialogSelectedProducts.includes(rowKey) ? "bg-blue-50/30" : "")}>
                                  <TableCell className="text-center p-3">
                                    <Checkbox checked={dialogSelectedProducts.includes(rowKey)} onCheckedChange={() => toggleSelectDialogProduct(rowKey)} />
                                  </TableCell>
                                  <TableCell className="text-[10px] font-semibold text-slate-700 p-1">{prod.orderNo || "—"}</TableCell>
                                  <TableCell className="font-medium text-[11px] p-2">{prod.productName || "—"}</TableCell>
                                  <TableCell className="text-[10px] font-bold text-slate-600 p-2 text-center">₹{prod.rate || "—"}</TableCell>
                                  <TableCell className="text-[10px] font-bold text-blue-600 p-2 text-center">{prod.approvalQty || "—"}</TableCell>
                                  <TableCell className="p-2">
                                    <Input type="number" className="h-7 text-[10px] font-bold" value={currentDispatchQty} onChange={(e) => {
                                      let val = Number(e.target.value);
                                      const maxVal = Number(maxLimit);
                                      if (val > maxVal) val = maxVal;
                                      setDispatchDetails((prev) => ({ ...prev, [rowKey]: { ...prev[rowKey], qty: val.toString() } }));
                                    }} />
                                  </TableCell>
                                  <TableCell className="p-2">
                                    <Select value={dispatchDetails[rowKey]?.deliveryFrom || "in-stock"} onValueChange={(val) => setDispatchDetails((prev) => ({ ...prev, [rowKey]: { ...prev[rowKey], deliveryFrom: val } }))}>
                                      <SelectTrigger className="h-7 text-[10px] font-bold"><SelectValue placeholder="Source" /></SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="in-stock" className="text-[10px]">In Stock</SelectItem>
                                        <SelectItem value="production" className="text-[10px]">Production</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </TableCell>
                                  <TableCell className="p-2">
                                    <div className="flex items-center gap-1 justify-center">
                                      <Select
                                        value={dispatchDetails[rowKey]?.transfer || prod.transfer || "no"}
                                        onValueChange={(val) => {
                                          setDispatchDetails((prev) => {
                                            const existing = prev[rowKey] || {};
                                            // Initialize transferData from prod if not already present in state
                                            const transferData = existing.transferData || {
                                              billTo: {
                                                company: prod.bill_company_name || "",
                                                address: prod.bill_address || ""
                                              },
                                              shipTo: {
                                                company: prod.ship_company_name || "",
                                                address: prod.ship_address || ""
                                              },
                                              freightRate: prod.freight_rate?.toString() || ""
                                            };
                                            return {
                                              ...prev,
                                              [rowKey]: { ...existing, transfer: val, transferData }
                                            };
                                          });
                                          if (val === "yes") {
                                            setCurrentTransferRowKey(rowKey);
                                            setIsTransferPopupOpen(true);
                                          }
                                        }}
                                      >
                                        <SelectTrigger className="h-7 text-[10px] font-bold w-20"><SelectValue placeholder="Transfer" /></SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="yes" className="text-[10px]">Yes</SelectItem>
                                          <SelectItem value="no" className="text-[10px]">No</SelectItem>
                                        </SelectContent>
                                      </Select>
                                      {(dispatchDetails[rowKey]?.transfer === "yes" || (!dispatchDetails[rowKey]?.transfer && prod.transfer === "yes")) && (
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-6 w-6 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                          onClick={() => {
                                            setCurrentTransferRowKey(rowKey);
                                            setIsTransferPopupOpen(true);
                                          }}
                                          title="View Transfer Details"
                                        >
                                          <Settings2 className="h-3.5 w-3.5" />
                                        </Button>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-[10px] font-bold text-slate-500 p-2 text-center">{maxLimit}</TableCell>
                                  <TableCell className="p-2 text-center text-[10px] font-bold text-slate-500">
                                    {custName.toLowerCase().includes("reliance") ? (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-7 text-[10px] font-bold text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 hover:border-red-300"
                                        onClick={() => {
                                          setPrecloseDialogProduct({ ...prod, maxLimit });
                                          setPrecloseInputs(prev => ({ ...prev, [prod.id]: maxLimit.toString() }));
                                          setPrecloseAction("close");
                                          setPrecloseRemarks("");
                                          setPrecloseDialogOpen(true);
                                        }}
                                      >
                                        <XCircle className="h-3.5 w-3.5 mr-1" />
                                        Preclose
                                      </Button>
                                    ) : "—"}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                          <tfoot className="bg-slate-100/80 border-t-2 border-slate-200">
                            <TableRow>
                              <TableCell colSpan={3} className="p-3 text-right">
                                <span className="text-[10px] uppercase font-black text-slate-500 tracking-wider">Totals:</span>
                              </TableCell>

                              <TableCell className="p-3 text-center">
                                <Badge variant="secondary" className="bg-blue-100 text-blue-800 font-black px-2 shadow-sm border-blue-200">
                                  {allProducts.reduce((sum: number, p: any) => sum + (parseFloat(p.approvalQty) || 0), 0)}
                                </Badge>
                              </TableCell>
                              <TableCell className="p-3">
                                <Badge variant="secondary" className="bg-green-100 text-green-800 font-black px-2 shadow-sm border-green-200 w-full justify-center">
                                  {allProducts.reduce((sum: number, p: any) => {
                                    const rowKey = p._rowKey;
                                    const maxLimit = p.remainingDispatchQty !== undefined ? p.remainingDispatchQty : p.approvalQty;
                                    const currentDispatchQty = dispatchDetails[rowKey]?.qty !== undefined ? dispatchDetails[rowKey].qty : maxLimit;
                                    return sum + (parseFloat(currentDispatchQty) || 0);
                                  }, 0)}
                                </Badge>
                              </TableCell>
                              <TableCell />
                              <TableCell />
                              <TableCell className="p-3 text-center">
                                <Badge variant="secondary" className="bg-slate-200 text-slate-700 font-black px-2 shadow-sm border-slate-300">
                                  {allProducts.reduce((sum: number, p: any) => {
                                    const maxLimit = p.remainingDispatchQty !== undefined ? p.remainingDispatchQty : p.approvalQty;
                                    return sum + (parseFloat(maxLimit) || 0);
                                  }, 0)}
                                </Badge>
                              </TableCell>
                              <TableCell />
                            </TableRow>
                          </tfoot>
                        </Table>
                        <div className="space-y-3 p-3 md:hidden">
                          <div className="flex items-center justify-between rounded-lg bg-slate-50 p-3">
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Products</p>
                              <p className="text-xs font-bold text-slate-700">{allProducts.length} items</p>
                            </div>
                            <Checkbox
                              checked={allProducts.length > 0 && allProducts.every((p: any) => dialogSelectedProducts.includes(p._rowKey))}
                              onCheckedChange={(checked) => {
                                const keys = allProducts.map((p: any) => p._rowKey);
                                if (checked) setDialogSelectedProducts(prev => Array.from(new Set([...prev, ...keys])));
                                else setDialogSelectedProducts(prev => prev.filter(k => !keys.includes(k)));
                              }}
                            />
                          </div>
                          {allProducts.map((prod: any) => {
                            const rowKey = prod._rowKey;
                            const maxLimit = prod.remainingDispatchQty !== undefined ? prod.remainingDispatchQty : prod.approvalQty;
                            const currentDispatchQty = dispatchDetails[rowKey]?.qty !== undefined ? dispatchDetails[rowKey].qty : maxLimit;
                            const selected = dialogSelectedProducts.includes(rowKey);

                            return (
                              <div key={rowKey} className={cn("rounded-xl border bg-white p-3 space-y-3", selected && "border-blue-200 bg-blue-50/40")}>
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Product</p>
                                    <p className="text-sm font-black text-slate-900 break-words">{prod.productName || "—"}</p>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight break-all">{prod.orderNo || "—"}</p>
                                  </div>
                                  <Checkbox checked={selected} onCheckedChange={() => toggleSelectDialogProduct(rowKey)} />
                                </div>

                                <div className="grid grid-cols-2 gap-3 text-xs">
                                  <div className="rounded-md bg-slate-50 p-2">
                                    <p className="text-[10px] font-black uppercase text-slate-400">Rate</p>
                                    <p className="mt-1 font-mono font-bold text-slate-700">₹{prod.rate || "—"}</p>
                                  </div>
                                  <div className="rounded-md bg-slate-50 p-2">
                                    <p className="text-[10px] font-black uppercase text-slate-400">Approval</p>
                                    <p className="mt-1 font-mono font-bold text-blue-600">{prod.approvalQty || "—"}</p>
                                  </div>
                                  <div className="rounded-md bg-slate-50 p-2">
                                    <p className="text-[10px] font-black uppercase text-slate-400">Remaining</p>
                                    <p className="mt-1 font-mono font-bold text-slate-700">{maxLimit}</p>
                                  </div>
                                  {custName.toLowerCase().includes("reliance") && (
                                    <div className="rounded-md bg-slate-50 p-2">
                                      <p className="text-[10px] font-black uppercase text-slate-400">Preclose</p>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="mt-1 h-7 text-[10px] font-bold text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 hover:border-red-300"
                                        onClick={() => {
                                          setPrecloseDialogProduct({ ...prod, maxLimit });
                                          setPrecloseInputs(prev => ({ ...prev, [prod.id]: maxLimit.toString() }));
                                          setPrecloseAction("close");
                                          setPrecloseRemarks("");
                                          setPrecloseDialogOpen(true);
                                        }}
                                      >
                                        <XCircle className="h-3.5 w-3.5 mr-1" />
                                        Preclose
                                      </Button>
                                    </div>
                                  )}
                                </div>

                                <div className="grid grid-cols-1 gap-3">
                                  <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase text-slate-400">Qty to Dispatch</Label>
                                    <Input type="number" className="h-9 text-xs font-bold" value={currentDispatchQty} onChange={(e) => {
                                      let val = Number(e.target.value);
                                      const maxVal = Number(maxLimit);
                                      if (val > maxVal) val = maxVal;
                                      setDispatchDetails((prev) => ({ ...prev, [rowKey]: { ...prev[rowKey], qty: val.toString() } }));
                                    }} />
                                  </div>
                                  <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase text-slate-400">Delivery From</Label>
                                    <Select value={dispatchDetails[rowKey]?.deliveryFrom || "in-stock"} onValueChange={(val) => setDispatchDetails((prev) => ({ ...prev, [rowKey]: { ...prev[rowKey], deliveryFrom: val } }))}>
                                      <SelectTrigger className="h-9 text-xs font-bold"><SelectValue placeholder="Source" /></SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="in-stock" className="text-xs">In Stock</SelectItem>
                                        <SelectItem value="production" className="text-xs">Production</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase text-slate-400">Transfer</Label>
                                    <div className="flex items-center gap-2">
                                      <Select
                                        value={dispatchDetails[rowKey]?.transfer || prod.transfer || "no"}
                                        onValueChange={(val) => {
                                          setDispatchDetails((prev) => {
                                            const existing = prev[rowKey] || {};
                                            const transferData = existing.transferData || {
                                              billTo: { company: prod.bill_company_name || "", address: prod.bill_address || "" },
                                              shipTo: { company: prod.ship_company_name || "", address: prod.ship_address || "" },
                                              freightRate: prod.freight_rate?.toString() || ""
                                            };
                                            return { ...prev, [rowKey]: { ...existing, transfer: val, transferData } };
                                          });
                                          if (val === "yes") {
                                            setCurrentTransferRowKey(rowKey);
                                            setIsTransferPopupOpen(true);
                                          }
                                        }}
                                      >
                                        <SelectTrigger className="h-9 text-xs font-bold"><SelectValue placeholder="Transfer" /></SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="yes" className="text-xs">Yes</SelectItem>
                                          <SelectItem value="no" className="text-xs">No</SelectItem>
                                        </SelectContent>
                                      </Select>
                                      {(dispatchDetails[rowKey]?.transfer === "yes" || (!dispatchDetails[rowKey]?.transfer && prod.transfer === "yes")) && (
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="h-9 text-blue-600"
                                          onClick={() => {
                                            setCurrentTransferRowKey(rowKey);
                                            setIsTransferPopupOpen(true);
                                          }}
                                        >
                                          <Settings2 className="h-4 w-4" />
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}

                          <div className="grid grid-cols-3 gap-2 rounded-lg border bg-slate-50 p-3 text-xs">
                            <div>
                              <p className="text-[9px] uppercase font-black text-slate-500">Approval</p>
                              <p className="mt-1 font-black text-blue-700">{allProducts.reduce((sum: number, p: any) => sum + (parseFloat(p.approvalQty) || 0), 0)}</p>
                            </div>
                            <div>
                              <p className="text-[9px] uppercase font-black text-slate-500">Dispatch</p>
                              <p className="mt-1 font-black text-green-700">{allProducts.reduce((sum: number, p: any) => {
                                const rowKey = p._rowKey;
                                const maxLimit = p.remainingDispatchQty !== undefined ? p.remainingDispatchQty : p.approvalQty;
                                const currentDispatchQty = dispatchDetails[rowKey]?.qty !== undefined ? dispatchDetails[rowKey].qty : maxLimit;
                                return sum + (parseFloat(currentDispatchQty) || 0);
                              }, 0)}</p>
                            </div>
                            <div>
                              <p className="text-[9px] uppercase font-black text-slate-500">Remaining</p>
                              <p className="mt-1 font-black text-slate-700">{allProducts.reduce((sum: number, p: any) => {
                                const maxLimit = p.remainingDispatchQty !== undefined ? p.remainingDispatchQty : p.approvalQty;
                                return sum + (parseFloat(maxLimit) || 0);
                              }, 0)}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <DialogFooter className="mt-4 border-t pt-4 px-1 sm:px-8 pb-4 sm:pb-8 flex flex-col gap-4 sm:flex-col w-full">
            <div className="flex flex-col sm:flex-row sm:items-end gap-3 w-full">
              <div className="flex-1 space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-red-500 tracking-tighter ml-1">Remarks <span className="text-red-500">*</span></Label>
                <Input
                  className="h-10 border-2 border-red-200 rounded-lg font-medium bg-white focus:border-red-400 transition-colors"
                  placeholder="Enter reason for reverting or cancelling..."
                  value={revertRemarks}
                  onChange={(e) => setRevertRemarks(e.target.value)}
                />
              </div>
              {role === 'super_admin' && (
                <Button
                  variant="outline"
                  onClick={handleCancel}
                  disabled={isProcessing || dialogSelectedProducts.length === 0 || isReadOnly || !revertRemarks.trim()}
                  className="w-full sm:w-auto font-black uppercase tracking-tight whitespace-normal sm:whitespace-nowrap border-2 border-red-600 text-red-600 hover:bg-red-50"
                >
                  {isProcessing ? "Processing..." : `Cancel Order (${dialogSelectedProducts.length})`}
                </Button>
              )}
              <Button
                variant="destructive"
                onClick={handleRevert}
                disabled={isProcessing || dialogSelectedProducts.length === 0 || isReadOnly || !revertRemarks.trim()}
                className="w-full sm:w-auto font-black uppercase tracking-tight whitespace-normal sm:whitespace-nowrap"
              >
                {isProcessing ? "Processing..." : `Revert to Pre-Approval (${dialogSelectedProducts.length})`}
              </Button>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:flex sm:justify-end">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="w-full sm:w-auto">Cancel</Button>
              <Button onClick={handleBulkDispatch} disabled={isProcessing || dialogSelectedProducts.length === 0 || isReadOnly} className="w-full sm:w-auto">
                {isProcessing ? "Processing..." : `Dispatch ${dialogSelectedProducts.length} Item(s)`}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer Details Popup */}
      <Dialog open={isTransferPopupOpen} onOpenChange={(open) => {
        if (!open) {
          if (!isSavingTransferRef.current && currentTransferRowKey) {
            setDispatchDetails(prev => ({
              ...prev,
              [currentTransferRowKey]: { ...prev[currentTransferRowKey], transfer: "no" }
            }));
          }
          setIsTransferPopupOpen(false);
          isSavingTransferRef.current = false;
        }
      }}>
        <DialogContent className="w-[calc(100vw-0.75rem)] max-w-[calc(100vw-0.75rem)] sm:max-w-4xl max-h-[90vh] overflow-x-hidden overflow-y-auto p-3 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Transfer Details</DialogTitle>
            <DialogDescription>
              Provide Bill-to and Ship-to details for the material transfer.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-8 py-4">
            {/* Bill To Column */}
            <div className="space-y-4">
              <h3 className="font-bold text-blue-800 border-b pb-1 uppercase text-sm">Bill To</h3>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Company Name <span className="text-red-500">*</span></Label>
                  <AsyncCombobox
                    placeholder="Select Company"
                    searchPlaceholder="Search customers..."
                    value={
                      currentTransferRowKey
                        ? (dispatchDetails[currentTransferRowKey]?.transferData?.billTo?.company ??
                          allProductsFromSelectedGroups.find(p => p._rowKey === currentTransferRowKey)?.bill_company_name ?? "")
                        : ""
                    }
                    fetchOptions={async (search: string, page: number) => {
                      const res = await customerApi.getAll({ search, page, limit: 20 });
                      const customers = res.data.customers || [];
                      return {
                        options: customers.map((c: any) => ({ value: `${c.customer_name}|${c.gstin || ''}`, label: c.customer_name, dropdownLabel: `${c.customer_name}${c.gstin ? ' — ' + c.gstin : ''}`, original: c })),
                        hasMore: (customers.length + (page - 1) * 20) < (res.data.pagination?.total || 0)
                      };
                    }}
                    onValueChange={async (val) => {
                      if (!currentTransferRowKey) return;

                      // Match the exact customer by name + GST, then use that record's address
                      const [cleanName, gstinPart = ''] = val.split('|');
                      let autoAddress: string | null = null;
                      try {
                        const res = await customerApi.getAll({ search: cleanName, all: "true" });
                        const list = res.data?.customers || [];
                        const match =
                          list.find((c: any) => c.customer_name === cleanName && (c.gstin || '') === gstinPart) ||
                          list.find((c: any) => c.customer_name === cleanName) ||
                          list[0];
                        if (match) {
                          autoAddress = [
                            match.address_line_1,
                            match.address_line_2,
                            match.state,
                            match.pincode
                          ].filter(Boolean).join(", ");
                        }
                      } catch (error) {
                        console.error("[DISPATCH] Failed to fetch bill-to address:", error);
                      }

                      const prevData = dispatchDetails[currentTransferRowKey]?.transferData || {
                        billTo: { company: "", address: "" },
                        shipTo: { company: "", address: "" },
                        freightRate: ""
                      };
                      setDispatchDetails(prev => {
                        const rowKey = currentTransferRowKey!;
                        const rowDetail = prev[rowKey] || { qty: "0" };
                        return {
                          ...prev,
                          [rowKey]: {
                            ...rowDetail,
                            transferData: {
                              ...prevData,
                              billTo: { ...prevData.billTo, company: val, address: autoAddress !== null ? autoAddress : prevData.billTo.address }
                            }
                          }
                        };
                      });
                    }}
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Address</Label>
                  <Input
                    placeholder="Enter Address"
                    className="h-9 text-xs font-medium"
                    value={
                      currentTransferRowKey
                        ? (dispatchDetails[currentTransferRowKey]?.transferData?.billTo?.address ||
                          allProductsFromSelectedGroups.find(p => p._rowKey === currentTransferRowKey)?.bill_address || "")
                        : ""
                    }
                    onChange={(e) => {
                      if (!currentTransferRowKey) return;
                      const prevData = dispatchDetails[currentTransferRowKey]?.transferData || {
                        billTo: { company: "", address: "" },
                        shipTo: { company: "", address: "" },
                        freightRate: ""
                      };
                      setDispatchDetails(prev => {
                        const rowKey = currentTransferRowKey!;
                        const rowDetail = prev[rowKey] || { qty: "0" };
                        return {
                          ...prev,
                          [rowKey]: {
                            ...rowDetail,
                            transferData: { ...prevData, billTo: { ...prevData.billTo, address: e.target.value } }
                          }
                        };
                      });
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Ship To Column */}
            <div className="space-y-4">
              <h3 className="font-bold text-green-800 border-b pb-1 uppercase text-sm">Ship To</h3>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Company Name <span className="text-red-500">*</span></Label>
                  <AsyncCombobox
                    placeholder="Select Company"
                    searchPlaceholder="Search customers..."
                    value={
                      currentTransferRowKey
                        ? (dispatchDetails[currentTransferRowKey]?.transferData?.shipTo?.company ||
                          allProductsFromSelectedGroups.find(p => p._rowKey === currentTransferRowKey)?.ship_company_name || "")
                        : ""
                    }
                    fetchOptions={async (search: string, page: number) => {
                      const res = await customerApi.getAll({ search, page, limit: 20 });
                      const customers = res.data.customers || [];
                      return {
                        options: customers.map((c: any) => ({ value: `${c.customer_name}|${c.gstin || ''}`, label: c.customer_name, dropdownLabel: `${c.customer_name}${c.gstin ? ' — ' + c.gstin : ''}`, original: c })),
                        hasMore: (customers.length + (page - 1) * 20) < (res.data.pagination?.total || 0)
                      };
                    }}
                    onValueChange={async (val) => {
                      if (!currentTransferRowKey) return;

                      // Match the exact customer by name + GST, then use that record's address
                      const [cleanName, gstinPart = ''] = val.split('|');
                      let autoAddress: string | null = null;
                      try {
                        const res = await customerApi.getAll({ search: cleanName, all: "true" });
                        const list = res.data?.customers || [];
                        const match =
                          list.find((c: any) => c.customer_name === cleanName && (c.gstin || '') === gstinPart) ||
                          list.find((c: any) => c.customer_name === cleanName) ||
                          list[0];
                        if (match) {
                          autoAddress = [
                            match.address_line_1,
                            match.address_line_2,
                            match.state,
                            match.pincode
                          ].filter(Boolean).join(", ");
                        }
                      } catch (error) {
                        console.error("[DISPATCH] Failed to fetch ship-to address:", error);
                      }

                      const prevData = dispatchDetails[currentTransferRowKey]?.transferData || {
                        billTo: { company: "", address: "" },
                        shipTo: { company: "", address: "" },
                        freightRate: ""
                      };
                      setDispatchDetails(prev => {
                        const rowKey = currentTransferRowKey!;
                        const rowDetail = prev[rowKey] || { qty: "0" };
                        return {
                          ...prev,
                          [rowKey]: {
                            ...rowDetail,
                            transferData: {
                              ...prevData,
                              shipTo: { ...prevData.shipTo, company: val, address: autoAddress !== null ? autoAddress : prevData.shipTo.address }
                            }
                          }
                        };
                      });
                    }}
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Address</Label>
                  <Input
                    placeholder="Enter Address"
                    className="h-9 text-xs font-medium"
                    value={
                      currentTransferRowKey
                        ? (dispatchDetails[currentTransferRowKey]?.transferData?.shipTo?.address ||
                          allProductsFromSelectedGroups.find(p => p._rowKey === currentTransferRowKey)?.ship_address || "")
                        : ""
                    }
                    onChange={(e) => {
                      if (!currentTransferRowKey) return;
                      const prevData = dispatchDetails[currentTransferRowKey]?.transferData || {
                        billTo: { company: "", address: "" },
                        shipTo: { company: "", address: "" },
                        freightRate: ""
                      };
                      setDispatchDetails(prev => {
                        const rowKey = currentTransferRowKey!;
                        const rowDetail = prev[rowKey] || { qty: "0" };
                        return {
                          ...prev,
                          [rowKey]: {
                            ...rowDetail,
                            transferData: { ...prevData, shipTo: { ...prevData.shipTo, address: e.target.value } }
                          }
                        };
                      });
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="px-0 sm:px-8 pb-4">
            <div className="space-y-1.5 max-w-xs">
              <Label className="text-xs font-bold">Freight Rate <span className="text-red-500">*</span></Label>
              <Input
                type="number"
                min="0"
                placeholder="0.00"
                className="h-10 text-sm font-bold border-2 focus:border-blue-400"
                value={
                  currentTransferRowKey
                    ? (dispatchDetails[currentTransferRowKey]?.transferData?.freightRate ||
                      allProductsFromSelectedGroups.find(p => p._rowKey === currentTransferRowKey)?.freight_rate?.toString() || "")
                    : ""
                }
                onChange={(e) => {
                  if (!currentTransferRowKey) return;
                  let val = e.target.value;
                  if (Number(val) < 0) val = "0";
                  const prevData = dispatchDetails[currentTransferRowKey]?.transferData || {
                    billTo: { company: "", address: "" },
                    shipTo: { company: "", address: "" },
                    freightRate: ""
                  };
                  setDispatchDetails(prev => {
                    const rowKey = currentTransferRowKey!;
                    const rowDetail = prev[rowKey] || { qty: "0" };
                    return {
                      ...prev,
                      [rowKey]: {
                        ...rowDetail,
                        transferData: { ...prevData, freightRate: val }
                      }
                    };
                  });
                }}
              />
            </div>
          </div>

          <DialogFooter className="mt-6 border-t pt-4 gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => {
              if (currentTransferRowKey) {
                setDispatchDetails(prev => ({
                  ...prev,
                  [currentTransferRowKey]: { ...prev[currentTransferRowKey], transfer: "no" }
                }));
              }
              setIsTransferPopupOpen(false);
            }} className="w-full sm:w-auto">Cancel</Button>
            <Button
              onClick={() => {
                // Validation
                const data = currentTransferRowKey ? dispatchDetails[currentTransferRowKey]?.transferData : null;
                if (!data || !data.billTo.company || !data.shipTo.company || data.freightRate === "") {
                  toast({ title: "Validation Error", description: "Companies and Freight Rate (>=0) are mandatory.", variant: "destructive" });
                  return;
                }
                isSavingTransferRef.current = true;
                setIsTransferPopupOpen(false);
              }}
              className="w-full bg-blue-600 hover:bg-blue-700 sm:w-auto"
            >
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Preclose Dialog */}
      <Dialog open={precloseDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setPrecloseDialogOpen(false);
          setPrecloseDialogProduct(null);
          setPrecloseRemarks("");
          setPrecloseAction("close");
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-black uppercase tracking-wider text-slate-700">Pre-Close Order</DialogTitle>
            <DialogDescription className="text-[11px] text-slate-500">
              {precloseDialogProduct?.productName || ""} &mdash; Remaining: {precloseDialogProduct?.maxLimit}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label className="text-[10px] uppercase font-black text-slate-500">Qty to Preclose</Label>
              <Input
                type="number"
                placeholder="Enter quantity"
                value={precloseDialogProduct ? (precloseInputs[precloseDialogProduct.id] !== undefined ? precloseInputs[precloseDialogProduct.id] : String(precloseDialogProduct.maxLimit)) : ""}
                onChange={(e) => {
                  if (!precloseDialogProduct) return;
                  setPrecloseInputs(prev => ({ ...prev, [precloseDialogProduct.id]: e.target.value }));
                }}
                className="h-9 text-sm font-bold text-center"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] uppercase font-black text-slate-500">Action</Label>
              <RadioGroup
                value={precloseAction}
                onValueChange={(val) => setPrecloseAction(val as "commitment" | "close")}
                className="space-y-2"
              >
                <div className="flex items-center space-x-2 rounded-lg border p-3 cursor-pointer hover:bg-slate-50">
                  <RadioGroupItem value="commitment" id="action-commitment" />
                  <Label htmlFor="action-commitment" className="text-xs font-bold text-slate-700 cursor-pointer">
                    Transfer to Commitment <span className="font-normal text-slate-500">(Qty will be added back to commitment)</span>
                  </Label>
                </div>
                <div className="flex items-center space-x-2 rounded-lg border p-3 cursor-pointer hover:bg-slate-50">
                  <RadioGroupItem value="close" id="action-close" />
                  <Label htmlFor="action-close" className="text-xs font-bold text-slate-700 cursor-pointer">
                    Close <span className="font-normal text-slate-500">(Qty will not be transferred anywhere)</span>
                  </Label>
                </div>
              </RadioGroup>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase font-black text-slate-500">Reason <span className="text-red-500">*</span></Label>
              <Textarea
                placeholder="Enter reason for preclosing..."
                value={precloseRemarks}
                onChange={(e) => setPrecloseRemarks(e.target.value)}
                className="text-xs font-medium resize-none"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setPrecloseDialogOpen(false);
                setPrecloseDialogProduct(null);
                setPrecloseRemarks("");
                setPrecloseAction("close");
              }}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={isProcessing}
              onClick={() => {
                if (!precloseDialogProduct) return;
                const maxLimit = precloseDialogProduct.maxLimit;
                const qty = parseFloat(precloseInputs[precloseDialogProduct.id] !== undefined ? precloseInputs[precloseDialogProduct.id] : String(maxLimit));
                if (isNaN(qty) || qty <= 0) {
                  toast({ title: "Invalid Quantity", description: "Please enter a valid number greater than 0", variant: "destructive" });
                  return;
                }
                if (qty > maxLimit + 0.0001) {
                  toast({ title: "Quantity Exceeded", description: `Cannot preclose more than ${maxLimit}`, variant: "destructive" });
                  return;
                }
                handlePreclose(precloseDialogProduct.id, qty, precloseAction, precloseRemarks);
              }}
            >
              {isProcessing ? "Processing..." : "Confirm Preclose"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Slip Dialog */}
      <Dialog open={isSlipDialogOpen} onOpenChange={setIsSlipDialogOpen}>
        <DialogContent className="max-w-4xl sm:max-w-4xl md:max-w-5xl lg:max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Dispatch Slip Preview</DialogTitle>
            <DialogDescription>Review the dispatch slip details below.</DialogDescription>
          </DialogHeader>
          <div className="bg-slate-50 p-4 rounded-lg overflow-x-auto">
            {renderSlipContent()}
          </div>
          <DialogFooter className="flex flex-col sm:flex-row justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => setIsSlipDialogOpen(false)} className="sm:order-first">Close</Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handlePrintSlip} className="border-blue-600 text-blue-600 hover:bg-blue-50">
                <Printer className="mr-2 h-4 w-4" /> Print Slip
              </Button>
              <Button onClick={handleDownloadSlip} className="bg-blue-600 hover:bg-blue-700">
                <Download className="mr-2 h-4 w-4" /> Download PDF
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </WorkflowStageShell>
  )
}
