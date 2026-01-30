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
import { Settings2, Loader2, ChevronDown, ChevronUp } from "lucide-react"
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
  const [productRates, setProductRates] = useState<{ [key: string]: { skuName: string; approvalQty: string; rate: string; remark: string; productName: string; rateOfMaterial: string } }>({})
  const [selectedRows, setSelectedRows] = useState<string[]>([])
  const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false)
  const [selectedProductRows, setSelectedProductRows] = useState<string[]>([])
  const [qtyValidationErrors, setQtyValidationErrors] = useState<{ [key: string]: string }>({})

  const [history, setHistory] = useState<any[]>([])
  const [expandedOrders, setExpandedOrders] = useState<string[]>([])
  
  // Date formatting helper
  const formatDate = (dateStr: string) => {
    if (!dateStr || dateStr === "—") return "—";
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      return date.toLocaleDateString("en-GB");
    } catch (e) {
      return dateStr;
    }
  };
  
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
      depoName: backendOrder.depo_name,
      orderPunchRemarks: backendOrder.order_punch_remarks,
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
        altQty: backendOrder.order_quantity,
        ratePerLtr: backendOrder.rate_per_ltr,
        rateLtr: backendOrder.rate_per_15kg,
        rateOfMaterial: backendOrder.rate_of_material, // Map rate_of_material
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
            product_name: rateData?.productName || rateData?.skuName,  // Include product_name
            approval_qty: rateData?.approvalQty ? parseFloat(rateData.approvalQty) : null,
            remaining_dispatch_qty: rateData?.approvalQty ? parseFloat(rateData.approvalQty) : null,
            rate_per_ltr: rateData?.rate ? parseFloat(rateData.rate) : null,
            rate_of_material: rateData?.rateOfMaterial ? parseFloat(rateData.rateOfMaterial) : null, // Submit to existing rate_of_material column
            remark: rateData?.remark || null, // Use individual remark
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
            remarks: rateData?.remark || "-", // Use individual remark
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

  // Group orders by base DO number (DO-022A, DO-022B → DO-022)
  const displayRows = useMemo(() => {
    const grouped: { [key: string]: any } = {}
    
    filteredPendingOrders.forEach((order) => {
      const originalOrderId = order.doNumber || order.orderNo || "DO-XXX"
      
      // Strip suffix (A, B, C...) from DO number for grouping/display
      const baseDoMatch = originalOrderId.match(/^(DO-\d+)/i)
      const baseDo = baseDoMatch ? baseDoMatch[1] : originalOrderId
      
      // Group by Order Number (baseDo) instead of Customer Name
      const groupKey = baseDo
      
      const products = (order.preApprovalProducts && order.preApprovalProducts.length > 0)
        ? order.preApprovalProducts
        : (order.products || [])

      if (!grouped[groupKey]) {
        grouped[groupKey] = {
          ...order,
          _displayDo: baseDo,
          _allBaseDos: new Set([baseDo]),
          _rowKey: groupKey,
          _allProducts: [],
          _productCount: 0,
          _ordersMap: {} // Map to store details for each base DO
        }
      } else {
        grouped[groupKey]._allBaseDos.add(baseDo)
      }
      
      // Store/Update details for this base DO group
      if (!grouped[groupKey]._ordersMap[baseDo]) {
        grouped[groupKey]._ordersMap[baseDo] = {
          orderPurpose: order.orderPurpose,
          orderType: order.orderType,
          startDate: order.startDate,
          endDate: order.endDate,
          deliveryDate: order.deliveryDate,
          transportType: order.transportType,
          contactPerson: order.contactPerson,
          whatsappNo: order.whatsappNo,
          customerAddress: order.customerAddress,
          paymentTerms: order.paymentTerms,
          advancePaymentTaken: order.advancePaymentTaken,
          advanceAmount: order.advanceAmount,
          isBrokerOrder: order.isBrokerOrder,
          brokerName: order.brokerName,
          depoName: order.depoName,
          orderPunchRemarks: order.orderPunchRemarks,
          _products: []
        }
      }
      
      // Aggregate products and link them to their original order ID
      products.forEach((prod: any) => {
        const productWithId = {
          ...prod,
          _originalOrderId: originalOrderId,
          _baseDo: baseDo,
          _rowKey: `${groupKey}-${prod._pid || prod.id}`
        }
        grouped[groupKey]._allProducts.push(productWithId)
        grouped[groupKey]._ordersMap[baseDo]._products.push(productWithId)
      })
      
      grouped[groupKey]._productCount = grouped[groupKey]._allProducts.length
    })
    
    // Finalize display strings
    Object.values(grouped).forEach((grp: any) => {
      grp._displayDo = Array.from(grp._allBaseDos).join(", ")
      
      const allTransports = new Set<string>()
      Object.values(grp._ordersMap).forEach((order: any) => {
          if (order.transportType) allTransports.add(order.transportType)
      })
      grp.transportType = Array.from(allTransports).join(", ")
    })
    
    return Object.values(grouped)
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

  const toggleSelectProductRow = (key: string) => {
    setSelectedProductRows(prev => 
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }

  const selectedItems = displayRows.filter(r => selectedRows.includes(r._rowKey))
  
  // Aggregate all products from selected items for the dialog summary count
  const allProductsFromSelectedOrders = selectedItems.flatMap(order => order._allProducts || [])

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
              <DialogContent className="sm:max-w-6xl max-w-6xl! max-h-[95vh] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                <DialogHeader className="border-b pb-4">
                  <DialogTitle className="text-xl font-bold text-slate-900 leading-none">Complete Pre-Approval ({allProductsFromSelectedOrders.length} Products)</DialogTitle>
                  <DialogDescription className="text-slate-500 mt-1.5">Select and edit products to approve. Only checked products will be processed.</DialogDescription>
                </DialogHeader>
                
                {/* Interleaved Order Details and Product Tables Section */}
                <div className="space-y-12 mb-8">
                  {selectedItems.map((customerGrp) => (
                    <div key={customerGrp._rowKey} className="space-y-6">
                      <h2 className="text-xl font-black text-blue-900 border-b-4 border-blue-100 pb-2 mt-4 uppercase tracking-tight flex items-center justify-between">
                        {customerGrp.customerName}
                        <Badge className="bg-blue-600 text-white ml-3 px-3 py-1 font-black">
                          {customerGrp._productCount} PRODUCTS
                        </Badge>
                      </h2>
                      
                      {/* Iterate through each unique base DO for this customer */}
                      {Object.entries(customerGrp._ordersMap).map(([baseDo, orderDetails]: [string, any], orderIdx) => {
                        const isExpanded = expandedOrders.includes(baseDo);
                        
                        const toggleExpand = () => {
                          setExpandedOrders(prev => 
                            isExpanded ? prev.filter(id => id !== baseDo) : [...prev, baseDo]
                          );
                        };

                        return (
                          <div key={baseDo} className="space-y-4 border-2 border-slate-100 rounded-3xl overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow">
                            <div className="bg-blue-600 px-5 py-3 flex items-center justify-between cursor-pointer" onClick={toggleExpand}>
                               <div className="flex items-center gap-4">
                                 <Badge className="bg-white text-blue-800 hover:bg-white px-4 py-1.5 text-base font-black tracking-tight rounded-full shadow-sm">
                                    ORDER: {baseDo}
                                 </Badge>
                                 <div className="flex flex-col">
                                   <span className="text-[10px] text-blue-100 font-black uppercase tracking-widest leading-none mb-1">Section {orderIdx + 1}</span>
                                   <span className="text-xs text-blue-100 font-bold leading-none">{orderDetails._products.length} Items Selected</span>
                                 </div>
                               </div>
                               <div className="flex items-center gap-3">
                                 <div className="text-[11px] text-blue-50 font-bold uppercase tracking-widest mr-2">Click to {isExpanded ? 'Hide' : 'Show'} Details</div>
                                 <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-8 w-8 text-white hover:bg-white/20 rounded-full"
                                  >
                                    {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                                  </Button>
                               </div>
                            </div>

                            {/* Collapsible Order Details */}
                            {isExpanded && (
                              <div className="px-5 pb-5 animate-in slide-in-from-top-2 duration-200">
                                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 shadow-inner">
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                                    <div>
                                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">Customer Name</p>
                                      <p className="text-sm font-bold text-slate-900 leading-tight">{customerGrp.customerName || "—"}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">Depo Name</p>
                                      <p className="text-sm font-bold text-slate-900 leading-tight">{orderDetails.depoName || "—"}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">Delivery Purpose</p>
                                      <p className="text-sm font-bold text-slate-900 leading-tight capitalize">{orderDetails.orderPurpose?.replace(/-/g, ' ') || "—"}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">Order Type</p>
                                      <p className="text-sm font-bold text-slate-900 leading-tight capitalize">{orderDetails.orderType || "—"}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">Start Date</p>
                                      <p className="text-sm font-bold text-slate-900 leading-tight">{formatDate(orderDetails.startDate)}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">End Date</p>
                                      <p className="text-sm font-bold text-slate-900 leading-tight">{formatDate(orderDetails.endDate)}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">Delivery Date</p>
                                      <p className="text-sm font-bold text-slate-900 leading-tight">{formatDate(orderDetails.deliveryDate)}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">Transport Type</p>
                                      <p className="text-sm font-bold text-slate-900 leading-tight">{orderDetails.transportType || "—"}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">Contact Person</p>
                                      <p className="text-sm font-bold text-slate-900 leading-tight">{orderDetails.contactPerson || "—"}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">WhatsApp No.</p>
                                      <p className="text-sm font-bold text-slate-900 leading-tight">{orderDetails.whatsappNo || "—"}</p>
                                    </div>
                                    <div className="col-span-2">
                                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">Customer Address</p>
                                      <p className="text-sm font-bold text-slate-900 leading-tight">{orderDetails.customerAddress || "—"}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">Payment Terms</p>
                                      <p className="text-sm font-bold text-slate-900 leading-tight capitalize">{orderDetails.paymentTerms || "—"}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">Advance Amount</p>
                                      <p className="text-base font-black text-blue-700 leading-tight">₹{orderDetails.advanceAmount || 0}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">Advance Payment</p>
                                      <p className="text-sm font-bold text-slate-900 leading-tight">{orderDetails.advancePaymentTaken ? "YES" : "NO"}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">Through Broker</p>
                                      <p className="text-sm font-bold text-slate-900 leading-tight">{orderDetails.isBrokerOrder ? orderDetails.brokerName || "Yes" : "No"}</p>
                                    </div>
                                    <div className="col-span-4 bg-amber-50 p-4 rounded-xl border border-amber-100 flex items-start gap-4">
                                      <div className="bg-amber-100 p-2 rounded-lg">
                                        <Settings2 className="h-5 w-5 text-amber-600" />
                                      </div>
                                      <div>
                                        <p className="text-[11px] text-amber-800 font-black uppercase tracking-widest mb-1 leading-none">Order Punch Remarks</p>
                                        <p className="text-sm font-medium text-slate-700 italic leading-snug">"{orderDetails.orderPunchRemarks || "No special instructions provided."}"</p>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Render Product Table for this DO */}
                            <div className="px-5 pb-6">
                              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-white">
                                <Table>
                                  <TableHeader>
                                    <TableRow className="bg-slate-50 border-b">
                                      <TableHead className="w-12 text-center text-[10px] uppercase font-black text-slate-500 tracking-wider">Select</TableHead>
                                      <TableHead className="text-[10px] uppercase font-black text-slate-500 tracking-wider">Product Info</TableHead>
                                      <TableHead className="text-[10px] uppercase font-black text-slate-500 tracking-wider">Order Qty</TableHead>
                                      <TableHead className="text-[10px] uppercase font-black text-slate-500 tracking-wider">Select SKU</TableHead>
                                      <TableHead className="text-[10px] uppercase font-black text-slate-500 tracking-wider">Rate (Mat.)</TableHead>
                                      <TableHead className="text-[10px] uppercase font-black text-slate-500 tracking-wider">Appr. Qty</TableHead>
                                      <TableHead className="text-[10px] uppercase font-black text-slate-500 tracking-wider">Final Rate</TableHead>
                                      <TableHead className="text-[10px] uppercase font-black text-slate-500 tracking-wider">Remarks</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {orderDetails._products.map((product: any) => {
                                      const rowKey = product._rowKey
                                      const isSelected = selectedProductRows.includes(rowKey)
                                      const hasError = qtyValidationErrors[rowKey]
                                      const maxQty = product.orderQty || 0
                                      
                                      return (
                                        <TableRow 
                                          key={rowKey} 
                                          className={cn(
                                            isSelected ? "bg-blue-50/40" : "",
                                            hasError ? "bg-red-50" : ""
                                          )}
                                        >
                                          <TableCell className="text-center p-3">
                                            <Checkbox 
                                              checked={isSelected}
                                              onCheckedChange={() => toggleSelectProductRow(rowKey)}
                                            />
                                          </TableCell>
                                          <TableCell className="p-3">
                                            <div className="flex flex-col">
                                              <span className="text-xs font-black text-slate-900 leading-none mb-1">{product.oilType || product.productName || "—"}</span>
                                              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">{product._originalOrderId}</span>
                                            </div>
                                          </TableCell>
                                          <TableCell className="p-3">
                                            <Badge variant="outline" className="border-blue-200 text-blue-700 font-black px-2">{maxQty}</Badge>
                                          </TableCell>
                                          <TableCell className="p-2 min-w-[180px]">
                                            <Popover open={openPopoverId === rowKey} onOpenChange={(open) => setOpenPopoverId(open ? rowKey : null)}>
                                              <PopoverTrigger asChild>
                                                <Button 
                                                  variant="outline" 
                                                  className="h-9 w-full justify-between bg-white px-3 border-slate-200 text-xs font-bold shadow-sm"
                                                  disabled={!isSelected}
                                                >
                                                  <span className="truncate">{productRates[rowKey]?.skuName || "Select SKU..."}</span>
                                                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                </Button>
                                              </PopoverTrigger>
                                              <PopoverContent className="w-[320px] p-0 shadow-2xl border-slate-200" align="start">
                                                <Command shouldFilter={false}>
                                                  <CommandInput placeholder="Search SKU catalog..." value={skuSearch} onValueChange={setSkuSearch} className="h-10 border-none focus:ring-0 text-xs font-bold" />
                                                  <CommandList className="max-h-[300px] overflow-y-auto">
                                                    {skuMaster.filter(s => s.toLowerCase().includes(skuSearch.toLowerCase())).length === 0 && (
                                                      <CommandEmpty className="py-8 text-xs text-slate-400 text-center font-bold">No SKU match found</CommandEmpty>
                                                    )}
                                                    <CommandGroup>
                                                      {skuMaster.filter(sku => sku.toLowerCase().includes(skuSearch.toLowerCase())).map((sku) => (
                                                        <CommandItem key={sku} value={sku} className="cursor-pointer py-2.5 px-4 text-xs font-bold hover:bg-blue-50 hover:text-blue-700 transition-colors" onSelect={() => {
                                                          setProductRates({ 
                                                            ...productRates, 
                                                            [rowKey]: { 
                                                              ...productRates[rowKey], 
                                                              skuName: sku,
                                                              productName: sku
                                                            } 
                                                          });
                                                          setSkuSearch(""); 
                                                          setOpenPopoverId(null);
                                                        }}>
                                                          <div className="flex items-center justify-between w-full">
                                                            <span>{sku}</span>
                                                            <Check className={cn("h-4 w-4 text-blue-600", productRates[rowKey]?.skuName === sku ? "opacity-100" : "opacity-0")} />
                                                          </div>
                                                        </CommandItem>
                                                      ))}
                                                    </CommandGroup>
                                                  </CommandList>
                                                </Command>
                                              </PopoverContent>
                                            </Popover>
                                          </TableCell>
                                          <TableCell className="p-2">
                                            <div className="relative">
                                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] font-black">₹</span>
                                              <Input 
                                                type="number"
                                                className="h-9 text-xs bg-white pl-5 font-bold border-slate-200 focus:border-blue-500 focus:ring-blue-500"
                                                value={productRates[rowKey]?.rateOfMaterial || product.rateOfMaterial || ""}
                                                onChange={(e) => setProductRates({ 
                                                  ...productRates, 
                                                  [rowKey]: { 
                                                    ...productRates[rowKey], 
                                                    rateOfMaterial: e.target.value 
                                                  } 
                                                })}
                                                disabled={!isSelected}
                                                placeholder="0.00"
                                              />
                                            </div>
                                          </TableCell>
                                          <TableCell className="p-2">
                                            <Input 
                                              type="number" 
                                              placeholder="Qty"
                                              className={cn(
                                                "h-9 text-xs bg-white font-bold border-slate-200 focus:border-blue-500 focus:ring-blue-500",
                                                hasError && "border-red-500 ring-1 ring-red-500"
                                              )}
                                              value={productRates[rowKey]?.approvalQty || ""} 
                                              onChange={(e) => {
                                                const value = e.target.value
                                                const qty = parseFloat(value)
                                                if (value && qty > maxQty) {
                                                  setQtyValidationErrors({
                                                    ...qtyValidationErrors,
                                                    [rowKey]: `Max ${maxQty}`
                                                  })
                                                } else {
                                                  const newErrors = {...qtyValidationErrors}
                                                  delete newErrors[rowKey]
                                                  setQtyValidationErrors(newErrors)
                                                }
                                                setProductRates({ 
                                                  ...productRates, 
                                                  [rowKey]: { 
                                                    ...productRates[rowKey], 
                                                    approvalQty: value 
                                                  } 
                                                })
                                              }} 
                                              disabled={!isSelected}
                                            />
                                            {hasError && <p className="text-[9px] text-red-600 font-black mt-1 uppercase tracking-tighter text-center">{hasError}</p>}
                                          </TableCell>
                                          <TableCell className="p-2">
                                            <div className="relative">
                                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-blue-400 text-[10px] font-black">₹</span>
                                              <Input 
                                                type="number" 
                                                placeholder="0.00"
                                                className="h-9 text-xs bg-white font-black text-blue-700 border-slate-200 focus:border-blue-600 focus:ring-blue-600 pl-5"
                                                value={productRates[rowKey]?.rate || ""} 
                                                onChange={(e) => setProductRates({ 
                                                  ...productRates, 
                                                  [rowKey]: { 
                                                    ...productRates[rowKey], 
                                                    rate: e.target.value 
                                                  } 
                                                })} 
                                                disabled={!isSelected}
                                              />
                                            </div>
                                          </TableCell>
                                          <TableCell className="p-2">
                                            <Input 
                                              className="h-9 text-[10px] bg-white border-slate-200 italic font-medium"
                                              value={productRates[rowKey]?.remark || ""}
                                              onChange={(e) => setProductRates({ 
                                                ...productRates, 
                                                [rowKey]: { 
                                                  ...productRates[rowKey], 
                                                  remark: e.target.value 
                                                } 
                                              })}
                                              disabled={!isSelected}
                                              placeholder="Add review remark..."
                                            />
                                          </TableCell>
                                        </TableRow>
                                      )
                                    })}
                                  </TableBody>
                                </Table>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>


                

                <DialogFooter className="sm:justify-end gap-3 border-t pt-4">
                  <Button variant="outline" onClick={() => {
                    setIsBulkDialogOpen(false)
                    setSelectedProductRows([])
                    setQtyValidationErrors({})
                  }}>Cancel</Button>
                  <Button 
                    onClick={() => {
                      // Filter to only selected products
                      const selectedProducts = allProductsFromSelectedOrders.filter(p => selectedProductRows.includes(p._rowKey))
                      const itemsToApprove = selectedProducts.map(prod => ({
                        _product: prod,
                        _rowKey: prod._rowKey,
                        _displayDo: prod._originalOrderId,
                        customerName: prod._orderData.customerName,
                        orderType: prod._orderData.orderType
                      }))
                      handleApprove(itemsToApprove)
                    }} 
                    disabled={
                      isApproving || 
                      selectedProductRows.length === 0 ||
                      Object.keys(qtyValidationErrors).length > 0 ||
                      selectedProductRows.some(key => !productRates[key]?.rate)
                    }
                    className="min-w-[200px] h-11 bg-blue-600 font-bold shadow-lg"
                  >
                    {isApproving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {isApproving ? "Processing..." : `Submit ${selectedProductRows.length} Product(s)`}
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
                  
                  // Get oil types from all products
                  const oilTypes = rawOrder._allProducts?.map((p: any) => p.oilType || p.productName).filter(Boolean).join(", ") || "—"
                  const firstProduct = rawOrder._allProducts?.[0]
                  
                  const row = {
                   orderNo: rawOrder._displayDo,
                   deliveryPurpose: rawOrder.orderPurpose || "Week On Week",
                   customerType: rawOrder.customerType || "Existing",
                   orderType: rawOrder.orderType || "Regular",
                   soNo: rawOrder._displayDo,
                   partySoDate: formatDate(rawOrder.soDate),
                   customerName: CUSTOMER_MAP[rawOrder.customerName] || rawOrder.customerName || "Acme Corp",
                   // Handle new date fields
                   startDate: formatDate(rawOrder.startDate),
                   endDate: formatDate(rawOrder.endDate),
                   deliveryDate: formatDate(rawOrder.deliveryDate),
                   // Show all oil types and product count
                   oilType: `${oilTypes} (${rawOrder._productCount} items)`,
                   ratePerLtr: firstProduct?.ratePerLtr || "—",
                   ratePer15Kg: firstProduct?.rateLtr || "—",
                   
                   itemConfirm: rawOrder.itemConfirm?.toUpperCase() || "YES",
                   productName: firstProduct?.productName || firstProduct?.oilType || "",
                   uom: firstProduct?.uom || "",
                   orderQty: firstProduct?.orderQty || "",
                   altUom: firstProduct?.altUom || "",
                   altQty: firstProduct?.altQty || "",
                   
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
                   
                   products: rawOrder._allProducts || [],
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