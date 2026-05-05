"use client"

import { useEffect, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { WorkflowStageShell } from "@/components/workflow/workflow-stage-shell"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table"
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
  DialogDescription,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ALL_WORKFLOW_COLUMNS as ALL_COLUMNS } from "@/lib/workflow-columns"
import { confirmMaterialReceiptApi, orderApi } from "@/lib/api-service"
import { useAuth } from "@/hooks/use-auth"
import { useQuery } from "@tanstack/react-query"
import { Loader2, ChevronLeft, ChevronRight, Settings2, CheckCircle, Upload, FileText, ExternalLink, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { usePersistedColumns } from "@/hooks/use-persisted-columns"

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

export default function MaterialReceiptPage() {
  const router = useRouter()
  const { user, isReadOnly } = useAuth()
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending")
  const [pendingPage, setPendingPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const limit = 25;

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
    "material-receipt",
    ["partySoDate", "orderNo", "customerName", "invoiceNo", "status"]
  )

  // Selection & Dialog State
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [selectedGroup, setSelectedGroup] = useState<any>(null)
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  // Receipt Form State
  const [isUploading, setIsUploading] = useState<string | null>(null)
  const [receiptData, setReceiptData] = useState({
    receivedDate: "",
    hasDamage: "no",
    receivedProof: null as File | null,
    receivedProofName: "",
    remarks: "",
  })

  // Per-product damage data
  const [productDamageData, setProductDamageData] = useState<Record<string, {
    damageQty: string
    damageImage: File | null
    damageImageName: string
  }>>({})

  // Pending Receipts Query
  const {
    data: pendingData,
    isLoading: isPendingLoading,
    refetch: refetchPending,
  } = useQuery({
    queryKey: ["pending-material-receipt", filterValues.search, filterValues.partyName, user?.depo_access?.['Confirm Material Receipt'], pendingPage],
    queryFn: async () => {
      const response = await confirmMaterialReceiptApi.getPending({
        page: pendingPage,
        limit: limit,
        so_no: filterValues.search,
        party_name: filterValues.partyName === "all" ? undefined : filterValues.partyName,
        depo_names: user?.depo_access?.['Confirm Material Receipt'] || []
      });
      return response.success ? response.data : { orders: [], pagination: { total: 0 } };
    },
  });

  const pendingOrders = pendingData?.orders || [];

  // History Query
  const {
    data: historyData,
    isLoading: isHistoryLoading,
    refetch: refetchHistory,
  } = useQuery({
    queryKey: ["material-receipt-history", filterValues.search, filterValues.partyName, user?.depo_access?.[activeTab === "pending" ? 'Confirm Material Receipt' : 'Confirm Material Receipt'], historyPage],
    queryFn: async () => {
      const response = await confirmMaterialReceiptApi.getHistory({
        page: historyPage,
        limit: limit,
        so_no: filterValues.search,
        party_name: filterValues.partyName === "all" ? undefined : filterValues.partyName,
        depo_names: user?.depo_access ? (user.depo_access['Confirm Material Receipt'] || []) : undefined
      });
      return response.success ? response.data : { orders: [], pagination: { total: 0 } };
    },
    enabled: activeTab === "history",
  });

  const historyOrders = historyData?.orders || [];

  // Reset to page 1 on filter change
  useEffect(() => {
    setPendingPage(1);
    setHistoryPage(1);
  }, [filterValues.search, filterValues.partyName]);

  const handleFileUpload = (file: File, type: 'damage' | 'proof', rowKey?: string) => {
    if (!file) return;

    if (type === 'damage' && rowKey) {
      setProductDamageData(prev => ({
        ...prev,
        [rowKey]: {
          ...prev[rowKey],
          damageImage: file,
          damageImageName: file.name
        }
      }))
    } else if (type === 'proof') {
      setReceiptData(p => ({
        ...p,
        receivedProof: file,
        receivedProofName: file.name
      }));
    }
  };

  const uploadSelectedFile = async (file: File, type: 'damage' | 'proof', rowKey?: string) => {
    setIsUploading(rowKey ? `${type}-${rowKey}` : type);
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

  /* Grouping Logic */
  const displayRows = useMemo(() => {
    const grouped: { [key: string]: any } = {}

    pendingOrders.forEach((order: any) => {
      const invoiceNo = order.invoice_no || "No Invoice"
      const doNumber = order.so_no || order.d_sr_number || "DO/26-27/0001"
      const groupKey = invoiceNo !== "No Invoice" ? invoiceNo : doNumber;

      if (!grouped[groupKey]) {
        grouped[groupKey] = {
          _rowKey: groupKey,
          doNumber: doNumber,
          invoiceNo: invoiceNo,
          customerName: order.party_name || "—",
          deliveryPurpose: order.order_type_delivery_purpose || "—",
          orderType: order.order_type || "—",
          startDate: order.start_date,
          endDate: order.end_date,
          deliveryDate: order.delivery_date,
          transportType: order.type_of_transporting || "—",
          contactPerson: order.customer_contact_person_name || "—",
          contactWhatsapp: order.customer_contact_person_whatsapp_no || "—",
          customerAddress: order.customer_address || "—",
          totalAmount: order.total_amount_with_gst || "—",
          isBroker: order.is_order_through_broker || false,
          isOrderThrough: order.is_order_through || "—",
          brokerName: order.broker_name || "—",
          advanceAmount: order.advance_amount || 0,
          paymentTerms: order.payment_terms || "—",
          partySoDate: order.party_so_date,
          invoiceDate: order.invoice_date,
          biltyNo: order.bilty_no || "—",
          rstNo: order.rst_no || "—",
          weightmentSlip: order.weightment_slip_copy || null,
          grossWeight: order.gross_weight || "—",
          tareWeight: order.tare_weight || "—",
          netWeight: order.net_weight || "—",
          weightDiff: order.difference || order.weight_diff || "—",
          extraWeight: order.extra_weight || "—",
          vehicleNo: order.truck_no || "—",
          transporterName: order.transporter_name || "—",
          truckNo: order.truck_no || "—",
          vehicleType: order.vehicle_type || "—",
          rto: order.rto || "—",
          passingWeight: order.passing_weight || "—",
          roadTax: order.road_tax || "—",
          gvw: order.gvw || "—",
          ulw: order.ulw || "—",
          driverName: order.driver_name || "—",
          driverContact: order.driver_contact_no || "—",
          driverLicense: order.driving_license_no || "—",
          dlValidUpto: order.dl_valid_upto,
          diffReason: order.reason_of_difference_in_weight_if_any_speacefic || "—",
          uploadSo: order.upload_so || null,
          _allProducts: [],
          _productCount: 0
        }
      }

      const rate = parseFloat(order.rate_of_material) || 0;
      const nosPerMainUom = parseFloat(order.nos_per_main_uom) || 1;
      const actualQty = parseFloat(order.actual_qty_dispatch) || 0;
      const freightRate = parseFloat(order.freight_rate) || 0;
      const computedBillAmount = (rate * nosPerMainUom + freightRate) * actualQty;

      grouped[groupKey]._allProducts.push({
        ...order,
        _rowKey: `${groupKey}-${order.id}`,
        id: order.id,
        specificOrderNo: order.so_no,
        productName: order.product_name,
        invoiceNo: order.invoice_no,
        billAmount: computedBillAmount.toFixed(2),
        actualQty: order.actual_qty_dispatch,
        truckNo: order.truck_no,
        netWeight: order.net_weight,
        weightDiff: order.difference || 0,
        reason_of_difference_in_weight_if_any_speacefic: order.reason_of_difference_in_weight_if_any_speacefic,
        processid: order.processid || null
      })

      grouped[groupKey]._productCount = grouped[groupKey]._allProducts.length
    })

    return Object.values(grouped).map((g: any) => ({
      ...g,
      formattedPartySoDate: formatDate(g._allProducts[0]?.party_so_date),
      processId: g._allProducts[0]?.processid || "—",
      vehicleNo: (g._allProducts[0]?.truckNo || "—").toUpperCase(),
      orderPunchRemarks: g._allProducts[0]?.order_punch_remarks || "—",
      uploadSo: g._allProducts[0]?.upload_so || g._allProducts[0]?.uploadSo || null,
    }))
  }, [pendingOrders])

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

  const toggleSelectItem = (itemKey: string) => {
    setSelectedItems(prev =>
      prev.includes(itemKey)
        ? prev.filter(k => k !== itemKey)
        : [...prev, itemKey]
    )
  }

  const toggleSelectAll = () => {
    if (selectedItems.length === displayRows.length && displayRows.length > 0) {
      setSelectedItems([])
    } else {
      setSelectedItems(displayRows.map(r => r._rowKey))
    }
  }

  const handleOpenDialog = () => {
    if (selectedItems.length === 0) return
    const targetGroup = displayRows.find(r => r._rowKey === selectedItems[0])
    if (targetGroup) {
      setSelectedGroup(targetGroup)
      setSelectedProducts(targetGroup._allProducts.map((p: any) => p._rowKey))
      setReceiptData({
        receivedDate: "",
        hasDamage: "no",
        receivedProof: null,
        receivedProofName: "",
        remarks: "",
      })
      setProductDamageData({})
      setIsDialogOpen(true)
    }
  }

  const handleSubmit = async () => {
    if (!selectedGroup) return
    if (!receiptData.receivedDate) {
      toast({ title: "Validation Error", description: "Received Date is required.", variant: "destructive" })
      return
    }

    const productsToSubmit = selectedGroup._allProducts.filter((p: any) =>
      selectedProducts.includes(p._rowKey)
    )

    if (productsToSubmit.length === 0) {
      toast({ title: "Error", description: "Please select at least one product", variant: "destructive" })
      return
    }

    setIsProcessing(true)
    try {
      const successfulSubmissions: any[] = []
      const receivedProofUrl = receiptData.receivedProof
        ? await uploadSelectedFile(receiptData.receivedProof, 'proof')
        : null

      for (const product of productsToSubmit) {
        const pDamage = productDamageData[product._rowKey] || {};
        const isItemDamaged = receiptData.hasDamage === "yes" && (pDamage.damageQty || pDamage.damageImage);
        const damageImageUrl = isItemDamaged && pDamage.damageImage
          ? await uploadSelectedFile(pDamage.damageImage, 'damage', product._rowKey)
          : null

        const submitData = {
          material_received_date: receiptData.receivedDate,
          damage_status: isItemDamaged ? "Damaged" : "Delivered",
          received_image_proof: receivedProofUrl,
          sku: null,
          damage_qty: isItemDamaged ? pDamage.damageQty : null,
          damage_image: isItemDamaged ? damageImageUrl : null,
          remarks_3: receiptData.remarks || null,
          bill_amount: product.billAmount ? parseFloat(product.billAmount) : null,
          username: user?.username || null
        };

        const response = await confirmMaterialReceiptApi.submit(product.id, submitData);
        if (response.success) successfulSubmissions.push(product);
      }

      if (successfulSubmissions.length > 0) {
        toast({ title: "Receipt Confirmed", description: `Processed ${successfulSubmissions.length} items.` })
        await refetchPending();
        await refetchHistory();
        setIsDialogOpen(false)
        setSelectedItems([])
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Submit failed", variant: "destructive" })
    } finally {
      setIsProcessing(false)
    }
  }

  const customerNames = Array.from(new Set(pendingOrders.map((order: any) => order.party_name || "Unknown Customer"))) as string[]

  const totals = useMemo(() => {
    if (!selectedGroup) return { billAmt: 0, actualQty: 0, netWt: 0 }
    return selectedGroup._allProducts
      .filter((p: any) => selectedProducts.includes(p._rowKey))
      .reduce((acc: any, p: any) => ({
        billAmt: acc.billAmt + (parseFloat(p.billAmount) || 0),
        actualQty: acc.actualQty + (parseFloat(p.actualQty) || 0),
        netWt: acc.netWt + (parseFloat(p.netWeight) || 0)
      }), { billAmt: 0, actualQty: 0, netWt: 0 })
  }, [selectedGroup, selectedProducts])

  const dynamicColumns = visibleColumns.filter(
    (colId) => !["partySoDate", "doNumber", "processId", "customerName", "productCount", "vehicleNo", "orderPunchRemarks", "status", "invoiceNo"].includes(colId)
  )

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

  return (
    <WorkflowStageShell
      partyNames={customerNames}
      title="Stage 12: Confirm Material Receipt"
      description="Confirm material receipt and report any damages."
      searchPlaceholder="Search DO Number, Customer, Invoice No..."
      pendingCount={pendingData?.pagination?.total || 0}
      historyData={historyOrders.map((order: any) => ({
        ...order,
        date: order.actual_8 ? formatDate(order.actual_8) : "-",
        orderNo: order.so_no,
        stage: "Material Receipt",
        customerName: order.party_name || "—",
        status: order.damage_status || "Completed",
        remarks: order.damage_status === "Damaged" ? `Damaged: ${order.damage_qty}` : "Received OK",
        rawData: order,
      }))}
      onFilterChange={setFilterValues}
      showStatusFilter={true}
      stageLevel={9}
      onTabChange={setActiveTab}
      isHistoryLoading={isHistoryLoading}
      showDateFilters={false}
      historyFooter={
        <div className="px-3 sm:px-6 py-4 border-t bg-slate-50/50 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between font-bold">
          <div className="text-[10px] sm:text-xs text-slate-400 uppercase tracking-widest leading-none text-center sm:text-left">
            Showing Page <span className="text-slate-900 mx-1">{historyPage}</span>
            {historyData?.pagination?.total && (
              <> of <span className="text-slate-900 mx-1">{Math.ceil(historyData.pagination.total / limit)}</span></>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
            <Button variant="outline" size="sm" onClick={() => setHistoryPage(p => Math.max(1, p - 1))} disabled={historyPage === 1 || isHistoryLoading} className="h-8 rounded-lg gap-1 px-3">
              <ChevronLeft className="h-4 w-4" /> Previous
            </Button>
            <Button variant="outline" size="sm" onClick={() => setHistoryPage(p => p + 1)} disabled={isHistoryLoading || (historyPage * limit >= (historyData?.pagination?.total || 0))} className="h-8 rounded-lg gap-1 px-3">
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-2 sm:flex sm:justify-end">
          {selectedItems.length > 0 && (
            <Button 
              onClick={handleOpenDialog} 
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 font-bold shadow-lg shadow-blue-200"
              title={isReadOnly ? "View Receipt Details" : "Confirm Receipt"}
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              Confirm Receipt ({selectedItems.length})
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="w-full sm:w-auto bg-transparent border-slate-200 text-slate-600">
                <Settings2 className="mr-2 h-4 w-4" />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[250px] max-h-[400px] overflow-y-auto">
              <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {ALL_COLUMNS.map((col) => (
                <DropdownMenuCheckboxItem key={col.id} className="capitalize" checked={visibleColumns.includes(col.id)} onCheckedChange={(checked) => setVisibleColumns((prev) => (checked ? [...prev, col.id] : prev.filter((id) => id !== col.id)))}>
                  {col.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="md:hidden space-y-3">
          {isPendingLoading ? (
            [...Array(4)].map((_, i) => (
              <Card key={i} className="p-4 rounded-2xl border border-slate-100 shadow-sm bg-white">
                <div className="space-y-3 opacity-50">
                  <div className="flex items-center justify-between">
                    <div className="h-4 w-4 bg-slate-200 animate-pulse rounded" />
                    <div className="h-5 w-24 bg-slate-200 animate-pulse rounded-full" />
                  </div>
                  <div className="h-4 w-36 bg-slate-200 animate-pulse rounded-full" />
                  <div className="grid grid-cols-2 gap-3">
                    <div className="h-3 w-full bg-slate-200 animate-pulse rounded-full" />
                    <div className="h-3 w-full bg-slate-200 animate-pulse rounded-full" />
                  </div>
                </div>
              </Card>
            ))
          ) : displayRows.length > 0 ? (
            displayRows.map((group) => (
              <Card key={group._rowKey} className={cn("p-4 rounded-2xl border shadow-sm bg-white transition-colors", selectedItems.includes(group._rowKey) ? "border-blue-200 bg-blue-50/40" : "border-slate-100")}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">DO Number</p>
                    <p className="break-words text-sm font-black text-slate-900">{group.doNumber.replace(/[A-Za-z]+$/, '')}</p>
                  </div>
                  <Checkbox checked={selectedItems.includes(group._rowKey)} onCheckedChange={() => toggleSelectItem(group._rowKey)} />
                </div>
                <div className="mt-3 min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Customer</p>
                  <p className="break-words text-xs font-black uppercase italic text-slate-800">{group.customerName}</p>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">DO Date</p>
                    <p className="font-bold text-slate-600">{group.formattedPartySoDate}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Process ID</p>
                    <p className="break-words font-black text-blue-600">{group.processId}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Vehicle</p>
                    <p className="break-words font-black text-slate-700">{group.vehicleNo}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Invoice</p>
                    {group._allProducts?.[0]?.invoice_copy ? (
                      <a href={group._allProducts[0].invoice_copy} target="_blank" rel="noopener noreferrer" className="break-words font-black text-blue-600 hover:underline">
                        {group.invoiceNo}
                      </a>
                    ) : (
                      <p className="break-words font-black text-blue-800">{group.invoiceNo}</p>
                    )}
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Badge className="bg-slate-100 text-slate-600 font-black text-[10px] uppercase border-none ring-1 ring-inset ring-slate-200">{group._productCount} items</Badge>
                  <Badge className="bg-cyan-100 text-cyan-700 font-black text-[9px] uppercase tracking-widest px-3 py-1 ring-1 ring-inset ring-cyan-200">In Transit</Badge>
                </div>
                <div className="mt-3 min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Order Punch Remarks</p>
                  <p className="break-words text-xs font-bold text-slate-500">{group.orderPunchRemarks}</p>
                </div>
                {dynamicColumns.length > 0 && (
                  <div className="mt-3 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-xs">
                    {dynamicColumns.map((colId) => {
                      const col = ALL_COLUMNS.find((c) => c.id === colId)
                      if (!col) return null
                      return (
                        <div key={colId} className="min-w-0">
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{col.label}</p>
                          <p className="break-words font-bold text-slate-700">{String(getDynamicColumnValue(group, colId))}</p>
                        </div>
                      )
                    })}
                  </div>
                )}
              </Card>
            ))
          ) : (
            <Card className="p-10 text-center rounded-2xl border border-slate-100 bg-white text-slate-400 font-black uppercase text-[10px] tracking-[0.2em]">
              No orders pending for receipt confirmation
            </Card>
          )}
          <Card className="border border-slate-100 rounded-2xl bg-white">
            <div className="px-3 py-4 flex flex-col gap-3 font-bold">
              <div className="text-[10px] text-slate-400 uppercase tracking-widest leading-none text-center">
                Showing Page <span className="text-slate-900 mx-1">{pendingPage}</span>
                {pendingData?.pagination?.total && (
                  <> of <span className="text-slate-900 mx-1">{Math.ceil(pendingData.pagination.total / limit)}</span></>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" onClick={() => setPendingPage(p => Math.max(1, p - 1))} disabled={pendingPage === 1 || isPendingLoading} className="h-8 rounded-lg gap-1 px-3 border-slate-200 font-black uppercase text-[10px]">
                  <ChevronLeft className="h-4 w-4" /> Previous
                </Button>
                <Button variant="outline" size="sm" onClick={() => setPendingPage(p => p + 1)} disabled={isPendingLoading || (pendingPage * limit >= (pendingData?.pagination?.total || 0))} className="h-8 rounded-lg gap-1 px-3 border-slate-200 font-black uppercase text-[10px]">
                  Next <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        </div>

        <Card className="hidden md:block border-none shadow-xl rounded-[2rem] overflow-hidden bg-white/50 backdrop-blur-sm">
          <Table>
            <TableHeader className="bg-slate-50 sticky top-0 z-10">
              <TableRow>
                <TableHead className="w-12 text-center">
                  <Checkbox checked={displayRows.length > 0 && selectedItems.length === displayRows.length} onCheckedChange={toggleSelectAll} />
                </TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-center cursor-pointer select-none hover:text-blue-600 transition-colors" onClick={() => handlePendingSort("partySoDate")}>DO Date<PendingSortIcon field="partySoDate" /></TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-center cursor-pointer select-none hover:text-blue-600 transition-colors" onClick={() => handlePendingSort("doNumber")}>DO Number<PendingSortIcon field="doNumber" /></TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-center cursor-pointer select-none hover:text-blue-600 transition-colors" onClick={() => handlePendingSort("processId")}>Process ID<PendingSortIcon field="processId" /></TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-center cursor-pointer select-none hover:text-blue-600 transition-colors" onClick={() => handlePendingSort("customerName")}>Customer Name<PendingSortIcon field="customerName" /></TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Products</TableHead>
                {visibleColumns.includes("invoiceNo") && <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-center cursor-pointer select-none hover:text-blue-600 transition-colors" onClick={() => handlePendingSort("invoiceNo")}>Invoice No.<PendingSortIcon field="invoiceNo" /></TableHead>}
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-center cursor-pointer select-none hover:text-blue-600 transition-colors" onClick={() => handlePendingSort("vehicleNo")}>Vehicle No.<PendingSortIcon field="vehicleNo" /></TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-center cursor-pointer select-none hover:text-blue-600 transition-colors" onClick={() => handlePendingSort("orderPunchRemarks")}>Order Punch Remarks<PendingSortIcon field="orderPunchRemarks" /></TableHead>
                {dynamicColumns.map((colId) => {
                  const col = ALL_COLUMNS.find((c) => c.id === colId)
                  if (!col) return null
                  return (
                    <TableHead key={colId} className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-center cursor-pointer select-none hover:text-blue-600 transition-colors" onClick={() => handlePendingSort(colId)}>
                      {col.label}<PendingSortIcon field={colId} />
                    </TableHead>
                  )
                })}
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isPendingLoading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i} className="opacity-40 border-b border-slate-50">
                    <TableCell className="text-center py-4"><div className="h-4 w-4 bg-slate-200 animate-pulse rounded mx-auto" /></TableCell>
                    <TableCell className="text-center p-4"><div className="h-3 w-20 bg-slate-200 animate-pulse rounded-full mx-auto" /></TableCell>
                    <TableCell className="text-center p-4"><div className="h-3 w-24 bg-slate-200 animate-pulse rounded-full mx-auto" /></TableCell>
                    <TableCell className="text-center p-4"><div className="h-3 w-16 bg-slate-200 animate-pulse rounded-full mx-auto" /></TableCell>
                    <TableCell className="text-center p-4"><div className="h-3 w-40 bg-slate-200 animate-pulse rounded-full mx-auto" /></TableCell>
                    <TableCell className="text-center p-4"><div className="h-3 w-16 bg-slate-200 animate-pulse rounded-full mx-auto" /></TableCell>
                    <TableCell className="text-center p-4"><div className="h-3 w-24 bg-slate-200 animate-pulse rounded-full mx-auto" /></TableCell>
                    <TableCell className="text-center p-4"><div className="h-3 w-24 bg-slate-200 animate-pulse rounded-full mx-auto" /></TableCell>
                    <TableCell className="text-center p-4"><div className="h-3 w-40 bg-slate-200 animate-pulse rounded-full mx-auto" /></TableCell>
                    <TableCell className="text-center p-4"><div className="h-5 w-24 bg-slate-200 animate-pulse rounded-full mx-auto" /></TableCell>
                  </TableRow>
                ))
              ) : sortedDisplayRows.length > 0 ? (
                sortedDisplayRows.map((group) => (
                  <TableRow key={group._rowKey} className={cn("hover:bg-blue-50/30 transition-colors", selectedItems.includes(group._rowKey) ? "bg-blue-50/50" : "")}>
                    <TableCell className="text-center p-4">
                      <Checkbox checked={selectedItems.includes(group._rowKey)} onCheckedChange={() => toggleSelectItem(group._rowKey)} />
                    </TableCell>
                    <TableCell className="text-center text-xs font-bold text-slate-600">{group.formattedPartySoDate}</TableCell>
                    <TableCell className="text-center text-xs font-black text-slate-900 leading-none">{group.doNumber.replace(/[A-Za-z]+$/, '')}</TableCell>
                    <TableCell className="text-center text-xs font-black text-blue-600 leading-none">{group.processId}</TableCell>
                    <TableCell className="text-center text-xs font-black text-slate-800 uppercase italic tracking-tighter">{group.customerName}</TableCell>
                    <TableCell className="text-center">
                      <Badge className="bg-slate-100 text-slate-600 font-black text-[10px] uppercase border-none ring-1 ring-inset ring-slate-200">{group._productCount} items</Badge>
                    </TableCell>
                    {visibleColumns.includes("invoiceNo") && (
                      <TableCell className="text-center text-xs font-black text-blue-800">
                        {group._allProducts?.[0]?.invoice_copy ? (
                          <a href={group._allProducts[0].invoice_copy} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-bold">
                            {group.invoiceNo}
                          </a>
                        ) : (
                          group.invoiceNo
                        )}
                      </TableCell>
                    )}
                    <TableCell className="text-center"><span className="text-xs font-black text-slate-700 tracking-tighter">{group.vehicleNo}</span></TableCell>
                    <TableCell className="text-center"><span className="text-xs text-slate-500 font-bold truncate max-w-[150px] block mx-auto">{group.orderPunchRemarks}</span></TableCell>
                    {dynamicColumns.map((colId) => (
                      <TableCell key={colId} className="text-center text-xs font-medium text-slate-700">
                        {String(getDynamicColumnValue(group, colId))}
                      </TableCell>
                    ))}
                    <TableCell className="text-center">
                      <Badge className="bg-cyan-100 text-cyan-700 font-black text-[9px] uppercase tracking-widest px-3 py-1 ring-1 ring-inset ring-cyan-200">In Transit</Badge>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={10 + dynamicColumns.length} className="text-center py-20 text-slate-400 font-black uppercase text-[10px] tracking-[0.3em] bg-slate-50/50">
                    No orders pending for receipt confirmation
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
            <TableFooter className="bg-slate-50/80 border-t border-slate-100">
              <TableRow>
                <TableCell colSpan={10} className="p-0">
                  <div className="px-3 sm:px-6 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between font-bold">
                    <div className="text-[10px] sm:text-xs text-slate-400 uppercase tracking-widest leading-none text-center sm:text-left">
                      Showing Page <span className="text-slate-900 mx-1">{pendingPage}</span>
                      {pendingData?.pagination?.total && (
                        <> of <span className="text-slate-900 mx-1">{Math.ceil(pendingData.pagination.total / limit)}</span></>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
                      <Button variant="outline" size="sm" onClick={() => setPendingPage(p => Math.max(1, p - 1))} disabled={pendingPage === 1 || isPendingLoading} className="h-8 rounded-lg gap-1 px-3 border-slate-200 font-black uppercase text-[10px]">
                        <ChevronLeft className="h-4 w-4" /> Previous
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setPendingPage(p => p + 1)} disabled={isPendingLoading || (pendingPage * limit >= (pendingData?.pagination?.total || 0))} className="h-8 rounded-lg gap-1 px-3 border-slate-200 font-black uppercase text-[10px]">
                        Next <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </Card>

        {/* Restore Previous Design Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="w-[calc(100vw-0.75rem)] max-w-[calc(100vw-0.75rem)] sm:max-w-[95vw] max-h-[95vh] overflow-x-hidden overflow-y-auto p-0 border-none rounded-2xl sm:rounded-[2.5rem] shadow-2xl bg-slate-50 [overflow-wrap:anywhere]">
            <div className="p-3 sm:p-8 space-y-6 sm:space-y-8">
              <DialogHeader className="border-b-2 border-slate-100 pb-4 sm:pb-6 -mx-3 sm:-mx-8 px-3 sm:px-8 bg-white rounded-t-2xl sm:rounded-t-[2.5rem]">
                <DialogTitle className="text-base sm:text-2xl font-black text-slate-900 tracking-tight flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <span>Confirm Receipt - Invoice: <span className="text-blue-600 italic uppercase">{selectedGroup?.invoiceNo}</span></span>
                  <span className="w-fit text-[10px] sm:text-sm font-black text-slate-300 uppercase tracking-widest sm:ml-4 ring-2 ring-slate-100 px-3 sm:px-4 py-1.5 rounded-full italic">[{selectedGroup?.customerName}]</span>
                </DialogTitle>
                <DialogDescription className="hidden" />
              </DialogHeader>

              {selectedGroup && (
                <div className="space-y-8 sm:space-y-10 animate-in fade-in zoom-in-95 duration-500">
                  {/* Section 1: Order & Logistics Details */}
                  <div className="space-y-6">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-6 w-1.5 bg-blue-600 rounded-full shadow-sm" />
                      <h3 className="min-w-0 text-xs sm:text-sm font-black uppercase tracking-[0.14em] sm:tracking-[0.2em] text-blue-900">Order & Logistics Details</h3>
                    </div>

                    <Card className="p-4 sm:p-8 border-none shadow-xl rounded-2xl sm:rounded-[2rem] bg-white grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 lg:gap-x-12 gap-y-5 sm:gap-y-8">
                      {[
                        { label: "Delivery Purpose", value: selectedGroup.deliveryPurpose },
                        { label: "Order Type", value: selectedGroup.orderType },
                        { label: "Start Date", value: formatDate(selectedGroup.startDate) },
                        { label: "End Date", value: formatDate(selectedGroup.endDate) },
                        { label: "Delivery Date", value: formatDate(selectedGroup.deliveryDate) },
                        { label: "Transport Type", value: selectedGroup.transportType, color: "text-magenta-600" },
                        { label: "Contact Person", value: `${selectedGroup.contactPerson} — (${selectedGroup.contactWhatsapp})` },
                        { label: "Customer Address", value: selectedGroup.customerAddress },
                        { label: "Start / End Date", value: `${formatDate(selectedGroup.startDate)} / ${formatDate(selectedGroup.endDate)}`, color: "text-blue-600" },
                        { label: "DO Date", value: formatDate(selectedGroup.partySoDate), color: "text-blue-600" },
                        { label: "Broker / Advance", value: `${(selectedGroup.isOrderThrough === "Direct" || (selectedGroup.isOrderThrough === "—" && !selectedGroup.isBroker)) ? "No" : selectedGroup.brokerName} / ₹${selectedGroup.advanceAmount}`, color: "text-blue-600" },
                        { label: "Invoice No / Date", value: `${selectedGroup.invoiceNo} / ${formatDate(selectedGroup.invoiceDate)}`, color: "text-blue-600" },
                        { label: "Bilty No", value: selectedGroup.biltyNo },
                        { label: "Truck No", value: selectedGroup.truckNo, color: "text-blue-600" },
                        { label: "Transporter", value: selectedGroup.transporterName },
                        { label: "Vehicle Type", value: selectedGroup.vehicleType },
                        { label: "RTO", value: selectedGroup.rto },
                        { label: "Passing Weight", value: selectedGroup.passingWeight },
                        { label: "Road Tax", value: selectedGroup.roadTax },
                        { label: "GVW", value: selectedGroup.gvw },
                        { label: "ULW", value: selectedGroup.ulw },
                        { label: "Driver Name", value: selectedGroup.driverName },
                        { label: "Driver Contact", value: selectedGroup.driverContact },
                        { label: "License No", value: selectedGroup.driverLicense },
                        { label: "DL Valid Upto", value: formatDate(selectedGroup.dlValidUpto) },
                        { label: "RST No", value: `#${selectedGroup.rstNo}`, color: "text-blue-600" },
                        { label: "Gross / Tare / Net", value: `${selectedGroup.grossWeight} / ${selectedGroup.tareWeight} / ${selectedGroup.netWeight}`, color: "text-[#3b82f6]" },
                        { label: "Weight Diff", value: selectedGroup.weightDiff, color: "text-orange-500" },
                        { label: "Extra Weight", value: selectedGroup.extraWeight, color: "text-[#d946ef]" },
                        { label: "Order Punch Remarks", value: selectedGroup.orderPunchRemarks, color: "text-amber-600 italic" },
                      ].map((item, idx) => (
                        <div key={idx} className="space-y-1.5 min-w-0">
                          <Label className="text-[10px] font-black uppercase text-slate-300 tracking-[0.1em] block leading-none">{item.label}</Label>
                          <p className={cn("break-words text-xs font-black tracking-tight leading-snug", item.color || "text-slate-800")}>{item.value || "—"}</p>
                        </div>
                      ))}
                      <div className="space-y-1.5 sm:col-span-2 min-w-0">
                        <Label className="text-[10px] font-black uppercase text-slate-300 tracking-[0.1em] block leading-none">PO Copy (SO Upload)</Label>
                        {selectedGroup.uploadSo ? (
                          <a 
                            href={selectedGroup.uploadSo} 
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
                    </Card>
                  </div>

                  {/* Section 2: Products */}
                  <div className="space-y-6">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-6 w-1.5 bg-blue-600 rounded-full shadow-sm" />
                      <h3 className="min-w-0 text-xs sm:text-sm font-black uppercase tracking-[0.14em] sm:tracking-[0.2em] text-blue-900">Products ({selectedProducts.length}/{selectedGroup._allProducts.length} selected)</h3>
                    </div>

                    <Card className="border-none shadow-xl rounded-2xl sm:rounded-[2rem] overflow-hidden bg-white">
                      <div className="md:hidden p-3 space-y-3">
                        <div className="flex items-center justify-between gap-3 rounded-xl bg-blue-600 px-3 py-3 text-white">
                          <span className="text-[10px] font-black uppercase tracking-widest">Select All</span>
                          <Checkbox
                            className="border-white/50 data-[state=checked]:bg-white data-[state=checked]:text-blue-600"
                            checked={selectedProducts.length === selectedGroup._allProducts.length}
                            onCheckedChange={(checked) => setSelectedProducts(checked ? selectedGroup._allProducts.map((p: any) => p._rowKey) : [])}
                          />
                        </div>
                        {selectedGroup._allProducts.map((product: any) => (
                          <Card key={product._rowKey} className={cn("p-4 rounded-2xl border shadow-sm", selectedProducts.includes(product._rowKey) ? "border-blue-200 bg-blue-50/40" : "border-slate-100 bg-white")}>
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Product</p>
                                <p className="break-words text-xs font-black uppercase tracking-tighter text-slate-800">{product.productName}</p>
                              </div>
                              <Checkbox
                                className="data-[state=checked]:bg-blue-600"
                                checked={selectedProducts.includes(product._rowKey)}
                                onCheckedChange={(checked) => setSelectedProducts(p => checked ? [...p, product._rowKey] : p.filter(k => k !== product._rowKey))}
                              />
                            </div>
                            <div className="mt-4 grid grid-cols-2 gap-3">
                              <div className="min-w-0">
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Order No</p>
                                <p className="break-words text-xs font-black text-slate-500">{product.specificOrderNo}</p>
                              </div>
                              <div className="min-w-0">
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Invoice</p>
                                <p className="break-words text-xs font-black italic text-blue-600">{product.invoiceNo}</p>
                              </div>
                              <div className="min-w-0">
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Bill Amt</p>
                                <p className="text-xs font-black text-slate-700">₹{product.billAmount}</p>
                              </div>
                              <div className="min-w-0">
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Actual Qty</p>
                                <p className="text-xs font-black text-slate-700">{product.actualQty}</p>
                              </div>
                              <div className="min-w-0">
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Truck No</p>
                                <p className="break-words text-xs font-black text-slate-500">{product.truckNo}</p>
                              </div>
                              <div className="min-w-0">
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Net Wt</p>
                                <p className="text-xs font-black text-slate-700">{product.netWeight}</p>
                              </div>
                            </div>
                            {receiptData.hasDamage === "yes" && (
                              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div className="space-y-1.5">
                                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Damage Qty</Label>
                                  <Input
                                    className="h-10 text-[11px] font-black border-2 border-slate-100 rounded-lg focus:border-blue-300 w-full transition-all"
                                    type="number"
                                    placeholder="0"
                                    value={productDamageData[product._rowKey]?.damageQty || ""}
                                    onChange={(e) => setProductDamageData(prev => ({ ...prev, [product._rowKey]: { ...prev[product._rowKey], damageQty: e.target.value } }))}
                                  />
                                </div>
                                <div className="space-y-1.5">
                                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Image</Label>
                                  <label title="Max file size: 20 MB" className="cursor-pointer inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors ring-1 ring-inset ring-slate-100">
                                    <Input
                                      type="file"
                                      accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif"
                                      className="hidden"
                                      onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'damage', product._rowKey)}
                                    />
                                    {isUploading === `damage-${product._rowKey}` ? <Loader2 className="h-4 w-4 animate-spin text-blue-600" /> : (productDamageData[product._rowKey]?.damageImage ? <CheckCircle className="h-4 w-4 text-green-500" /> : <Upload className="h-4 w-4 text-slate-400" />)}
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{productDamageData[product._rowKey]?.damageImage ? "Selected" : "Select"}</span>
                                  </label>
                                </div>
                              </div>
                            )}
                          </Card>
                        ))}
                        <div className="rounded-2xl bg-slate-50 p-4">
                          <div className="grid grid-cols-3 gap-3 text-center">
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Bill</p>
                              <p className="break-words text-xs font-black text-blue-700">₹{totals.billAmt.toFixed(2)}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Qty</p>
                              <p className="text-xs font-black text-slate-700">{totals.actualQty}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Net Wt</p>
                              <p className="text-xs font-black text-slate-700">{totals.netWt.toFixed(2)}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                      <Table className="hidden md:table">
                        <TableHeader className="bg-blue-600">
                          <TableRow className="hover:bg-blue-600 border-none">
                            <TableHead className="w-12 text-center h-12">
                              <Checkbox
                                className="border-white/50 data-[state=checked]:bg-white data-[state=checked]:text-blue-600"
                                checked={selectedProducts.length === selectedGroup._allProducts.length}
                                onCheckedChange={(checked) => setSelectedProducts(checked ? selectedGroup._allProducts.map((p: any) => p._rowKey) : [])}
                              />
                            </TableHead>
                            <TableHead className="text-[10px] font-black uppercase text-blue-50 tracking-widest h-12">Order No</TableHead>
                            <TableHead className="text-[10px] font-black uppercase text-blue-50 tracking-widest h-12">Product Name</TableHead>
                            <TableHead className="text-[10px] font-black uppercase text-blue-50 tracking-widest h-12">Invoice No</TableHead>
                            <TableHead className="text-[10px] font-black uppercase text-blue-50 tracking-widest h-12 text-center">Bill Amt</TableHead>
                            <TableHead className="text-[10px] font-black uppercase text-blue-50 tracking-widest h-12 text-center">Actual Qty</TableHead>
                            <TableHead className="text-[10px] font-black uppercase text-blue-50 tracking-widest h-12 text-center">Truck No</TableHead>
                            <TableHead className="text-[10px] font-black uppercase text-blue-50 tracking-widest h-12 text-center">Net Wt</TableHead>
                            {receiptData.hasDamage === "yes" && (
                              <>
                                <TableHead className="text-[10px] font-black uppercase text-blue-50 tracking-widest h-12 text-center">Damage Qty</TableHead>
                                <TableHead className="text-[10px] font-black uppercase text-blue-50 tracking-widest h-12 text-center">Image</TableHead>
                              </>
                            )}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedGroup._allProducts.map((product: any) => (
                            <TableRow key={product._rowKey} className={cn("h-14 transition-colors", selectedProducts.includes(product._rowKey) ? "bg-blue-50/40" : "")}>
                              <TableCell className="text-center">
                                <Checkbox
                                  className="data-[state=checked]:bg-blue-600"
                                  checked={selectedProducts.includes(product._rowKey)}
                                  onCheckedChange={(checked) => setSelectedProducts(p => checked ? [...p, product._rowKey] : p.filter(k => k !== product._rowKey))}
                                />
                              </TableCell>
                              <TableCell className="text-xs font-black text-slate-500 uppercase tracking-tighter">{product.specificOrderNo}</TableCell>
                              <TableCell className="text-xs font-black text-slate-800 uppercase tracking-tighter">{product.productName}</TableCell>
                              <TableCell className="text-xs font-black text-blue-600 italic tracking-tighter">{product.invoiceNo}</TableCell>
                              <TableCell className="text-center font-black text-xs text-slate-700">₹{product.billAmount}</TableCell>
                              <TableCell className="text-center font-black text-xs text-slate-700">{product.actualQty}</TableCell>
                              <TableCell className="text-center font-black text-xs text-slate-500">{product.truckNo}</TableCell>
                              <TableCell className="text-center font-black text-xs text-slate-700">{product.netWeight}</TableCell>
                              {receiptData.hasDamage === "yes" && (
                                <>
                                  <TableCell className="px-2">
                                    <Input
                                      className="h-8 text-[11px] font-black border-2 border-slate-100 rounded-lg focus:border-blue-300 w-20 mx-auto transition-all"
                                      type="number"
                                      placeholder="0"
                                      value={productDamageData[product._rowKey]?.damageQty || ""}
                                      onChange={(e) => setProductDamageData(prev => ({ ...prev, [product._rowKey]: { ...prev[product._rowKey], damageQty: e.target.value } }))}
                                    />
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <label title="Max file size: 20 MB" className="cursor-pointer inline-flex items-center justify-center p-2 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors ring-1 ring-inset ring-slate-100">
                                      <Input
                                        type="file"
                                        accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif"
                                        className="hidden"
                                        onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'damage', product._rowKey)}
                                      />
                                      {isUploading === `damage-${product._rowKey}` ? <Loader2 className="h-4 w-4 animate-spin text-blue-600" /> : (productDamageData[product._rowKey]?.damageImage ? <CheckCircle className="h-4 w-4 text-green-500" /> : <Upload className="h-4 w-4 text-slate-400" />)}
                                    </label>
                                  </TableCell>
                                </>
                              )}
                            </TableRow>
                          ))}
                        </TableBody>
                        <TableFooter className="bg-slate-50/50">
                          <TableRow className="h-14 font-black text-xs border-none">
                            <TableCell colSpan={4} className="text-right uppercase tracking-[0.2em] text-slate-400 px-8">Total</TableCell>
                            <TableCell className="text-center text-blue-700 underline underline-offset-4 decoration-2">₹{totals.billAmt.toFixed(2)}</TableCell>
                            <TableCell className="text-center"><Badge className="bg-blue-600 text-white font-black px-4 py-1.5 rounded-full shadow-lg shadow-blue-100">{totals.actualQty}</Badge></TableCell>
                            <TableCell />
                            <TableCell className="text-center text-slate-600">{totals.netWt.toFixed(2)}</TableCell>
                            {receiptData.hasDamage === "yes" && <TableCell colSpan={2} />}
                          </TableRow>
                        </TableFooter>
                      </Table>
                    </Card>
                  </div>

                  {/* Section 3: Receipt Details */}
                  <div className="space-y-6">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-6 w-1.5 bg-blue-600 rounded-full shadow-sm" />
                      <h3 className="min-w-0 text-xs sm:text-sm font-black uppercase tracking-[0.14em] sm:tracking-[0.2em] text-blue-900">Receipt Details</h3>
                    </div>

                    <Card className="p-4 sm:p-10 border-none shadow-xl rounded-2xl sm:rounded-[2rem] bg-white grid grid-cols-1 md:grid-cols-2 gap-x-10 lg:gap-x-20 gap-y-6 sm:gap-y-12 relative overflow-hidden">
                      <div className="space-y-4">
                        <Label className="text-[10px] font-black uppercase text-slate-300 tracking-[0.2em] ml-1">Material Received Date <span className="text-red-500">*</span></Label>
                        <Input
                          type="date"
                          className="h-12 sm:h-16 border-2 border-slate-50 bg-slate-50/30 rounded-2xl px-4 sm:px-8 font-black text-slate-700 text-sm sm:text-lg focus:bg-white focus:border-blue-100 transition-all shadow-inner"
                          value={receiptData.receivedDate}
                          onChange={(e) => setReceiptData({ ...receiptData, receivedDate: e.target.value })}
                        />
                      </div>

                      <div className="space-y-4">
                        <Label className="text-[10px] font-black uppercase text-slate-300 tracking-[0.2em] ml-1">Damage Status</Label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 sm:h-16">
                          <Button
                            onClick={() => setReceiptData({ ...receiptData, hasDamage: 'no' })}
                            className={cn("h-12 sm:h-full border-2 rounded-2xl font-black uppercase italic tracking-tighter transition-all duration-300",
                              receiptData.hasDamage === 'no' ? "bg-white border-green-500 text-green-500 shadow-xl shadow-green-50" : "bg-slate-50 border-slate-50 text-slate-400 hover:bg-white hover:border-slate-100"
                            )}
                            variant="outline"
                          >
                            <CheckCircle className="mr-2 h-4 w-4" /> No Damage
                          </Button>
                          <Button
                            onClick={() => setReceiptData({ ...receiptData, hasDamage: 'yes' })}
                            className={cn("h-12 sm:h-full border-2 rounded-2xl font-black uppercase italic tracking-tighter transition-all duration-300",
                              receiptData.hasDamage === 'yes' ? "bg-white border-red-500 text-red-500 shadow-xl shadow-red-50" : "bg-slate-50 border-slate-50 text-slate-400 hover:bg-white hover:border-slate-100"
                            )}
                            variant="outline"
                          >
                            <FileText className="mr-2 h-4 w-4" /> Has Damage
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <Label className="text-[10px] font-black uppercase text-slate-300 tracking-[0.2em] ml-1">Received Image (Proof)</Label>
                        <p className="text-[10px] text-slate-400 ml-1">Max file size: 20 MB</p>
                        <Card className={cn("border-2 border-dashed rounded-2xl sm:rounded-3xl p-4 sm:p-8 bg-slate-50/50 hover:bg-slate-50 transition-all cursor-pointer group flex flex-col items-center justify-center min-h-[140px] sm:min-h-[160px]",
                          receiptData.receivedProof ? "border-green-200" : "border-slate-200"
                        )}>
                          <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer">
                            <Input type="file" accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif" className="hidden" onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'proof')} />
                            <div className="bg-white p-4 rounded-2xl shadow-lg ring-1 ring-slate-100 mb-4 group-hover:scale-110 transition-transform">
                              <Upload className="h-6 w-6 text-blue-600" />
                            </div>
                            <span className="max-w-full break-words text-center text-[10px] uppercase font-black tracking-widest text-slate-400 group-hover:text-blue-600 transition-colors">
                              {isUploading === 'proof' ? "UPLOADING MATERIAL PROOF..." : (receiptData.receivedProof ? `SELECTED: ${receiptData.receivedProofName}` : "Click to Select Proof")}
                            </span>
                          </label>
                        </Card>
                      </div>

                      <div className="space-y-4">
                        <Label className="text-[10px] font-black uppercase text-slate-300 tracking-[0.2em] ml-1">Remarks</Label>
                        <Textarea
                          className="bg-slate-50/30 border-2 border-slate-50 rounded-2xl sm:rounded-3xl p-4 sm:p-6 font-bold text-slate-700 placeholder:text-slate-200 focus:bg-white focus:border-blue-100 transition-all h-[140px] sm:h-[160px] resize-none shadow-inner shadow-slate-100"
                          placeholder="Enter remarks..."
                          value={receiptData.remarks}
                          onChange={(e) => setReceiptData({ ...receiptData, remarks: e.target.value })}
                        />
                      </div>
                    </Card>
                  </div>
                </div>
              )}

              <DialogFooter className="mt-8 sm:mt-12 pt-5 sm:pt-8 border-t-2 border-slate-100 -mx-3 sm:-mx-8 px-3 sm:px-12 bg-white rounded-b-2xl sm:rounded-b-[2.5rem]">
                <div className="grid w-full grid-cols-1 gap-3 sm:flex sm:items-center sm:justify-between">
                  <Button variant="ghost" onClick={() => setIsDialogOpen(false)} className="h-12 sm:h-14 w-full sm:w-auto px-6 sm:px-10 font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-2xl">Cancel</Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={isProcessing || isReadOnly || !receiptData.receivedDate}
                    className={cn("h-12 sm:h-16 w-full sm:w-auto px-6 sm:px-16 rounded-2xl shadow-2xl text-sm sm:text-xl font-black italic tracking-tighter uppercase transition-all duration-500",
                      receiptData.hasDamage === 'yes' ? "bg-red-600 hover:bg-red-700 shadow-red-100" : "bg-blue-600 hover:bg-blue-700 shadow-blue-100"
                    )}
                  >
                    {isProcessing ? <Loader2 className="mr-2 sm:mr-3 h-5 w-5 sm:h-6 sm:w-6 animate-spin" /> : <CheckCircle className="mr-2 sm:mr-3 h-5 w-5 sm:h-6 sm:w-6" />}
                    Confirm Receipt
                  </Button>
                </div>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </WorkflowStageShell>
  )
}
