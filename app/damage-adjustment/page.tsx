"use client"

import { useEffect, useState, useMemo } from "react"
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
import { Upload, CheckCircle, Settings2, FileText, IndianRupee, ExternalLink } from "lucide-react"
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ALL_WORKFLOW_COLUMNS as ALL_COLUMNS } from "@/lib/workflow-columns"
import { damageAdjustmentApi, orderApi } from "@/lib/api-service"
import { useAuth } from "@/hooks/use-auth"
import { useInfiniteQuery } from "@tanstack/react-query"
import { useInView } from "react-intersection-observer"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

export default function DamageAdjustmentPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { isReadOnly, user } = useAuth()
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

  const [visibleColumns, setVisibleColumns] = useState<string[]>([
    "partySoDate",
    "orderNo",
    "customerName",
    "invoiceNo",
    "status",
  ])

  // Selection & Dialog State
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [selectedGroup, setSelectedGroup] = useState<any>(null)
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  // Adjustment Form State
  const [isUploading, setIsUploading] = useState<boolean>(false)
  const [adjustmentData, setAdjustmentData] = useState({
    creditNoteDate: "",
    creditNoteNo: "",
    creditNoteCopy: "" as string,
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
    queryKey: ["damage-adjustment-history", filterValues],
    queryFn: async ({ pageParam = 1 }) => {
      const response = await damageAdjustmentApi.getHistory({
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

  const handleFileUpload = async (file: File) => {
    if (!file) return;

    setIsUploading(true);
    try {
      const response = await orderApi.uploadFile(file);
      if (response.success) {
        setAdjustmentData(p => ({
          ...p,
          creditNoteCopy: response.data.url,
          creditNoteCopyName: file.name
        }));
        toast({
          title: "Upload Successful",
          description: `${file.name} uploaded successfully.`
        });
      }
    } catch (error: any) {
      console.error("Upload failed:", error);
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload file to S3",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
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
    const orderDateStr = order.timestamp || order.planned_9
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
          brokerName: order.broker_name || "—",
          advanceAmount: order.advance_amount || 0,
          paymentTerms: order.payment_terms || "—",
          partySoDate: order.party_so_date ? new Date(order.party_so_date).toLocaleDateString("en-IN") : "—",

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
      processId: g._allProducts[0]?.processid || "—",
      vehicleNo: (g._allProducts[0]?.truckNo || "—").toUpperCase(),
      orderPunchRemarks: g._allProducts[0]?.order_punch_remarks || "—",
      uploadSo: g._allProducts[0]?.upload_so || g._allProducts[0]?.uploadSo || null,
    }))
  }, [filteredPendingOrders])

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
        creditNoteCopy: "",
        creditNoteCopyName: "",
      })

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

      for (const product of productsToSubmit) {
        const submitData = {
          credit_note_date: adjustmentData.creditNoteDate,
          credit_note_no: adjustmentData.creditNoteNo,
          credit_note_qty: 0,
          credit_note_amount: 0,
          net_banalce: 0,
          status_2: "Completed",
          credit_note_copy: adjustmentData.creditNoteCopy || null,
          username: user?.username || null // Add username for tracking
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



  const customerNames = Array.from(new Set(pendingOrders.map(order => (order.transfer === 'yes' && order.bill_company_name) ? order.bill_company_name : (order.party_name || "Unknown Customer"))))

  return (
    <WorkflowStageShell
      partyNames={customerNames}
      title="Stage 13: Damage Adjustment"
      description="Process credit notes and adjustments for damaged goods."
      pendingCount={displayRows.length}
      historyData={historyOrders.map((order) => ({
        ...order,
        date: order.actual_9 ? new Date(order.actual_9).toLocaleDateString("en-GB") : "-",
        orderNo: order.so_no,
        stage: "Damage Adjustment",
        customerName: (order.transfer === 'yes' && order.bill_company_name) ? order.bill_company_name : order.party_name,
        status: order.status_2 || "Completed",
        remarks: order.credit_note_no ? `CN: ${order.credit_note_no}` : "-",
        rawData: order,
      }))}
      onFilterChange={setFilterValues}
      showStatusFilter={true}
      stageLevel={10}
      onTabChange={setActiveTab}
      isHistoryLoading={isHistoryLoading}
      showDateFilters={false}
      historyFooter={
        <div ref={historyEndRef} className="py-4 flex justify-center">
          {isFetchingNextHistory && (
            <div className="flex items-center gap-2 text-blue-600 font-bold animate-pulse text-xs tracking-widest ">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>LOADING MORE ADJUSTMENT HISTORY...</span>
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
            Process Adjustment ({selectedItems.length})
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="bg-transparent">
                <Settings2 className="mr-2 h-4 w-4" />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[250px] max-h-[400px] overflow-y-auto">
              <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {ALL_COLUMNS.map((col) => (
                <DropdownMenuCheckboxItem
                  key={col.id}
                  className="capitalize"
                  checked={visibleColumns.includes(col.id)}
                  onCheckedChange={(checked) => {
                    setVisibleColumns((prev) => (checked ? [...prev, col.id] : prev.filter((id) => id !== col.id)))
                  }}
                >
                  {col.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Main Table (Grouped) */}
        <Card className="border-none shadow-sm overflow-auto max-h-[600px]">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-card shadow-sm">
              <TableRow>
                <TableHead className="w-12 text-center">
                  <Checkbox checked={displayRows.length > 0 && selectedItems.length === displayRows.length} onCheckedChange={toggleSelectAll} />
                </TableHead>
                <TableHead className="whitespace-nowrap text-center">DO Date</TableHead>
                <TableHead className="whitespace-nowrap text-center">DO Number</TableHead>
                <TableHead className="whitespace-nowrap text-center">Process ID</TableHead>
                <TableHead className="whitespace-nowrap text-center">Customer Name</TableHead>
                <TableHead className="whitespace-nowrap text-center">Products</TableHead>
                {visibleColumns.includes("invoiceNo") && <TableHead className="whitespace-nowrap text-center">Invoice No.</TableHead>}
                <TableHead className="whitespace-nowrap text-center">Vehicle No.</TableHead>
                <TableHead className="whitespace-nowrap text-center">Order Punch Remarks</TableHead>
                <TableHead className="whitespace-nowrap text-center">Damage Info</TableHead>
                <TableHead className="whitespace-nowrap text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isPendingLoading && pendingOrders.length === 0 ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i} className="opacity-40 border-b border-slate-50">
                    <TableCell className="text-center py-4"><div className="h-4 w-4 bg-slate-200 animate-pulse rounded mx-auto" /></TableCell>
                    <TableCell className="text-center py-4"><div className="h-3 w-20 bg-slate-200 animate-pulse rounded-full mx-auto" /></TableCell>
                    <TableCell className="text-center py-4"><div className="h-3 w-24 bg-slate-200 animate-pulse rounded-full mx-auto" /></TableCell>
                    <TableCell className="text-center py-4"><div className="h-3 w-20 bg-slate-200 animate-pulse rounded-full mx-auto" /></TableCell>
                    <TableCell className="text-center py-4"><div className="h-3 w-40 bg-slate-200 animate-pulse rounded-full mx-auto" /></TableCell>
                    <TableCell className="text-center py-4"><div className="h-3 w-16 bg-slate-200 animate-pulse rounded-full mx-auto" /></TableCell>
                    {visibleColumns.includes("invoiceNo") && <TableCell className="text-center py-4"><div className="h-3 w-24 bg-slate-200 animate-pulse rounded-full mx-auto" /></TableCell>}
                    <TableCell className="text-center py-4"><div className="h-3 w-24 bg-slate-200 animate-pulse rounded-full mx-auto" /></TableCell>
                    <TableCell className="text-center py-4"><div className="h-3 w-32 bg-slate-200 animate-pulse rounded-full mx-auto" /></TableCell>
                    <TableCell className="text-center py-4"><div className="h-3 w-24 bg-slate-200 animate-pulse rounded-full mx-auto" /></TableCell>
                    <TableCell className="text-center py-4"><div className="h-5 w-24 bg-slate-200 animate-pulse rounded-full mx-auto" /></TableCell>
                  </TableRow>
                ))
              ) : displayRows.length > 0 ? (
                displayRows.map((group) => (
                  <TableRow key={group._rowKey} className={selectedItems.includes(group._rowKey) ? "bg-blue-50/50" : ""}>
                    <TableCell className="text-center">
                      <Checkbox checked={selectedItems.includes(group._rowKey)} onCheckedChange={() => toggleSelectItem(group._rowKey)} />
                    </TableCell>
                    <TableCell className="text-center text-xs font-medium">{group.partySoDate}</TableCell>
                    <TableCell className="text-center text-xs font-medium">{group.doNumber}</TableCell>
                    <TableCell className="text-center text-xs font-medium">{group.processId}</TableCell>
                    <TableCell className="text-center text-xs">{group.customerName}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{group._productCount} items</Badge>
                    </TableCell>
                    {visibleColumns.includes("invoiceNo") && (
                      <TableCell className="text-center text-xs font-medium">
                        {group._allProducts?.[0]?.invoice_copy ? (
                          <a href={group._allProducts[0].invoice_copy} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-bold">
                            {group.invoiceNo}
                          </a>
                        ) : (
                          group.invoiceNo
                        )}
                      </TableCell>
                    )}
                    <TableCell className="text-center">
                      <span className="text-xs font-bold text-slate-700">{group.vehicleNo}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-xs text-slate-600 font-medium">{group.orderPunchRemarks}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      {/* Show summary of damage if available in first product or count */}
                      <div className="text-xs text-red-600 font-medium">
                        {group._allProducts.filter((p: any) => p.damageStatus === "Damaged").length} damaged items
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className="bg-red-100 text-red-700">Pending Adjustment</Badge>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
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
        <DialogContent className="max-w-[95vw]! w-full max-h-[95vh] overflow-y-auto p-0">
          <div className="p-6">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-slate-900">
                Damage Adjustment - Invoice: {selectedGroup?.invoiceNo} <span className="text-sm font-medium text-slate-500">({selectedGroup?.customerName})</span>
              </DialogTitle>
            </DialogHeader>

            {selectedGroup && (
              <div className="space-y-6 mt-4">
                {/* Order Details Top Section */}
                <div className="border rounded-lg p-4 bg-muted/30">
                  <h3 className="text-sm font-semibold mb-3 text-primary">Order & Logistics Details</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4 text-xs">
                    <div>
                      <Label className="text-xs text-muted-foreground">Delivery Purpose</Label>
                      <p className="font-medium">{selectedGroup.deliveryPurpose}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Order Type</Label>
                      <p className="font-medium">{selectedGroup.orderType}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Start Date</Label>
                      <p className="font-medium">{selectedGroup.startDate}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">End Date</Label>
                      <p className="font-medium">{selectedGroup.endDate}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Delivery Date</Label>
                      <p className="font-medium">{selectedGroup.deliveryDate}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">DO Date</Label>
                      <p className="font-medium">{selectedGroup.partySoDate || "—"}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Transport Type</Label>
                      <p className="font-medium">{selectedGroup.transportType}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Contact Person</Label>
                      <p className="font-medium">{selectedGroup.contactPerson}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Customer Address</Label>
                      <p className="font-medium truncate" title={selectedGroup.customerAddress}>{selectedGroup.customerAddress}</p>
                    </div>

                    <div>
                      <Label className="text-xs text-muted-foreground">Delivery Purpose</Label>
                      <p className="font-medium">{selectedGroup.deliveryPurpose}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Start / End Date</Label>
                      <p className="font-medium">{selectedGroup.startDate} / {selectedGroup.endDate}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">DO Date</Label>
                      <p className="font-medium">{selectedGroup.partySoDate}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Transport Type</Label>
                      <p className="font-medium text-purple-600">{selectedGroup.transportType}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Contact Person</Label>
                      <p className="font-medium">{selectedGroup.contactPerson} ({selectedGroup.contactWhatsapp})</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Broker / Advance</Label>
                      <p className="font-medium text-blue-600">{selectedGroup.brokerName} / ₹{selectedGroup.advanceAmount}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Address</Label>
                      <p className="font-medium truncate" title={selectedGroup.customerAddress}>{selectedGroup.customerAddress}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Invoice No / Date</Label>
                      <p className="font-medium text-blue-600">{selectedGroup.invoiceNo} / {selectedGroup.invoiceDate}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Order Punch Remarks</Label>
                      <p className="font-medium text-amber-600 italic">"{selectedGroup.orderPunchRemarks || "No special instructions provided."}"</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">PO Copy (SO Upload)</Label>
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
                        <p className="text-[10px] font-black text-slate-400 leading-none mt-1 uppercase">NOT UPLOADED</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Bilty No</Label>
                      <p className="font-medium">{selectedGroup.biltyNo}</p>
                    </div>

                    <div>
                      <Label className="text-xs text-muted-foreground">Truck No</Label>
                      <p className="font-medium">{(selectedGroup.truckNo || "—").toUpperCase()}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Transporter</Label>
                      <p className="font-medium truncate" title={selectedGroup.transporterName}>{selectedGroup.transporterName}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Vehicle Type</Label>
                      <p className="font-medium">{selectedGroup.vehicleType}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">RTO</Label>
                      <p className="font-medium">{selectedGroup.rto}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Passing Weight</Label>
                      <p className="font-medium">{selectedGroup.passingWeight}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Road Tax</Label>
                      <p className="font-medium">{selectedGroup.roadTax}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">GVW</Label>
                      <p className="font-medium">{selectedGroup.gvw}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">ULW</Label>
                      <p className="font-medium">{selectedGroup.ulw}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Driver Name</Label>
                      <p className="font-medium">{selectedGroup.driverName}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Driver Contact</Label>
                      <p className="font-medium">{selectedGroup.driverContact}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">License No</Label>
                      <p className="font-medium">{selectedGroup.driverLicense}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">DL Valid Upto</Label>
                      <p className="font-medium">{selectedGroup.dlValidUpto ? new Date(selectedGroup.dlValidUpto).toLocaleDateString("en-IN") : "—"}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">RST No</Label>
                      {selectedGroup.weightmentSlip ? (
                        <a href={selectedGroup.weightmentSlip} target="_blank" rel="noopener noreferrer" className="block text-blue-600 hover:text-blue-800 underline font-black">
                          #{selectedGroup.rstNo}
                        </a>
                      ) : (
                        <p className="font-medium">#{selectedGroup.rstNo}</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Gross / Tare / Net</Label>
                      <p className="font-medium text-slate-900 leading-tight">
                        {selectedGroup.grossWeight || "0"} / {selectedGroup.tareWeight || "0"} / <span className="text-blue-600 font-black">{((Number(selectedGroup.grossWeight || 0) - Number(selectedGroup.tareWeight || 0)) || "0").toString()}</span>
                      </p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Weight Diff</Label>
                      <p className="font-black text-amber-600">{selectedGroup.weightDiff || "0"}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Extra Weight</Label>
                      <p className="font-black text-purple-600">{selectedGroup.extraWeight || "0"}</p>
                    </div>
                    {selectedGroup.diffReason && selectedGroup.diffReason !== "—" && (
                      <div className="col-span-1">
                        <Label className="text-xs text-muted-foreground">Diff Reason</Label>
                        <p className="font-medium text-red-500 italic">{selectedGroup.diffReason}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Product List Table (Middle) */}
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-muted/50 px-4 py-2 border-b">
                    <h3 className="text-sm font-semibold text-primary">Products ({selectedProducts.length}/{selectedGroup._productCount} selected)</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">
                            <Checkbox
                              checked={selectedProducts.length === selectedGroup._allProducts.length && selectedGroup._allProducts.length > 0}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedProducts(selectedGroup._allProducts.map((p: any) => p._rowKey))
                                } else {
                                  setSelectedProducts([])
                                }
                              }}
                            />
                          </TableHead>
                          <TableHead>Order No</TableHead>
                          <TableHead>Product Name</TableHead>
                          <TableHead>Inv Qty</TableHead>
                          <TableHead>Damage Qty</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedGroup._allProducts.map((product: any) => (
                          <TableRow key={product._rowKey} className={selectedProducts.includes(product._rowKey) ? "bg-red-50/20" : ""}>
                            <TableCell>
                              <Checkbox
                                checked={selectedProducts.includes(product._rowKey)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setSelectedProducts(prev => [...prev, product._rowKey])
                                  } else {
                                    setSelectedProducts(prev => prev.filter(k => k !== product._rowKey))
                                  }
                                }}
                              />
                            </TableCell>
                            <TableCell className="font-medium text-xs text-slate-500">{product.specificOrderNo || "—"}</TableCell>
                            <TableCell className="font-medium">{product.productName}</TableCell>
                            <TableCell>{product.actualQty || "—"}</TableCell>
                            <TableCell className="font-bold text-red-600">{product.damageQty || 0}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="border-red-200 text-red-700 bg-red-50">
                                {product.damageStatus || "Pending"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Adjustment Form (Bottom) */}
                <div className="space-y-6 border rounded-lg p-6 bg-white shadow-sm">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b pb-2">
                    <FileText className="h-4 w-4 text-blue-600" />
                    Credit Note & Adjustment Details
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <Label>Credit Note Date <span className="text-red-500">*</span></Label>
                      <Input
                        type="date"
                        value={adjustmentData.creditNoteDate}
                        onChange={(e) => setAdjustmentData({ ...adjustmentData, creditNoteDate: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Credit Note No <span className="text-red-500">*</span></Label>
                      <Input
                        value={adjustmentData.creditNoteNo}
                        onChange={(e) => setAdjustmentData({ ...adjustmentData, creditNoteNo: e.target.value })}
                        placeholder="e.g. CN-2023-001"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Upload CN Copy</Label>
                      <p className="text-[10px] text-slate-400">Max file size: 10 MB</p>
                      <div className="border-2 border-dashed rounded-lg p-3 text-center hover:bg-slate-50 transition-colors bg-blue-50/20">
                        <Input
                          type="file"
                          accept="image/*,.pdf"
                          onChange={(e) => {
                            if (e.target.files?.[0]) {
                              handleFileUpload(e.target.files[0])
                            }
                          }}
                          className="hidden"
                          id="cn-upload"
                        />
                        <label htmlFor="cn-upload" className="cursor-pointer block">
                          <Upload className="h-5 w-5 mx-auto mb-1 text-blue-600" />
                          <p className="text-xs font-bold text-slate-700 uppercase tracking-tight block">
                            {isUploading ? "UPLOADING..." : (adjustmentData.creditNoteCopyName ? `REPLACE: ${adjustmentData.creditNoteCopyName}` : "Upload Copy")}
                          </p>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <DialogFooter className="mt-8 border-t pt-4 bg-gray-50 -mx-6 -mb-6 px-6 py-4">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isProcessing}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isProcessing || isReadOnly}
                className="bg-blue-600 hover:bg-blue-700 min-w-37.5"
                title={isReadOnly ? "View Only Access" : "Complete Adjustment"}
              >
                {isProcessing ? "Processing..." : "Complete Adjustment"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </WorkflowStageShell>
  )
}
