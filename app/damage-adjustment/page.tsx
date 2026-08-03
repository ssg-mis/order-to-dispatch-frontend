"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
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
import { FileUploadField } from "@/components/file-upload-field"
import { Upload, CheckCircle, Settings2, FileText, IndianRupee, ExternalLink, ArrowUpDown, ArrowUp, ArrowDown, ChevronUp, ChevronDown } from "lucide-react"
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { WORKFLOW_STAGE_COLUMNS as ALL_COLUMNS } from "@/lib/workflow-columns"
import { ColumnToggleContent } from "@/components/ui/column-toggle-content"
import { damageAdjustmentApi, orderApi } from "@/lib/api-service"
import { useAuth } from "@/hooks/use-auth"
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query"
import { StageHistoryTab } from "@/components/workflow/stage-history-tab"
import { useInView } from "react-intersection-observer"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
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

export default function DamageAdjustmentPage() {
  const queryClient = useQueryClient()
  const router = useRouter()
  const { toast } = useToast()
  const { isReadOnly, user, isAdmin, isFeatureEnabled } = useAuth()
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending")
  const { ref: pendingEndRef, inView: pendingInView } = useInView()

  const [filterValues, setFilterValues] = useState({
    status: "",
    startDate: "",
    endDate: "",
    partyName: "",
    search: "",
    manualSaudaNo: ""
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
    "damage-adjustment",
    ["partySoDate", "orderNo", "customerName", "invoiceNo", "status", "products"]
  )
  const DMG_STD_IDS = ["partySoDate", "orderNo", "processid", "customerName", "invoiceNo", "vehicleNo", "orderPunchRemarks", "status", "products"]
  const [columnOrder, setColumnOrder] = useColumnOrder("damage-adjustment", DMG_STD_IDS)
  const ALWAYS_VISIBLE_DMG = new Set<string>([])
  const orderedVisibleStd = columnOrder.filter(id => ALWAYS_VISIBLE_DMG.has(id) || visibleColumns.includes(id))
  const handleColumnReorder = useCallback((newVisibleOrder: string[]) => {
    const coreInNewOrder = newVisibleOrder.filter(id => DMG_STD_IDS.includes(id))
    const hiddenCols = columnOrder.filter(id => !coreInNewOrder.includes(id))
    setColumnOrder([...coreInNewOrder, ...hiddenCols])
  }, [columnOrder, setColumnOrder])

  // Selection & Dialog State
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [selectedGroup, setSelectedGroup] = useState<any>(null)
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false)

  // Adjustment Form State
  const [isUploading, setIsUploading] = useState<boolean>(false)
  const [adjustmentData, setAdjustmentData] = useState({
    creditNoteDate: "",
    creditNoteNo: "",
    creditNoteCopy: null as File | null,
    creditNoteCopyName: "",
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
    queryKey: ["damage-adjustment-pending", filterValues],
    queryFn: async ({ pageParam = 1 }) => {
      const response = await damageAdjustmentApi.getPending({
        page: pageParam,
        limit: 20,
        search: filterValues.search,
        manual_sauda_no: filterValues.manualSaudaNo,
        do_date_from: filterValues.startDate,
        do_date_to: filterValues.endDate,
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

  const pendingOrders = useMemo(() => {
    return pendingData?.pages.flatMap((page) => page.orders) || [];
  }, [pendingData]);

  useEffect(() => {
    if (pendingInView && hasNextPending) {
      fetchNextPending();
    }
  }, [pendingInView, hasNextPending, fetchNextPending]);

  const handleFileUpload = (file: File) => {
    if (!file) return;

    setAdjustmentData(p => ({
      ...p,
      creditNoteCopy: file,
      creditNoteCopyName: file.name
    }));
  };

  const uploadSelectedFile = async (file: File) => {
    setIsUploading(true);
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
      setIsUploading(false);
    }
  };


  /* Filter Logic */

  // Search, Manual Sauda No., DO Date range and Party Name are applied
  // server-side (see getPending/getHistory params), so no client-side filtering here.
  const filteredPendingOrders = pendingOrders

  /* Grouping Logic */
  const displayRows = useMemo(() => {
    const grouped: { [key: string]: any } = {}

    filteredPendingOrders.forEach((order: any) => {
      // Group by Invoice Number
      const invoiceNo = order.invoice_no || "No Invoice"
      const doNumber = order.so_no || order.d_sr_number || "DO/26-27/0001"
      // Group by Base DO (e.g. DO/26-27/0001 from DO/26-27/0001A)
      const baseDoMatch = doNumber.match(/^(DO[-\/](?:\d{2}-\d{2}\/)?\d+)/i)
      const baseDo = baseDoMatch ? baseDoMatch[1].toUpperCase() : doNumber

      if (!grouped[invoiceNo]) {
        grouped[invoiceNo] = {
          _rowKey: invoiceNo,
          doNumber: doNumber,
          invoiceNo: invoiceNo,
          customerName: (order.transfer === 'yes' && order.bill_company_name) ? order.bill_company_name : (order.party_name || "—"),

          // Order Details from JOIN
          deliveryPurpose: order.order_type_delivery_purpose || "—",
          orderType: order.order_type || "—",
          startDate: order.start_date ? new Date(order.start_date).toLocaleDateString("en-IN") : "—",
          endDate: order.end_date ? new Date(order.end_date).toLocaleDateString("en-IN") : "—",
          deliveryDate: order.delivery_date ? new Date(order.delivery_date).toLocaleDateString("en-IN") : "—",
          transportType: order.type_of_transporting || "—",
          contactPerson: order.customer_contact_person_name || "—",
          contactWhatsapp: order.customer_contact_person_whatsapp_no || "—",
          customerAddress: order.customer_address || "—",
          isBroker: order.is_order_through_broker || false,
          isOrderThrough: order.is_order_through || "—",
          brokerName: order.broker_name || "—",
          advanceAmount: order.advance_amount || 0,
          paymentTerms: order.payment_terms || "—",
          partySoDate: order.party_so_date ? new Date(order.party_so_date).toLocaleDateString("en-IN") : "—",
          partyCredit: order.party_credit_status || "—",

          // Additional Details for Header (as requested)
          invoiceDate: order.invoice_date ? new Date(order.invoice_date).toLocaleDateString("en-IN") : "—",
          biltyNo: order.bilty_no || "—",
          rstNo: order.rst_no || "—",
          weightmentSlip: order.weightment_slip_copy || null,
          grossWeight: order.gross_weight || "—",
          tareWeight: order.tare_weight || "—",
          netWeight: order.net_weight || "—",
          difference: order.difference,
          weightDiff: order.difference || order.weight_diff || "—",
          extraWeight: order.extra_weight || "—",
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

      grouped[invoiceNo]._allProducts.push({
        ...order,
        _rowKey: `${invoiceNo}-${order.id}`,
        id: order.id,
        specificOrderNo: order.so_no,
        productName: order.product_name,
        invoiceNo: order.invoice_no,
        billAmount: order.bill_amount,
        actualQty: order.actual_qty_dispatch,
        truckNo: order.truck_no,
        netWeight: order.net_weight,

        // Damage Info
        damageQty: order.damage_qty,
        damageStatus: order.damage_status,
        damageSku: order.sku,
        damageImage: order.damage_image,
        difference: order.difference,
        weightDiff: order.difference || 0,
        reason_of_difference_in_weight_if_any_speacefic: order.reason_of_difference_in_weight_if_any_speacefic,
        processid: order.processid || null
      })

      grouped[invoiceNo]._productCount = grouped[invoiceNo]._allProducts.length
    })

    return Object.values(grouped).map(g => ({
      ...g,
      partySoDate: formatDate(g._allProducts[0]?.party_so_date),
      processid: g._allProducts[0]?.processid || "—",
      processId: g._allProducts[0]?.processid || "—", // Keep processId for safety
      orderNo: g.doNumber,
      vehicleNo: (g._allProducts[0]?.truckNo || "—").toUpperCase(),
      orderPunchRemarks: g._allProducts[0]?.order_punch_remarks || "—",
      uploadSo: g._allProducts[0]?.upload_so || g._allProducts[0]?.uploadSo || null,
    }))
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

  const FIXED_COLUMN_IDS = ["partySoDate", "orderNo", "processid", "customerName", "vehicleNo", "orderPunchRemarks", "status", "invoiceNo", "products"]

  // Sorts displayRows by any field key — dynamic columns are automatically sortable
  const getSortValue = (group: any, field: string) => {
    if (field === "status") {
      return "Pending Adjustment"
    }
    if (field === "products") {
      return group._productCount || 0
    }
    if (field === "orderNo") {
      return group.doNumber || ""
    }
    if (field === "processid") {
      return group.processId || ""
    }
    
    let val;
    if (FIXED_COLUMN_IDS.includes(field)) {
      val = group[field]
    } else {
      val = getDynamicColumnValue(group, field)
    }

    if (val === undefined || val === null || val === "—" || val === "") return ""
    
    if (typeof val === "number") return val
    if (["rate", "qty", "amount", "total", "ratePerLtr", "ratePer15Kg", "orderQty", "altQty", "totalWithGst", "advanceAmount"].some(k => field.toLowerCase().includes(k))) {
      const num = parseFloat(String(val).replace(/[^0-9.-]/g, ""))
      return isNaN(num) ? -Infinity : num
    }
    return String(val).toLowerCase()
  }

  const sortedDisplayRows = useMemo(() => {
    if (!pendingSortField || displayRows.length === 0) return displayRows
    return [...displayRows].sort((a, b) => {
      const aVal = getSortValue(a, pendingSortField)
      const bVal = getSortValue(b, pendingSortField)
      if (typeof aVal === "number" && typeof bVal === "number") {
        return pendingSortDir === "asc" ? aVal - bVal : bVal - aVal
      }
      const aStr = String(aVal)
      const bStr = String(bVal)
      if (aStr < bStr) return pendingSortDir === "asc" ? -1 : 1
      if (aStr > bStr) return pendingSortDir === "asc" ? 1 : -1
      return 0
    })
  }, [displayRows, pendingSortField, pendingSortDir])

  const dynamicColumns = visibleColumns.filter((colId) => !FIXED_COLUMN_IDS.includes(colId))

  function getDynamicColumnValue(group: any, colId: string) {
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

    // Open for the first selected group
    const targetGroup = displayRows.find(r => r._rowKey === selectedItems[0])
    if (targetGroup) {
      setSelectedGroup(targetGroup)
      setSelectedProducts(targetGroup._allProducts.map((p: any) => p._rowKey)) // Select all by default

      // Reset form
      setAdjustmentData({
        creditNoteDate: "",
        creditNoteNo: "",
        creditNoteCopy: null,
        creditNoteCopyName: "",
      })

      setIsDetailsExpanded(false)
      setIsDialogOpen(true)
    }
  }

  const handleSubmit = async () => {
    if (!selectedGroup) return

    // Validation: Require Credit Note Details generally, though backend might allow slightly less.
    // Let's enforce basic credit note details if quantities are involved.
    if (!adjustmentData.creditNoteDate || !adjustmentData.creditNoteNo) {
      toast({ title: "Validation Error", description: "Credit Note details are required.", variant: "destructive" })
      return
    }

    // Numeric Validation - Removed since quantity/amount/balance fields were removed

    const productsToSubmit = selectedGroup._allProducts.filter((p: any) =>
      selectedProducts.includes(p._rowKey)
    )

    if (productsToSubmit.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one product",
        variant: "destructive"
      })
      return
    }

    setIsProcessing(true)
    try {
      const successfulSubmissions: any[] = []
      const failedSubmissions: any[] = []
      const creditNoteCopyUrl = adjustmentData.creditNoteCopy
        ? await uploadSelectedFile(adjustmentData.creditNoteCopy)
        : null

      for (const product of productsToSubmit) {
        const submitData = {
          credit_note_date: adjustmentData.creditNoteDate,
          credit_note_no: adjustmentData.creditNoteNo,
          credit_note_qty: parseFloat(product.damageQty) || 0,
          credit_note_amount: 0,
          net_banalce: 0,
          status_2: "Completed",
          credit_note_copy: creditNoteCopyUrl,
          user_id: user?.id || null // Track acting user's login id
        };

        try {
          console.log(`[Damage-Adjustment] Submitting for ID ${product.id}`, submitData);
          const response = await damageAdjustmentApi.submit(product.id, submitData);

          if (response.success) {
            successfulSubmissions.push(product);
          } else {
            failedSubmissions.push({ product, error: response.message });
          }
        } catch (err: any) {
          console.error(`[Damage-Adjustment] Failed for ID ${product.id}`, err);
          failedSubmissions.push({ product, error: err.message });
        }
      }

      if (successfulSubmissions.length > 0) {
        toast({
          title: "Adjustment Processed",
          description: `Successfully processed ${successfulSubmissions.length} items.`,
        })

        await refetchPending();
        queryClient.invalidateQueries({ queryKey: ["damage-adjustment-history"] });

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



  const customerNames = Array.from(new Set(pendingOrders.map(order => (order.transfer === 'yes' && order.bill_company_name) ? order.bill_company_name : (order.party_name || "Unknown Customer"))))

  return (
    <WorkflowStageShell
      partyNames={customerNames}
      title="Stage 13: Damage Adjustment"
      description="Process credit notes and adjustments for damaged goods."
      pendingCount={displayRows.length}
      historyData={[]}
      onFilterChange={setFilterValues}
      showStatusFilter={true}
      stageLevel={10}
      onTabChange={setActiveTab}
      showDateFilters={true}
      showSaudaFilter={true}
      dateLabel="DO Date"
      searchPlaceholder="Search DO Number..."
      historyContent={
        <StageHistoryTab
          queryKeyPrefix="damage-adjustment-history"
          getHistoryApi={(params: any) => damageAdjustmentApi.getHistory({
            page: params.page,
            limit: params.limit,
            search: params.order_no,
            manual_sauda_no: filterValues.manualSaudaNo || undefined,
            do_date_from: params.start_date,
            do_date_to: params.end_date,
            party_name: params.customer_name,
          })}
          filterValues={filterValues}
          activeTab={activeTab}
          stageName="Damage Adjustment"
          stageLevel={10}
          remarksColName="Remarks"
          orderListKey="orders"
          mapOrderNo={(order: any) => order.so_no || "-"}
          mapCustomerName={(order: any) => (order.transfer === 'yes' && order.bill_company_name) ? order.bill_company_name : order.party_name}
          mapRemarks={(order: any) => order.credit_note_no ? `CN: ${order.credit_note_no}` : "-"}
          getDate={(order: any) => order.actual_9 || order.timestamp || null}
        />
      }
    >
      <div className="space-y-4">
        {/* Action Bar */}
        <div className="grid grid-cols-1 gap-2 sm:flex sm:justify-end">
          <Button
            onClick={handleOpenDialog}
            disabled={selectedItems.length === 0}
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700"
          >
            <CheckCircle className="mr-2 h-4 w-4" />
            Process Adjustment ({selectedItems.length})
          </Button>

          {(isAdmin || isFeatureEnabled('can_toggle_columns')) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="w-full sm:w-auto bg-transparent">
                  <Settings2 className="mr-2 h-4 w-4" />
                  Columns
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[250px]" collisionPadding={16}>
                <ColumnToggleContent columns={ALL_COLUMNS} visibleColumns={visibleColumns} setVisibleColumns={setVisibleColumns} />
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden space-y-3">
          {isPendingLoading && pendingOrders.length === 0 ? (
            [...Array(4)].map((_, i) => (
              <Card key={i} className="p-4 rounded-2xl border border-slate-100 bg-white shadow-sm">
                <div className="space-y-3 opacity-50">
                  <div className="flex items-center justify-between">
                    <div className="h-4 w-4 rounded bg-slate-200 animate-pulse" />
                    <div className="h-5 w-28 rounded-full bg-slate-200 animate-pulse" />
                  </div>
                  <div className="h-4 w-40 rounded-full bg-slate-200 animate-pulse" />
                  <div className="grid grid-cols-2 gap-3">
                    <div className="h-3 rounded-full bg-slate-200 animate-pulse" />
                    <div className="h-3 rounded-full bg-slate-200 animate-pulse" />
                  </div>
                </div>
              </Card>
            ))
          ) : displayRows.length > 0 ? (
            displayRows.map((group) => (
              <Card key={group._rowKey} className={cn("p-4 rounded-2xl border bg-white shadow-sm", selectedItems.includes(group._rowKey) ? "border-blue-200 bg-blue-50/40" : "border-slate-100")}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    {visibleColumns.includes("orderNo") && (
                      <>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">DO Number</p>
                        <p className="break-words text-sm font-black text-slate-900">{group.doNumber}</p>
                      </>
                    )}
                  </div>
                  <Checkbox checked={selectedItems.includes(group._rowKey)} onCheckedChange={() => toggleSelectItem(group._rowKey)} />
                </div>

                {visibleColumns.includes("customerName") && (
                  <div className="mt-3 min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Customer</p>
                    <p className="break-words text-xs font-bold text-slate-700">{group.customerName}</p>
                  </div>
                )}

                <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                  {visibleColumns.includes("partySoDate") && (
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">DO Date</p>
                      <p className="font-medium text-slate-700">{group.partySoDate}</p>
                    </div>
                  )}
                  {visibleColumns.includes("processid") && (
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Manual Sauda No.</p>
                      <p className="break-words font-medium text-slate-700">{group.processId}</p>
                    </div>
                  )}
                  {visibleColumns.includes("invoiceNo") && (
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Invoice</p>
                      {group._allProducts?.[0]?.invoice_copy ? (
                        <a href={group._allProducts[0].invoice_copy} target="_blank" rel="noopener noreferrer" className="break-words font-bold text-blue-600 hover:underline">
                          {group.invoiceNo}
                        </a>
                      ) : (
                        <p className="break-words font-medium text-slate-700">{group.invoiceNo}</p>
                      )}
                    </div>
                  )}
                  {visibleColumns.includes("vehicleNo") && (
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Vehicle</p>
                      <p className="break-words font-bold text-slate-700">{group.vehicleNo}</p>
                    </div>
                  )}
                </div>

                {dynamicColumns.length > 0 && (
                  <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-xs">
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

                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge variant="secondary">{group._productCount} items</Badge>
                  <Badge className="bg-red-100 text-red-700">{group._allProducts.filter((p: any) => p.damageStatus === "Damaged").length} damaged</Badge>
                  {visibleColumns.includes("status") && (
                    <Badge className="bg-red-100 text-red-700">Pending Adjustment</Badge>
                  )}
                </div>

                {visibleColumns.includes("orderPunchRemarks") && (
                  <div className="mt-3 min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Order Punch Remarks</p>
                    <p className="break-words text-xs font-medium text-slate-600">{group.orderPunchRemarks}</p>
                  </div>
                )}
              </Card>
            ))
          ) : (
            <Card className="p-10 text-center rounded-2xl border border-slate-100 bg-white text-muted-foreground">
              No pending damage adjustments
            </Card>
          )}
          <div ref={pendingEndRef} className="py-2 flex justify-center">
            {isFetchingNextPending && (
              <div className="flex items-center gap-2 text-blue-600 font-bold animate-pulse text-[10px]">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>LOADING MORE...</span>
              </div>
            )}
          </div>
        </div>

        {/* Main Table (Grouped) */}
        <Card className="hidden md:block border-none shadow-sm overflow-auto max-h-[600px]">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-card shadow-sm">
              <TableRow>
                <TableHead className="w-12 text-center">
                  <Checkbox checked={displayRows.length > 0 && selectedItems.length === displayRows.length} onCheckedChange={toggleSelectAll} />
                </TableHead>
                <ColumnDragProvider columnIds={[...orderedVisibleStd, ...dynamicColumns]} onReorder={handleColumnReorder} disabled={!isAdmin && !isFeatureEnabled('can_reorder_columns')}>
                  {orderedVisibleStd.map(id => {
                    const cls = "whitespace-nowrap text-center cursor-pointer select-none hover:text-blue-600 transition-colors"
                    if (id === "partySoDate") return <SortableTableHead key={id} id={id} className={cls} onClick={() => handlePendingSort("partySoDate")}>DO Date<PendingSortIcon field="partySoDate" /></SortableTableHead>
                    if (id === "orderNo") return <SortableTableHead key={id} id={id} className={cls} onClick={() => handlePendingSort("orderNo")}>DO Number<PendingSortIcon field="orderNo" /></SortableTableHead>
                    if (id === "processid") return <SortableTableHead key={id} id={id} className={cls} onClick={() => handlePendingSort("processid")}>Manual Sauda No.<PendingSortIcon field="processid" /></SortableTableHead>
                    if (id === "customerName") return <SortableTableHead key={id} id={id} className={cls} onClick={() => handlePendingSort("customerName")}>Customer Name<PendingSortIcon field="customerName" /></SortableTableHead>
                    if (id === "invoiceNo") return <SortableTableHead key={id} id={id} className={cls} onClick={() => handlePendingSort("invoiceNo")}>Invoice No.<PendingSortIcon field="invoiceNo" /></SortableTableHead>
                    if (id === "vehicleNo") return <SortableTableHead key={id} id={id} className={cls} onClick={() => handlePendingSort("vehicleNo")}>Vehicle No.<PendingSortIcon field="vehicleNo" /></SortableTableHead>
                    if (id === "orderPunchRemarks") return <SortableTableHead key={id} id={id} className={cls} onClick={() => handlePendingSort("orderPunchRemarks")}>Order Punch Remarks<PendingSortIcon field="orderPunchRemarks" /></SortableTableHead>
                    if (id === "status") return <SortableTableHead key={id} id={id} className="whitespace-nowrap text-center">Status</SortableTableHead>
                    if (id === "products") return <SortableTableHead key={id} id={id} className="whitespace-nowrap text-center">Items</SortableTableHead>
                    return null
                  })}
                  {dynamicColumns.map((colId) => {
                    const col = ALL_COLUMNS.find((c) => c.id === colId)
                    if (!col) return null
                    return (
                      <SortableTableHead key={colId} id={colId} className="whitespace-nowrap text-center cursor-pointer select-none hover:text-blue-600 transition-colors" onClick={() => handlePendingSort(colId)}>
                        {col.label}<PendingSortIcon field={colId} />
                      </SortableTableHead>
                    )
                  })}
                </ColumnDragProvider>
                <TableHead className="whitespace-nowrap text-center">Damage Info</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isPendingLoading && pendingOrders.length === 0 ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i} className="opacity-40 border-b border-slate-50">
                    <TableCell className="text-center py-4"><div className="h-4 w-4 bg-slate-200 animate-pulse rounded mx-auto" /></TableCell>
                    {orderedVisibleStd.map(id => (
                      <TableCell key={id} className="text-center py-4">
                        <div className={cn("h-3 bg-slate-200 animate-pulse rounded-full mx-auto", id === "status" ? "h-5 w-24" : id === "products" ? "w-16" : id === "customerName" ? "w-40" : id === "orderPunchRemarks" ? "w-32" : id === "orderNo" || id === "invoiceNo" || id === "vehicleNo" ? "w-24" : "w-20")} />
                      </TableCell>
                    ))}
                    {dynamicColumns.map((colId) => (
                      <TableCell key={colId} className="text-center py-4"><div className="h-3 w-24 bg-slate-200 animate-pulse rounded-full mx-auto" /></TableCell>
                    ))}
                    <TableCell className="text-center py-4"><div className="h-3 w-24 bg-slate-200 animate-pulse rounded-full mx-auto" /></TableCell>
                  </TableRow>
                ))
              ) : displayRows.length > 0 ? (
                sortedDisplayRows.map((group) => (
                  <TableRow key={group._rowKey} className={selectedItems.includes(group._rowKey) ? "bg-blue-50/50" : ""}>
                    <TableCell className="text-center">
                      <Checkbox checked={selectedItems.includes(group._rowKey)} onCheckedChange={() => toggleSelectItem(group._rowKey)} />
                    </TableCell>
                    {orderedVisibleStd.map(id => {
                      if (id === "partySoDate") return <TableCell key={id} className="text-center text-xs font-medium">{group.partySoDate}</TableCell>
                      if (id === "orderNo") return <TableCell key={id} className="text-center text-xs font-medium">{group.doNumber}</TableCell>
                      if (id === "processid") return <TableCell key={id} className="text-center text-xs font-medium">{group.processId}</TableCell>
                      if (id === "customerName") return <TableCell key={id} className="text-center text-xs">{group.customerName}</TableCell>
                      if (id === "invoiceNo") return (
                        <TableCell key={id} className="text-center text-xs font-medium">
                          {group._allProducts?.[0]?.invoice_copy ? (
                            <a href={group._allProducts[0].invoice_copy} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-bold">{group.invoiceNo}</a>
                          ) : group.invoiceNo}
                        </TableCell>
                      )
                      if (id === "vehicleNo") return <TableCell key={id} className="text-center"><span className="text-xs font-bold text-slate-700">{group.vehicleNo}</span></TableCell>
                      if (id === "orderPunchRemarks") return <TableCell key={id} className="text-center"><span className="text-xs text-slate-600 font-medium">{group.orderPunchRemarks}</span></TableCell>
                      if (id === "status") return <TableCell key={id} className="text-center"><Badge className="bg-red-100 text-red-700">Pending Adjustment</Badge></TableCell>
                      if (id === "products") return (
                        <TableCell key={id} className="text-center">
                          <Badge variant="secondary">{group._productCount} items</Badge>
                        </TableCell>
                      )
                      return null
                    })}
                    {dynamicColumns.map((colId) => (
                      <TableCell key={colId} className="text-center text-xs font-medium text-slate-700">
                        {String(getDynamicColumnValue(group, colId))}
                      </TableCell>
                    ))}
                    <TableCell className="text-center">
                      <div className="text-xs text-red-600 font-medium">
                        {group._allProducts.filter((p: any) => p.damageStatus === "Damaged").length} damaged items
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={2 + orderedVisibleStd.length + dynamicColumns.length}
                    className="text-center py-8 text-muted-foreground"
                  >
                    No pending damage adjustments
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
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
        <DialogContent className="w-[calc(100vw-0.75rem)] max-w-[calc(100vw-0.75rem)] sm:max-w-[95vw] max-h-[95vh] overflow-x-hidden overflow-y-auto p-0 border-none rounded-2xl sm:rounded-[2.5rem] shadow-2xl bg-slate-50 [overflow-wrap:anywhere]">
          <div className="p-3 sm:p-8 space-y-6 sm:space-y-8">
            <DialogHeader className="border-b-2 border-slate-100 pb-4 sm:pb-6 -mx-3 sm:-mx-8 px-3 sm:px-8 bg-white rounded-t-2xl sm:rounded-t-[2.5rem]">
              <DialogTitle className="text-base sm:text-2xl font-black text-slate-900 tracking-tight flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <span>Damage Adjustment - Invoice: <span className="text-blue-600 italic uppercase">{selectedGroup?.invoiceNo}</span></span>
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

                  <div className="border-2 border-slate-100 rounded-xl sm:rounded-3xl overflow-hidden bg-white shadow-sm min-w-0">
                    <div 
                      className="bg-blue-600 px-3 sm:px-5 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between cursor-pointer" 
                      onClick={() => setIsDetailsExpanded(prev => !prev)}
                    >
                      <div className="min-w-0 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                        <Badge className="max-w-full bg-white text-blue-800 hover:bg-white px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-black tracking-tight rounded-full shadow-sm uppercase whitespace-normal break-words">
                          DETAILS FOR INVOICE {selectedGroup.invoiceNo}
                        </Badge>
                        <div className="flex flex-col">
                          <span className="text-xs text-blue-100 font-bold leading-none">
                            Logistics, Vehicle & Driver Information
                          </span>
                        </div>
                      </div>
                      <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-start">
                        <div className="text-[10px] sm:text-[11px] text-blue-50 font-bold uppercase tracking-widest sm:mr-2 leading-none cursor-pointer">
                          {isDetailsExpanded ? 'HIDE DETAILS ▲' : 'SHOW DETAILS ▼'}
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/20 rounded-full">
                          {isDetailsExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                        </Button>
                      </div>
                    </div>

                    {isDetailsExpanded && (
                      <div className="px-3 sm:px-5 pb-5 pt-4 space-y-6 bg-slate-50 border-t border-slate-100 animate-in slide-in-from-top-2 duration-300">
                        <Card className="p-4 sm:p-8 border-none shadow-xl rounded-2xl sm:rounded-[2rem] bg-white grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 lg:gap-x-12 gap-y-5 sm:gap-y-8">
                          {[
                            { label: "Delivery Purpose", value: selectedGroup.deliveryPurpose },
                            { label: "Order Type", value: selectedGroup.orderType },
                            { label: "Start Date / End Date", value: `${selectedGroup.startDate} / ${selectedGroup.endDate}`, color: "text-blue-600" },
                            { label: "Delivery Date", value: selectedGroup.deliveryDate },
                            { label: "DO Date", value: selectedGroup.partySoDate, color: "text-blue-600" },
                            { label: "Transport Type", value: selectedGroup.transportType },
                            { label: "Contact Person", value: `${selectedGroup.contactPerson} — (${selectedGroup.contactWhatsapp})` },
                            { label: "Broker / Advance", value: `${(selectedGroup.isOrderThrough === "Direct" || (selectedGroup.isOrderThrough === "—" && !selectedGroup.isBroker)) ? "No" : selectedGroup.brokerName} / ₹${selectedGroup.advanceAmount}`, color: "text-blue-600" },
                            { label: "Credit Status", value: selectedGroup.partyCredit, color: selectedGroup.partyCredit === "Good" ? "text-green-700" : "text-red-600" },
                            { label: "Customer Address", value: selectedGroup.customerAddress },
                            { label: "Invoice No / Date", value: `${selectedGroup.invoiceNo} / ${selectedGroup.invoiceDate}`, color: "text-blue-600" },
                            { label: "Order Punch Remarks", value: selectedGroup.orderPunchRemarks, color: "text-amber-600 italic" },
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
                            { label: "DL Valid Upto", value: selectedGroup.dlValidUpto ? new Date(selectedGroup.dlValidUpto).toLocaleDateString("en-IN") : "—" },
                            { label: "RST No", value: `#${selectedGroup.rstNo}`, color: "text-blue-600" },
                            { label: "Gross / Tare / Net", value: `${selectedGroup.grossWeight} / ${selectedGroup.tareWeight} / ${selectedGroup.netWeight}`, color: "text-[#3b82f6]" },
                            { label: "Weight Diff", value: selectedGroup.weightDiff, color: "text-orange-500" },
                            { label: "Extra Weight", value: selectedGroup.extraWeight, color: "text-[#d946ef]" },
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
                    )}
                  </div>
                </div>

                {/* Section 2: Products */}
                <div className="space-y-6">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-6 w-1.5 bg-blue-600 rounded-full shadow-sm" />
                    <h3 className="min-w-0 text-xs sm:text-sm font-black uppercase tracking-[0.14em] sm:tracking-[0.2em] text-blue-900">Products ({selectedProducts.length}/{selectedGroup._productCount} selected)</h3>
                  </div>

                  <Card className="border-none shadow-xl rounded-2xl sm:rounded-[2rem] overflow-hidden bg-white">
                    <div className="md:hidden p-3 space-y-3">
                      <div className="flex items-center justify-between gap-3 rounded-xl bg-blue-600 px-3 py-3 text-white">
                        <span className="text-[10px] font-black uppercase tracking-widest">Select All</span>
                        <Checkbox
                          className="border-white/50 data-[state=checked]:bg-white data-[state=checked]:text-blue-600"
                          checked={selectedProducts.length === selectedGroup._allProducts.length && selectedGroup._allProducts.length > 0}
                          onCheckedChange={(checked) => setSelectedProducts(checked ? selectedGroup._allProducts.map((p: any) => p._rowKey) : [])}
                        />
                      </div>
                      {selectedGroup._allProducts.map((product: any) => {
                        const selected = selectedProducts.includes(product._rowKey);
                        return (
                          <div key={product._rowKey} className={cn("rounded-xl border bg-white p-3 space-y-3", selected && "border-red-200 bg-red-50/20")}>
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Product Info</p>
                                <p className="text-sm font-black text-slate-800 uppercase tracking-tight break-words">{product.productName}</p>
                                <div className="mt-1 flex flex-col gap-1">
                                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest break-all">{product.specificOrderNo}</span>
                                  <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest break-words">{product.party_name || product.partyName}</span>
                                </div>
                              </div>
                              <Checkbox
                                className="data-[state=checked]:bg-red-600"
                                checked={selected}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setSelectedProducts(prev => [...prev, product._rowKey])
                                  } else {
                                    setSelectedProducts(prev => prev.filter(k => k !== product._rowKey))
                                  }
                                }}
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-3 text-xs">
                              <div className="rounded-md bg-slate-50 p-2">
                                <p className="text-[10px] font-black uppercase text-slate-400">Inv Qty</p>
                                  <p className="mt-1 font-mono font-bold text-blue-700">{product.actualQty || "0"}</p>
                              </div>
                              <div className="rounded-md bg-slate-50 p-2">
                                <p className="text-[10px] font-black uppercase text-slate-400">Damage Qty</p>
                                <p className="mt-1 font-mono font-black text-red-600">{product.damageQty || 0}</p>
                              </div>
                              <div className="rounded-md bg-slate-50 p-2 col-span-2">
                                <p className="text-[10px] font-black uppercase text-slate-400">Status</p>
                                <Badge variant="outline" className="mt-1 border-red-200 text-red-700 bg-red-50 text-[10px] uppercase font-black tracking-wider w-fit">
                                  {product.damageStatus || "Pending"}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      <div className="rounded-xl border bg-slate-50 p-3 text-xs space-y-2">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-[9px] uppercase font-black text-slate-500">Total Inv Qty</p>
                            <p className="mt-1 font-black text-blue-700">
                              {selectedGroup._allProducts.filter((p: any) => selectedProducts.includes(p._rowKey)).reduce((sum: number, p: any) => sum + (parseFloat(p.actualQty) || 0), 0)}
                            </p>
                          </div>
                          <div>
                            <p className="text-[9px] uppercase font-black text-slate-500">Total Damaged Qty</p>
                            <p className="mt-1 font-black text-red-600">
                              {selectedGroup._allProducts.filter((p: any) => selectedProducts.includes(p._rowKey)).reduce((sum: number, p: any) => sum + (parseFloat(p.damageQty) || 0), 0)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <Table className="hidden md:table">
                      <TableHeader className="bg-slate-50">
                        <TableRow className="border-none">
                          <TableHead className="w-12 text-center h-10">
                            <Checkbox
                              checked={selectedProducts.length === selectedGroup._allProducts.length && selectedGroup._allProducts.length > 0}
                              onCheckedChange={(checked) => setSelectedProducts(checked ? selectedGroup._allProducts.map((p: any) => p._rowKey) : [])}
                            />
                          </TableHead>
                          <TableHead className="text-[10px] font-black uppercase tracking-wider h-10">PRODUCT INFO</TableHead>
                          <TableHead className="text-[10px] font-black uppercase text-center tracking-wider h-10">INV QTY</TableHead>
                          <TableHead className="text-[10px] font-black uppercase text-center tracking-wider h-10">DAMAGE QTY</TableHead>
                          <TableHead className="text-[10px] font-black uppercase text-center tracking-wider h-10">STATUS</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedGroup._allProducts.map((product: any) => {
                          const selected = selectedProducts.includes(product._rowKey);
                          return (
                            <TableRow key={product._rowKey} className={cn("h-14 transition-colors", selected ? "bg-red-50/10" : "")}>
                              <TableCell className="text-center">
                                <Checkbox
                                  className="data-[state=checked]:bg-red-600"
                                  checked={selected}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setSelectedProducts(prev => [...prev, product._rowKey])
                                    } else {
                                      setSelectedProducts(prev => prev.filter(k => k !== product._rowKey))
                                    }
                                  }}
                                />
                              </TableCell>
                              <TableCell className="p-2">
                                <div className="flex flex-col">
                                  <span className="text-xs font-black text-slate-800 uppercase tracking-tight">{product.productName}</span>
                                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1 leading-none">{product.specificOrderNo}</span>
                                  <span className="text-[8px] font-black text-blue-500 uppercase tracking-widest mt-1 leading-none">{product.party_name || product.partyName}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700 font-black text-xs px-3">
                                  {product.actualQty || "0"}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-center font-black text-xs text-red-600">
                                {product.damageQty || 0}
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge variant="outline" className="border-red-200 text-red-700 bg-red-50 text-[9px] font-black uppercase tracking-wider">
                                  {product.damageStatus || "Pending"}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                      <TableFooter className="bg-slate-50/50">
                        <TableRow className="h-14 font-black text-xs border-none">
                          <TableCell />
                          <TableCell className="text-[10px] uppercase font-black text-slate-900">Total Selection</TableCell>
                          <TableCell className="text-center">
                            <Badge className="bg-blue-600 text-white font-black text-xs px-3">
                              {selectedGroup._allProducts.filter((p: any) => selectedProducts.includes(p._rowKey)).reduce((sum: number, p: any) => sum + (parseFloat(p.actualQty) || 0), 0)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className="bg-red-600 text-white font-black text-xs px-3">
                              {selectedGroup._allProducts.filter((p: any) => selectedProducts.includes(p._rowKey)).reduce((sum: number, p: any) => sum + (parseFloat(p.damageQty) || 0), 0)}
                            </Badge>
                          </TableCell>
                          <TableCell />
                        </TableRow>
                      </TableFooter>
                    </Table>
                  </Card>
                </div>

                {/* Section 3: Credit Note Details */}
                <div className="space-y-6">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-6 w-1.5 bg-blue-600 rounded-full shadow-sm" />
                    <h3 className="min-w-0 text-xs sm:text-sm font-black uppercase tracking-[0.14em] sm:tracking-[0.2em] text-blue-900">Credit Note & Adjustment Details</h3>
                  </div>

                  <Card className="p-4 sm:p-10 border-none shadow-xl rounded-2xl sm:rounded-[2rem] bg-white grid grid-cols-1 md:grid-cols-3 gap-6 relative overflow-hidden">
                    <div className="space-y-4">
                      <Label className="text-[10px] font-black uppercase text-slate-300 tracking-[0.2em] ml-1">Credit Note Date <span className="text-red-500">*</span></Label>
                      <Input
                        type="date"
                        className="h-12 sm:h-16 border-2 border-slate-50 bg-slate-50/30 rounded-2xl px-4 sm:px-8 font-black text-slate-700 text-sm sm:text-lg focus:bg-white focus:border-blue-100 transition-all shadow-inner"
                        value={adjustmentData.creditNoteDate}
                        onChange={(e) => setAdjustmentData({ ...adjustmentData, creditNoteDate: e.target.value })}
                      />
                    </div>

                    <div className="space-y-4">
                      <Label className="text-[10px] font-black uppercase text-slate-300 tracking-[0.2em] ml-1">Credit Note No <span className="text-red-500">*</span></Label>
                      <Input
                        className="h-12 sm:h-16 border-2 border-slate-50 bg-slate-50/30 rounded-2xl px-4 sm:px-8 font-black text-slate-700 text-sm sm:text-lg focus:bg-white focus:border-blue-100 transition-all shadow-inner"
                        value={adjustmentData.creditNoteNo}
                        onChange={(e) => setAdjustmentData({ ...adjustmentData, creditNoteNo: e.target.value })}
                        placeholder="e.g. CN-2023-001"
                      />
                    </div>

                    <div className="space-y-4">
                      <Label className="text-[10px] font-black uppercase text-slate-300 tracking-[0.2em] ml-1">Upload CN Copy</Label>
                      <FileUploadField
                        accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif,.pdf"
                        value={null}
                        fileName={adjustmentData.creditNoteCopyName}
                        variant="dropzone"
                        helperText="Max file size: 20 MB"
                        uploading={isUploading}
                        buttonText="Click to Select Copy"
                        onFilesSelected={(files) => files[0] && handleFileUpload(files[0])}
                      />
                    </div>
                  </Card>
                </div>
              </div>
            )}

            <DialogFooter className="mt-8 sm:mt-12 pt-5 sm:pt-8 border-t-2 border-slate-100 -mx-3 sm:-mx-8 px-3 sm:px-12 bg-white rounded-b-2xl sm:rounded-b-[2.5rem]">
              <div className="grid w-full grid-cols-1 gap-3 sm:flex sm:items-center sm:justify-between">
                <Button variant="ghost" onClick={() => setIsDialogOpen(false)} disabled={isProcessing} className="h-12 sm:h-14 w-full sm:w-auto px-6 sm:px-10 font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-2xl">Cancel</Button>
                <Button
                  onClick={handleSubmit}
                  disabled={isProcessing || isReadOnly || !adjustmentData.creditNoteDate || !adjustmentData.creditNoteNo}
                  className="h-12 sm:h-16 w-full sm:w-auto px-6 sm:px-16 bg-blue-600 hover:bg-blue-700 shadow-xl shadow-blue-100 rounded-2xl text-sm sm:text-xl font-black italic tracking-tighter uppercase transition-all duration-500"
                >
                  {isProcessing ? <Loader2 className="mr-2 sm:mr-3 h-5 w-5 sm:h-6 sm:w-6 animate-spin" /> : <CheckCircle className="mr-2 sm:mr-3 h-5 w-5 sm:h-6 sm:w-6" />}
                  Complete Adjustment
                </Button>
              </div>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </WorkflowStageShell>
  )
}
