"use client"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"

import { useEffect, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { WorkflowStageShell } from "@/components/workflow/workflow-stage-shell"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { Checkbox } from "@/components/ui/checkbox"
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Settings2 } from "lucide-react"
import { dispatchPlanningApi } from "@/lib/api-service"

export default function DispatchMaterialPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [pendingOrders, setPendingOrders] = useState<any[]>([])
  const [historyOrders, setHistoryOrders] = useState<any[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [selectedOrders, setSelectedOrders] = useState<string[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [dispatchData, setDispatchData] = useState({
    dispatchDate: "",
    dispatchTime: "",
    warehouseLocation: "",
    materialReady: false,
    packagingComplete: false,
    labelsAttached: false,
  })
  const [dispatchDetails, setDispatchDetails] = useState<Record<string, { qty: string, transportType?: string, deliveryFrom?: string }>>({})

  const PAGE_COLUMNS = [
    { id: "orderNo", label: "DO Number" },
    { id: "customerName", label: "Customer Name" },
    { id: "productName", label: "Products Name" },
    { id: "transportType", label: "Type of Transporting" },
    { id: "status", label: "Status" },
    
    // Requested Options
    { id: "soNo", label: "DO No." },
    { id: "deliveryPurpose", label: "Order Type (Delivery Purpose)" },
    { id: "startDate", label: "Start Date" },
    { id: "endDate", label: "End Date" },
    { id: "deliveryDate", label: "Delivery Date" },
    { id: "orderType", label: "Order Type" },
    { id: "customerType", label: "Customer Type" },
    { id: "partySoDate", label: "Party DO Date" },
    { id: "oilType", label: "Oil Type" },
    { id: "ratePer15Kg", label: "Rate Per 15 kg" },
    { id: "ratePerLtr", label: "Rate Per Ltr" },
    { id: "rate", label: "Rate" },
    { id: "totalWithGst", label: "Total Amount with GST" },
    { id: "contactPerson", label: "Customer Contact Person Name" },
    { id: "whatsapp", label: "Customer Contact Person Whatsapp No." },
    { id: "address", label: "Customer Address" },
    { id: "paymentTerms", label: "Payment Terms" },
    { id: "advanceTaken", label: "Advance Payment to be Taken" },
    { id: "advanceAmount", label: "Advance Amount" },
    { id: "isBroker", label: "Is this order Through Broker" },
    { id: "brokerName", label: "Broker Name (If Order Through Broker)" },
    { id: "uploadSo", label: "Upload DO" },
    { id: "skuName", label: "SKU Name" },
    { id: "approvalQty", label: "Approval Qty" },
    { id: "skuRates", label: "Take Required Rates of Each Item" },
    { id: "remark", label: "Remark" },
  ]

  const [visibleColumns, setVisibleColumns] = useState<string[]>([
    "orderNo",
    "customerName",
    "productName",
    "transportType",
    "status",
  ])


  // Fetch pending dispatches from backend API
  const fetchPendingDispatches = async () => {
    try {
      console.log('[DISPATCH] Fetching pending dispatches from API...');
      const response = await dispatchPlanningApi.getPending({ limit: 1000 });
      console.log('[DISPATCH] API Response:', response);
      
      if (response.success && response.data.dispatches) {
        setPendingOrders(response.data.dispatches);
        console.log('[DISPATCH] Loaded', response.data.dispatches.length, 'pending dispatches');
      }
    } catch (error: any) {
      console.error("[DISPATCH] Failed to fetch pending dispatches:", error);
      toast({
        title: "Error",
        description: error?.message || "Failed to load pending dispatches",
        variant: "destructive",
      });
      setPendingOrders([]); // Clear on error - don't use cache
    }
  };

  // Fetch dispatch history from backend API
  const fetchDispatchHistory = async () => {
    try {
      const response = await dispatchPlanningApi.getHistory({ limit: 1000 });
      
      if (response.success && response.data.dispatches) {
        setHistoryOrders(response.data.dispatches);
      }
    } catch (error: any) {
      console.error("[DISPATCH] Failed to fetch history:", error);
      setHistoryOrders([]); // Clear on error - don't use cache
    }
  };

  useEffect(() => {
    fetchPendingDispatches();
    fetchDispatchHistory();
  }, [])

  // State for popup selection
  const [selectedGroup, setSelectedGroup] = useState<any>(null)
  const [dialogSelectedProducts, setDialogSelectedProducts] = useState<string[]>([])

  const toggleSelectAll = () => {
    // In grouped view, selecting all might not be the primary action, 
    // but if needed, we can select all *GROUPS* or just rely on individual group action.
    // For now, let's keep it simple: Select all visible groups
    if (selectedOrders.length === displayRows.length) {
      setSelectedOrders([])
    } else {
      setSelectedOrders(displayRows.map((row) => row._rowKey))
    }
  }

  const toggleSelectOrder = (rowKey: string) => {
    if (!rowKey) return
    if (selectedOrders.includes(rowKey)) {
      setSelectedOrders(selectedOrders.filter((id) => id !== rowKey))
    } else {
      setSelectedOrders([...selectedOrders, rowKey])
    }
  }

  const handleOpenDialog = () => {
      // Pick the first selected order to display details
      // In a real bulk scenario with DIFFERENT orders, we might need a wizard.
      // But typically dispatch planning is done per DO.
      // We will take the first selected group.
      const firstKey = selectedOrders[0];
      const group = displayRows.find(r => r._rowKey === firstKey);
      
      if (group) {
          setSelectedGroup(group)
          // Default: Select ALL products in the group for dispatch
          setDialogSelectedProducts(group._allProducts.map((p: any) => p._rowKey))
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



  const handleBulkDispatch = async () => {
    setIsProcessing(true)
    try {
      // Logic: Iterate through dialogSelectedProducts which contains keys of selected PRODUCTS
      // Find the product in selectedGroup._allProducts
      if (!selectedGroup || dialogSelectedProducts.length === 0) {
        toast({
          title: "No Items Selected",
          description: "Please select items to dispatch",
          variant: "destructive",
        });
        return;
      }

      const successfulDispatches: any[] = []
      const failedDispatches: any[] = []
      
      const itemsToProcess = selectedGroup._allProducts.filter((p: any) => dialogSelectedProducts.includes(p._rowKey))

      // Submit each item to backend API
      for (const item of itemsToProcess) {
        const orderId = item.id // Use the order_dispatch table ID from backend
        const rowKey = item._rowKey;
        
        // Extract values from input state or default to item values
        // Default delivery from "in-stock" if not set
        const deliveryVal = dispatchDetails[rowKey]?.deliveryFrom || "in-stock";
        // Default qty to orderQty if not set
        const dispatchQty = dispatchDetails[rowKey]?.qty || item.orderQty;
        
        try {
          if (orderId) {
            // Call backend API to submit dispatch planning
            const dispatchData = {
              dispatch_from: deliveryVal,
              dispatch_qty: dispatchQty,
            };

            console.log('[DISPATCH] Submitting dispatch planning for order ID:', orderId, dispatchData);
            const response = await dispatchPlanningApi.submit(orderId, dispatchData);
            console.log('[DISPATCH] API Response:', response);
            
            if (response.success) {
              successfulDispatches.push({ item, dsrNumber: response.data?.dsrNumber });
            } else {
              failedDispatches.push({ item, error: response.message || 'Unknown error' });
            }
          } else {
            console.warn('[DISPATCH] Skipping - no order ID found for:', item);
            failedDispatches.push({ item, error: 'No order ID found' });
          }
        } catch (error: any) {
          console.error('[DISPATCH] Failed to submit dispatch planning:', error);
          failedDispatches.push({ item, error: error?.message || error?.toString() || 'Unknown error' });
        }
      }

      // Show results
      if (successfulDispatches.length > 0) {
        toast({
          title: "Dispatches Submitted Successfully",
          description: `${successfulDispatches.length} dispatch(es) submitted. DSR numbers created.`,
        });

        // Clear selections
        setSelectedOrders([]);
        setDispatchDetails({});
        setDialogSelectedProducts([]);
        setIsDialogOpen(false); // Close dialog

        // Refresh data from backend
        await fetchPendingDispatches();
        await fetchDispatchHistory();

        // Optionally navigate to actual dispatch after a delay
        setTimeout(() => {
          router.push("/actual-dispatch")
        }, 1500)
      }

      if (failedDispatches.length > 0) {
        console.error('[DISPATCH] Failed dispatches:', failedDispatches);
        toast({
          title: "Some Dispatches Failed",
          description: `${failedDispatches.length} dispatch(es) failed. Check console for details.`,
          variant: "destructive",
        })
      }
    } catch (error: any) {
      console.error('[DISPATCH] Unexpected error:', error);
      toast({
        title: "Error",
        description: error?.message || "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false)
    }
  }

  const allChecked = dispatchData.materialReady && dispatchData.packagingComplete && dispatchData.labelsAttached


  /* Extract unique customer names */
  const customerNames = Array.from(new Set(pendingOrders.map(order => order.customerName || "Unknown")))

  const [filterValues, setFilterValues] = useState({
      status: "",
      startDate: "",
      endDate: "",
      partyName: ""
  })

  const filteredPendingOrders = pendingOrders.filter(order => {
      let matches = true
      
      // Filter by Party Name
      if (filterValues.partyName && filterValues.partyName !== "all" && order.customerName !== filterValues.partyName) {
          matches = false
      }

      // Filter by Date Range
      const orderDateStr = order.dispatchData?.dispatchDate || order.timestamp
      if (orderDateStr) {
          const orderDate = new Date(orderDateStr)
          if (filterValues.startDate) {
              const start = new Date(filterValues.startDate)
              start.setHours(0,0,0,0)
              if (orderDate < start) matches = false
          }
          if (filterValues.endDate) {
              const end = new Date(filterValues.endDate)
              end.setHours(23,59,59,999)
              if (orderDate > end) matches = false
          }
      }

      // Filter by Status (On Time / Expire)
      if (filterValues.status) {
          const today = new Date()
          today.setHours(0, 0, 0, 0)
          const targetDateStr = order.deliveryDate || order.timestamp
          if (targetDateStr) {
             const targetDate = new Date(targetDateStr)
             
             if (filterValues.status === "expire") {
                 if (targetDate < today) matches = true
                 else matches = false
             } else if (filterValues.status === "on-time") {
                 if (targetDate >= today) matches = true
                 else matches = false
             }
          }
      }

      return matches
  })

  // Group orders by DO Number for table display
  const displayRows = useMemo(() => {
    const grouped: { [key: string]: any } = {}
    
    filteredPendingOrders.forEach((order: any) => {
      // Backend order_no is the DO number
      const orderId = order.order_no || order.orderNo || "DO-XXX"
      
      // Extract base DO number (remove suffix like A, B, C)
      // Matches DO-022 from DO-022A, DO-022B, etc.
      const baseDoMatch = orderId.match(/^(DO-\d+)/i)
      const baseDo = baseDoMatch ? baseDoMatch[1] : orderId
      
      if (!grouped[baseDo]) {
         const internalOrder = order.data?.orderData || order;
         const preApproval = order.data?.preApprovalData || internalOrder.preApprovalData || {};

        grouped[baseDo] = {
           ...order,
           _id: order.id, // Keep one ID for key
           _rowKey: baseDo,
           doNumber: baseDo,
           orderNo: baseDo,
           customerName: order.customer_name || internalOrder.customerName,
           transportType: order.type_of_transporting || internalOrder.transportType,
           deliveryDate: order.delivery_date || internalOrder.deliveryDate,
           
           // Aggregated Data
           _allProducts: [],
           _productCount: 0,
           
           // Order Details for Header - Robust Mapping
           deliveryPurpose: internalOrder.order_type_delivery_purpose || internalOrder.orderPurpose || "—",
           startDate: internalOrder.start_date || internalOrder.startDate || "—",
           endDate: internalOrder.end_date || internalOrder.endDate || "—",
           orderType: internalOrder.order_type || internalOrder.orderType || "—",
           customerType: internalOrder.customer_type || internalOrder.customerType || "—",
           partySoDate: internalOrder.party_so_date || internalOrder.soDate || "—",
           totalWithGst: internalOrder.total_amount_with_gst || internalOrder.totalWithGst || "—",
           contactPerson: internalOrder.customer_contact_person_name || internalOrder.contactPerson || "—",
           whatsapp: internalOrder.customer_contact_person_whatsapp_no || internalOrder.whatsappNo || "—",
           address: internalOrder.customer_address || internalOrder.customerAddress || "—",
           paymentTerms: internalOrder.payment_terms || internalOrder.paymentTerms || "—",
           advanceTaken: internalOrder.advance_payment_to_be_taken || internalOrder.advancePaymentTaken || false,
           advanceAmount: internalOrder.advance_amount || internalOrder.advanceAmount || "—",
           isBroker: internalOrder.is_order_through_broker || internalOrder.isBrokerOrder || false,
           brokerName: internalOrder.broker_name || internalOrder.brokerName || "—",
           
           // Extended fields requested
           custContactName: internalOrder.customer_contact_person_name || internalOrder.contactPerson || "—",
           weDealInSku: internalOrder.we_are_dealing_in_ordered_sku || false,
           creditStatus: internalOrder.party_credit_status || internalOrder.creditStatus || "—",
           dispatchConfirmed: internalOrder.dispatch_date_confirmed || false,
           overallStatus: internalOrder.overall_status_of_order || internalOrder.overallStatus || "—",
           custConfirmation: internalOrder.order_confirmation_with_customer || false,
        }
      }

      // Add product to the group
      grouped[baseDo]._allProducts.push({
        ...order,
        _rowKey: `${baseDo}-${order.id}`, // Unique key for product row
        id: order.id,
        orderNo: order.order_no,
        productName: order.product_name || order._product?.productName || order._product?.oilType,
        oilType: order.oil_type || order._product?.oilType,
        orderQty: order.order_quantity || order._product?.orderQty,
        rate: order.rate || order._product?.rate,
        ratePerLtr: order.rate_per_ltr || order._product?.ratePerLtr,
        approvalQty: order.approval_qty || order.order_quantity,
        remainingDispatchQty: order.remaining_dispatch_qty !== null ? order.remaining_dispatch_qty : (order.approval_qty || order.order_quantity),
        // Include any other product specific fields
      })
      
      grouped[baseDo]._productCount = grouped[baseDo]._allProducts.length
    })

    return Object.values(grouped)
  }, [filteredPendingOrders])

  return (
    <WorkflowStageShell
      title="Stage 4: Dispatch Planning"
      description="Prepare and Dispatch Plannings for delivery."
      pendingCount={displayRows.length}
      historyData={historyOrders.map((order) => ({
        date: new Date(order.dispatchData?.dispatchedAt || order.timestamp || new Date()).toLocaleDateString("en-GB"),
        stage: "Dispatch Planning",
        status: "Completed",
        remarks: order.dispatchData?.dispatchDate ? `Dispatched: ${order.dispatchData.dispatchDate}` : "Dispatched",
      }))}
      partyNames={customerNames}
      onFilterChange={setFilterValues}
      showStatusFilter={true}
    >
      <div className="flex justify-end gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="bg-transparent">
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

        <Button
          onClick={handleOpenDialog}
          disabled={selectedOrders.length === 0}
        >
          {selectedOrders.length > 1 ? `Select 1 Group to Dispatch` : `Dispatch Selected (${selectedOrders.length})`}
        </Button>
      </div>

      <Card className="border-none shadow-sm overflow-hidden overflow-auto max-h-[600px]">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-card shadow-sm">
            <TableRow>
              <TableHead className="w-12 text-center">
                <Checkbox
                  checked={displayRows.length > 0 && selectedOrders.length === displayRows.length}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Select all"
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
            {displayRows.length > 0 ? (
                displayRows.map((row) => {
                   const rowKey = row._rowKey;
                   
                   return (
                   <TableRow key={row._rowKey} className={selectedOrders.includes(rowKey) ? "bg-blue-50/50" : ""}>
                     <TableCell className="text-center">
                       <Checkbox
                         checked={selectedOrders.includes(rowKey)}
                         onCheckedChange={() => toggleSelectOrder(rowKey)}
                         aria-label={`Select item ${rowKey}`}
                       />
                     </TableCell>
                     
                     {PAGE_COLUMNS.filter((col) => visibleColumns.includes(col.id)).map((col) => (
                       <TableCell key={col.id} className="whitespace-nowrap text-center">
                         {col.id === "status" ? (
                            <div className="flex justify-center flex-col items-center gap-1">
                              <Badge className="bg-orange-100 text-orange-700">Pending</Badge>
                              {row._productCount > 1 && (
                                  <span className="text-[10px] text-slate-500 font-medium">({row._productCount} Items)</span>
                              )}
                            </div>
                         ) : col.id === "productName" ? (
                             <div className="flex flex-col items-center">
                                 <span className="font-medium text-slate-700">{row.productName}</span>
                                 {row._productCount > 1 && (
                                     <span className="text-[10px] text-slate-500">+ {row._productCount - 1} more types</span>
                                 )}
                             </div>
                         ) : (
                            row[col.id as keyof typeof row]
                         )}
                       </TableCell>
                     ))}
                     
                     {/* Action to open dialog for this specific row */}
                     <TableCell>
                         <Button variant="ghost" size="sm" onClick={() => {
                             setSelectedOrders([rowKey]) // Select only this one
                             setSelectedGroup(row)
                             setDialogSelectedProducts(row._allProducts.map((p: any) => p._rowKey))
                             setIsDialogOpen(true)
                         }}>
                             <Settings2 className="w-4 h-4 ml-2 text-slate-400 hover:text-blue-600" />
                         </Button>
                     </TableCell>
                   </TableRow>
                   )
                 })
               ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No orders pending for dispatch
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
      
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-6xl !max-w-6xl max-h-[95vh] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="text-xl font-bold text-slate-900 leading-none">
              Dispatch Planning: {selectedGroup?.doNumber || "Order Dispatch"}
            </DialogTitle>
            <DialogDescription className="text-slate-500 mt-1.5">
              Review order details and set dispatch quantities for products.
            </DialogDescription>
          </DialogHeader>
          
          {selectedGroup && (
            <div className="space-y-6">
                {/* Order Details Header */}
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mt-4">
                    <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-3">Order Details</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-4">
                        <div>
                            <p className="text-xs text-slate-500 font-medium">Delivery Purpose</p>
                            <p className="text-sm font-semibold text-slate-900">{selectedGroup.deliveryPurpose}</p>
                        </div>
                        <div>
                            <p className="text-xs text-slate-500 font-medium">Order Type</p>
                            <p className="text-sm font-semibold text-slate-900">{selectedGroup.orderType}</p>
                        </div>
                        <div>
                             <p className="text-xs text-slate-500 font-medium">Dates</p>
                             <p className="text-xs font-semibold text-slate-900">
                                 Start: {selectedGroup.startDate}<br/>
                                 End: {selectedGroup.endDate}
                             </p>
                        </div>
                        <div>
                            <p className="text-xs text-slate-500 font-medium">Delivery Date</p>
                            <p className="text-sm font-semibold text-slate-900">{selectedGroup.deliveryDate}</p>
                        </div>
                        
                        <div>
                            <p className="text-xs text-slate-500 font-medium">Transport</p>
                            <p className="text-sm font-semibold text-slate-900">{selectedGroup.transportType}</p>
                        </div>
                        <div>
                            <p className="text-xs text-slate-500 font-medium">Customer</p>
                            <p className="text-sm font-semibold text-slate-900 truncate" title={selectedGroup.customerName}>{selectedGroup.customerName}</p>
                            <p className="text-xs text-slate-500">{selectedGroup.custContactName} ({selectedGroup.whatsapp})</p>
                        </div>
                        <div className="md:col-span-2">
                             <p className="text-xs text-slate-500 font-medium">Address</p>
                             <p className="text-xs font-semibold text-slate-900 truncate" title={selectedGroup.address}>{selectedGroup.address}</p>
                        </div>

                        <div>
                            <p className="text-xs text-slate-500 font-medium">Payment Terms</p>
                            <p className="text-sm font-semibold text-slate-900">{selectedGroup.paymentTerms}</p>
                        </div>
                         <div>
                            <p className="text-xs text-slate-500 font-medium">Advance Payment</p>
                            <p className="text-sm font-semibold text-slate-900">
                                {selectedGroup.advanceTaken ? `Yes (${selectedGroup.advanceAmount})` : "No"}
                            </p>
                        </div>
                        <div>
                             <p className="text-xs text-slate-500 font-medium">Broker</p>
                             <p className="text-sm font-semibold text-slate-900">
                                 {selectedGroup.isBroker ? selectedGroup.brokerName : "No"}
                               </p>
                        </div>
                         <div>
                             <p className="text-xs text-slate-500 font-medium">Credit Status</p>
                             <div className="flex items-center gap-2">
                                 <span className={`text-xs font-bold px-2 py-0.5 rounded ${selectedGroup.creditStatus === 'Good' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                     {selectedGroup.creditStatus}
                                 </span>
                             </div>
                        </div>

                        <div className="col-span-2 md:col-span-4 grid grid-cols-2 md:grid-cols-4 gap-2 pt-2 border-t border-slate-200 mt-2">
                           <div className="flex items-center gap-2">
                               <div className={`w-2 h-2 rounded-full ${selectedGroup.weDealInSku ? 'bg-green-500' : 'bg-red-500'}`} />
                               <span className="text-xs text-slate-600">We Deal in SKU?</span>
                           </div>
                            <div className="flex items-center gap-2">
                               <div className={`w-2 h-2 rounded-full ${selectedGroup.dispatchConfirmed ? 'bg-green-500' : 'bg-red-500'}`} />
                               <span className="text-xs text-slate-600">Dispatch Confirmed?</span>
                           </div>
                            <div className="flex items-center gap-2">
                               <div className={`w-2 h-2 rounded-full ${selectedGroup.overallStatus === 'Approved' ? 'bg-green-500' : 'bg-red-500'}`} />
                               <span className="text-xs text-slate-600">Overall Status: {selectedGroup.overallStatus}</span>
                           </div>
                           <div className="flex items-center gap-2">
                               <div className={`w-2 h-2 rounded-full ${selectedGroup.custConfirmation ? 'bg-green-500' : 'bg-red-500'}`} />
                               <span className="text-xs text-slate-600">Cust. Confirmed?</span>
                           </div>
                        </div>
                    </div>
                </div>

                {/* Product Table */}
                <div className="border rounded-md mt-4 max-h-[400px] overflow-auto">
                    <Table>
                        <TableHeader className="bg-slate-50 sticky top-0 z-10">
                            <TableRow>
                                <TableHead className="w-[50px] text-center">
                                    <Checkbox 
                                        checked={dialogSelectedProducts.length > 0 && dialogSelectedProducts.length === selectedGroup._allProducts.length}
                                        onCheckedChange={(checked) => {
                                            if (checked) setDialogSelectedProducts(selectedGroup._allProducts.map((p: any) => p._rowKey))
                                            else setDialogSelectedProducts([])
                                        }}
                                    />
                                </TableHead>
                                <TableHead>Order No</TableHead>
                                <TableHead>Product Name</TableHead>
                                <TableHead>Ordered Qty</TableHead>
                                <TableHead>Approval Qty</TableHead>
                                <TableHead className="w-[150px]">Qty to Dispatch</TableHead>
                                <TableHead className="w-[180px]">Delivery From</TableHead>
                                <TableHead>Remaining Qty</TableHead>
                                <TableHead>Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {selectedGroup._allProducts.map((prod: any) => {
                                const rowKey = prod._rowKey;
                                // Default dispatch qty to remainingDispatchQty if available, else approvalQty
                                const defaultDispatchQty = prod.remainingDispatchQty !== undefined ? prod.remainingDispatchQty : prod.approvalQty;
                                const currentDispatchQty = dispatchDetails[rowKey]?.qty !== undefined ? dispatchDetails[rowKey].qty : defaultDispatchQty;
                                
                                // Validation limit is remainingDispatchQty
                                const maxLimit = prod.remainingDispatchQty !== undefined ? prod.remainingDispatchQty : prod.approvalQty;
                                
                                // Remaining Qty Calc: (Limit) - (Current Input)
                                const remainingQty = (maxLimit || 0) - (Number(currentDispatchQty) || 0);

                                return (
                                <TableRow key={rowKey} className={dialogSelectedProducts.includes(rowKey) ? "bg-blue-50/30" : ""}>
                                    <TableCell className="text-center">
                                        <Checkbox 
                                            checked={dialogSelectedProducts.includes(rowKey)}
                                            onCheckedChange={() => toggleSelectDialogProduct(rowKey)}
                                        />
                                    </TableCell>
                                    <TableCell className="text-xs font-semibold text-slate-700">{prod.orderNo || "—"}</TableCell>
                                    <TableCell className="font-medium text-xs">{prod.productName || "—"}</TableCell>
                                    <TableCell className="text-xs font-bold">{prod.orderQty}</TableCell>
                                    <TableCell className="text-xs font-bold text-blue-600">{prod.approvalQty || "—"}</TableCell>
                                    <TableCell>
                                        <Input
                                            type="number"
                                            className="h-8 text-xs"
                                            placeholder="Qty"
                                            value={currentDispatchQty}
                                            max={maxLimit}
                                            onChange={(e) => {
                                                let val = Number(e.target.value);
                                                const maxVal = Number(maxLimit);
                                                
                                                if (val > maxVal) {
                                                    val = maxVal;
                                                    toast({
                                                        title: "Limit Exceeded",
                                                        description: `Dispatch Ref cannot exceed Remaining Qty (${maxVal})`,
                                                        variant: "destructive"
                                                    })
                                                }

                                                setDispatchDetails((prev) => ({
                                                ...prev,
                                                [rowKey]: {
                                                    ...prev[rowKey],
                                                    qty: val.toString()
                                                }
                                                }))
                                            }}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Select
                                            value={dispatchDetails[rowKey]?.deliveryFrom || "in-stock"} // Default to In Stock
                                            onValueChange={(val) =>
                                              setDispatchDetails((prev) => ({
                                                ...prev,
                                                [rowKey]: {
                                                  ...prev[rowKey],
                                                  deliveryFrom: val
                                                }
                                              }))
                                            }
                                        >
                                          <SelectTrigger className="h-8 text-xs">
                                            <SelectValue placeholder="Source" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="in-stock">In Stock</SelectItem>
                                            <SelectItem value="production">Production</SelectItem>
                                          </SelectContent>
                                        </Select>
                                    </TableCell>
                                    <TableCell className="text-xs font-bold text-slate-500">
                                        {maxLimit}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="text-[10px] bg-orange-50 text-orange-700 border-orange-200">Pending</Badge>
                                    </TableCell>
                                </TableRow>
                            )})}
                        </TableBody>
                    </Table>
                </div>
            </div>
          )}

          <DialogFooter className="mt-4 border-t pt-4">
             <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
             <Button onClick={handleBulkDispatch} disabled={isProcessing || dialogSelectedProducts.length === 0}>
                {isProcessing ? "Processing..." : `Dispatch ${dialogSelectedProducts.length} Item(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </WorkflowStageShell>
  )
}