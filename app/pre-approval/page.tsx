"use client"

import { Card } from "@/components/ui/card"
import { WorkflowStageShell } from "@/components/workflow/workflow-stage-shell"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { Settings2, Loader2 } from "lucide-react"
import { useState, useEffect, useMemo } from "react"
import { saveWorkflowHistory } from "@/lib/storage-utils"
import { skuApi, preApprovalApi } from "@/lib/api-service"
import { Check, ChevronsUpDown, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"



export default function PreApprovalPage() {
  const { toast } = useToast()
  const router = useRouter()
  const PAGE_COLUMNS = [
    { id: "soNo", label: "DO No." },
    { id: "deliveryPurpose", label: "Order Type (Delivery Purpose)" },
    { id: "startDate", label: "Start Date" },
    { id: "endDate", label: "End Date" },
    { id: "deliveryDate", label: "Delivery Date" },
    { id: "orderType", label: "Order Type" },
    { id: "customerType", label: "Customer Type" },
    { id: "partySoDate", label: "Party DO Date" },
    { id: "customerName", label: "Customer Name" },
    { id: "oilType", label: "Oil Type" },
    { id: "ratePer15Kg", label: "Rate Per 15 kg" },
    { id: "ratePerLtr", label: "Rate Per Ltr." },
    { id: "productName", label: "Product Name" },
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
    { id: "uploadSo", label: "Upload DO." },
  ]

  const [visibleColumns, setVisibleColumns] = useState<string[]>([
    "soNo",
    "customerName",
    "deliveryPurpose",
    "deliveryDate",
    "oilType",
    "ratePer15Kg"
  ])
  const [isApproving, setIsApproving] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [pendingOrders, setPendingOrders] = useState<any[]>([])
  const [preApprovalData, setPreApprovalData] = useState<any>(null)
  const [productRates, setProductRates] = useState<{ [key: string]: { skuName: string; approvalQty: string; rate: string; remark: string } }>({})
  const [overallRemark, setOverallRemark] = useState("")
  const [selectedRows, setSelectedRows] = useState<string[]>([])
  const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false)

  const [history, setHistory] = useState<any[]>([])
  
  // SKU State
  const [skuMaster, setSkuMaster] = useState<string[]>([])
  const [skuSearch, setSkuSearch] = useState("")

  // Fetch SKUs
  useEffect(() => {
    const fetchSkus = async () => {
      try {
        const response = await skuApi.getAll()
        if (response.success && Array.isArray(response.data)) {
          // Map to just names or keep full objects if more info needed later
          // Currently the UI seems to just list names in the command list
          setSkuMaster(response.data.map((sku: any) => sku.sku_name))
        }
      } catch (error) {
        console.error("Failed to fetch SKUs:", error)
        toast({
          title: "Warning",
          description: "Failed to load SKU list. Please try refeshing.",
          variant: "destructive",
        })
      }
    }
    
    fetchSkus()
  }, [])



  // Map backend data (snake_case) to frontend format (camelCase)
  const mapBackendOrderToFrontend = (backendOrder: any) => {
    return {
      id: backendOrder.id,
      doNumber: backendOrder.order_no,
      orderNo: backendOrder.order_no,
      customerName: backendOrder.customer_name,
      orderType: backendOrder.order_type,
      customerType: backendOrder.customer_type,
      orderPurpose: backendOrder.order_type_delivery_purpose,
      deliveryDate: backendOrder.delivery_date,
      startDate: backendOrder.start_date,
      endDate: backendOrder.end_date,
      soDate: backendOrder.party_so_date,
      contactPerson: backendOrder.customer_contact_person_name,
      whatsappNo: backendOrder.customer_contact_person_whatsapp_no,
      customerAddress: backendOrder.customer_address,
      paymentTerms: backendOrder.payment_terms,
      advancePaymentTaken: backendOrder.advance_payment_to_be_taken,
      advanceAmount: backendOrder.advance_amount,
      isBrokerOrder: backendOrder.is_order_through_broker,
      brokerName: backendOrder.broker_name,
      transportType: backendOrder.type_of_transporting,
      totalWithGst: backendOrder.total_with_gst,
      // Product info (for individual row from DB)
      preApprovalProducts: [{
        _pid: `${backendOrder.id}-${backendOrder.order_no}`,
        id: backendOrder.id,
        productName: backendOrder.product_name,
        oilType: backendOrder.oil_type,
        uom: backendOrder.uom,
        orderQty: backendOrder.order_quantity,
        altUom: backendOrder.alternate_uom,
        altQty: backendOrder.alternate_qty_kg,
        ratePerLtr: backendOrder.rate_per_ltr,
        rateLtr: backendOrder.rate_per_15kg,
        skuName: backendOrder.sku_name,
        approvalQty: backendOrder.approval_qty,
      }]
    };
  };

  // Fetch pending orders from backend
  const fetchPendingOrders = async () => {
    try {
      setIsLoading(true);
      const response = await preApprovalApi.getPending({ limit: 1000 });
      
      if (response.success && response.data.orders) {
        const mappedOrders = response.data.orders.map(mapBackendOrderToFrontend);
        setPendingOrders(mappedOrders);
      }
    } catch (error: any) {
      console.error("Failed to fetch pending orders:", error);
      toast({
        title: "Error",
        description: error?.message || "Failed to load pending orders from server",
        variant: "destructive",
      });
      setPendingOrders([]); // Clear on error - don't use cache
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch history from backend
  const fetchHistory = async () => {
    try {
      const response = await preApprovalApi.getHistory({ limit: 1000 });
      
      if (response.success && response.data.orders) {
        const mappedHistory = response.data.orders.map((order: any) => ({
          orderNo: order.order_no,
          customerName: order.customer_name,
          stage: "Pre-Approval",
          status: "Completed" as const,
          processedBy: "System",
          timestamp: order.actual_1,
          date: order.actual_1 ? new Date(order.actual_1).toLocaleDateString("en-GB") : "-",
          remarks: order.remark || "-",
        }));
        setHistory(mappedHistory);
      }
    } catch (error: any) {
      console.error("Failed to fetch history:", error);
      setHistory([]); // Clear on error - don't use cache
    }
  };

  useEffect(() => {
    // Fetch data from backend
    fetchPendingOrders();
    fetchHistory();
    
    // Load Pre-Approval Draft Data (if any)
    const savedPreApprovalData = localStorage.getItem("preApprovalData");
    if (savedPreApprovalData) {
      setPreApprovalData(JSON.parse(savedPreApprovalData));
    }
  }, [])

  const handleApprove = async (itemsToApprove: any[]) => {
    setIsApproving(true)
    try {
      const successfulApprovals: any[] = []
      const failedApprovals: any[] = []
      
      // Submit each approval to backend
      for (const item of itemsToApprove) {
        try {
          const product = item._product
          const productKey = item._rowKey
          const rateData = productRates[productKey]
          
          // Prepare submission data
          const submissionData = {
            sku_name: rateData?.skuName,
            approval_qty: rateData?.approvalQty ? parseFloat(rateData.approvalQty) : null,
            rate_per_ltr: rateData?.rate ? parseFloat(rateData.rate) : null,
            remark: overallRemark || null,
          }
          
          // Call backend API to submit pre-approval
          await preApprovalApi.submit(product.id, submissionData)
          
          successfulApprovals.push(item)
          
          // Also save to workflow history for local tracking
          const historyEntry = {
            orderNo: item._displayDo,
            customerName: item.customerName || "Unknown",
            stage: "Pre-Approval",
            status: "Completed" as const,
            processedBy: "Current User",
            timestamp: new Date().toISOString(),
            remarks: overallRemark || "-",
            orderType: item.orderType || "pre-approval"
          }
          saveWorkflowHistory(historyEntry)
          
        } catch (error: any) {
          console.error(`Failed to approve order ${item._displayDo}:`, error)
          failedApprovals.push({ item, error: error?.message || "Unknown error" })
        }
      }
      
      // Show results
      if (successfulApprovals.length > 0) {
        toast({
          title: "Approvals Submitted",
          description: `${successfulApprovals.length} product(s) approved successfully.`,
        })
        
        // Refresh data from backend
        await fetchPendingOrders()
        await fetchHistory()
      }
      
      if (failedApprovals.length > 0) {
        toast({
          title: "Some Approvals Failed",
          description: `${failedApprovals.length} approval(s) failed. Please try again.`,
          variant: "destructive",
        })
      }
      
      setSelectedRows([])
      setIsBulkDialogOpen(false)
      setProductRates({})
      setOverallRemark("")
      
      // Navigate if all pending items are processed
      if (successfulApprovals.length > 0 && pendingOrders.length === successfulApprovals.length) {
        setTimeout(() => {
            router.push("/approval-of-order")
        }, 1500)
      }
    } finally {
      setIsApproving(false)
    }
  }



  const destinationColumnsCount = visibleColumns.length + 1
  
  /* Extract unique customer names */
  const customerNames = Array.from(new Set(pendingOrders.map(order => order.customerName || "Unknown")))

  const [filterValues, setFilterValues] = useState({
      status: "",
      startDate: "",
      endDate: "",
      partyName: ""
  })
  const [openPopoverId, setOpenPopoverId] = useState<string | null>(null)

  const filteredPendingOrders = pendingOrders.filter(order => {
      let matches = true
      
      // Filter by Party Name
      if (filterValues.partyName && filterValues.partyName !== "all" && order.customerName !== filterValues.partyName) {
          matches = false
      }

      // Filter by Date Range (using deliveryDate or soDate as fallback)
      const orderDateStr = order.deliveryDate || order.soDate
      if (orderDateStr) {
          const orderDate = new Date(orderDateStr)
          if (filterValues.startDate) {
              const start = new Date(filterValues.startDate)
              if (orderDate < start) matches = false
          }
          if (filterValues.endDate) {
              const end = new Date(filterValues.endDate)
              if (orderDate > end) matches = false
          }
      }

      // Filter by Status (On Time / Expire)
      // "Expire" = deliveryDate is in the past
      // "On Time" = deliveryDate is today or future
      if (filterValues.status) {
          const today = new Date()
          today.setHours(0, 0, 0, 0) // normalized today
          
          if (orderDateStr) {
             const deliveryDate = new Date(orderDateStr)
             if (filterValues.status === "expire") {
                 if (deliveryDate >= today) matches = false
             } else if (filterValues.status === "on-time") {
                 if (deliveryDate < today) matches = false
             }
          }
      }

      return matches
  })

  // Flatten orders for table display with suffixes
  const displayRows = useMemo(() => {
    const rows: any[] = []
    filteredPendingOrders.forEach((order) => {
      const orderId = order.doNumber || order.orderNo || "DO-XXX"
      const products = (order.preApprovalProducts && order.preApprovalProducts.length > 0)
        ? order.preApprovalProducts
        : (order.products || []);

      if (products.length === 0) {
        rows.push({ 
          ...order, 
          _product: null, 
          _displayDo: order.doNumber || order.orderNo || order.soNumber || "DO-XXX",
          _rowKey: `${orderId}-null`
        })
      } else {
        products.forEach((prod: any) => {
          rows.push({ 
            ...order, 
            _product: prod, 
            _displayDo: orderId,
            _rowKey: `${orderId}-${prod._pid}`
          })
        });
      }
    })
    return rows
  }, [filteredPendingOrders])

  const toggleSelectAll = () => {
    if (selectedRows.length === displayRows.length) {
      setSelectedRows([])
    } else {
      setSelectedRows(displayRows.map(r => r._rowKey))
    }
  }

  const toggleSelectRow = (key: string) => {
    setSelectedRows(prev => 
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }

  const selectedItems = displayRows.filter(r => selectedRows.includes(r._rowKey))

  return (
    <WorkflowStageShell
      title="Stage 2: Pre-Approval"
      description="Review and set rates for item requirements."
      pendingCount={displayRows.length}
      historyData={history}
        partyNames={customerNames}
        onFilterChange={setFilterValues}
    >
      <div className="space-y-4">
        <div className="flex justify-end gap-2">
          {selectedRows.length > 0 && (
            <Dialog open={isBulkDialogOpen} onOpenChange={setIsBulkDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700 shadow-md">
                  Process Selected ({selectedRows.length})
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-6xl !max-w-6xl max-h-[95vh] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                <DialogHeader className="border-b pb-4">
                  <DialogTitle className="text-xl font-bold text-slate-900 leading-none">Complete Pre-Approval ({selectedRows.length} Items)</DialogTitle>
                  <DialogDescription className="text-slate-500 mt-1.5">Enter rates and SKU details for all selected products below.</DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 py-3">
                  {selectedItems.map((item, idx) => {
                    const product = item._product;
                    const pId = product.id ? String(product.id) : `idx-${idx}`;
                    return (
                      <div key={item._rowKey} className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm hover:border-blue-200 transition-all flex flex-col gap-2">
                        {/* Header: Item Identity */}
                        <div className="border-b border-slate-50 pb-1.5">
                          <div className="flex justify-between items-start mb-0.5">
                             <Badge variant="secondary" className="text-[9px] font-black px-1 py-0 rounded bg-blue-50 text-blue-700 border-blue-100">{item._displayDo}</Badge>
                             <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">{item.orderType}</span>
                          </div>
                          <h4 className="text-[10px] font-bold text-slate-800 truncate leading-tight" title={item.customerName}>{item.customerName}</h4>
                          <p className="text-[9px] text-slate-500 truncate font-semibold leading-tight">{product.oilType || product.productName || "No Product"}</p>
                        </div>

                        {/* Input Grid */}
                        <div className="space-y-2">
                          {/* SKU Selection */}
                          <div className="space-y-1">
                             <Label className="text-[8px] uppercase font-bold text-slate-400 ml-0.5">Select SKU</Label>
                             <Popover open={openPopoverId === item._rowKey} onOpenChange={(open) => setOpenPopoverId(open ? item._rowKey : null)}>
                                <PopoverTrigger asChild>
                                  <Button variant="outline" className="h-8 w-full justify-between bg-white px-2 border-slate-200 text-[10px] text-slate-700">
                                    <span className="truncate">{productRates[item._rowKey]?.skuName || "Select SKU.."}</span>
                                    <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[300px] p-0 shadow-xl border-slate-200" align="start">
                                  <Command shouldFilter={false}>
                                    <CommandInput placeholder="Search SKU..." value={skuSearch} onValueChange={setSkuSearch} className="h-9 border-none focus:ring-0 text-xs" />
                                    <CommandList className="max-h-[250px] overflow-y-auto">
                                      {skuMaster.filter(s => s.toLowerCase().includes(skuSearch.toLowerCase())).length === 0 && (
                                        <CommandEmpty className="py-6 text-xs text-slate-500 text-center font-medium">No SKU found</CommandEmpty>
                                      )}
                                      <CommandGroup>
                                        {skuMaster.filter(sku => sku.toLowerCase().includes(skuSearch.toLowerCase())).map((sku) => (
                                          <CommandItem key={sku} value={sku} className="cursor-pointer py-1.5 px-3 text-[10px]" onSelect={() => {
                                            setProductRates({ ...productRates, [item._rowKey]: { ...productRates[item._rowKey], skuName: sku } });
                                            setSkuSearch(""); setOpenPopoverId(null);
                                          }}>
                                            <Check className={cn("mr-2 h-3 w-3 text-blue-600", productRates[item._rowKey]?.skuName === sku ? "opacity-100" : "opacity-0")} />
                                            {sku}
                                          </CommandItem>
                                        ))}
                                      </CommandGroup>
                                    </CommandList>
                                  </Command>
                                </PopoverContent>
                             </Popover>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            {/* Approval Qty */}
                            <div className="space-y-1">
                               <Label className="text-[8px] uppercase font-bold text-slate-400 ml-0.5">App. Qty</Label>
                               <Input 
                                  type="number" 
                                  placeholder="Qty"
                                  className="h-8 bg-white text-[10px] px-2 border-slate-200 focus:ring-1 focus:ring-blue-100" 
                                  value={productRates[item._rowKey]?.approvalQty || ""} 
                                  onChange={(e) => setProductRates({ ...productRates, [item._rowKey]: { ...productRates[item._rowKey], approvalQty: e.target.value } })} 
                               />
                            </div>

                            {/* Required Rate */}
                            <div className="space-y-1">
                               <Label className="text-[8px] uppercase font-bold text-slate-400 ml-0.5">Req. Rate</Label>
                               <Input 
                                  type="number" 
                                  placeholder="Rate"
                                  className="h-8 bg-white text-[10px] px-2 border-slate-200 font-bold text-blue-700 focus:ring-1 focus:ring-blue-100" 
                                  value={productRates[item._rowKey]?.rate || ""} 
                                  onChange={(e) => setProductRates({ ...productRates, [item._rowKey]: { ...productRates[item._rowKey], rate: e.target.value } })} 
                               />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-bold text-slate-700 uppercase tracking-tight">Overall Remark</Label>
                    <Textarea placeholder="Enter internal remarks..." className="min-h-[80px] bg-white border-slate-200" value={overallRemark} onChange={(e) => setOverallRemark(e.target.value)} />
                  </div>
                

                <DialogFooter className="sm:justify-end gap-3 border-t pt-4">
                  <Button variant="outline" onClick={() => setIsBulkDialogOpen(false)}>Cancel</Button>
                  <Button 
                    onClick={() => handleApprove(selectedItems)} 
                    disabled={isApproving || selectedItems.some(item => !productRates[item._rowKey]?.rate)}
                    className="min-w-[200px] h-11 bg-blue-600 font-bold shadow-lg"
                  >
                    {isApproving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {isApproving ? "Processing..." : "Submit All Approvals"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="bg-transparent shadow-sm">
                <Settings2 className="mr-2 h-4 w-4" />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[250px] max-h-[400px] overflow-y-auto">
              <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {PAGE_COLUMNS.map((col) => (
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

        <Card className="border-none shadow-sm overflow-auto max-h-[600px]">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-card shadow-sm">
              <TableRow>
                <TableHead className="w-12 text-center">
                  <Checkbox 
                    checked={displayRows.length > 0 && selectedRows.length === displayRows.length}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                {PAGE_COLUMNS.filter((col) => visibleColumns.includes(col.id)).map((col) => (
                  <TableHead key={col.id} className="whitespace-nowrap text-center">
                    {col.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={visibleColumns.length + 1} className="text-center py-8">
                    <div className="flex items-center justify-center gap-2 text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>Loading pending approvals...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : displayRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={visibleColumns.length + 1} className="text-center py-8 text-muted-foreground">
                    No Data pending for Pre Approval
                  </TableCell>
                </TableRow>
              ) : displayRows.map((rawOrder, i) => {
                  const CUSTOMER_MAP: Record<string, string> = {
                    cust1: "Acme Corp",
                    cust2: "Global Industries",
                    cust3: "Zenith Supply",
                  }
                  
                  const row = {
                   orderNo: rawOrder._displayDo,
                   deliveryPurpose: rawOrder.orderPurpose || "Week On Week",
                   customerType: rawOrder.customerType || "Existing",
                   orderType: rawOrder.orderType || "Regular",
                   soNo: rawOrder._displayDo,
                   partySoDate: rawOrder.soDate || "2024-03-21",
                   customerName: CUSTOMER_MAP[rawOrder.customerName] || rawOrder.customerName || "Acme Corp",
                   // Handle new date fields
                   startDate: rawOrder.startDate || "—",
                   endDate: rawOrder.endDate || "—",
                   deliveryDate: rawOrder.deliveryDate || "—",
                   // Handle Rates Aggregation (Single product now)
                   oilType: rawOrder._product?.oilType || rawOrder._product?.productName || "—",
                   ratePerLtr: rawOrder._product?.ratePerLtr || "—",
                   ratePer15Kg: rawOrder._product?.rateLtr || "—",
                   
                   itemConfirm: rawOrder.itemConfirm?.toUpperCase() || "YES",
                   productName: rawOrder._product?.productName || rawOrder._product?.oilType || "",
                   uom: rawOrder._product?.uom || "",
                   orderQty: rawOrder._product?.orderQty || "",
                   altUom: rawOrder._product?.altUom || "",
                   altQty: rawOrder._product?.altQty || "",
                   
                   // Extended Columns
                   totalWithGst: rawOrder.totalWithGst || "—",
                   transportType: rawOrder.transportType || "—",
                   contactPerson: rawOrder.contactPerson || "—",
                   whatsapp: rawOrder.whatsappNo || "—",
                   address: rawOrder.customerAddress || "—",
                   paymentTerms: rawOrder.paymentTerms || "—",
                   advanceTaken: rawOrder.advancePaymentTaken || "—",
                   advanceAmount: rawOrder.advanceAmount || "—",
                   isBroker: rawOrder.isBrokerOrder || "—",
                   brokerName: rawOrder.brokerName || "—",
                   uploadSo: "so_document.pdf",
                   
                   products: rawOrder._product ? [rawOrder._product] : [],
                 }

                return (
                 <TableRow key={rawOrder._rowKey} className={selectedRows.includes(rawOrder._rowKey) ? "bg-blue-50/50" : ""}>
                   <TableCell className="text-center">
                     <Checkbox 
                       checked={selectedRows.includes(rawOrder._rowKey)}
                       onCheckedChange={() => toggleSelectRow(rawOrder._rowKey)}
                     />
                   </TableCell>
                   {PAGE_COLUMNS.filter((col) => visibleColumns.includes(col.id)).map((col) => (
                     <TableCell key={col.id} className="whitespace-nowrap text-center">
                       {row[col.id as keyof typeof row]}
                     </TableCell>
                   ))}
                 </TableRow>
                )
               })}
            </TableBody>
          </Table>
        </Card>
      </div>
    </WorkflowStageShell>
  )
}