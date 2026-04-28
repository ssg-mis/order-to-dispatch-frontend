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
import { Upload, Settings2, FileText, ChevronUp, ChevronDown, Plus, X, Truck, ExternalLink } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ALL_WORKFLOW_COLUMNS as ALL_COLUMNS } from "@/lib/workflow-columns"
import { makeInvoiceApi, orderApi } from "@/lib/api-service"
import { cn } from "@/lib/utils"
import { useAuth } from "@/hooks/use-auth"
import { useInfiniteQuery } from "@tanstack/react-query"
import { useInView } from "react-intersection-observer"
import { Loader2 } from "lucide-react"

export default function MakeInvoicePage() {
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

  const renderDocumentLink = (value: string) => {
    if (!value || value === "—") return <p className="text-xs font-bold text-slate-400 leading-none">NOT UPLOADED</p>;
    
    // Check if it's a URL
    if (String(value).startsWith('http')) {
      return (
        <a 
          href={value} 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-1 bg-violet-50 text-violet-700 rounded-lg hover:bg-violet-100 transition-all border border-violet-200 w-fit group shadow-sm mt-0.5"
        >
          <FileText className="h-3 w-3 group-hover:scale-110 transition-transform" />
          <span className="text-[10px] font-black uppercase tracking-tight">VIEW PHOTO</span>
        </a>
      );
    }
    
    return <p className="text-xs font-bold text-slate-700 leading-none">{formatDate(value)}</p>;
  };

  const [visibleColumns, setVisibleColumns] = useState<string[]>([
    "partySoDate",
    "orderNo",
    "customerName",
    "status",
  ])

  // Selection & Dialog State
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [selectedGroups, setSelectedGroups] = useState<any[]>([])
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])
  const [expandedOrders, setExpandedOrders] = useState<string[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

  // Form State
  const [invoiceType, setInvoiceType] = useState<"independent" | "common" | "">("independent")
  const [invoiceData, setInvoiceData] = useState({
    invoiceNo: "",
    invoiceDate: new Date().toISOString().split('T')[0], // Default to today
    qty: "",
    billAmount: "",
    invoiceFile: "" as string,
    invoiceFileName: ""
  })

  // CD Amount State for products
  const [productCdData, setProductCdData] = useState<{[key: string]: {isCd: string, cdAmount: string}}>({})

  // Fetch pending invoices
  const handleFileUpload = async (file: File) => {
    if (!file) return;

    setIsUploading(true);
    try {
      const response = await orderApi.uploadFile(file);
      if (response.success) {
        setInvoiceData(p => ({
          ...p,
          invoiceFile: response.data.url,
          invoiceFileName: file.name
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

  // Pending query with infinite pagination
  const {
    data: pendingData,
    fetchNextPage: fetchNextPending,
    hasNextPage: hasNextPending,
    isFetchingNextPage: isFetchingNextPending,
    isLoading: isPendingLoading,
    refetch: refetchPending,
  } = useInfiniteQuery({
    queryKey: ["make-invoice-pending", filterValues],
    queryFn: async ({ pageParam = 1 }) => {
      const response = await makeInvoiceApi.getPending({
        page: pageParam,
        limit: 20,
        search: filterValues.search,
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
    queryKey: ["make-invoice-history", filterValues],
    queryFn: async ({ pageParam = 1 }) => {
      const response = await makeInvoiceApi.getHistory({
        page: pageParam,
        limit: 20,
        search: filterValues.search,
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
    const orderDateStr = order.timestamp
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

    // Search filter (Matches DO No, Customer Name, and Vehicle No)
    if (filterValues.search) {
      const search = filterValues.search.toLowerCase().trim()
      const orderNo = String(order.so_no || "").toLowerCase()
      const partyEntry = (order.transfer === 'yes' && order.bill_company_name) ? order.bill_company_name : (order.party_name || order.partyName || "");
      const customerName = String(partyEntry).toLowerCase()
      const vehicleNo = String(order.truck_no || "").toLowerCase()
      
      const searchMatches = 
        orderNo.includes(search) || 
        customerName.includes(search) || 
        vehicleNo.includes(search);
        
      if (!searchMatches) matches = false
    }

    return matches
  })

  /* Grouping Logic */
  const displayRows = useMemo(() => {
    const grouped: { [key: string]: any } = {}

    filteredPendingOrders.forEach((order: any) => {
      // Normalize party name robustly: trim, uppercase, and collapse spaces
      const partyEntry = (order.transfer === 'yes' && order.bill_company_name) ? order.bill_company_name : (order.party_name || order.partyName || "Unknown Customer")
      const partyName = String(partyEntry).trim().toUpperCase().replace(/\s+/g, ' ')
      
      const rawDoNumber = order.so_no || order.soNo || "—"
      const doNumber = rawDoNumber.replace(/(?<=\d)[A-Z].*$/, "")
      
      // Extract only date part (YYYY-MM-DD) robustly from LRC actual_1
      const actualDateVal = order.lrc_actual_1 || order.actual_1
      const actual1Str = actualDateVal ? (() => {
        const d = new Date(actualDateVal);
        if (isNaN(d.getTime())) return String(actualDateVal).split(/[T ]/)[0].trim();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      })() : "no-date";

      // Normalize vehicle no: trim, uppercase, and remove ALL spaces for consistent grouping
      const vehicleNo = (order.truck_no || "—").trim().toUpperCase().replace(/\s+/g, '')

      // Group by normalized Company Name, date, and Vehicle No.
      const groupKey = `${partyName}-${actual1Str}-${vehicleNo}`;

      if (!grouped[groupKey]) {
        grouped[groupKey] = {
          _rowKey: groupKey,
          customerName: partyName,
          doNumberList: new Set<string>(),
          _allProducts: [],
          _ordersMap: {}, // Still keep map structure for compatibility with existing dialog logic
          _productCount: 0
        }
      }

      const group = grouped[groupKey]
      group.doNumberList.add(doNumber)

      // Use base DO (stripping A, B, C suffixes) as the key to prevent duplicate detail blocks
      const orderKey = doNumber;
      if (!grouped[groupKey]._ordersMap[orderKey]) {
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
        amount: (((parseFloat(order.rate_of_material) || 0) * (parseFloat(order.nos_per_main_uom) || 1)) + (parseFloat(order.freight_rate) || 0)) * (parseFloat(order.actual_qty_dispatch) || 0),
        qtyToDispatch: order.actual_qty_dispatch || 0,
        truckNo: order.truck_no,
        rstNo: order.rst_no,
        grossWeight: order.gross_weight,
        tareWeight: order.tare_weight,
        netWeight: order.net_weight,
        extraWeight: order.extra_weight,
        weightDiff: order.difference || 0,
        transporterName: order.transporter_name,
        driverName: order.driver_name,
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

      grouped[groupKey]._ordersMap[orderKey]._products.push(product)
      grouped[groupKey]._allProducts.push(product)
      group._productCount = group._allProducts.length
    })

    // Finalize groups
    return Object.values(grouped).map(group => ({
      ...group,
      partySoDate: formatDate(group._allProducts[0]?.party_so_date),
      doNumber: Array.from(group.doNumberList as Set<string>).join(", "),
      processId: group._allProducts[0]?.processid || "—",
      vehicleNo: (group._allProducts[0]?.truckNo || "—").toUpperCase(),
      actual1Date: formatDate(group._allProducts[0]?.lrc_actual_1 || group._allProducts[0]?.actual_1),
      uploadSo: group._allProducts[0]?.upload_so || group._allProducts[0]?.uploadSo || null,
      freightRate: group._allProducts[0]?.freight_rate || 0,
      orderPunchRemarks: group._allProducts[0]?.order_punch_remarks || "—"
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

    // Collect and consolidate selected party groups BY COMPANY
    const targetGroups = displayRows.filter(r => selectedItems.includes(r._rowKey))
    if (targetGroups.length > 0) {
      // Consolidate targetGroups by company
      const consolidatedMap: { [key: string]: any } = {}
      targetGroups.forEach(group => {
        const company = group.customerName
        if (!consolidatedMap[company]) {
          consolidatedMap[company] = {
            ...group,
            _allProducts: [...group._allProducts],
            _ordersMap: JSON.parse(JSON.stringify(group._ordersMap)), // Deep copy to avoid mutation
            doNumber: group.doNumber,
            _rowKey: `consolidated-${company}`
          }
        } else {
          const existing = consolidatedMap[company]
          existing._allProducts.push(...group._allProducts)
          existing._productCount = existing._allProducts.length
          // Merge unique DO numbers
          const existingDos = existing.doNumber.split(", ").map((s: string) => s.trim())
          const newDos = group.doNumber.split(", ").map((s: string) => s.trim())
          existing.doNumber = Array.from(new Set([...existingDos, ...newDos])).join(", ")
          
          // Merge ordersMap content
          Object.entries(group._ordersMap).forEach(([orderKey, orderData]: [string, any]) => {
            if (!existing._ordersMap[orderKey]) {
              existing._ordersMap[orderKey] = JSON.parse(JSON.stringify(orderData))
            } else {
              existing._ordersMap[orderKey]._products.push(...orderData._products)
            }
          })
        }
      })
      
      setSelectedGroups(Object.values(consolidatedMap))
      
      // Select all products for all selected groups by default
      const allProdKeys = targetGroups.flatMap(g => g._allProducts.map((p: any) => p._rowKey))
      setSelectedProducts(allProdKeys)

      // Reset form
      setInvoiceData({
        invoiceNo: "",
        invoiceDate: new Date().toISOString().split('T')[0],
        qty: "",
        billAmount: "",
        invoiceFile: "",
        invoiceFileName: "",
      })
      setInvoiceType("independent")

      setIsDialogOpen(true)
    }
  }

  // Auto-fill Qty and Bill Amount based on selected products
  useEffect(() => {
    if (!isDialogOpen || selectedGroups.length === 0) return;

    let totalQty = 0;
    let totalBillAmount = 0;

    selectedGroups.forEach(group => {
      group._allProducts.forEach((product: any) => {
        if (selectedProducts.includes(product._rowKey)) {
          const qty = parseFloat(product.qtyToDispatch) || 0;
          // Use final_rate if available, and ADD freight_rate
          const baseRate = parseFloat(product.final_rate || product.rate_per_ltr || product.rate_per_15kg || product.rate_of_material || 0);
          const freightRate = parseFloat(product.freight_rate || 0);
          
          // CD Amount adjustment
          const cdAmt = productCdData[product.id]?.isCd === 'yes' ? parseFloat(productCdData[product.id]?.cdAmount || '0') : 0;
          
          const rate = baseRate + freightRate - cdAmt;
          totalQty += qty;
          totalBillAmount += qty * rate;
        }
      });
    });

    setInvoiceData(prev => ({
      ...prev,
      qty: totalQty.toString(),
      billAmount: totalBillAmount.toFixed(2)
    }));
  }, [selectedProducts, isDialogOpen, selectedGroups, productCdData]);

  const handleSubmit = async () => {
    if (selectedGroups.length === 0 || !invoiceData.invoiceNo || !invoiceData.invoiceFile) {
      toast({
        title: "Validation Error",
        description: "Please fill all required invoice details (Invoice Number and Copy).",
        variant: "destructive"
      })
      return
    }

    // Filter selected products across all selected groups
    const allProductsToSubmit = selectedGroups.flatMap(g =>
      g._allProducts.filter((p: any) => selectedProducts.includes(p._rowKey))
    )

    if (allProductsToSubmit.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one product to invoice",
        variant: "destructive"
      })
      return
    }

    setIsProcessing(true)
    try {
      const successfulSubmissions: any[] = []
      const failedSubmissions: any[] = []

      // Submit each selected product
      for (const product of allProductsToSubmit) {
        const submitData = {
          bill_type: invoiceType,
          invoice_no: invoiceData.invoiceNo,
          invoice_date: invoiceType === 'independent' ? invoiceData.invoiceDate : null,
          qty: invoiceData.qty || null,
          bill_amount: invoiceType === 'independent' ? invoiceData.billAmount : null,
          invoice_copy: invoiceData.invoiceFile || null,
          username: user?.username || null, // Add username for tracking
          cd_amount: productCdData[product.id]?.isCd === 'yes' ? parseFloat(productCdData[product.id]?.cdAmount || '0') : 0
        };

        try {
          console.log(`[INVOICE] Submitting for ID ${product.id}`, submitData);
          const response = await makeInvoiceApi.submit(product.id, submitData);

          if (response.success) {
            successfulSubmissions.push(product);
          } else {
            failedSubmissions.push({ product, error: response.message });
          }
        } catch (err: any) {
          console.error(`[INVOICE] Failed for ID ${product.id}`, err);
          failedSubmissions.push({ product, error: err.message });
        }
      }

      // Handle results
      if (successfulSubmissions.length > 0) {
        toast({
          title: "Invoices Created",
          description: `Successfully created invoice for ${successfulSubmissions.length} items.`,
        })

        // Refresh Data
        await refetchPending();
        await refetchHistory();

        setIsDialogOpen(false)
        setSelectedItems([]) // Clear root selection
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
        description: "An unexpected error occurred during submission.",
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
      title="Stage 9: Make Invoice (Proforma)"
      description="Create proforma invoice grouped by DO Number."
      pendingCount={displayRows.length} // Count groups
      historyData={historyOrders.map((order) => ({
        ...order,
        date: order.actual_5 ? new Date(order.actual_5).toLocaleDateString("en-GB") : "-",
        stage: "Make Invoice",
        orderNo: order.so_no,
        customerName: (order.transfer === 'yes' && order.bill_company_name) ? order.bill_company_name : order.party_name,
        status: "Completed",
        remarks: `${order.invoice_no || "Generated"} ${order.freight_rate ? `| Freight: ₹${order.freight_rate}` : ""}`,
        rawData: order,
      }))}
      onFilterChange={setFilterValues}
      showStatusFilter={true}
      stageLevel={6}
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
        <div className="flex justify-end gap-2">
          <Button
            onClick={handleOpenDialog}
            disabled={selectedItems.length === 0}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <FileText className="mr-2 h-4 w-4" />
            Create Invoice ({selectedItems.length})
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
                <TableHead className="whitespace-nowrap text-center">Actual 1</TableHead>
                <TableHead className="whitespace-nowrap text-center">DO Number</TableHead>
                <TableHead className="whitespace-nowrap text-center">Process ID</TableHead>
                <TableHead className="whitespace-nowrap text-center">Customer Name</TableHead>
                <TableHead className="whitespace-nowrap text-center">Products</TableHead>
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
                    <TableCell className="text-center py-4"><div className="h-3 w-32 bg-slate-200 animate-pulse rounded-full mx-auto" /></TableCell>
                    <TableCell className="text-center py-4"><div className="h-3 w-24 bg-slate-200 animate-pulse rounded-full mx-auto" /></TableCell>
                    <TableCell className="text-center py-4"><div className="h-3 w-16 bg-slate-200 animate-pulse rounded-full mx-auto" /></TableCell>
                    <TableCell className="text-center py-4"><div className="h-3 w-32 bg-slate-200 animate-pulse rounded-full mx-auto" /></TableCell>
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
                    <TableCell className="text-center text-xs font-medium text-blue-700">{formatDate(group._allProducts[0]?.lrc_actual_1 || group._allProducts[0]?.actual_1)}</TableCell>
                    <TableCell className="text-center text-xs font-medium">{group.doNumber}</TableCell>
                    <TableCell className="text-center text-xs font-medium">{group.processId}</TableCell>
                    <TableCell className="text-center text-xs">{group.customerName}</TableCell>
                    <TableCell className="text-center">
                      <span className="text-[10px] font-black text-slate-700 uppercase leading-tight block max-w-[150px] mx-auto">
                        {group._allProducts[0]?.productName || "—"}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-xs font-bold text-slate-700">{group.vehicleNo}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-xs text-slate-600 font-medium">{group.orderPunchRemarks}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className="bg-cyan-100 text-cyan-700">Pending Invoice</Badge>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                    No orders pending for invoice creation
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
        <DialogContent className="!max-w-[95vw] w-full max-h-[95vh] overflow-y-auto p-0">
          <div className="p-6">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-slate-900">
                Create Invoice - {selectedGroups.length > 1 ? `${selectedGroups.length} Parties` : selectedGroups[0]?.customerName}
              </DialogTitle>
            </DialogHeader>

            {selectedGroups.length > 0 && (
              <div className="space-y-6 mt-6">
                {/* 1. Stacked Company Information Bars */}
                <div className="space-y-4">
                  {selectedGroups.map((group, groupIdx) => {
                    const isExpanded = expandedOrders.includes(group._rowKey);
                    const toggleExpand = () => {
                      setExpandedOrders(prev => isExpanded ? prev.filter(id => id !== group._rowKey) : [...prev, group._rowKey]);
                    };
                    const uniqueOrderDetails = Object.values(group._ordersMap);

                    return (
                      <div key={group._rowKey} className="border-2 border-slate-100 rounded-3xl overflow-hidden bg-white shadow-sm">
                        <div className="bg-blue-600 px-5 py-3 flex items-center justify-between cursor-pointer" onClick={toggleExpand}>
                          <div className="flex items-center gap-4">
                            <Badge className="bg-white text-blue-800 hover:bg-white px-4 py-1.5 text-sm font-black tracking-tight rounded-full shadow-sm uppercase">
                              DETAILS FOR {group.customerName}
                            </Badge>
                            <div className="flex flex-col">
                              <span className="text-[10px] text-blue-100 font-black uppercase tracking-widest leading-none mb-1">PARTY {groupIdx + 1} | {group.doNumber}</span>
                              <span className="text-xs text-blue-100 font-bold leading-none">
                                {group._productCount} Items Selected
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-[11px] text-blue-50 font-bold uppercase tracking-widest mr-2 leading-none cursor-pointer">
                              {isExpanded ? 'HIDE PARTY DETAILS ▲' : 'CLICK TO SHOW PARTY DETAILS ▼'}
                            </div>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/20 rounded-full">
                              {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                            </Button>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="px-5 pb-5 pt-4 space-y-6 bg-slate-50 border-t border-slate-100 animate-in slide-in-from-top-2 duration-300">
                            {uniqueOrderDetails.map((orderDetails: any, idx) => {
                              const firstProd = orderDetails._products[0] || {};
                              return (
                                <div key={idx} className="bg-white border border-slate-100 rounded-2xl p-6 relative shadow-sm">
                                  <div className="absolute -top-3 left-6">
                                    <Badge className="bg-slate-200 text-slate-700 hover:bg-slate-200 text-[10px] font-black uppercase px-3 py-1">
                                      ORDER: {firstProd.specificOrderNo}
                                    </Badge>
                                  </div>
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                                    {/* Order Info */}
                                    <div>
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Delivery Purpose</p>
                                      <p className="text-xs font-bold text-slate-900 leading-none">{orderDetails.deliveryPurpose}</p>
                                    </div>
                                    <div>
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Start Date / End Date</p>
                                      <p className="text-xs font-bold text-slate-700 leading-none">
                                        {formatDate(orderDetails.startDate)} / {formatDate(orderDetails.endDate)}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">DO Date</p>
                                      <p className="text-xs font-bold text-slate-700">{orderDetails.partySoDate || "—"}</p>
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
                                      <p className="text-[10px] font-medium text-slate-600 leading-tight truncate" title={orderDetails.address}>{orderDetails.address}</p>
                                    </div>
                                    <div>
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Contact Person</p>
                                      <p className="text-xs font-bold text-slate-900 leading-none">{orderDetails.contactPerson} ({orderDetails.whatsapp})</p>
                                    </div>
                                    <div>
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Broker / Advance</p>
                                      <p className="text-xs font-bold text-slate-900 leading-none">{orderDetails.brokerName} / ₹{orderDetails.advanceAmount}</p>
                                    </div>

                                    <div className="md:col-span-2">
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Order Punch Remarks</p>
                                      <p className="text-[10px] font-medium text-slate-600 leading-tight italic">"{orderDetails.orderPunchRemarks || "No special instructions provided."}"</p>
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

                                    {/* Dispatch Info */}
                                    <div>
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Truck No</p>
                                      <p className="text-sm font-black text-blue-800">{(firstProd.truckNo || "—").toUpperCase()}</p>
                                    </div>
                                    <div>
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Bilty No</p>
                                      <p className="text-xs font-black text-blue-600">{firstProd.bilty_no || firstProd.biltyNo || "—"}</p>
                                    </div>
                                    <div>
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Transporter</p>
                                      <p className="text-xs font-bold text-slate-700 leading-none">{firstProd.transporterName || "—"}</p>
                                    </div>
                                    <div>
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Audit Status</p>
                                      <Badge variant="outline" className={cn("text-[9px] font-black px-2 py-0.5 uppercase", firstProd.check_status === 'Approved' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-orange-50 text-orange-700 border-orange-200')}>
                                        {firstProd.check_status || "Pending"}
                                      </Badge>
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
                                      <p className="text-xs font-bold text-slate-900 leading-none">{formatDate(firstProd.dl_valid_upto)}</p>
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

                                    <div className="md:col-span-4 h-px bg-slate-200 my-1" />

                                    {/* Weight Details */}
                                    <div>
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">RST No</p>
                                      {firstProd.weightment_slip_copy ? (
                                        <a href={firstProd.weightment_slip_copy} target="_blank" rel="noopener noreferrer" className="text-sm font-black text-blue-600 hover:text-blue-800 underline">
                                          #{firstProd.rst_no || firstProd.rstNo || "—"}
                                        </a>
                                      ) : (
                                        <p className="text-sm font-black text-slate-900 tracking-tight">#{firstProd.rst_no || firstProd.rstNo || "—"}</p>
                                      )}
                                    </div>
                                    <div>
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Gross / Tare / Net</p>
                                      <p className="text-xs font-black text-slate-900 leading-tight">
                                        {firstProd.grossWeight || firstProd.gross_weight || "0"} / {firstProd.tareWeight || firstProd.tare_weight || "0"} / <span className="text-blue-600 font-black">{((Number(firstProd.grossWeight || firstProd.gross_weight || 0) - Number(firstProd.tareWeight || firstProd.tare_weight || 0)) || "0").toString()}</span>
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Weight Diff</p>
                                      <p className="text-xs font-black text-amber-600">{firstProd.weightDiff || firstProd.difference || "0"}</p>
                                    </div>
                                    <div>
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Extra Weight</p>
                                      <p className="text-xs font-black text-purple-600">{firstProd.extraWeight || firstProd.extra_weight || "0"}</p>
                                    </div>
                                    <div className="md:col-span-2">
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Weight Diff Reason</p>
                                      <p className="text-[10px] font-bold text-red-500 italic">{firstProd.reason_of_difference_in_weight_if_any_speacefic || firstProd.reasonForDiff || "—"}</p>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* 2. Unified Product Table (Shows ALL selected groups products) */}
                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-white">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead className="w-12 text-center h-10">
                          <Checkbox
                            checked={selectedGroups.every(g => g._allProducts.every((p: any) => selectedProducts.includes(p._rowKey)))}
                            onCheckedChange={(checked) => {
                              const allKeys = selectedGroups.flatMap(g => g._allProducts.map((p: any) => p._rowKey));
                              if (checked) {
                                setSelectedProducts(prev => Array.from(new Set([...prev, ...allKeys])))
                              } else {
                                setSelectedProducts(prev => prev.filter(k => !allKeys.includes(k)))
                              }
                            }}
                          />
                        </TableHead>
                        <TableHead className="text-[10px] uppercase font-black h-10">PRODUCT INFO</TableHead>
                        <TableHead className="text-[10px] uppercase font-black text-center h-10">ACTUAL QTY DISPATCH</TableHead>
                        <TableHead className="text-[10px] uppercase font-black text-center h-10">RATE</TableHead>
                        <TableHead className="text-[10px] uppercase font-black text-center h-10">BASE AMOUNT</TableHead>
                        <TableHead className="text-[10px] uppercase font-black text-center h-10">VEHICLE NUMBER</TableHead>
                        <TableHead className="text-[10px] uppercase font-black text-center h-10">STATUS</TableHead>
                        <TableHead className="text-[10px] uppercase font-black text-center h-10">IS CD</TableHead>
                        <TableHead className="text-[10px] uppercase font-black text-center h-10">CD AMOUNT</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedGroups.flatMap(g => g._allProducts).map((product: any) => (
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
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{product.specificOrderNo}</span>
                                <span className="text-[8px] font-black text-blue-500 uppercase tracking-widest">{product.party_name || product.partyName}</span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-center p-2">
                            <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700 font-black text-xs px-3">
                              {product.qtyToDispatch || "0"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center p-2 text-xs font-bold text-slate-700">
                            <Popover>
                              <PopoverTrigger asChild>
                                <span className="cursor-pointer hover:text-blue-600 hover:underline transition-all">
                                  {(() => {
                                    const originalRate = Number(product.rate) || 0;
                                    const cdAmt = productCdData[product.id]?.isCd === 'yes' ? parseFloat(productCdData[product.id]?.cdAmount || '0') : 0;
                                    const adjustedRate = originalRate - cdAmt;
                                    return adjustedRate ? `₹${adjustedRate.toFixed(2)}` : "—";
                                  })()}
                                </span>
                              </PopoverTrigger>
                              <PopoverContent className="w-fit p-3 bg-white border-2 border-blue-100 shadow-xl rounded-xl animate-in zoom-in-95 duration-200">
                                <div className="space-y-1.5">
                                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Freight Rate</p>
                                  <p className="text-sm font-black text-blue-700 leading-none">
                                    {product.freight_rate ? `₹${product.freight_rate}` : "No Freight Rate Available"}
                                  </p>
                                </div>
                              </PopoverContent>
                            </Popover>
                          </TableCell>
                          <TableCell className="text-center p-2 text-xs font-bold text-slate-700">
                            {(() => {
                              const originalRate = Number(product.rate) || 0;
                              const cdAmt = productCdData[product.id]?.isCd === 'yes' ? parseFloat(productCdData[product.id]?.cdAmount || '0') : 0;
                              const adjustedRate = originalRate - cdAmt;
                              const qty = parseFloat(product.qtyToDispatch) || 0;
                              const adjustedAmount = adjustedRate * qty;
                              return adjustedAmount ? `₹${adjustedAmount.toFixed(2)}` : "—";
                            })()}
                          </TableCell>
                          <TableCell className="text-center p-2">
                            <div className="flex items-center justify-center gap-1.5 font-bold text-slate-700 text-xs">
                              {(product.truckNo || "—").toUpperCase()}
                            </div>
                          </TableCell>
                          <TableCell className="text-center p-2">
                            <Badge className="bg-green-100 text-green-700 border-green-200 font-black text-[9px] uppercase">Ready for Invoice</Badge>
                          </TableCell>
                          <TableCell className="text-center p-2">
                            <Select
                              value={productCdData[product.id]?.isCd || "no"}
                              onValueChange={(val) => setProductCdData(prev => ({
                                ...prev,
                                [product.id]: { ...(prev[product.id] || { cdAmount: "0" }), isCd: val }
                              }))}
                            >
                              <SelectTrigger className="h-8 text-[10px] font-bold">
                                <SelectValue placeholder="Select" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="no">No</SelectItem>
                                <SelectItem value="yes">Yes</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-center p-2">
                            {productCdData[product.id]?.isCd === 'yes' && (
                              <Input
                                type="number"
                                className="h-8 text-[10px] font-bold w-20 mx-auto"
                                value={productCdData[product.id]?.cdAmount || ""}
                                onChange={(e) => setProductCdData(prev => ({
                                  ...prev,
                                  [product.id]: { ...(prev[product.id] || { isCd: "yes" }), cdAmount: e.target.value }
                                }))}
                                placeholder="Amount"
                              />
                            )}
                          </TableCell>
                        </TableRow>
                      ))}

                      {/* Summary Row */}
                      <TableRow className="bg-slate-50 font-black h-12 border-t-2 border-slate-200">
                        <TableCell />
                        <TableCell className="text-[10px] uppercase font-black text-slate-900">Total Selection</TableCell>
                        <TableCell className="text-center">
                          <Badge className="bg-blue-600 text-white font-black text-xs px-3">
                            {selectedGroups.flatMap(g => g._allProducts).filter(p => selectedProducts.includes(p._rowKey)).reduce((sum, p) => sum + (parseFloat(p.qtyToDispatch) || 0), 0)}
                          </Badge>
                        </TableCell>
                        <TableCell />
                        <TableCell className="text-center text-xs text-blue-700 font-black">
                          ₹{selectedGroups.flatMap(g => g._allProducts)
                            .filter(p => selectedProducts.includes(p._rowKey))
                            .reduce((sum, p) => {
                              const originalRate = Number(p.rate) || 0;
                              const cdAmt = productCdData[p.id]?.isCd === 'yes' ? parseFloat(productCdData[p.id]?.cdAmount || '0') : 0;
                              const adjustedRate = originalRate - cdAmt;
                              const qty = parseFloat(p.qtyToDispatch) || 0;
                              return sum + (adjustedRate * qty);
                            }, 0).toFixed(2)}
                        </TableCell>
                        <TableCell colSpan={4} />
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
                {/* 3. Invoice Form */}
                <div className="space-y-6 border rounded-lg p-6 bg-white shadow-sm">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b pb-2">
                    <FileText className="h-4 w-4 text-blue-600" />
                    Invoice Details
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <Label>Invoice Number <span className="text-red-500">*</span></Label>
                      <Input
                        value={invoiceData.invoiceNo}
                        onChange={(e) => setInvoiceData({ ...invoiceData, invoiceNo: e.target.value })}
                        placeholder="Enter Invoice No"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Upload Invoice Copy <span className="text-red-500">*</span></Label>
                      <p className="text-[10px] text-slate-400">Max file size: 10 MB</p>
                      <div className="flex items-center gap-2">
                        <Input
                          type="file"
                          id="invoice-file"
                          accept=".pdf,.jpg,.png"
                          onChange={(e) => {
                            if (e.target.files?.[0]) {
                              handleFileUpload(e.target.files[0])
                            }
                          }}
                          className="hidden"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full justify-start text-xs h-9"
                          onClick={() => document.getElementById('invoice-file')?.click()}
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          {invoiceData.invoiceFileName || 'Choose File'}
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Invoice Date <span className="text-red-500">*</span></Label>
                      <Input
                        type="date"
                        value={invoiceData.invoiceDate}
                        onChange={(e) => setInvoiceData({ ...invoiceData, invoiceDate: e.target.value })}
                      />
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
                disabled={isProcessing || !invoiceData.invoiceNo || isReadOnly}
                className="bg-blue-600 hover:bg-blue-700 min-w-[150px]"
                title={isReadOnly ? "View Only Access" : "Generate Invoice"}
              >
                {isProcessing ? "Processing..." : "Generate Invoice"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </WorkflowStageShell>
  )
}
