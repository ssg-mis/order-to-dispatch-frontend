"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { WorkflowStageShell } from "@/components/workflow/workflow-stage-shell"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Upload, CheckCircle, Settings2, ChevronUp, ChevronDown, CheckSquare, Eye, FileText, ExternalLink, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ALL_WORKFLOW_COLUMNS as ALL_COLUMNS } from "@/lib/workflow-columns"
import { ColumnToggleContent } from "@/components/ui/column-toggle-content"
import { gateOutApi, orderApi, customerApi } from "@/lib/api-service"
import { cn } from "@/lib/utils"
import { useAuth } from "@/hooks/use-auth"
import { useInfiniteQuery, useQuery } from "@tanstack/react-query"
import { useInView } from "react-intersection-observer"
import { Loader2 } from "lucide-react"
import { usePersistedColumns } from "@/hooks/use-persisted-columns"
import { useColumnOrder } from "@/hooks/use-column-order"
import { SortableTableHead } from "@/components/ui/sortable-table-head"
import { ColumnDragProvider } from "@/components/ui/column-drag-provider"

const MAX_COMPRESSED_IMAGE_BYTES = 850 * 1024
const MAX_COMPRESSED_IMAGE_DIMENSION = 1600

async function compressImageForUpload(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file

  const bitmap = await createImageBitmap(file)
  const canvas = document.createElement("canvas")
  const context = canvas.getContext("2d")

  if (!context) {
    bitmap.close()
    return file
  }

  const toBlob = (quality: number) =>
    new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", quality))

  let maxDimension = Math.min(MAX_COMPRESSED_IMAGE_DIMENSION, Math.max(bitmap.width, bitmap.height))
  let blob: Blob | null = null

  while (maxDimension >= 320) {
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))

    canvas.width = width
    canvas.height = height
    context.clearRect(0, 0, width, height)
    context.drawImage(bitmap, 0, 0, width, height)

    let quality = 0.82
    blob = await toBlob(quality)

    while (blob && blob.size > MAX_COMPRESSED_IMAGE_BYTES && quality > 0.34) {
      quality -= 0.08
      blob = await toBlob(quality)
    }

    if (blob && blob.size <= MAX_COMPRESSED_IMAGE_BYTES) break
    maxDimension -= 250
  }

  bitmap.close()

  if (!blob || blob.size > MAX_COMPRESSED_IMAGE_BYTES) return file

  const cleanName = file.name.replace(/\.[^.]+$/, "")
  return new File([blob], `${cleanName}.jpg`, { type: "image/jpeg", lastModified: Date.now() })
}

const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
  "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
  "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
  "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Delhi", "Jammu and Kashmir", "Ladakh", "Chandigarh", "Puducherry",
  "Andaman and Nicobar Islands", "Dadra and Nagar Haveli", "Daman and Diu", "Lakshadweep",
]

function extractState(addr: string): string | null {
  if (!addr) return null
  const lower = addr.toLowerCase()
  for (const s of INDIAN_STATES) {
    if (lower.includes(s.toLowerCase())) return s
  }
  return null
}

function InvoiceSummary({ selectedGroups, selectedProducts }: {
  selectedGroups: any[]
  selectedProducts: string[]
}) {
  const selProds = selectedGroups.flatMap((g) => g._allProducts)
    .filter((p) => selectedProducts.includes(p._rowKey))

  const firstProd = selProds[0]
  const firstGroup = selectedGroups[0]
  const firstOrderDetails: any = Object.values(firstGroup?._ordersMap || {})[0] || {}
  const depoName = (firstOrderDetails?.depoName && firstOrderDetails.depoName !== "—")
    ? firstOrderDetails.depoName
    : (firstProd?.depo_name || "")
  const shippingAddr = firstProd?.customer_address || ""

  const shippingState = extractState(shippingAddr) || ""

  const billingSearchTerm = depoName ? `Shri Shyam ${depoName}` : "Shri Shyam"
  const { data: billingRes } = useQuery({
    queryKey: ['billing-customer-state', billingSearchTerm],
    queryFn: () => customerApi.getAll({ search: billingSearchTerm, all: "true" }),
    enabled: true,
    staleTime: 10 * 60 * 1000,
  })
  const billingCustomers: any[] = billingRes?.data?.customers || []
  const billingCustomer = billingCustomers.find((c: any) =>
    c.customer_name?.toLowerCase().includes("shri shyam")
  )
  const billingState = billingCustomer?.state || ""

  const totalTaxable = selProds.reduce((sum, p) => {
    const rate = Number(p.rate) || 0
    const rateWoGst = parseFloat((rate / 1.05).toFixed(2))
    return sum + (rateWoGst * (parseFloat(p.actualQty) || 0))
  }, 0)

  const missingBilling = !billingState
  const missingShipping = !shippingState
  let gstType = "same"
  let cgst = Math.round(totalTaxable * 0.025 * 100) / 100
  let sgst = cgst
  let igst = 0

  if (missingBilling || missingShipping) {
    gstType = "no_address"
  } else if (billingState === shippingState) {
    gstType = "same"
  } else {
    gstType = "different"
    cgst = 0
    sgst = 0
    igst = Math.round(totalTaxable * 0.05 * 100) / 100
  }

  const rawTotal = totalTaxable + cgst + sgst + igst
  const roundOff = rawTotal - Math.floor(rawTotal)
  const invoiceTotal = Math.floor(rawTotal)

  return (
    <div className="border border-slate-200 rounded-2xl bg-white shadow-sm overflow-hidden">
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Invoice Summary</p>
      </div>
      <div className="p-4 max-w-sm ml-auto space-y-2">
        <div className="flex justify-between items-center text-xs">
          <span className="font-black uppercase text-slate-500 text-[10px]">Total Taxable Amount</span>
          <span className="font-mono font-bold text-slate-700">₹{totalTaxable.toFixed(2)}</span>
        </div>
        <div className="flex justify-between items-center text-xs">
          <span className="font-black uppercase text-slate-500 text-[10px]">CGST (2.5%)</span>
          <span className="font-mono font-bold text-slate-700">{gstType !== "different" ? `₹${cgst.toFixed(2)}` : "—"}</span>
        </div>
        <div className="flex justify-between items-center text-xs">
          <span className="font-black uppercase text-slate-500 text-[10px]">SGST (2.5%)</span>
          <span className="font-mono font-bold text-slate-700">{gstType !== "different" ? `₹${sgst.toFixed(2)}` : "—"}</span>
        </div>
        <div className="flex justify-between items-center text-xs">
          <span className="font-black uppercase text-slate-500 text-[10px]">IGST (5%)</span>
          <span className="font-mono font-bold text-slate-700">{gstType === "different" ? `₹${igst.toFixed(2)}` : "—"}</span>
        </div>
        <div className="flex justify-between items-center text-xs">
          <span className="font-black uppercase text-slate-500 text-[10px]">Round Off</span>
          <span className="font-mono font-bold text-slate-500">{roundOff > 0 ? `-₹${roundOff.toFixed(2)}` : "—"}</span>
        </div>
        <div className="flex justify-between items-center border-t border-slate-200 pt-2">
          <span className="font-black uppercase text-slate-800 text-[11px]">Total Invoice Amount</span>
          <span className="font-mono font-black text-blue-700 text-sm">₹{invoiceTotal.toFixed(2)}</span>
        </div>
      </div>
    </div>
  )
}

export default function GateOutPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { isReadOnly, user, isAdmin, isFeatureEnabled } = useAuth()
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending")
  const { ref: pendingEndRef, inView: pendingInView } = useInView()
  const { ref: historyEndRef, inView: historyInView } = useInView()

  const [filterValues, setFilterValues] = useState({
    status: "",
    startDate: "",
    endDate: "",
    partyName: "",
    search: ""
  })
  const [isProcessing, setIsProcessing] = useState(false)
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

  const [visibleColumns, setVisibleColumns] = usePersistedColumns(
    "gate-out",
    ["partySoDate", "orderNo", "customerName", "invoiceNo", "status"]
  )
  const GATE_OUT_STD_IDS = ["partySoDate", "customerName", "orderNo", "actual1Date", "processid", "invoiceNo", "vehicleNo", "orderPunchRemarks", "status", "products"]
  const [columnOrder, setColumnOrder] = useColumnOrder("gate-out", [...GATE_OUT_STD_IDS, ...ALL_COLUMNS.map(c => c.id).filter(id => !GATE_OUT_STD_IDS.includes(id))])
  const ALWAYS_VISIBLE_GATE_OUT = new Set(["products"])
  const orderedVisible = columnOrder.filter(id => ALWAYS_VISIBLE_GATE_OUT.has(id) || visibleColumns.includes(id))
  const dynamicColumns = visibleColumns.filter(id => !GATE_OUT_STD_IDS.includes(id))
  const handleColumnReorder = useCallback((newVisibleOrder: string[]) => {
    const newOrderSet = new Set(newVisibleOrder)
    const hiddenCols = columnOrder.filter(id => !newOrderSet.has(id))
    setColumnOrder([...newVisibleOrder, ...hiddenCols])
  }, [columnOrder, setColumnOrder])

  // Selection & Dialog State
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [selectedGroups, setSelectedGroups] = useState<any[]>([]) // Changed to array for multi-group support
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [expandedOrders, setExpandedOrders] = useState<string[]>([]) // State to manage expanded sections

  // Gate Out Form State
  const [isUploading, setIsUploading] = useState<string | null>(null)
  const [gateOutData, setGateOutData] = useState({
    gatePassFile: null as File | null,
    gatePassFileName: "",
    vehicleLoadedImage: null as File | null,
    vehicleLoadedImageName: "",
  })

  // Pending query with infinite pagination
  const {
    data: pendingData,
    fetchNextPage: fetchNextPending,
    hasNextPage: hasNextPending,
    isFetchingNextPage: isFetchingNextPending,
    isLoading: isPendingLoading,
    refetch: refetchPending,
  } = useInfiniteQuery({
    queryKey: ["gate-out-pending", filterValues],
    queryFn: async ({ pageParam = 1 }) => {
      const response = await gateOutApi.getPending({
        page: pageParam,
        limit: 20,
        so_no: filterValues.search,
        party_name: filterValues.partyName === "all" ? undefined : filterValues.partyName,
      });
      return response.success ? response.data : { orders: [], pagination: { total: 0 } };
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const currentCount = allPages.reduce((sum, page) => sum + (page.orders?.length || 0), 0);
      return currentCount < (lastPage.pagination?.total || 0) ? allPages.length + 1 : undefined;
    },
  });

  // History query with infinite pagination (lazy loaded)
  const {
    data: historyData,
    fetchNextPage: fetchNextHistory,
    hasNextPage: hasNextHistory,
    isFetchingNextPage: isFetchingNextHistory,
    isLoading: isHistoryLoading,
    refetch: refetchHistory,
  } = useInfiniteQuery({
    queryKey: ["gate-out-history", filterValues],
    queryFn: async ({ pageParam = 1 }) => {
      const response = await gateOutApi.getHistory({
        page: pageParam,
        limit: 20,
        so_no: filterValues.search,
        party_name: filterValues.partyName === "all" ? undefined : filterValues.partyName,
      });
      return response.success ? response.data : { orders: [], pagination: { total: 0 } };
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const currentCount = allPages.reduce((sum, page) => sum + (page.orders?.length || 0), 0);
      return currentCount < (lastPage.pagination?.total || 0) ? allPages.length + 1 : undefined;
    },
    enabled: activeTab === "history",
  });

  const pendingOrders = useMemo(() => {
    return pendingData?.pages.flatMap((page) => page.orders) || [];
  }, [pendingData]);

  const historyOrders = useMemo(() => {
    return historyData?.pages.flatMap((page) => page.orders) || [];
  }, [historyData]);

  useEffect(() => {
    if (pendingInView && hasNextPending) {
      fetchNextPending();
    }
  }, [pendingInView, hasNextPending, fetchNextPending]);

  useEffect(() => {
    if (historyInView && hasNextHistory) {
      fetchNextHistory();
    }
  }, [historyInView, hasNextHistory, fetchNextHistory]);

  const handleFileUpload = (file: File, type: 'gatePass' | 'vehicleImage') => {
    if (!file) return;

    if (type === 'gatePass') {
      setGateOutData(p => ({
        ...p,
        gatePassFile: file,
        gatePassFileName: file.name
      }));
    } else {
      setGateOutData(p => ({
        ...p,
        vehicleLoadedImage: file,
        vehicleLoadedImageName: file.name
      }));
    }
  };

  const uploadSelectedFile = async (file: File, type: 'gatePass' | 'vehicleImage') => {
    setIsUploading(type);
    try {
      const uploadFile = await compressImageForUpload(file);
      const response = await orderApi.uploadFile(uploadFile);
      if (response.success) {
        return response.data.url;
      }
      throw new Error(response.message || "Failed to upload file to S3");
    } catch (error: any) {
      console.error("Upload failed:", error);
      throw error;
    } finally {
      setIsUploading(null);
    }
  };


  /* Filter Logic */

  const filteredPendingOrders = pendingOrders.filter(order => {
    let matches = true

    // Filter by Party Name
    if (filterValues.partyName && filterValues.partyName !== "all" && order.party_name !== filterValues.partyName) {
      matches = false
    }

    // Filter by Date Range
    const orderDateStr = order.timestamp || order.planned_7
    if (orderDateStr) {
      const orderDate = new Date(orderDateStr)
      if (filterValues.startDate) {
        const start = new Date(filterValues.startDate)
        start.setHours(0, 0, 0, 0)
        if (orderDate < start) matches = false
      }
      if (filterValues.endDate) {
        const end = new Date(filterValues.endDate)
        end.setHours(23, 59, 59, 999)
        if (orderDate > end) matches = false
      }
    }

    return matches
  })

  /* Grouping Logic */
  const displayRows = useMemo(() => {
    const grouped: { [key: string]: any } = {}

    filteredPendingOrders.forEach((order: any) => {
      const invoiceNo = order.invoice_no || "No Invoice"
      const partyName = (order.transfer === 'yes' && order.bill_company_name) ? order.bill_company_name : (order.party_name || order.partyName || "Unknown Customer")
      const rawDoNumber = order.so_no || order.soNo || "—"
      const doNumber = rawDoNumber.replace(/(?<=\d)[A-Z].*$/, "")
      // Extract only date part (YYYY-MM-DD) robustly from LRC actual_1, matched by so_no
      const actualDateVal = order.lrc_actual_1 || order.actual_1
      const actual1Str = actualDateVal ? (() => { 
        const d = new Date(actualDateVal); 
        if (isNaN(d.getTime())) return String(actualDateVal).split(/[T ]/)[0].trim(); 
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; 
      })() : "no-date"
      const vehicleNo = (order.truck_no || "—").trim().toUpperCase().replace(/\s+/g, "")

      // Group by actual_1 date and Vehicle No.
      const groupKey = `${actual1Str}-${vehicleNo}`

      if (!grouped[groupKey]) {
        grouped[groupKey] = {
          _rowKey: groupKey,
          customerName: partyName,
          invoiceNo: invoiceNo,
          actual1Date: actual1Str,
          doNumberList: new Set<string>(),
          _allProducts: [],
          _ordersMap: {}, // Group items by specific DO for interleaved view
          _productCount: 0
        }
      }

      const group = grouped[groupKey]
      group.doNumberList.add(doNumber)

      const orderKey = doNumber;

      if (!group._ordersMap[orderKey]) {
        group._ordersMap[orderKey] = {
          _products: [],
          depoName: order.depo_name || order.depoName || "—",
          deliveryPurpose: order.order_type_delivery_purpose || "—",
          orderType: order.order_type || "—",
          startDate: order.start_date,
          endDate: order.end_date,
          deliveryDate: order.delivery_date,
          transportType: order.type_of_transporting || "—",
          contactPerson: order.customer_contact_person_name || "—",
          whatsapp: order.customer_contact_person_whatsapp_no || "—",
          customerAddress: order.customer_address || "—",
          paymentTerms: order.payment_terms || "—",
          advanceAmount: order.advance_amount || 0,
          isBroker: order.is_order_through_broker || false,
          isOrderThrough: order.is_order_through || "—",
          brokerName: order.broker_name || "—",
          partyCredit: order.party_credit_status || "Good",
          totalAmount: order.total_amount_with_gst || "—",
          oilType: order.oil_type || "—",
          partySoDate: formatDate(order.party_so_date || order.partySoDate),
          uploadSo: order.upload_so || null,
        }
      }

      const product = {
        ...order,
        _rowKey: `${partyName}-${order.id}`,
        id: order.id,
        specificOrderNo: doNumber,
        productName: order.product_name,
        rate: (parseFloat(order.rate_of_material) || 0) * (parseFloat(order.nos_per_main_uom) || 1),
        amount: ((parseFloat(order.rate_of_material) || 0) * (parseFloat(order.nos_per_main_uom) || 1)) * (parseFloat(order.actual_qty_dispatch) || 0),
        invoiceNo: order.invoice_no,
        invoiceDate: order.invoice_date,
        billAmount: order.bill_amount,
        actualQty: order.actual_qty_dispatch,
        truckNo: order.truck_no,
        rstNo: order.rst_no,
        grossWeight: order.gross_weight,
        tareWeight: order.tare_weight,
        netWeight: order.net_weight,
        weightDiff: order.difference || 0,
        transporterName: order.transporter_name,
        fitness: order.fitness,
        fitness_end_date: order.fitness_end_date,
        insurance: order.insurance,
        insurance_end_date: order.insurance_end_date,
        polution: order.polution,
        pollution_end_date: order.pollution_end_date,
        tax_copy: order.tax_copy,
        tax_end_date: order.tax_end_date,
        permit1: order.permit1,
        permit1_end_date: order.permit1_end_date,
        permit2_out_state: order.permit2_out_state,
        permit2_end_date: order.permit2_end_date,
        check_status: order.check_status,
        remarks: order.remarks,
        weightment_slip_copy: order.weightment_slip_copy,
        reasonForDiff: order.reason_of_difference_in_weight_if_any_speacefic,
        reason_of_difference_in_weight_if_any_speacefic: order.reason_of_difference_in_weight_if_any_speacefic,
        bilty_no: order.bilty_no,
        processid: order.processid || null
      }

      group._ordersMap[orderKey]._products.push(product)
      group._allProducts.push(product)
      group._productCount = group._allProducts.length
    })

    // Finalize DO numbers string
    const result = Object.values(grouped).map((g: any) => {
      const customers = Array.from(new Set(g._allProducts.map((p: any) => p.party_name || p.partyName))).filter(Boolean)

      return {
        ...g,
        customerName: customers.length > 1 ? `Multiple Parties (${customers.length})` : customers[0] || g.customerName,
        partySoDate: formatDate(g._allProducts[0]?.party_so_date),
        doNumber: Array.from(g.doNumberList as Set<string>).join(", "),
        orderNo: Array.from(g.doNumberList as Set<string>).join(", "),
        processId: g._allProducts[0]?.processid || "—",
        processid: g._allProducts[0]?.processid || "—",
        vehicleNo: (g._allProducts[0]?.truckNo || "—").toUpperCase(),
        actual1Date: formatDate(g._allProducts[0]?.lrc_actual_1 || g._allProducts[0]?.actual_1),
        invoiceNo: g._allProducts[0]?.invoice_no || "—",
        orderPunchRemarks: g._allProducts[0]?.order_punch_remarks || "—",
        uploadSo: g._allProducts[0]?.upload_so || g._allProducts[0]?.uploadSo || null,
      }
    })

    return result
  }, [filteredPendingOrders])

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
  const sortedDisplayRows = useMemo(() => {
    if (!pendingSortField || displayRows.length === 0) return displayRows
    return [...displayRows].sort((a, b) => {
      const aVal = String((a as any)[pendingSortField] ?? "").toLowerCase()
      const bVal = String((b as any)[pendingSortField] ?? "").toLowerCase()
      if (aVal < bVal) return pendingSortDir === "asc" ? -1 : 1
      if (aVal > bVal) return pendingSortDir === "asc" ? 1 : -1
      return 0
    })
  }, [displayRows, pendingSortField, pendingSortDir])


  const getDynamicColumnValue = (group: any, colId: string) => {
    const directValue = group?.[colId]
    if (directValue !== undefined && directValue !== null && directValue !== "") return directValue

    const firstProduct = group?._allProducts?.[0] || {}
    const firstOrder = Object.values(group?._ordersMap || {})[0] || {}

    const orderValue = (firstOrder as any)?.[colId]
    if (orderValue !== undefined && orderValue !== null && orderValue !== "") return orderValue

    const productValue = (firstProduct as any)?.[colId]
    if (productValue !== undefined && productValue !== null && productValue !== "") return productValue

    return "—"
  }

  const toggleSelectItem = (itemKey: string) => {
    setSelectedItems(prev =>
      prev.includes(itemKey)
        ? prev.filter(k => k !== itemKey)
        : [...prev, itemKey]
    )
  }

  const toggleSelectAll = () => {
    if (selectedItems.length === displayRows.length) {
      setSelectedItems([])
    } else {
      setSelectedItems(displayRows.map(r => r._rowKey))
    }
  }

  const handleOpenDialog = () => {
    if (selectedItems.length === 0) return

    // Get all selected groups
    const targets = displayRows.filter(r => selectedItems.includes(r._rowKey))
    if (targets.length > 0) {
      setSelectedGroups(targets)
      // Select all products by default from all selected groups
      const allProdKeys = targets.flatMap(g => g._allProducts.map((p: any) => p._rowKey))
      setSelectedProducts(allProdKeys)

      // Reset form
      setGateOutData({
        gatePassFile: null,
        gatePassFileName: "",
        vehicleLoadedImage: null,
        vehicleLoadedImageName: ""
      })
      setExpandedOrders([]) // Reset expanded state

      setIsDialogOpen(true)
    }
  }

  const handleSubmit = async () => {
    if (selectedGroups.length === 0) return

    // Flatten all selected products from all selected groups
    const productsToSubmit = selectedGroups.flatMap(group =>
      group._allProducts.filter((p: any) => selectedProducts.includes(p._rowKey))
    )

    if (productsToSubmit.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one product",
        variant: "destructive"
      })
      return
    }

    const selectedGatePassFile = gateOutData.gatePassFile
    const selectedVehicleLoadedImage = gateOutData.vehicleLoadedImage

    // Validate Mandatory Uploads
    if (!selectedGatePassFile || !selectedVehicleLoadedImage) {
      toast({
        title: "Validation Error",
        description: "Please upload both Gate Pass and Vehicle Loaded Image.",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true)
    try {
      const successfulSubmissions: any[] = []
      const failedSubmissions: any[] = []
      const gatePassFileUrl = await uploadSelectedFile(selectedGatePassFile, 'gatePass')
      const vehicleLoadedImageUrl = await uploadSelectedFile(selectedVehicleLoadedImage, 'vehicleImage')

      for (const product of productsToSubmit) {
        const submitData = {
          gate_pass: gatePassFileUrl || "",
          vehicle_image: vehicleLoadedImageUrl || "",
          username: user?.username || null // Add username for tracking
        };

        try {
          console.log(`[GATE-OUT] Submitting for ID ${product.id}`, submitData);
          const response = await gateOutApi.submit(product.id, submitData);

          if (response.success) {
            successfulSubmissions.push(product);
          } else {
            failedSubmissions.push({ product, error: response.message });
          }
        } catch (err: any) {
          console.error(`[GATE-OUT] Failed for ID ${product.id}`, err);
          failedSubmissions.push({ product, error: err.message });
        }
      }

      if (successfulSubmissions.length > 0) {
        toast({
          title: "Gate Out Completed",
          description: `Successfully processed ${successfulSubmissions.length} items.`,
        })

        await refetchPending();
        await refetchHistory();

        setIsDialogOpen(false)
        setSelectedItems([])
      }

      if (failedSubmissions.length > 0) {
        toast({
          title: "Partial Failure",
          description: `Failed to process ${failedSubmissions.length} items.`,
          variant: "destructive"
        })
      }

    } catch (error: any) {
      console.error("Batch submit error:", error);
      toast({
        title: "Error",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      })
    } finally {
      setIsProcessing(false)
    }
  }



  const customerNames = Array.from(new Set(pendingOrders.map(order => (order.transfer === 'yes' && order.bill_company_name) ? order.bill_company_name : (order.party_name || order.partyName || "Unknown Customer"))))

  return (
    <WorkflowStageShell
      partyNames={customerNames}
      title="Stage 11: Gate Out"
      description="Record gate out details and upload gate pass grouped by Customer."
      pendingCount={displayRows.length}
      historyData={historyOrders.map((order) => ({
        ...order,
        date: order.actual_7 ? new Date(order.actual_7).toLocaleDateString("en-GB") : "-",
        orderNo: order.so_no,
        stage: "Gate Out",
        customerName: (order.transfer === 'yes' && order.bill_company_name) ? order.bill_company_name : order.party_name,
        status: "Completed",
        remarks: order.gate_pass_copy ? "Pass Uploaded" : "-",
        rawData: order,
      }))}
      onFilterChange={setFilterValues}
      showStatusFilter={true}
      stageLevel={8}
      onTabChange={setActiveTab}
      isHistoryLoading={isHistoryLoading}
      showDateFilters={false}
      historyFooter={
        <div ref={historyEndRef} className="py-4 flex justify-center">
          {isFetchingNextHistory && (
            <div className="flex items-center gap-2 text-blue-600 font-bold animate-pulse text-xs tracking-widest ">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>LOADING MORE GATE OUT HISTORY...</span>
            </div>
          )}
          {!hasNextHistory && historyOrders.length > 0 && (
            <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest bg-slate-50 px-4 py-1.5 rounded-full border border-slate-100 italic">
              END OF HISTORY
            </span>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        {/* Action Bar */}
        <div className="flex justify-end gap-2">
          <Button
            onClick={handleOpenDialog}
            disabled={selectedItems.length === 0}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <CheckCircle className="mr-2 h-4 w-4" />
            Complete Gate Out ({selectedItems.length})
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="bg-transparent">
                <Settings2 className="mr-2 h-4 w-4" />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[250px]">
              <ColumnToggleContent columns={ALL_COLUMNS} visibleColumns={visibleColumns} setVisibleColumns={setVisibleColumns} />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Main Card View (Grouped) */}
        <Card className="border-none shadow-sm overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b bg-slate-50/70 px-4 py-3">
            <div className="flex items-center gap-3">
              <Checkbox checked={displayRows.length > 0 && selectedItems.length === displayRows.length} onCheckedChange={toggleSelectAll} />
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-slate-700">Gate Out Loads</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{selectedItems.length} selected</p>
              </div>
            </div>
            <Badge className="w-fit bg-rose-100 text-rose-700 hover:bg-rose-100">
              {displayRows.length} Ready
            </Badge>
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block max-h-[600px] overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card shadow-sm">
                <TableRow className="bg-slate-50">
                  <TableHead className="w-10 text-center">
                    <Checkbox checked={displayRows.length > 0 && selectedItems.length === displayRows.length} onCheckedChange={toggleSelectAll} />
                  </TableHead>
                  <ColumnDragProvider columnIds={orderedVisible} onReorder={handleColumnReorder} disabled={!isAdmin && !isFeatureEnabled('can_reorder_columns')}>
                    {orderedVisible.map(id => {
                      const cls = "text-[10px] font-black uppercase tracking-widest cursor-pointer select-none hover:text-blue-600 transition-colors"
                      if (id === "partySoDate") return <SortableTableHead key={id} id={id} className={cls} onClick={() => handlePendingSort("partySoDate")}>DO Date<PendingSortIcon field="partySoDate" /></SortableTableHead>
                      if (id === "customerName") return <SortableTableHead key={id} id={id} className={cls} onClick={() => handlePendingSort("customerName")}>Customer<PendingSortIcon field="customerName" /></SortableTableHead>
                      if (id === "orderNo") return <SortableTableHead key={id} id={id} className={cls} onClick={() => handlePendingSort("orderNo")}>DO Number(s)<PendingSortIcon field="orderNo" /></SortableTableHead>
                      if (id === "actual1Date") return <SortableTableHead key={id} id={id} className={cls + " text-center"} onClick={() => handlePendingSort("actual1Date")}>Actual 1<PendingSortIcon field="actual1Date" /></SortableTableHead>
                      if (id === "processid") return <SortableTableHead key={id} id={id} className={cls} onClick={() => handlePendingSort("processid")}>Process ID<PendingSortIcon field="processid" /></SortableTableHead>
                      if (id === "invoiceNo") return <SortableTableHead key={id} id={id} className={cls} onClick={() => handlePendingSort("invoiceNo")}>Invoice No<PendingSortIcon field="invoiceNo" /></SortableTableHead>
                      if (id === "vehicleNo") return <SortableTableHead key={id} id={id} className={cls} onClick={() => handlePendingSort("vehicleNo")}>Vehicle No<PendingSortIcon field="vehicleNo" /></SortableTableHead>
                      if (id === "orderPunchRemarks") return <SortableTableHead key={id} id={id} className={cls} onClick={() => handlePendingSort("orderPunchRemarks")}>Order Punch Remarks<PendingSortIcon field="orderPunchRemarks" /></SortableTableHead>
                      if (id === "status") return <SortableTableHead key={id} id={id} className="text-[10px] font-black uppercase tracking-widest text-center">Status</SortableTableHead>
                      if (id === "products") return <SortableTableHead key={id} id={id} className="text-[10px] font-black uppercase tracking-widest text-center">Items</SortableTableHead>
                      const dynCol = ALL_COLUMNS.find(c => c.id === id)
                      if (dynCol) return <SortableTableHead key={id} id={id} className={cls} onClick={() => handlePendingSort(id)}>{dynCol.label}<PendingSortIcon field={id} /></SortableTableHead>
                      return null
                    })}
                  </ColumnDragProvider>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isPendingLoading && pendingOrders.length === 0 ? (
                  [...Array(5)].map((_, i) => (
                    <TableRow key={i} className="opacity-40 border-b border-slate-50">
                      <TableCell className="text-center py-4"><div className="h-4 w-4 bg-slate-200 animate-pulse rounded mx-auto" /></TableCell>
                      {orderedVisible.map(id => (
                        <TableCell key={id} className="text-center py-4">
                          <div className={cn("h-3 bg-slate-200 animate-pulse rounded-full mx-auto", id === "status" ? "h-5 w-16" : id === "products" ? "w-12" : id === "customerName" ? "w-32" : id === "orderNo" || id === "invoiceNo" || id === "vehicleNo" ? "w-24" : "w-20")} />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : sortedDisplayRows.length > 0 ? (
                  sortedDisplayRows.map((group) => (
                    <TableRow
                      key={group._rowKey}
                      className={cn(
                        "cursor-pointer transition-colors",
                        selectedItems.includes(group._rowKey) ? "bg-blue-50/40" : "hover:bg-slate-50/60"
                      )}
                      onClick={() => toggleSelectItem(group._rowKey)}
                    >
                      <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                        <Checkbox checked={selectedItems.includes(group._rowKey)} onCheckedChange={() => toggleSelectItem(group._rowKey)} />
                      </TableCell>
                      {orderedVisible.map(id => {
                        if (id === "partySoDate") return <TableCell key={id} className="text-xs text-slate-500 font-medium whitespace-nowrap">{group.partySoDate}</TableCell>
                        if (id === "customerName") return <TableCell key={id} className="text-xs font-black text-slate-900 uppercase">{group.customerName}</TableCell>
                        if (id === "orderNo") return (
                          <TableCell key={id}>
                            <div className="flex flex-wrap gap-1">
                              {String(group.doNumber || "—").split(", ").map((doNo: string) => (
                                <Badge key={doNo} variant="outline" className="bg-white text-blue-700 border-blue-100 text-[10px] font-bold whitespace-nowrap">{doNo}</Badge>
                              ))}
                            </div>
                          </TableCell>
                        )
                        if (id === "actual1Date") return <TableCell key={id} className="text-center text-xs font-bold text-blue-700 whitespace-nowrap">{group.actual1Date}</TableCell>
                        if (id === "processid") return <TableCell key={id} className="text-xs font-bold text-slate-700">{group.processId}</TableCell>
                        if (id === "invoiceNo") return (
                          <TableCell key={id} className="text-xs font-bold text-slate-700">
                            {group._allProducts?.[0]?.invoice_copy ? (
                              <a href={group._allProducts[0].invoice_copy} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-blue-600 hover:underline font-black">{group.invoiceNo}</a>
                            ) : group.invoiceNo}
                          </TableCell>
                        )
                        if (id === "vehicleNo") return <TableCell key={id} className="text-xs font-black text-slate-800 whitespace-nowrap">{group.vehicleNo}</TableCell>
                        if (id === "orderPunchRemarks") return <TableCell key={id} className="text-xs text-slate-600 font-medium">{group.orderPunchRemarks}</TableCell>
                        if (id === "status") return (
                          <TableCell key={id} className="text-center">
                            <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100 text-[10px] font-black whitespace-nowrap">Ready</Badge>
                          </TableCell>
                        )
                        if (id === "products") return (
                          <TableCell key={id} className="text-center">
                            <Badge variant="secondary" className="font-black text-[10px]">{group._productCount}</Badge>
                          </TableCell>
                        )
                        return null
                      })}
                      {dynamicColumns.map((colId) => (
                        <TableCell key={colId} className="text-xs font-bold text-slate-700">
                          {String(getDynamicColumnValue(group, colId))}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={1 + orderedVisible.length + dynamicColumns.length} className="text-center py-12 text-muted-foreground">
                      No orders pending for gate out
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden max-h-[600px] overflow-y-auto p-3">
            {isPendingLoading && pendingOrders.length === 0 ? (
              <div className="grid grid-cols-1 gap-4">
                {[...Array(4)].map((_, i) => (
                  <Card key={i} className="p-4 space-y-4 border-slate-100 shadow-sm animate-pulse">
                    <div className="flex justify-between">
                      <div className="h-4 w-32 bg-slate-200 rounded" />
                      <div className="h-5 w-20 bg-slate-200 rounded-full" />
                    </div>
                    <div className="h-5 w-3/4 bg-slate-100 rounded" />
                    <div className="grid grid-cols-2 gap-3">
                      <div className="h-12 bg-slate-100 rounded-lg" />
                      <div className="h-12 bg-slate-100 rounded-lg" />
                    </div>
                  </Card>
                ))}
              </div>
            ) : displayRows.length > 0 ? (
              <div className="grid grid-cols-1 gap-4">
                {displayRows.map((group) => (
                  <Card
                    key={group._rowKey}
                    className={cn(
                      "p-4 border-2 transition-all shadow-sm bg-white",
                      selectedItems.includes(group._rowKey) ? "border-blue-500 bg-blue-50/30 shadow-md" : "border-slate-100 hover:border-blue-200"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        {visibleColumns.includes("partySoDate") && <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{group.partySoDate}</p>}
                        {visibleColumns.includes("customerName") && <h3 className="text-sm font-black uppercase tracking-tight text-slate-900 leading-tight break-words">{group.customerName}</h3>}
                      </div>
                      <Checkbox checked={selectedItems.includes(group._rowKey)} onCheckedChange={() => toggleSelectItem(group._rowKey)} className="mt-1 h-5 w-5" />
                    </div>

                    {visibleColumns.includes("orderNo") && (
                      <div className="mt-4 flex flex-wrap gap-1.5">
                        {String(group.doNumber || "—").split(", ").map((doNo: string) => (
                          <Badge key={doNo} variant="outline" className="bg-white text-blue-700 border-blue-100 text-[10px] font-bold">
                            {doNo}
                          </Badge>
                        ))}
                      </div>
                    )}

                    <div className="mt-4 grid grid-cols-2 gap-3 border-y border-slate-100 py-3">
                      {visibleColumns.includes("actual1Date") && (
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Actual 1 Date</p>
                          <p className="text-xs font-bold text-blue-700">{group.actual1Date}</p>
                        </div>
                      )}
                      {visibleColumns.includes("processid") && (
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Process ID</p>
                          <p className="text-xs font-bold text-slate-700 break-words">{group.processId}</p>
                        </div>
                      )}
                      {visibleColumns.includes("invoiceNo") && (
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Invoice No.</p>
                          {group._allProducts?.[0]?.invoice_copy ? (
                            <a href={group._allProducts[0].invoice_copy} target="_blank" rel="noopener noreferrer" className="text-xs font-black text-blue-600 hover:underline break-words">
                              {group.invoiceNo}
                            </a>
                          ) : (
                            <p className="text-xs font-bold text-slate-700 break-words">{group.invoiceNo}</p>
                          )}
                        </div>
                      )}
                      {visibleColumns.includes("vehicleNo") && (
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Vehicle No.</p>
                          <p className="text-xs font-black text-slate-800">{group.vehicleNo}</p>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                      <Badge variant="secondary" className="font-black">{group._productCount} items</Badge>
                      {visibleColumns.includes("status") && <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100">Ready for Gate Out</Badge>}
                    </div>

                    {visibleColumns.includes("orderPunchRemarks") && group.orderPunchRemarks && group.orderPunchRemarks !== "—" && (
                      <div className="mt-3 rounded-lg bg-slate-50 p-3">
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Order Punch Remarks</p>
                        <p className="mt-1 text-[11px] font-medium italic text-slate-600 leading-relaxed break-words">"{group.orderPunchRemarks}"</p>
                      </div>
                    )}
                    {dynamicColumns.length > 0 && (
                      <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                        {dynamicColumns.map((colId) => {
                          const col = ALL_COLUMNS.find((c) => c.id === colId)
                          if (!col) return null
                          return (
                            <div key={colId} className="rounded-md bg-slate-50 p-2">
                              <p className="text-[10px] font-black uppercase text-slate-400">{col.label}</p>
                              <p className="mt-1 font-bold break-words">{String(getDynamicColumnValue(group, colId))}</p>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                No orders pending for gate out
              </div>
            )}
          </div>
          <div ref={pendingEndRef} className="py-2 flex justify-center">
            {isFetchingNextPending && (
              <div className="flex items-center gap-2 text-blue-600 font-bold animate-pulse text-[10px]">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>LOADING MORE...</span>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Split-View Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="w-[calc(100vw-0.75rem)] max-w-[calc(100vw-0.75rem)] sm:!max-w-[95vw] max-h-[95vh] overflow-y-auto p-0 [overflow-wrap:anywhere]">
          <div className="p-4 sm:p-6">
            <DialogHeader className="pr-8">
              <DialogTitle className="text-lg sm:text-xl font-bold text-slate-900 border-b pb-4 mb-4 leading-tight">
                Complete Gate Out - {selectedGroups.length > 1 ? `${selectedGroups.length} Invoices Selected` : selectedGroups[0]?.invoiceNo}
              </DialogTitle>
            </DialogHeader>

            {selectedGroups.length > 0 && (
              <div className="space-y-4 mt-6 min-w-0">
                {selectedGroups.map((group, groupIdx) => {
                  const allProducts = group._allProducts;
                  const allSelected = allProducts.every((p: any) => selectedProducts.includes(p._rowKey));
                  const isExpanded = expandedOrders.includes(group._rowKey);
                  const toggleExpand = () => {
                    setExpandedOrders(prev => isExpanded ? prev.filter(id => id !== group._rowKey) : [...prev, group._rowKey]);
                  };

                  const uniqueOrderDetails = Object.values(group._ordersMap);

                  return (
                    <div key={group._rowKey} className="border-2 border-slate-100 rounded-xl sm:rounded-3xl overflow-hidden bg-white shadow-sm min-w-0">
                        <div className="bg-blue-600 px-3 sm:px-5 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between cursor-pointer" onClick={toggleExpand}>
                          <div className="min-w-0 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                            <Badge className="max-w-full bg-white text-blue-800 hover:bg-white px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-black tracking-tight rounded-full shadow-sm uppercase whitespace-normal break-words">
                              DETAILS FOR {group.invoiceNo} — {group.customerName}
                            </Badge>
                            <div className="flex flex-col">
                              <span className="text-[10px] text-blue-100 font-black uppercase tracking-widest leading-none mb-1">GROUP {groupIdx + 1} | {group.doNumber}</span>
                              <span className="text-xs text-blue-100 font-bold leading-none">
                                {allProducts.filter((p: any) => selectedProducts.includes(p._rowKey)).length} Items Checked
                              </span>
                            </div>
                          </div>
                          <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-start">
                            <div className="text-[10px] sm:text-[11px] text-blue-50 font-bold uppercase tracking-widest sm:mr-2 leading-none cursor-pointer">
                              {isExpanded ? 'HIDE DETAILS ▲' : 'CLICK TO SHOW DETAILS ▼'}
                            </div>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/20 rounded-full">
                              {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                            </Button>
                          </div>
                        </div>

                          {/* Consolidated Collapsible Details Bar */}
                          {isExpanded && (
                            <div className="px-3 sm:px-5 pb-5 pt-4 space-y-6 bg-slate-50 border-t border-slate-100 animate-in slide-in-from-top-2 duration-300">
                              {uniqueOrderDetails.map((orderDetails: any, idx) => {
                                const firstProd = orderDetails._products[0] || {};
                                return (
                                  <div key={idx} className="bg-white border border-slate-100 rounded-2xl p-4 sm:p-6 relative shadow-sm">
                                    <div className="absolute -top-3 left-6">
                                      <Badge className="bg-slate-200 text-slate-700 hover:bg-slate-200 text-[10px] font-black uppercase px-3 py-1">
                                        ORDER: {firstProd.specificOrderNo}
                                      </Badge>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
                                      {/* Order Info */}
                                      {/* Order Info */}
                                      <div>
                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Delivery Purpose</p>
                                        <p className="text-xs font-bold text-slate-900 leading-none">{orderDetails.deliveryPurpose}</p>
                                      </div>
                                      <div>
                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Start Date / End Date</p>
                                        <p className="text-xs font-bold text-slate-900 leading-none">
                                          {orderDetails.startDate ? new Date(orderDetails.startDate).toLocaleDateString("en-GB") : "—"} / {orderDetails.endDate ? new Date(orderDetails.endDate).toLocaleDateString("en-GB") : "—"}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">DO Date</p>
                                        <p className="text-xs font-bold text-slate-700">
                                          {orderDetails.partySoDate || "—"}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Transport Type</p>
                                        <p className="text-xs font-bold text-slate-900 leading-none">{orderDetails.transportType}</p>
                                      </div>
                                      <div>
                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Credit Status</p>
                                        <Badge className={cn("text-[10px] font-black px-2 py-0.5", orderDetails.partyCredit === 'Good' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')}>
                                          {orderDetails.partyCredit}
                                        </Badge>
                                      </div>
                                      <div>
                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Customer Address</p>
                                        <p className="text-[10px] font-medium text-slate-600 leading-tight break-words" title={orderDetails.customerAddress}>{orderDetails.customerAddress}</p>
                                      </div>
                                      <div>
                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Contact Person</p>
                                        <p className="text-xs font-bold text-slate-900 leading-none">{orderDetails.contactPerson} ({orderDetails.whatsapp})</p>
                                      </div>
                                      <div>
                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Broker / Advance</p>
                                        <p className="text-xs font-bold text-slate-900 leading-none">
                                          {(orderDetails.isOrderThrough === "Direct" || (orderDetails.isOrderThrough === "—" && !orderDetails.isBroker)) ? "No" : orderDetails.brokerName} / ₹{orderDetails.advanceAmount}
                                        </p>
                                      </div>
                                      <div className="sm:col-span-2">
                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Order Punch Remarks</p>
                                        <p className="text-[10px] font-medium text-slate-600 leading-tight italic">"{orderDetails.orderPunchRemarks || "No special instructions provided."}"</p>
                                      </div>
                                      <div className="sm:col-span-2">
                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">PO Copy (SO Upload)</p>
                                        {group.uploadSo ? (
                                          <a 
                                            href={group.uploadSo} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-all border border-blue-200 w-fit group shadow-sm mt-0.5"
                                          >
                                            <FileText className="h-3 w-3 group-hover:scale-110 transition-transform" />
                                            <span className="text-[10px] font-black uppercase tracking-tight">VIEW PO COPY</span>
                                            <ExternalLink className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                          </a>
                                        ) : (
                                          <p className="text-[10px] font-black text-slate-400 leading-none">NOT UPLOADED</p>
                                        )}
                                      </div>

                                      <div className="sm:col-span-2 md:col-span-4 h-px bg-slate-200 my-1" />

                                      {/* Dispatch Info */}
                                      <div>
                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Truck No</p>
                                        <p className="text-sm font-black text-blue-800">{firstProd.truckNo || "—"}</p>
                                      </div>
                                      <div>
                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Bilty No</p>
                                        <p className="text-xs font-black text-blue-600">{firstProd.biltyNo || firstProd.bilty_no || "—"}</p>
                                      </div>
                                      <div>
                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Invoice No</p>
                                        <p className="text-xs font-black text-green-600">{firstProd.invoiceNo || "—"}</p>
                                      </div>
                                      <div>
                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Invoice Date</p>
                                        <p className="text-xs font-bold text-slate-700">
                                          {firstProd.invoiceDate ? new Date(firstProd.invoiceDate).toLocaleDateString("en-GB") : "—"}
                                        </p>
                                      </div>

                                      <div className="sm:col-span-2 md:col-span-4 h-px bg-slate-200 my-1" />

                                      {/* Vehicle Info */}
                                      <div className="sm:col-span-2 md:col-span-4 flex items-center gap-2 mb-[-8px]">
                                        <div className="h-3 w-1 bg-blue-600 rounded-full" />
                                        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-blue-900/60">Vehicle Specifications</p>
                                      </div>

                                      <div>
                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Vehicle Type</p>
                                        <p className="text-xs font-bold text-slate-900 leading-none">{firstProd.vehicle_type || "—"}</p>
                                      </div>
                                      <div>
                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">RTO</p>
                                        <p className="text-xs font-bold text-slate-900 leading-none">{firstProd.rto || "—"}</p>
                                      </div>
                                      <div>
                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Passing Weight</p>
                                        <p className="text-xs font-bold text-slate-900 leading-none">{firstProd.passing_weight || "—"}</p>
                                      </div>
                                      <div>
                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Road Tax</p>
                                        <p className="text-xs font-bold text-slate-900 leading-none">{firstProd.road_tax || "—"}</p>
                                      </div>
                                      <div>
                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">GVW</p>
                                        <p className="text-xs font-bold text-slate-900 leading-none">{firstProd.gvw || "—"}</p>
                                      </div>
                                      <div>
                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">ULW</p>
                                        <p className="text-xs font-bold text-slate-900 leading-none">{firstProd.ulw || "—"}</p>
                                      </div>

                                      {/* Driver Info */}
                                      <div className="sm:col-span-2 md:col-span-4 flex items-center gap-2 mb-[-8px] mt-2">
                                        <div className="h-3 w-1 bg-amber-600 rounded-full" />
                                        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-amber-900/60">Driver Information</p>
                                      </div>

                                      <div>
                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Driver Name</p>
                                        <p className="text-xs font-bold text-slate-900 leading-none">{firstProd.driver_name || "—"}</p>
                                      </div>
                                      <div>
                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Contact No</p>
                                        <p className="text-xs font-bold text-slate-900 leading-none">{firstProd.driver_contact_no || "—"}</p>
                                      </div>
                                      <div>
                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">License No</p>
                                        <p className="text-xs font-bold text-slate-900 leading-none">{firstProd.driving_license_no || "—"}</p>
                                      </div>
                                      <div>
                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Valid Upto</p>
                                        <p className="text-xs font-bold text-slate-900 leading-none">{firstProd.dl_valid_upto ? new Date(firstProd.dl_valid_upto).toLocaleDateString("en-GB") : "—"}</p>
                                      </div>

                                      <div className="sm:col-span-2 md:col-span-4 h-px bg-slate-200 my-1" />

                                      {/* Security Audit Info */}
                                      <div>
                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Fitness</p>
                                        {String(firstProd.fitness).startsWith('http') ? (
                                          <a href={firstProd.fitness} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-blue-600 hover:text-blue-800 underline">
                                            {firstProd.fitness_end_date ? new Date(firstProd.fitness_end_date).toLocaleDateString("en-GB") : "View Document"}
                                          </a>
                                        ) : <span className="text-[10px] text-slate-400">—</span>}
                                      </div>
                                      <div>
                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Insurance</p>
                                        {String(firstProd.insurance).startsWith('http') ? (
                                          <a href={firstProd.insurance} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-blue-600 hover:text-blue-800 underline">
                                            {firstProd.insurance_end_date ? new Date(firstProd.insurance_end_date).toLocaleDateString("en-GB") : "View Document"}
                                          </a>
                                        ) : <span className="text-[10px] text-slate-400">—</span>}
                                      </div>
                                      <div>
                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Pollution</p>
                                        {String(firstProd.polution).startsWith('http') ? (
                                          <a href={firstProd.polution} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-blue-600 hover:text-blue-800 underline">
                                            {firstProd.pollution_end_date ? new Date(firstProd.pollution_end_date).toLocaleDateString("en-GB") : "View Document"}
                                          </a>
                                        ) : <span className="text-[10px] text-slate-400">—</span>}
                                      </div>
                                      <div>
                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Audit Status</p>
                                        <Badge variant="outline" className={cn("text-[9px] font-black", firstProd.check_status === 'OK' ? "text-green-600 border-green-200 bg-green-50" : "text-amber-600 border-amber-200 bg-amber-50")}>
                                          {firstProd.check_status || "—"}
                                        </Badge>
                                      </div>

                                      <div className="sm:col-span-2 md:col-span-4 h-px bg-slate-200 my-1" />

                                      <div>
                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Tax Copy</p>
                                        {String(firstProd.tax_copy).startsWith('http') ? (
                                          <a href={firstProd.tax_copy} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-blue-600 hover:text-blue-800 underline">
                                            {firstProd.tax_end_date ? new Date(firstProd.tax_end_date).toLocaleDateString("en-GB") : "View Document"}
                                          </a>
                                        ) : <span className="text-[10px] text-slate-400">—</span>}
                                      </div>
                                      <div>
                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Permit 1</p>
                                        {String(firstProd.permit1).startsWith('http') ? (
                                          <a href={firstProd.permit1} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-blue-600 hover:text-blue-800 underline">
                                            {firstProd.permit1_end_date ? new Date(firstProd.permit1_end_date).toLocaleDateString("en-GB") : "View Document"}
                                          </a>
                                        ) : <span className="text-[10px] text-slate-400">—</span>}
                                      </div>
                                      <div>
                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Permit 2 (Out State)</p>
                                        {String(firstProd.permit2_out_state).startsWith('http') ? (
                                          <a href={firstProd.permit2_out_state} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-blue-600 hover:text-blue-800 underline">
                                            {firstProd.permit2_end_date ? new Date(firstProd.permit2_end_date).toLocaleDateString("en-GB") : "View Document"}
                                          </a>
                                        ) : <span className="text-[10px] text-slate-400">—</span>}
                                      </div>

                                      <div className="sm:col-span-2 md:col-span-4 h-px bg-slate-200 my-1" />

                                      {/* Weightment Info */}
                                      <div>
                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">RST No</p>
                                        {firstProd.weightment_slip_copy ? (
                                          <a href={firstProd.weightment_slip_copy} target="_blank" rel="noopener noreferrer" className="text-sm font-black text-blue-600 hover:text-blue-800 underline">
                                            #{firstProd.rstNo || "—"}
                                          </a>
                                        ) : (
                                          <p className="text-sm font-black text-slate-900">#{firstProd.rstNo || "—"}</p>
                                        )}
                                      </div>
                                      <div>
                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Gross / Tare / Net</p>
                                        <p className="text-xs font-black text-slate-900 leading-tight">
                                          {firstProd.grossWeight || "0"} / {firstProd.tareWeight || "0"} / <span className="text-blue-600 font-black">{((Number(firstProd.grossWeight || 0) - Number(firstProd.tareWeight || 0)) || "0").toString()}</span>
                                        </p>
                                      </div>
                                      <div>
                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Weight Diff</p>
                                        <p className="text-xs font-black text-amber-600">{firstProd.weightDiff || "0"}</p>
                                      </div>
                                      <div>
                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Extra Weight</p>
                                        <p className="text-xs font-black text-purple-600">{firstProd.extraWeight || "0"}</p>
                                      </div>
                                      <div>
                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Weight Diff Reason</p>
                                        <p className="text-[10px] font-bold text-red-500 italic">{firstProd.reasonForDiff || firstProd.reason_of_difference_in_weight_if_any_speacefic || "—"}</p>
                                      </div>
                                      <div>
                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Transporter Name</p>
                                        <p className="text-xs font-bold text-slate-700 break-words" title={firstProd.transporterName}>{firstProd.transporterName || "—"}</p>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Product List (Responsive) */}
                          <div className="px-3 sm:px-5 pb-5 pt-4 border-t border-slate-100">
                          <div className="border border-slate-200 rounded-xl sm:rounded-2xl overflow-x-auto shadow-sm bg-white">
                            <div className="hidden md:block overflow-x-auto">
                            <Table>
                              <TableHeader className="bg-slate-50">
                                <TableRow>
                                  <TableHead className="w-12 text-center h-10">
                                    <Checkbox
                                      checked={allSelected}
                                      onCheckedChange={(checked) => {
                                        if (checked) {
                                          setSelectedProducts(prev => Array.from(new Set([...prev, ...allProducts.map((p: any) => p._rowKey)])))
                                        } else {
                                          setSelectedProducts(prev => prev.filter(k => !allProducts.some((p: any) => p._rowKey === k)))
                                        }
                                      }}
                                    />
                                  </TableHead>
                                  <TableHead className="text-[10px] uppercase font-black h-10">PRODUCT INFO</TableHead>
                                  <TableHead className="text-[10px] uppercase font-black text-center h-10">WEIGHT(KGS)</TableHead>
                                  <TableHead className="text-[10px] uppercase font-black text-center h-10">ACTUAL QTY DISPATCH</TableHead>
                                  <TableHead className="text-[10px] uppercase font-black text-center h-10">RATE (INC. WITH TAXES)</TableHead>
                                  <TableHead className="text-[10px] uppercase font-black text-center h-10">RATE</TableHead>
                                  <TableHead className="text-[10px] uppercase font-black text-center h-10">TAXABLE AMOUNT</TableHead>
                                  <TableHead className="text-[10px] uppercase font-black text-center h-10">AMOUNT</TableHead>
                                  <TableHead className="text-[10px] uppercase font-black text-center h-10">INVOICE NO</TableHead>
                                  <TableHead className="text-[10px] uppercase font-black text-center h-10">INVOICE COPY</TableHead>
                                  <TableHead className="text-[10px] uppercase font-black text-center h-10">TRUCK NO</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {allProducts.map((product: any) => (
                                  <TableRow key={product._rowKey} className={cn(selectedProducts.includes(product._rowKey) ? "bg-blue-50/20" : "", "h-14")}>
                                    <TableCell className="text-center p-2">
                                      <Checkbox
                                        checked={selectedProducts.includes(product._rowKey)}
                                        onCheckedChange={() => {
                                          if (selectedProducts.includes(product._rowKey)) {
                                            setSelectedProducts(prev => prev.filter(k => k !== product._rowKey))
                                          } else {
                                            setSelectedProducts(prev => [...prev, product._rowKey])
                                          }
                                        }}
                                      />
                                    </TableCell>
                                    <TableCell className="p-2">
                                      <div className="flex flex-col">
                                        <span className="text-xs font-black text-slate-800 uppercase tracking-tight">{product.productName}</span>
                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{product.specificOrderNo}</span>
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-center p-2 text-xs font-bold text-slate-700">
                                      {product.netWeight || "—"}
                                    </TableCell>
                                    <TableCell className="text-center p-2">
                                      <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700 font-black text-xs px-3">
                                        {product.actualQty || "0"}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="text-center p-2 text-xs font-bold text-slate-700">
                                      {product.rate ? `₹${product.rate.toFixed(2)}` : "—"}
                                    </TableCell>
                                    <TableCell className="text-center p-2 text-xs font-bold text-slate-700">
                                      {product.rate ? `₹${(product.rate / 1.05).toFixed(2)}` : "—"}
                                    </TableCell>
                                    <TableCell className="text-center p-2 text-xs font-bold text-slate-700">
                                      {(() => { const t = parseFloat(((product.rate || 0) / 1.05).toFixed(2)) * (parseFloat(product.actualQty) || 0); return t ? `₹${t.toFixed(2)}` : "—"; })()}
                                    </TableCell>
                                    <TableCell className="text-center p-2 text-xs font-bold text-slate-700">
                                      {product.amount ? `₹${product.amount.toFixed(2)}` : "—"}
                                    </TableCell>
                                    <TableCell className="text-center p-2 text-xs font-bold text-green-700">
                                      {product.invoiceNo || "—"}
                                    </TableCell>
                                    <TableCell className="text-center p-2">
                                      {product.invoice_copy ? (
                                        <a href={product.invoice_copy} target="_blank" rel="noopener noreferrer" className="inline-block">
                                          <img src={product.invoice_copy} alt="Invoice" className="h-10 w-14 object-cover rounded border border-slate-200 hover:opacity-80 transition-opacity cursor-pointer mx-auto" onError={(e: any) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'inline'; }} />
                                          <span style={{ display: 'none' }} className="text-[10px] text-blue-600 underline font-bold">View Invoice</span>
                                        </a>
                                      ) : (
                                        <span className="text-[10px] text-slate-400 font-bold italic tracking-tighter">NO FILE</span>
                                      )}
                                    </TableCell>
                                    <TableCell className="text-center p-2 text-xs font-bold text-slate-700">
                                      {(product.truckNo || "—").toUpperCase()}
                                    </TableCell>
                                  </TableRow>
                                ))}

                                {/* Summary Footer Row */}
                                <TableRow className="bg-slate-50 font-black h-12 border-t-2 border-slate-200">
                                  <TableCell />
                                  <TableCell className="text-[10px] uppercase font-black text-slate-900">Total</TableCell>
                                  <TableCell />
                                  <TableCell className="text-center">
                                    <Badge className="bg-blue-600 text-white font-black text-xs px-3">
                                      {allProducts.reduce((sum: number, p: any) => sum + (parseFloat(p.actualQty) || 0), 0)}
                                    </Badge>
                                  </TableCell>
                                  <TableCell />
                                  <TableCell />
                                  <TableCell className="text-center text-xs text-blue-700 font-black">
                                    ₹{allProducts.reduce((sum: number, p: any) => sum + (parseFloat(((p.rate || 0) / 1.05).toFixed(2)) * (parseFloat(p.actualQty) || 0)), 0).toFixed(2)}
                                  </TableCell>
                                  <TableCell className="text-center text-xs text-blue-700 font-black">
                                    ₹{allProducts.reduce((sum: number, p: any) => sum + (parseFloat(p.amount) || 0), 0).toFixed(2)}
                                  </TableCell>
                                  <TableCell colSpan={3} />
                                </TableRow>
                              </TableBody>
                            </Table>
                            </div>

                            <div className="md:hidden divide-y divide-slate-100">
                              <div className="flex items-center justify-between gap-3 bg-slate-50 p-3">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Products</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Select All</span>
                                  <Checkbox
                                    checked={allSelected}
                                    onCheckedChange={(checked) => {
                                      if (checked) {
                                        setSelectedProducts(prev => Array.from(new Set([...prev, ...allProducts.map((p: any) => p._rowKey)])))
                                      } else {
                                        setSelectedProducts(prev => prev.filter(k => !allProducts.some((p: any) => p._rowKey === k)))
                                      }
                                    }}
                                  />
                                </div>
                              </div>
                              {allProducts.map((product: any) => (
                                <div key={product._rowKey} className={cn("p-4 space-y-3", selectedProducts.includes(product._rowKey) ? "bg-blue-50/30" : "bg-white")}>
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <p className="text-xs font-black text-slate-800 uppercase leading-tight break-words">{product.productName}</p>
                                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">#{product.specificOrderNo}</p>
                                    </div>
                                    <Checkbox
                                      checked={selectedProducts.includes(product._rowKey)}
                                      onCheckedChange={() => {
                                        if (selectedProducts.includes(product._rowKey)) {
                                          setSelectedProducts(prev => prev.filter(k => k !== product._rowKey))
                                        } else {
                                          setSelectedProducts(prev => [...prev, product._rowKey])
                                        }
                                      }}
                                      className="h-5 w-5"
                                    />
                                  </div>
                                  <div className="grid grid-cols-2 gap-3">
                                    <div className="rounded-md bg-slate-50 p-2">
                                      <p className="text-[10px] font-black uppercase text-slate-400">Weight(KGS)</p>
                                      <p className="mt-1 font-mono font-bold text-slate-700">{product.netWeight || "—"}</p>
                                    </div>
                                    <div className="rounded-md bg-slate-50 p-2">
                                      <p className="text-[10px] font-black uppercase text-slate-400">Actual Qty</p>
                                      <p className="mt-1 font-mono font-bold text-blue-700">{product.actualQty || "0"}</p>
                                    </div>
                                    <div className="rounded-md bg-slate-50 p-2">
                                      <p className="text-[10px] font-black uppercase text-slate-400">Rate (Inc. with taxes)</p>
                                      <p className="mt-1 font-mono font-bold text-slate-700">{product.rate ? `₹${product.rate.toFixed(2)}` : "—"}</p>
                                    </div>
                                    <div className="rounded-md bg-slate-50 p-2">
                                      <p className="text-[10px] font-black uppercase text-slate-400">Rate</p>
                                      <p className="mt-1 font-mono font-bold text-slate-700">{product.rate ? `₹${(product.rate / 1.05).toFixed(2)}` : "—"}</p>
                                    </div>
                                    <div className="rounded-md bg-slate-50 p-2">
                                      <p className="text-[10px] font-black uppercase text-slate-400">Total Taxable Amount</p>
                                      <p className="mt-1 font-mono font-bold text-slate-700">{(() => { const t = parseFloat(((product.rate || 0) / 1.05).toFixed(2)) * (parseFloat(product.actualQty) || 0); return t ? `₹${t.toFixed(2)}` : "—"; })()}</p>
                                    </div>
                                    <div className="rounded-md bg-slate-50 p-2">
                                      <p className="text-[10px] font-black uppercase text-slate-400">Amount</p>
                                      <p className="mt-1 font-mono font-black text-blue-700">{product.amount ? `₹${product.amount.toFixed(2)}` : "—"}</p>
                                    </div>
                                    <div className="rounded-md bg-slate-50 p-2">
                                      <p className="text-[10px] font-black uppercase text-slate-400">Truck No</p>
                                      <p className="mt-1 font-mono font-bold text-slate-700">{(product.truckNo || "—").toUpperCase()}</p>
                                    </div>
                                    <div className="col-span-2 rounded-md bg-slate-50 p-2">
                                      <p className="text-[10px] font-black uppercase text-slate-400">Invoice</p>
                                      <div className="mt-1 flex flex-wrap items-center gap-2">
                                        <span className="text-xs font-bold text-green-700">{product.invoiceNo || "—"}</span>
                                        {product.invoice_copy ? (
                                          <a href={product.invoice_copy} target="_blank" rel="noopener noreferrer" className="text-[10px] font-black text-blue-600 underline">
                                            View Invoice
                                          </a>
                                        ) : (
                                          <span className="text-[10px] text-slate-400 font-bold italic tracking-tighter">NO FILE</span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                              <div className="bg-slate-50 p-4">
                                <div className="grid grid-cols-2 gap-3 text-xs">
                                  <div>
                                    <p className="text-[9px] uppercase font-black text-slate-500">Total Qty</p>
                                    <Badge className="mt-1 bg-blue-600 text-white font-black text-xs px-3">
                                      {allProducts.reduce((sum: number, p: any) => sum + (parseFloat(p.actualQty) || 0), 0)}
                                    </Badge>
                                  </div>
                                  <div>
                                    <p className="text-[9px] uppercase font-black text-slate-500">Total Amount</p>
                                    <p className="mt-1 font-black text-blue-700">
                                      ₹{allProducts.reduce((sum: number, p: any) => sum + (parseFloat(p.amount) || 0), 0).toFixed(2)}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                          </div>
                    </div>
                  );
                })}

                {/* GST & Invoice Summary */}
                <InvoiceSummary
                  selectedGroups={selectedGroups}
                  selectedProducts={selectedProducts}
                />
              </div>
            )}

            {/* Gate Out Form (Bottom) */}
            <div className="mt-8 space-y-6 border rounded-lg p-4 sm:p-6 bg-white shadow-sm">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b pb-2">
                <CheckCircle className="h-4 w-4 text-blue-600" />
                Gate Pass & Evidence
              </h3>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
                <div className="space-y-2">
                  <Label>Upload Gate Pass <span className="text-red-500">*</span></Label>
                  <p className="text-[10px] text-slate-400">Max file size: 20 MB</p>
                  <div className="border-2 border-dashed rounded-lg p-4 text-center hover:bg-slate-50 transition-colors bg-blue-50/20">
                    <Input
                      type="file"
                      accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif,.pdf"
                      onChange={(e) => {
                        if (e.target.files?.[0]) {
                          handleFileUpload(e.target.files[0], 'gatePass')
                        }
                      }}
                      className="hidden"
                      id="gatepass-upload"
                    />
                    <label htmlFor="gatepass-upload" className="cursor-pointer block">
                      <Upload className="h-6 w-6 mx-auto mb-2 text-blue-600" />
                      <p className="text-xs font-bold text-slate-700 uppercase tracking-tight break-words">
                        {isUploading === 'gatePass' ? "UPLOADING..." : (gateOutData.gatePassFile ? `SELECTED: ${gateOutData.gatePassFileName}` : "Click to select gate pass")}
                      </p>
                    </label>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Upload Vehicle Loaded Image <span className="text-red-500">*</span></Label>
                  <p className="text-[10px] text-slate-400">Max file size: 20 MB</p>
                  <div className="border-2 border-dashed rounded-lg p-4 text-center hover:bg-slate-50 transition-colors bg-violet-50/20">
                    <Input
                      type="file"
                      accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif,.pdf"
                      onChange={(e) => {
                        if (e.target.files?.[0]) {
                          handleFileUpload(e.target.files[0], 'vehicleImage')
                        }
                      }}
                      className="hidden"
                      id="vehicle-loaded-upload"
                    />
                    <label htmlFor="vehicle-loaded-upload" className="cursor-pointer block">
                      <Upload className="h-6 w-6 mx-auto mb-2 text-violet-600" />
                      <p className="text-xs font-bold text-slate-700 uppercase tracking-tight break-words">
                        {isUploading === 'vehicleImage' ? "UPLOADING..." : (gateOutData.vehicleLoadedImage ? `SELECTED: ${gateOutData.vehicleLoadedImageName}` : "Click to select vehicle image")}
                      </p>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="mt-8 border-t pt-4 bg-gray-50 -mx-4 sm:-mx-6 -mb-4 sm:-mb-6 px-4 sm:px-6 py-4 flex flex-col sm:flex-row gap-3">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isProcessing} className="h-11 sm:h-10">
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isProcessing || isReadOnly}
                className="bg-blue-600 hover:bg-blue-700 min-w-37.5 h-11 sm:h-10"
              >
                {isProcessing ? "Processing..." : "Complete Gate Out"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </WorkflowStageShell>
  )
}
