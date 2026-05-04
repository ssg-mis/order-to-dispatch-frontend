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
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { CheckCircle, Settings2, Eye, FileText, ExternalLink } from "lucide-react"
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ALL_WORKFLOW_COLUMNS as ALL_COLUMNS } from "@/lib/workflow-columns"
import { checkInvoiceApi } from "@/lib/api-service"
import { cn } from "@/lib/utils"
import { useAuth } from "@/hooks/use-auth"
import { useInfiniteQuery } from "@tanstack/react-query"
import { useInView } from "react-intersection-observer"
import { Loader2 } from "lucide-react"

export default function CheckInvoicePage() {
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
  const [selectedGroups, setSelectedGroups] = useState<any[]>([]) // Changed to array for multi-group support
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [expandedOrders, setExpandedOrders] = useState<string[]>([]) // State to manage expanded sections

  const [checkData, setCheckData] = useState({
    status: "",
    remarks: "",
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
    queryKey: ["check-invoice-pending", filterValues],
    queryFn: async ({ pageParam = 1 }) => {
      const response = await checkInvoiceApi.getPending({
        page: pageParam,
        limit: 20,
        so_no: filterValues.search,
        party_name: filterValues.partyName === "all" ? undefined : filterValues.partyName,
      });
      return response.success ? response.data : { invoices: [], pagination: { total: 0 } };
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const currentCount = allPages.reduce((sum, page) => sum + (page.invoices?.length || 0), 0);
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
    queryKey: ["check-invoice-history", filterValues],
    queryFn: async ({ pageParam = 1 }) => {
      const response = await checkInvoiceApi.getHistory({
        page: pageParam,
        limit: 20,
        so_no: filterValues.search,
        party_name: filterValues.partyName === "all" ? undefined : filterValues.partyName,
      });
      return response.success ? response.data : { invoices: [], pagination: { total: 0 } };
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const currentCount = allPages.reduce((sum, page) => sum + (page.invoices?.length || 0), 0);
      return currentCount < (lastPage.pagination?.total || 0) ? allPages.length + 1 : undefined;
    },
    enabled: activeTab === "history",
  });

  const pendingOrders = useMemo(() => {
    return pendingData?.pages.flatMap((page) => page.invoices) || [];
  }, [pendingData]);

  const historyOrders = useMemo(() => {
    return historyData?.pages.flatMap((page) => page.invoices) || [];
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

  /* Filter Logic */

  const filteredPendingOrders = pendingOrders.filter(order => {
    let matches = true

    // Filter by Party Name
    if (filterValues.partyName && filterValues.partyName !== "all" && order.party_name !== filterValues.partyName) {
      matches = false
    }

    // Filter by Date Range
    const orderDateStr = order.timestamp || order.planned_6
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
      const doNumber = rawDoNumber.replace(/[A-Z]+$/, "")

      if (!grouped[invoiceNo]) {
        grouped[invoiceNo] = {
          _rowKey: invoiceNo,
          customerName: partyName,
          invoiceNo: invoiceNo,
          doNumberList: new Set<string>(),
          _allProducts: [],
          _ordersMap: {}, // Group items by specific DO for interleaved view
          _productCount: 0
        }
      }

      const group = grouped[invoiceNo]
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
          address: order.customer_address || "—",
          paymentTerms: order.payment_terms || "—",
          advanceAmount: order.advance_amount || 0,
          isBroker: order.is_order_through_broker || false,
          isOrderThrough: order.is_order_through || "—",
          brokerName: order.broker_name || "—",
          partyCredit: order.party_credit_status || "Good",
          totalAmount: order.total_amount_with_gst || "—",
          oilType: order.oil_type || "—",
          // Check Invoice specific data
          invoiceNo: order.invoice_no,
          invoiceDate: order.invoice_date,
          biltyNo: order.bilty_no,
          rstNo: order.rst_no,
          grossWeight: order.gross_weight,
          tareWeight: order.tare_weight,
          netWeight: order.net_weight,
          transporterName: order.transporter_name,
          truckNo: order.truck_no,
          diffReason: order.reason_of_difference_in_weight_if_any_speacefic,
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
        rate: ((parseFloat(order.rate_of_material) || 0) * (parseFloat(order.nos_per_main_uom) || 1)) + (parseFloat(order.freight_rate) || 0),
        amount: (((parseFloat(order.rate_of_material) || 0) * (parseFloat(order.nos_per_main_uom) || 1)) + (parseFloat(order.freight_rate) || 0)) * (parseFloat(order.actual_qty_dispatch || order.actual_qty || order.qty) || 0),
        invoiceNo: order.invoice_no,
        invoiceDate: order.invoice_date,
        billAmount: order.bill_amount,
        qty: order.qty,
        actualQty: order.actual_qty_dispatch || order.actual_qty,
        truckNo: order.truck_no,
        rstNo: order.rst_no,
        grossWeight: order.gross_weight,
        tareWeight: order.tare_weight,
        netWeight: order.net_weight,
        transporterName: order.transporter_name,
        weightDiff: order.difference || 0,
        fitness: order.fitness,
        insurance: order.insurance,
        tax_copy: order.tax_copy,
        polution: order.polution,
        permit1: order.permit1,
        permit2_out_state: order.permit2_out_state,
        weightment_slip_copy: order.weightment_slip_copy,
        vehicle_no_plate_image: order.vehicle_no_plate_image,
        bilty_image: order.bilty_image,
        vehicle_image_attachemrnt: order.vehicle_image_attachemrnt,
        reason_of_difference_in_weight_if_any_speacefic: order.reason_of_difference_in_weight_if_any_speacefic,
        processid: order.processid || null,
        actual_5: order.actual_5, // Track whether record has been reverted
      }

      group._ordersMap[orderKey]._products.push(product)
      group._allProducts.push(product)
      group._productCount = group._allProducts.length
    })

    // Convert Set to string for display
    return Object.values(grouped).map(group => ({
      ...group,
      partySoDate: formatDate(group._allProducts[0]?.party_so_date),
      doNumber: Array.from(group.doNumberList).join(", "),
      processId: group._allProducts[0]?.processid || "—",
      vehicleNo: (group._allProducts[0]?.truckNo || "—").toUpperCase(),
      invoiceNo: group._allProducts[0]?.invoice_no || "—",
      freightRate: group._allProducts[0]?.freight_rate || 0,
      orderPunchRemarks: group._allProducts[0]?.order_punch_remarks || "—",
      uploadSo: group._allProducts[0]?.upload_so || group._allProducts[0]?.uploadSo || null,
      // Group is reverted if ALL products have actual_5 = null (pushed back to Make Invoice)
      isReverted: group._allProducts.every((p: any) => !p.actual_5),
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

    // Get all selected groups
    const targets = displayRows.filter(r => selectedItems.includes(r._rowKey))
    if (targets.length > 0) {
      setSelectedGroups(targets)
      // Select all products by default from all selected groups
      const allProdKeys = targets.flatMap(g => g._allProducts.map((p: any) => p._rowKey))
      setSelectedProducts(allProdKeys)

      // Reset form
      setCheckData({ status: "", remarks: "" })
      setExpandedOrders([]) // Reset expanded state

      setIsDialogOpen(true)
    }
  }

  const handleSubmit = async () => {
    if (selectedGroups.length === 0 || !checkData.status) {
      toast({
        title: "Validation Error",
        description: "Please select verification status.",
        variant: "destructive"
      })
      return
    }

    if (checkData.status === "Issue" && !checkData.remarks) {
      toast({
        title: "Validation Error",
        description: "Remarks are mandatory when reporting an issue.",
        variant: "destructive"
      })
      return
    }

    // Flatten all selected products from all selected groups
    const productsToSubmit = selectedGroups.flatMap(group =>
      group._allProducts.filter((p: any) => selectedProducts.includes(p._rowKey))
    )

    if (productsToSubmit.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one product to verify",
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
          status_1: checkData.status,
          remarks_2: checkData.remarks,
          username: user?.username || null // Add username for tracking
        };

        try {
          console.log(`[CHECK] Submitting for ID ${product.id}`, submitData);
          const response = await checkInvoiceApi.submit(product.id, submitData);

          if (response.success) {
            successfulSubmissions.push(product);
          } else {
            failedSubmissions.push({ product, error: response.message });
          }
        } catch (err: any) {
          console.error(`[CHECK] Failed for ID ${product.id}`, err);
          failedSubmissions.push({ product, error: err.message });
        }
      }

      if (successfulSubmissions.length > 0) {
        toast({
          title: "Invoices Verified",
          description: `Successfully verified ${successfulSubmissions.length} items.`,
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

  const buildCheckInvoiceDisplay = (group: any) => ({
    doNumber: group.doNumber || "—",
    partySoDate: group.partySoDate || "—",
    processId: group.processId || "—",
    customerName: group.customerName || "—",
    invoiceNo: group.invoiceNo || "—",
    vehicleNo: group.vehicleNo || "—",
    productCount: group._productCount || group._allProducts?.length || 0,
    productName: group._allProducts?.[0]?.productName || "—",
    orderPunchRemarks: group.orderPunchRemarks || "—",
    qty: group._allProducts?.reduce((sum: number, p: any) => sum + (Number(p.actualQty) || 0), 0) || 0,
    amount: group._allProducts?.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0) || 0,
    invoiceCopy: group._allProducts?.[0]?.invoice_copy,
    statusText: group.isReverted || group._allProducts?.some((p: any) => p.status_1 === "Issue") ? "Issue Reported" : "Pending Review",
  })

  return (
    <WorkflowStageShell
      partyNames={customerNames}
      title="Stage 10: Check Invoice"
      description="Review and verify invoices grouped by Customer."
      pendingCount={displayRows.length}
      historyData={historyOrders.map((order) => ({
        ...order,
        date: order.actual_6 ? new Date(order.actual_6).toLocaleDateString("en-GB") : order.invoice_date || "-",
        orderNo: order.so_no,
        stage: "Check Invoice",
        customerName: (order.transfer === 'yes' && order.bill_company_name) ? order.bill_company_name : order.party_name,
        status: order.status_1 || "Verified",
        remarks: `${order.remarks_2 || "-"} ${order.freight_rate ? `| Freight: ₹${order.freight_rate}` : ""}`,
        rawData: order,
      }))}
      onFilterChange={setFilterValues}
      showStatusFilter={true}
      stageLevel={7}
      onTabChange={setActiveTab}
      isHistoryLoading={isHistoryLoading}
      showDateFilters={false}
      historyFooter={
        <div ref={historyEndRef} className="py-4 flex justify-center">
          {isFetchingNextHistory && (
            <div className="flex items-center gap-2 text-blue-600 font-bold animate-pulse text-xs tracking-widest ">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>LOADING MORE INVOICE HISTORY...</span>
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
        <div className="flex flex-col justify-end gap-2 sm:flex-row">
          <Button
            onClick={handleOpenDialog}
            disabled={selectedItems.length === 0}
            className="w-full bg-blue-600 hover:bg-blue-700 sm:w-auto"
          >
            <CheckCircle className="mr-2 h-4 w-4" />
            Verify Invoice ({selectedItems.length})
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="w-full bg-transparent sm:w-auto">
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
        <Card className="border-none shadow-sm overflow-hidden md:max-h-[600px] md:overflow-auto">
          <Table className="hidden md:table">
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
                    <TableCell className="text-center py-4"><div className="h-3 w-16 bg-slate-200 animate-pulse rounded-full mx-auto" /></TableCell>
                    <TableCell className="text-center py-4"><div className="h-3 w-32 bg-slate-200 animate-pulse rounded-full mx-auto" /></TableCell>
                    <TableCell className="text-center py-4"><div className="h-5 w-24 bg-slate-200 animate-pulse rounded-full mx-auto" /></TableCell>
                  </TableRow>
                ))
              ) : displayRows.length > 0 ? (
                displayRows.map((group) => (
                  <TableRow
                    key={group._rowKey}
                    className={`${selectedItems.includes(group._rowKey) ? "bg-blue-50/50" : ""} ${group.isReverted ? "opacity-60 bg-amber-50/40" : ""}`}
                  >
                    <TableCell className="text-center">
                      <Checkbox
                        checked={selectedItems.includes(group._rowKey)}
                        onCheckedChange={() => toggleSelectItem(group._rowKey)}
                        disabled={group.isReverted}
                        title={group.isReverted ? "Reverted to Make Invoice stage — awaiting re-issue" : ""}
                      />
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
                      {group.isReverted ? (
                        <Badge className="bg-red-100 text-red-700">Issue Reported</Badge>
                      ) : group._allProducts.some((p: any) => p.status_1 === "Issue") ? (
                        <Badge className="bg-red-100 text-red-700">Issue Reported</Badge>
                      ) : (
                        <Badge className="bg-yellow-100 text-yellow-700">Pending Review</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                    No invoices pending for review
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
              displayRows.map((group) => {
                const display = buildCheckInvoiceDisplay(group)
                const selected = selectedItems.includes(group._rowKey)
                return (
                  <div
                    key={group._rowKey}
                    className={cn(
                      "rounded-lg border bg-white p-4 shadow-sm",
                      selected && "border-blue-200 bg-blue-50",
                      group.isReverted && "opacity-60 bg-amber-50/40"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-mono text-sm font-black text-blue-700 break-all">{display.doNumber}</p>
                        <p className="mt-1 text-xs font-semibold text-slate-500">{display.partySoDate}</p>
                      </div>
                      <Checkbox
                        checked={selected}
                        onCheckedChange={() => toggleSelectItem(group._rowKey)}
                        disabled={group.isReverted}
                      />
                    </div>

                    <div className="mt-3">
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Customer Name</p>
                      <p className="text-sm font-bold text-slate-900 break-words">{display.customerName}</p>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                      <div className="rounded-md bg-slate-50 p-2">
                        <p className="text-[10px] font-black uppercase text-slate-400">Invoice No.</p>
                        {display.invoiceCopy ? (
                          <a href={display.invoiceCopy} target="_blank" rel="noopener noreferrer" className="mt-1 block font-bold text-blue-600 underline break-words">
                            {display.invoiceNo}
                          </a>
                        ) : (
                          <p className="mt-1 font-bold break-words">{display.invoiceNo}</p>
                        )}
                      </div>
                      <div className="rounded-md bg-slate-50 p-2">
                        <p className="text-[10px] font-black uppercase text-slate-400">Process ID</p>
                        <p className="mt-1 font-bold break-words">{display.processId}</p>
                      </div>
                      <div className="rounded-md bg-slate-50 p-2">
                        <p className="text-[10px] font-black uppercase text-slate-400">Products</p>
                        <p className="mt-1 font-bold">{display.productCount} items</p>
                      </div>
                      <div className="rounded-md bg-slate-50 p-2">
                        <p className="text-[10px] font-black uppercase text-slate-400">Vehicle</p>
                        <p className="mt-1 font-bold break-words">{display.vehicleNo}</p>
                      </div>
                      <div className="rounded-md bg-slate-50 p-2">
                        <p className="text-[10px] font-black uppercase text-slate-400">Qty</p>
                        <p className="mt-1 font-mono font-bold">{display.qty}</p>
                      </div>
                      <div className="rounded-md bg-slate-50 p-2">
                        <p className="text-[10px] font-black uppercase text-slate-400">Amount</p>
                        <p className="mt-1 font-mono font-bold">₹{Number(display.amount).toFixed(2)}</p>
                      </div>
                    </div>

                    {display.orderPunchRemarks !== "—" && (
                      <div className="mt-3 rounded-md bg-amber-50 p-3 text-xs">
                        <span className="font-black text-amber-800">Order Remarks:</span> {display.orderPunchRemarks}
                      </div>
                    )}
                    <Badge className={cn("mt-3", display.statusText === "Issue Reported" ? "bg-red-100 text-red-700 hover:bg-red-100" : "bg-yellow-100 text-yellow-700 hover:bg-yellow-100")}>
                      {display.statusText}
                    </Badge>
                  </div>
                )
              })
            ) : (
              <div className="py-10 text-center text-muted-foreground">
                No invoices pending for review
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
        <DialogContent className="w-[calc(100vw-0.75rem)] max-w-[calc(100vw-0.75rem)] sm:!max-w-[95vw] max-h-[95vh] overflow-x-hidden overflow-y-auto p-0 [overflow-wrap:anywhere]">
          <div className="p-3 sm:p-6">
            <DialogHeader className="min-w-0">
              <DialogTitle className="text-lg sm:text-xl font-bold text-slate-900 border-b pb-4 mb-4 break-words">
                Verify Invoices - {selectedGroups.length > 1 ? `${selectedGroups.length} Invoices Selected` : selectedGroups[0]?.invoiceNo}
              </DialogTitle>
            </DialogHeader>

            {selectedGroups.length > 0 && (
              <div className="space-y-6 sm:space-y-12 mt-6 min-w-0">
                {selectedGroups.map((group, groupIdx) => {
                  const allProducts = group._allProducts;
                  const allSelected = allProducts.every((p: any) => selectedProducts.includes(p._rowKey));
                  const isExpanded = expandedOrders.includes(group._rowKey);
                  const toggleExpand = () => {
                    setExpandedOrders(prev => isExpanded ? prev.filter(id => id !== group._rowKey) : [...prev, group._rowKey]);
                  };

                  const uniqueOrderDetails = Object.values(group._ordersMap);

                  return (
                    <div key={group._rowKey} className="space-y-4 sm:space-y-6 min-w-0">
                      <h2 className="text-base sm:text-xl font-black text-slate-800 border-b-4 border-slate-100 pb-2 mt-4 uppercase tracking-tight flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <span className="break-words">Invoice: {group.invoiceNo} <span className="text-sm font-medium text-slate-500">({group.customerName})</span></span>
                        <Badge className="w-fit bg-blue-600 text-white px-3 py-1 font-black sm:ml-3">
                          {group._productCount} PRODUCTS
                        </Badge>
                      </h2>

                      <div className="space-y-4 border-2 border-slate-100 rounded-xl sm:rounded-3xl overflow-hidden bg-white shadow-sm min-w-0">
                        <div className="bg-blue-600 px-3 sm:px-5 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between cursor-pointer" onClick={toggleExpand}>
                          <div className="min-w-0 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                            <Badge className="max-w-full bg-white text-blue-800 hover:bg-white px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-black tracking-tight rounded-full shadow-sm uppercase whitespace-normal break-words">
                              DISPATCH DETAILS
                            </Badge>
                            <div className="flex flex-col">
                              <span className="text-[10px] text-blue-100 font-black uppercase tracking-widest leading-none mb-1">GROUP {groupIdx + 1} | {group.doNumber}</span>
                              <span className="text-xs text-blue-100 font-bold leading-none">
                                {allProducts.filter((p: any) => selectedProducts.includes(p._rowKey)).length} Items Checked
                              </span>
                            </div>
                          </div>
                          <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-start">
                            <div className="text-[10px] sm:text-[11px] text-blue-50 font-bold uppercase tracking-widest sm:mr-2 leading-none">
                              {isExpanded ? 'HIDE AUDIT DATA ▲' : 'SHOW AUDIT DATA ▼'}
                            </div>
                          </div>
                        </div>

                        <div className="px-3 sm:px-5 pb-5 space-y-4">
                          {/* Consolidated Collapsible Audit Details Bar */}
                          {isExpanded && (
                            <div className="space-y-6 animate-in slide-in-from-top-2 duration-300 mt-2">
                              {uniqueOrderDetails.map((orderDetails: any, idx) => {
                                const firstProd = orderDetails._products[0] || {};
                                return (
                                  <div key={idx} className="bg-slate-50 border border-slate-100 rounded-2xl p-4 sm:p-6 relative shadow-inner">
                                    <div className="absolute -top-3 left-6">
                                      <Badge className="bg-slate-200 text-slate-700 hover:bg-slate-200 text-[10px] font-black uppercase px-3 py-1">
                                        ORDER: {firstProd.specificOrderNo}
                                      </Badge>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
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
                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Transport Type</p>
                                        <p className="text-xs font-bold text-slate-900 leading-none">{orderDetails.transportType}</p>
                                      </div>
                                      <div>
                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Credit Status</p>
                                        <Badge className={cn("text-[10px] font-black px-2 py-0.5", orderDetails.partyCredit === 'Good' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')}>
                                          {orderDetails.partyCredit}
                                        </Badge>
                                      </div>

                                      <div className="md:col-span-4 h-px bg-slate-200 my-1" />

                                      {/* Dispatch Info */}
                                      <div>
                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Truck No</p>
                                        <p className="text-sm font-black text-blue-800">{(firstProd.truckNo || "—").toUpperCase()}</p>
                                      </div>
                                      <div>
                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Bilty No</p>
                                        <p className="text-xs font-black text-blue-600">{firstProd.biltyNo || firstProd.bilty_no || "—"}</p>
                                      </div>
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
                                        <p className="text-[10px] font-medium text-slate-600 leading-tight break-words" title={orderDetails.address}>{orderDetails.address}</p>
                                      </div>
                                      <div>
                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Contact Person</p>
                                        <p className="text-xs font-bold text-slate-900 leading-tight break-words">{orderDetails.contactPerson} ({orderDetails.whatsapp})</p>
                                      </div>
                                      <div>
                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Broker / Advance</p>
                                        <p className="text-xs font-bold text-slate-900 leading-none">
                                          {(orderDetails.isOrderThrough === "Direct" || (orderDetails.isOrderThrough === "—" && !orderDetails.isBroker)) ? "No" : orderDetails.brokerName} / ₹{orderDetails.advanceAmount}
                                        </p>
                                      </div>
                                      <div className="md:col-span-2">
                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Order Punch Remarks</p>
                                        <p className="text-[10px] font-medium text-slate-600 leading-tight italic break-words">"{orderDetails.orderPunchRemarks || "No special instructions provided."}"</p>
                                      </div>
                                      <div className="md:col-span-2">
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

                                      <div className="md:col-span-4 h-px bg-slate-200 my-1" />

                                      {/* Vehicle Info */}
                                      <div className="md:col-span-4 flex items-center gap-2 mb-[-8px]">
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
                                      <div className="md:col-span-4 flex items-center gap-2 mb-[-8px] mt-2">
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

                                      <div className="md:col-span-4 h-px bg-slate-200 my-1" />

                                      {/* Security Audit Info */}
                                      <div>
                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Fitness</p>
                                        {firstProd.fitness ? (
                                          <a href={firstProd.fitness} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-blue-600 hover:text-blue-800 underline">
                                            {firstProd.fitness_end_date ? new Date(firstProd.fitness_end_date).toLocaleDateString("en-GB") : "View Document"}
                                          </a>
                                        ) : <span className="text-[10px] text-slate-400">—</span>}
                                      </div>
                                      <div>
                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Insurance</p>
                                        {firstProd.insurance ? (
                                          <a href={firstProd.insurance} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-blue-600 hover:text-blue-800 underline">
                                            {firstProd.insurance_end_date ? new Date(firstProd.insurance_end_date).toLocaleDateString("en-GB") : "View Document"}
                                          </a>
                                        ) : <span className="text-[10px] text-slate-400">—</span>}
                                      </div>
                                      <div>
                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Pollution</p>
                                        {firstProd.polution ? (
                                          <a href={firstProd.polution} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-blue-600 hover:text-blue-800 underline">
                                            {firstProd.pollution_end_date ? new Date(firstProd.pollution_end_date).toLocaleDateString("en-GB") : "View Document"}
                                          </a>
                                        ) : <span className="text-[10px] text-slate-400">—</span>}
                                      </div>
                                      <div>
                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Tax Copy</p>
                                        {firstProd.tax_copy ? (
                                          <a href={firstProd.tax_copy} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-blue-600 hover:text-blue-800 underline">
                                            {firstProd.tax_end_date ? new Date(firstProd.tax_end_date).toLocaleDateString("en-GB") : "View Document"}
                                          </a>
                                        ) : <span className="text-[10px] text-slate-400">—</span>}
                                      </div>

                                      <div>
                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Permit 1</p>
                                        {firstProd.permit1 ? (
                                          <a href={firstProd.permit1} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-blue-600 hover:text-blue-800 underline">
                                            {firstProd.permit1_end_date ? new Date(firstProd.permit1_end_date).toLocaleDateString("en-GB") : "View Document"}
                                          </a>
                                        ) : <span className="text-[10px] text-slate-400">—</span>}
                                      </div>
                                      <div>
                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Permit 2 (Out State)</p>
                                        {firstProd.permit2_out_state ? (
                                          <a href={firstProd.permit2_out_state} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-blue-600 hover:text-blue-800 underline">
                                            {firstProd.permit2_end_date ? new Date(firstProd.permit2_end_date).toLocaleDateString("en-GB") : "View Document"}
                                          </a>
                                        ) : <span className="text-[10px] text-slate-400">—</span>}
                                      </div>
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
                                        <p className="text-[10px] font-bold text-red-500 italic">{firstProd.reason_of_difference_in_weight_if_any_speacefic || firstProd.reasonForDiff || "—"}</p>
                                      </div>
                                      <div>
                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Transporter Name</p>
                                        <p className="text-xs font-bold text-slate-700 truncate" title={firstProd.transporterName}>{firstProd.transporterName || "—"}</p>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Product Table (Always Visible) */}
                          <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-white min-w-0">
                            <Table className="hidden md:table">
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
                                  <TableHead className="text-[10px] uppercase font-black text-center h-10">ACTUAL QTY</TableHead>
                                  <TableHead className="text-[10px] uppercase font-black text-center h-10">RATE</TableHead>
                                  <TableHead className="text-[10px] uppercase font-black text-center h-10">AMOUNT</TableHead>
                                  <TableHead className="text-[10px] uppercase font-black text-center h-10">INVOICE NO</TableHead>
                                  <TableHead className="text-[10px] uppercase font-black text-center h-10">INVOICE DATE</TableHead>
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
                                    <TableCell className="text-center p-2">
                                      <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700 font-black text-xs px-3">
                                        {product.actualQty || "0"}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="text-center p-2 text-xs font-bold text-slate-700">
                                      {product.rate ? `₹${product.rate.toFixed(2)}` : "—"}
                                    </TableCell>
                                    <TableCell className="text-center p-2 text-xs font-bold text-slate-700">
                                      {product.amount ? `₹${product.amount.toFixed(2)}` : "—"}
                                    </TableCell>
                                    <TableCell className="text-center p-2 text-xs font-bold text-green-700">
                                      {product.invoice_copy ? (
                                        <a href={product.invoice_copy} target="_blank" rel="noopener noreferrer" className="hover:text-green-900 underline">
                                          {product.invoiceNo || "View Invoice"}
                                        </a>
                                      ) : (
                                        <span>{product.invoiceNo || "—"}</span>
                                      )}
                                    </TableCell>
                                    <TableCell className="text-center p-2 text-xs font-black">
                                      {product.invoiceDate ? new Date(product.invoiceDate).toLocaleDateString("en-GB") : "—"}
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
                                  <TableCell className="text-center">
                                    <Badge className="bg-blue-600 text-white font-black text-xs px-3">
                                      {allProducts.reduce((sum: number, p: any) => sum + (parseFloat(p.actualQty) || 0), 0)}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-center text-xs text-slate-700"></TableCell>
                                  <TableCell className="text-center text-xs text-blue-700 font-black">
                                    ₹{allProducts.reduce((sum: number, p: any) => sum + (parseFloat(p.amount) || 0), 0).toFixed(2)}
                                  </TableCell>
                                  <TableCell colSpan={3} />
                                </TableRow>
                              </TableBody>
                            </Table>
                            <div className="space-y-3 p-3 md:hidden">
                              <div className="flex items-center justify-between rounded-lg bg-slate-50 p-3">
                                <div>
                                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Products</p>
                                  <p className="text-xs font-bold text-slate-700">{allProducts.length} items</p>
                                </div>
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
                              {allProducts.map((product: any) => {
                                const selected = selectedProducts.includes(product._rowKey)
                                return (
                                  <div key={product._rowKey} className={cn("rounded-xl border bg-white p-3 space-y-3", selected && "border-blue-200 bg-blue-50/40")}>
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="min-w-0">
                                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Product Info</p>
                                        <p className="text-sm font-black text-slate-800 uppercase tracking-tight break-words">{product.productName}</p>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest break-all">{product.specificOrderNo}</p>
                                      </div>
                                      <Checkbox
                                        checked={selected}
                                        onCheckedChange={() => {
                                          if (selected) {
                                            setSelectedProducts(prev => prev.filter(k => k !== product._rowKey))
                                          } else {
                                            setSelectedProducts(prev => [...prev, product._rowKey])
                                          }
                                        }}
                                      />
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 text-xs">
                                      <div className="rounded-md bg-slate-50 p-2">
                                        <p className="text-[10px] font-black uppercase text-slate-400">Actual Qty</p>
                                        <p className="mt-1 font-mono font-bold text-blue-700">{product.actualQty || "0"}</p>
                                      </div>
                                      <div className="rounded-md bg-slate-50 p-2">
                                        <p className="text-[10px] font-black uppercase text-slate-400">Rate</p>
                                        <p className="mt-1 font-mono font-bold text-slate-700">{product.rate ? `₹${product.rate.toFixed(2)}` : "—"}</p>
                                      </div>
                                      <div className="rounded-md bg-slate-50 p-2">
                                        <p className="text-[10px] font-black uppercase text-slate-400">Amount</p>
                                        <p className="mt-1 font-mono font-bold text-slate-700">{product.amount ? `₹${product.amount.toFixed(2)}` : "—"}</p>
                                      </div>
                                      <div className="rounded-md bg-slate-50 p-2">
                                        <p className="text-[10px] font-black uppercase text-slate-400">Truck No</p>
                                        <p className="mt-1 font-bold break-words">{(product.truckNo || "—").toUpperCase()}</p>
                                      </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 text-xs">
                                      <div className="rounded-md bg-green-50 p-2">
                                        <p className="text-[10px] font-black uppercase text-green-700">Invoice No</p>
                                        {product.invoice_copy ? (
                                          <a href={product.invoice_copy} target="_blank" rel="noopener noreferrer" className="mt-1 block font-bold text-green-700 underline break-words">
                                            {product.invoiceNo || "View Invoice"}
                                          </a>
                                        ) : (
                                          <p className="mt-1 font-bold text-green-700 break-words">{product.invoiceNo || "—"}</p>
                                        )}
                                      </div>
                                      <div className="rounded-md bg-slate-50 p-2">
                                        <p className="text-[10px] font-black uppercase text-slate-400">Invoice Date</p>
                                        <p className="mt-1 font-bold">{product.invoiceDate ? new Date(product.invoiceDate).toLocaleDateString("en-GB") : "—"}</p>
                                      </div>
                                    </div>
                                  </div>
                                )
                              })}

                              <div className="grid grid-cols-2 gap-3 rounded-lg border bg-slate-50 p-3 text-xs">
                                <div>
                                  <p className="text-[9px] uppercase font-black text-slate-500">Total Qty</p>
                                  <p className="mt-1 font-black text-blue-700">{allProducts.reduce((sum: number, p: any) => sum + (parseFloat(p.actualQty) || 0), 0)}</p>
                                </div>
                                <div>
                                  <p className="text-[9px] uppercase font-black text-slate-500">Total Amount</p>
                                  <p className="mt-1 font-black text-blue-700">₹{allProducts.reduce((sum: number, p: any) => sum + (parseFloat(p.amount) || 0), 0).toFixed(2)}</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Verification Form (Bottom) */}
            <div className="mt-8 space-y-6 border rounded-lg p-4 sm:p-6 bg-white shadow-sm">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b pb-2">
                <CheckCircle className="h-4 w-4 text-blue-600" />
                Final Verification Logic
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Verification Status <span className="text-red-500">*</span></Label>
                  <Select value={checkData.status} onValueChange={(val) => setCheckData({ ...checkData, status: val })}>
                    <SelectTrigger className="h-10 border-2 focus:ring-2 focus:ring-blue-500 transition-all font-bold tracking-tight bg-white">
                      <SelectValue placeholder="Select Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Verified" className="font-bold text-green-600">Verified</SelectItem>
                      <SelectItem value="Issue" className="font-bold text-red-600">Issue</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Remarks {checkData.status === "Issue" && <span className="text-red-500">*</span>}</Label>
                  <Textarea
                    value={checkData.remarks}
                    onChange={(e) => setCheckData({ ...checkData, remarks: e.target.value })}
                    placeholder="Enter verification remarks..."
                    className="h-[38px] min-h-[38px]"
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="mt-8 border-t pt-4 bg-gray-50 -mx-3 sm:-mx-6 -mb-3 sm:-mb-6 px-3 sm:px-6 py-4 gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isProcessing} className="w-full sm:w-auto">
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isProcessing || !checkData.status || isReadOnly}
                className="w-full bg-blue-600 hover:bg-blue-700 min-w-[150px] sm:w-auto"
                title={isReadOnly ? "View Only Access" : "Complete Verification"}
              >
                {isProcessing ? "Processing..." : "Complete Verification"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </WorkflowStageShell>
  )
}
