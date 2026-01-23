"use client"

import { Card } from "@/components/ui/card"
import { WorkflowStageShell } from "@/components/workflow/workflow-stage-shell"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useRouter } from "next/navigation"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useToast } from "@/hooks/use-toast"
import { useState, useEffect, useMemo } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Checkbox } from "@/components/ui/checkbox"
import { Settings2, CheckCircle2, Loader2 } from "lucide-react"
import { saveWorkflowHistory } from "@/lib/storage-utils"
import { approvalApi } from "@/lib/api-service"


export default function CommitmentReviewPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [isConfirming, setIsConfirming] = useState(false)
  const PAGE_COLUMNS = [
    { id: "orderNo", label: "DO Number" },
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
    { id: "ratePerLtr", label: "Rate Per Ltr." }, // Aggregated
    { id: "productName", label: "Product Name" },
    { id: "uom", label: "UOM" },
    { id: "orderQty", label: "Order Quantity" },
    { id: "altUom", label: "Alt UOM" },
    { id: "altQty", label: "Alt Qty (Kg)" },
    { id: "rate", label: "Rate" },
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
    { id: "status", label: "Status" },
  ]

  const [visibleColumns, setVisibleColumns] = useState<string[]>([
    "orderNo",
    "customerName",
    "productName",
    "rate",
    "status",
  ])
  
  // State for list of orders
  const [isLoading, setIsLoading] = useState(true)
  const [pendingOrders, setPendingOrders] = useState<any[]>([])
  const [selectedOrder, setSelectedOrder] = useState<any>(null) // For the dialog interaction
  const [sourceOfMaterial, setSourceOfMaterial] = useState<string>("in-stock")

  const [checklistValues, setChecklistValues] = useState<Record<string, string>>({
    rate: "approve",
    sku: "approve",
    credit: "approve",
    dispatch: "approve",
    overall: "approve",
    confirm: "approve",
  })

  const [history, setHistory] = useState<any[]>([])

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
      partySoDate: backendOrder.party_so_date,
      contactPerson: backendOrder.customer_contact_person_name,
      whatsappNo: backendOrder.customer_contact_person_whatsapp_no,
      customerAddress: backendOrder.customer_address,
      paymentTerms: backendOrder.payment_terms,
      advancePaymentTaken: backendOrder.advance_payment_to_be_taken,
      advanceAmount: backendOrder.advance_amount,
      isBrokerOrder: backendOrder.is_order_through_broker,
      brokerName: backendOrder.broker_name,
      transportType: backendOrder.type_of_transporting,
      totalWithGst: backendOrder.total_amount_with_gst,
      serial: backendOrder.serial,
      // Product info (for individual row from DB)
      products: [{
        _pid: `${backendOrder.id}-${backendOrder.serial}`,
        id: backendOrder.id,
        productName: backendOrder.product_name,
        oilType: backendOrder.oil_type,
        uom: backendOrder.uom,
        orderQty: backendOrder.order_quantity,
        altUom: backendOrder.alternate_uom,
        altQty: backendOrder.alternate_qty_kg,
        ratePerLtr: backendOrder.rate_per_ltr,
        rateLtr: backendOrder.rate_per_15kg,
        rate: backendOrder.rate_of_material,
      }],
      // Keep approval-specific fields
      rateIsRightly: backendOrder.rate_is_rightly_as_per_current_market_rate,
      weDealInSku: backendOrder.we_are_dealing_in_ordered_sku,
      creditStatus: backendOrder.party_credit_status,
      dispatchConfirmed: backendOrder.dispatch_date_confirmed,
      overallStatus: backendOrder.overall_status_of_order,
      customerConfirmation: backendOrder.order_confirmation_with_customer,
    };
  };

  // Fetch pending approvals from backend
  const fetchPendingApprovals = async () => {
    try {
      setIsLoading(true);
      const response = await approvalApi.getPending({ limit: 1000 });
      
      if (response.success && response.data.orders) {
        const mappedOrders = response.data.orders.map(mapBackendOrderToFrontend);
        setPendingOrders(mappedOrders);
      }
    } catch (error: any) {
      console.error("Failed to fetch pending approvals:", error);
      toast({
        title: "Error",
        description: error?.message || "Failed to load pending approvals from server",
        variant: "destructive",
      });
      
      // Fallback to localStorage if API fails
      const savedPending = localStorage.getItem("approvalPendingItems");
      if (savedPending) {
        setPendingOrders(JSON.parse(savedPending));
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch approval history from backend
  const fetchHistory = async () => {
    try {
      const response = await approvalApi.getHistory({ limit: 1000 });
      
      if (response.success && response.data.orders) {
        const mappedHistory = response.data.orders.map((order: any) => ({
          orderNo: order.order_no,
          customerName: order.customer_name,
          stage: "Approval Of Order",
          status: "Completed" as const,
          processedBy: "System",
          timestamp: order.actual_2,
          date: order.actual_2 ? new Date(order.actual_2).toLocaleDateString("en-GB") : "-",
          remarks: order.remark || "-",
        }));
        setHistory(mappedHistory);
      }
    } catch (error: any) {
      console.error("Failed to fetch history:", error);
      
      // Fallback to localStorage
      const savedHistory = localStorage.getItem("workflowHistory");
      if (savedHistory) {
        const historyData = JSON.parse(savedHistory);
        const stageHistory = historyData
          .filter((item: any) => item.stage === "Approval Of Order" || item.stage === "Commitment Review")
          .map((item: any) => ({
            ...item,
            stage: "Approval Of Order",
            date: item.date || (item.timestamp ? new Date(item.timestamp).toLocaleDateString("en-GB") : "-"),
            remarks: item.remarks || "-"
          }));
        setHistory(stageHistory);
      }
    }
  };

  useEffect(() => {
    // Fetch data from backend
    fetchPendingApprovals();
    fetchHistory();
  }, [])

  const checkItems = [
    { id: "rate", label: "Rate Right?" },
    { id: "sku", label: "We Deal in SKU?" },
    { id: "credit", label: "Credit OK?" },
    { id: "dispatch", label: "Dispatch Confirmed?" },
    { id: "overall", label: "Overall Status?" },
    { id: "confirm", label: "Customer Confirmation?" },
  ]

  const handleChecklistChange = (itemId: string, value: string) => {
    setChecklistValues((prev) => ({
      ...prev,
      [itemId]: value,
    }))
  }

  const handleConfirmCommitment = async () => {
    if (selectedItems.length === 0) return;
    
    setIsConfirming(true)
    try {
      const hasRejection = Object.values(checklistValues).includes("reject")
      const timestamp = new Date().toISOString()
      
      const successfulApprovals: any[] = []
      const failedApprovals: any[] = []
      
      // Process each selected item individually
      for (const item of selectedItems) {
        const orderIdentifier = item.doNumber || item.soNumber || item.orderNo || "ORD-XXX";
        const productName = item._product?.productName || item._product?.oilType || "Unknown";
        const product = item._product || item.products?.[0];

        console.log('[APPROVAL] Processing item:', {
          orderIdentifier,
          productName,
          productId: product?.id,
          hasRejection,
          checklistValues
        });

        // Create a focused order object with ONLY the approved/rejected product
        const focusedOrderData = {
            ...item,
            products: item.orderType === "regular" ? [item._product] : [],
            preApprovalProducts: item.orderType === "pre-approval" ? [item._product] : (item.preApprovalProducts?.some((p: any) => p.oilType) ? [item._product] : []),
            _product: item._product // keep for reference
        };

        // Try submitting to backend API
        try {
          if (product?.id && !hasRejection) {
            // Prepare approval data for backend
            // Convert to boolean values for boolean columns in database
            const approvalData = {
              rate_is_rightly_as_per_current_market_rate: checklistValues.rate === "approve",
              we_are_dealing_in_ordered_sku: checklistValues.sku === "approve",
              party_credit_status: checklistValues.credit === "approve" ? "Good" : "Poor",
              dispatch_date_confirmed: checklistValues.dispatch === "approve",
              overall_status_of_order: checklistValues.overall === "approve" ? "Approved" : "Rejected",
              order_confirmation_with_customer: checklistValues.confirm === "approve",
            };

            console.log('[APPROVAL] Submitting to API:', {
              productId: product.id,
              approvalData
            });

            // Call backend API to submit approval
            const response = await approvalApi.submit(product.id, approvalData);
            console.log('[APPROVAL] API Response:', response);
            successfulApprovals.push(item);
          } else {
            console.warn('[APPROVAL] Skipping API submission:', {
              productId: product?.id,
              hasRejection,
              reason: !product?.id ? 'Missing product ID' : 'Has rejection'
            });
          }
        } catch (error: any) {
          console.error(`[APPROVAL] Failed to submit approval for ${orderIdentifier}:`, error);
          failedApprovals.push({ item, error: error?.message || "Unknown error" });
        }

        // Save to local history for tracking (both success and failure cases)
        if (hasRejection) {
          const historyEntry = {
            orderNo: orderIdentifier,
            customerName: item.customerName || "Unknown",
            stage: "Approval Of Order",
            status: "Rejected" as const,
            processedBy: "Current User",
            timestamp: timestamp,
            remarks: `Rejected: ${productName}`,
            data: {
              orderData: focusedOrderData,
              checklistResults: checklistValues,
              rejectedAt: timestamp,
            },
            orderType: item.orderType || "regular"
          }
          saveWorkflowHistory(historyEntry)
        } else {
          const finalData = {
            orderData: {
              ...focusedOrderData,
              deliveryData: {
                  deliveryFrom: sourceOfMaterial
              }
            },
            checklistResults: checklistValues,
            confirmedAt: timestamp,
            status: "Approved",
          }

          const historyEntry = {
            orderNo: orderIdentifier,
            customerName: item.customerName || "Unknown",
            stage: "Approval Of Order",
            status: "Approved" as const,
            processedBy: "Current User",
            timestamp: timestamp,
            remarks: `Verified & Approved: ${productName}`,
            data: finalData,
            orderType: item.orderType || "regular"
          }

          saveWorkflowHistory(historyEntry)
          setHistory((prev) => [...prev, historyEntry])
        }
      }

      // Show results
      if (successfulApprovals.length > 0) {
        toast({
          title: hasRejection ? "Orders Rejected" : "Approvals Submitted",
          description: `${successfulApprovals.length} item(s) have been processed successfully.`,
          variant: hasRejection ? "destructive" : "default",
        })
        
        // Refresh data from backend
        await fetchPendingApprovals()
        await fetchHistory()
      }
      
      if (failedApprovals.length > 0) {
        toast({
          title: "Some Approvals Failed",
          description: `${failedApprovals.length} approval(s) failed. Please try again.`,
          variant: "destructive",
        })
      }

      if (successfulApprovals.length === 0 && failedApprovals.length === 0) {
        toast({
          title: hasRejection ? "Orders Rejected" : "Commitment Verified",
          description: `${selectedItems.length} items have been processed.`,
          variant: hasRejection ? "destructive" : "default",
        })
      }

      if (pendingOrders.length <= selectedItems.length) {
           setTimeout(() => {
             router.push("/dispatch-material")
           }, 1000)
      }
      setSelectedItems([])
      setSelectedOrder(null)
    } finally {
      setIsConfirming(false)
    }
  }

  const [selectedItems, setSelectedItems] = useState<any[]>([])

  const toggleSelectItem = (item: any) => {
    const key = `${item.doNumber || item.orderNo}-${item._product?.productName || item._product?.oilType || 'no-prod'}`
    const isSelected = selectedItems.some(i => `${i.doNumber || i.orderNo}-${i._product?.productName || i._product?.oilType || 'no-prod'}` === key)
    
    if (isSelected) {
      setSelectedItems(prev => prev.filter(i => `${i.doNumber || i.orderNo}-${i._product?.productName || i._product?.oilType || 'no-prod'}` !== key))
    } else {
      setSelectedItems(prev => [...prev, item])
    }
  }

  const toggleSelectAll = () => {
    if (selectedItems.length === displayRows.length) {
      setSelectedItems([])
    } else {
      setSelectedItems([...displayRows])
    }
  }

  const handleBulkVerifyOpen = (open: boolean) => {
    if (!open) {
      setSelectedOrder(null)
    } else {
      // Pick the first one as representative for the dialog fields, 
      // but the process will apply to all selected items
      if (selectedItems.length > 0) {
        setSelectedOrder(selectedItems[0])
      }
    }
  }

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
      // Check for timestamp or date field
      const orderDateStr = order.deliveryData?.date || order.date || order.timestamp
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

      // Filter by Status (Simulating Expiry based on arbitrary logic if no due date, 
      // typically approval is needed ASAP so maybe compare created date vs today)
      // For now, let's use the same logic: "on-time" if recent, "expire" if old (>7 days?)
      // OR better, if the order object has a due date.
      // Let's assume deliveryDate exists as in other stages, or default to checking 'timestamp' vs today.
      
      if (filterValues.status) {
          const targetDateStr = order.deliveryData?.expectedDeliveryDate || order.deliveryDate || order.timestamp
          if (targetDateStr) {
             const targetDate = new Date(targetDateStr)
             const today = new Date()
             today.setHours(0, 0, 0, 0)
             
             if (filterValues.status === "expire") {
                 // If Expected Date is in past, it's expired/overdue? OR if it's "Expire" status.
                 // Let's assume "Expire" means "Overdue"
                 if (targetDate < today) matches = true // keeping 'expire' matches
                 else matches = false
             } else if (filterValues.status === "on-time") {
                 if (targetDate >= today) matches = true
                 else matches = false
             }
          }
      }

      return matches
  })

  // Flatten orders for table display
  const displayRows = useMemo(() => {
    const rows: any[] = []
    filteredPendingOrders.forEach((order) => {
      const isRegular = order.orderType === "regular" || order.stage === "Approval Of Order";
      const hasPreApproval = order.preApprovalProducts?.some((p: any) => p.oilType);

      let products: any[] = [];
      
      if (isRegular) {
        products = order.products || order.data?.products || order.orderData?.products || order.data?.orderData?.products || [];
        if (products.length === 0 && hasPreApproval) {
          products = order.preApprovalProducts;
        }
      } else {
        products = hasPreApproval ? order.preApprovalProducts : (order.products || []);
      }

      if (!products || products.length === 0) {
        // Only push if not already verified in history
        const isVerified = history.some(h => 
            (h.orderNo === (order.doNumber || order.orderNo)) && h._product === null
        );
        if (!isVerified) rows.push({ ...order, _product: null })
      } else {
        products.forEach((prod: any) => {
          // Check if THIS specific product is already verified in history
          const pName = prod.productName || prod.oilType;
          const isVerified = history.some(h => 
            (h.orderNo === (order.doNumber || order.orderNo)) && 
            (h.data?.orderData?._product?.productName === pName || h.data?.orderData?._product?.oilType === pName)
          );

          if (!isVerified) {
            rows.push({ ...order, _product: prod })
          }
        });
      }
    })
    return rows
  }, [filteredPendingOrders, history])

  return (
    <WorkflowStageShell
      title="Stage 3: Approval Of Order"
      description="Six-point verification check before commitment entry."
      pendingCount={displayRows.length}
      historyData={history}
        partyNames={customerNames}
        onFilterChange={setFilterValues}
    >
      <div className="space-y-4">
        <div className="flex justify-end gap-2">
          <Dialog open={selectedOrder !== null} onOpenChange={handleBulkVerifyOpen}>
              <DialogTrigger asChild>
                <Button 
                  disabled={selectedItems.length === 0}
                  className="bg-blue-600 hover:bg-blue-700 shadow-md transition-all active:scale-95"
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Verify Selected ({selectedItems.length})
                </Button>
              </DialogTrigger>
                <DialogContent className="sm:max-w-6xl !max-w-6xl max-h-[95vh] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                <DialogHeader className="border-b pb-4">
                  <DialogTitle className="text-xl font-bold text-slate-900 leading-none">
                    Bulk Approval: {selectedItems.length > 1 ? `${selectedItems.length} Items Selected` : (selectedOrder?.doNumber || "Order Verification")}
                  </DialogTitle>
                  <DialogDescription className="text-slate-500 mt-1.5">Verify order details and complete the six-point check for commitment.</DialogDescription>
                </DialogHeader>

                {/* Selected Items Detail Section */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 shadow-sm mt-4">
                    <div className="space-y-3">
                        <Label className="text-[10px] font-bold uppercase tracking-wider text-blue-600/70 block px-1">Selected Items ({selectedItems.length})</Label>
                        <div className="max-h-[300px] overflow-y-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 pr-2 scrollbar-hide">
                            {selectedItems.map((item, idx) => (
                                <div key={idx} className="bg-white p-3 border border-slate-200 rounded-xl shadow-sm flex flex-col gap-1.5 relative overflow-hidden group hover:border-blue-200 transition-all">
                                    <div className="absolute top-0 right-0 py-0.5 px-2 bg-slate-50 border-l border-b border-slate-100 rounded-bl-lg">
                                       <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">{item.orderType || "—"}</span>
                                    </div>
                                    <div className="flex flex-col">
                                       <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider leading-none mb-1">DO-No: {item.doNumber || item.orderNo}</span>
                                       <h4 className="text-xs font-bold text-slate-800 leading-tight truncate pr-16">{item.customerName || "—"}</h4>
                                    </div>
                                    <div className="pt-2 border-t border-slate-50 mt-0.5">
                                       <div className="flex items-center gap-1.5">
                                          <div className="w-1 h-1 rounded-full bg-blue-500" />
                                          <span className="text-xs font-bold text-blue-600 truncate">
                                            {item._product?.productName || item._product?.oilType || "—"}
                                          </span>
                                       </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="py-6 space-y-4">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 px-1 uppercase tracking-tight">
                    <div className="w-1.5 h-4 bg-blue-600 rounded-full" />
                    Six-Point Verification
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {checkItems.map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-4 rounded-xl border border-slate-100 bg-white shadow-sm hover:border-slate-200 transition-colors">
                        <Label className="text-sm font-semibold text-slate-700">{item.label}</Label>
                        <RadioGroup
                          value={checklistValues[item.id]}
                          onValueChange={(value) => handleChecklistChange(item.id, value)}
                          className="flex gap-6"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="approve" id={`${item.id}-ok`} className="text-green-600" />
                            <Label htmlFor={`${item.id}-ok`} className="text-sm font-medium text-green-600 cursor-pointer">
                              Approve
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="reject" id={`${item.id}-no`} className="text-red-600" />
                            <Label htmlFor={`${item.id}-no`} className="text-sm font-medium text-red-600 cursor-pointer">
                              Reject
                            </Label>
                          </div>
                        </RadioGroup>
                      </div>
                    ))}
                  </div>
               </div>
               <DialogFooter className="border-t pt-4 sm:justify-center">
                 <Button
                   onClick={handleConfirmCommitment}
                   disabled={isConfirming}
                   className="min-w-[300px] px-8 h-11 text-base font-bold shadow-lg shadow-blue-100 transition-all hover:scale-[1.01] active:scale-[0.99]"
                   variant={Object.values(checklistValues).includes("reject") ? "destructive" : "default"}
                 >
                   {isConfirming
                     ? "Processing..."
                     : Object.values(checklistValues).includes("reject")
                       ? "Reject & Save to History"
                       : `Approve ${selectedItems.length} Item(s)`}
                 </Button>
               </DialogFooter>
             </DialogContent>
          </Dialog>

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
        </div>

        <Card className="border-none shadow-sm overflow-auto max-h-[600px]">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-card shadow-sm">
              <TableRow>
                <TableHead className="w-[50px] text-center">
                    <Checkbox 
                        checked={displayRows.length > 0 && selectedItems.length === displayRows.length}
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
              ) : displayRows.length > 0 ? (
                displayRows.map((order: any, index: number) => {
                   const p = order._product;
                   
                   const CUSTOMER_MAP: Record<string, string> = {
                     cust1: "Acme Corp",
                     cust2: "Global Industries",
                     cust3: "Zenith Supply",
                   }

                   const row = {
                     orderNo: order.doNumber || order.orderNo || "DO-XXX",
                     deliveryPurpose: order.orderPurpose || "—",
                     customerType: order.customerType || "—",
                     orderType: order.orderType || "—",
                     soNo: order.soNumber || "—",
                     partySoDate: order.soDate || order.partySoDate || "—",
                     customerName: CUSTOMER_MAP[order.customerName] || order.customerName || "—",
                     startDate: order.startDate || "—",
                     endDate: order.endDate || "—",
                     deliveryDate: order.deliveryDate || "—",
                     
                     // Rates & Product Details - Single product from flattened row
                     oilType: p?.oilType || order.oilType || "—",
                     ratePerLtr: p?.ratePerLtr || order.ratePerLtr || "—",
                     ratePer15Kg: p?.rateLtr || order.rateLtr || "—",
                     productName: p?.productName || p?.oilType || "—",
                     uom: p?.uom || "—",
                     orderQty: p?.orderQty !== undefined ? p?.orderQty : "—",
                     altUom: p?.altUom || "—",
                     altQty: p?.altQty !== undefined ? p?.altQty : "—",
                     rate: p?.rate || "—",

                     // Extended Columns
                     totalWithGst: order.totalWithGst || "—",
                     transportType: order.transportType || "—",
                     contactPerson: order.contactPerson || "—",
                     whatsapp: order.whatsappNo || "—",
                     address: order.customerAddress || "—",
                     paymentTerms: order.paymentTerms || "—",
                     advanceTaken: order.advancePaymentTaken || "—",
                     advanceAmount: order.advanceAmount || "—",
                     isBroker: order.isBrokerOrder || "—",
                     brokerName: order.brokerName || "—",
                     uploadSo: "do_document.pdf",
                     
                     status: "Excellent",
                     products: (order.orderType === "regular" && order.products?.length > 0) 
                        ? order.products 
                        : (order.preApprovalProducts?.some((p: any) => p.oilType) 
                            ? order.preApprovalProducts 
                            : (order.products || order.data?.products || order.orderData?.products || [])),
                   }

                   return (
                   <TableRow 
                      key={`${index}-${row.orderNo}-${row.productName}`}
                      className={selectedItems.some(i => `${i.doNumber || i.orderNo}-${i._product?.productName || i._product?.oilType || 'no-prod'}` === `${row.orderNo}-${row.productName}`) ? "bg-blue-50/50" : ""}
                   >
                     <TableCell className="text-center">
                        <Checkbox 
                            checked={selectedItems.some(i => `${i.doNumber || i.orderNo}-${i._product?.productName || i._product?.oilType || 'no-prod'}` === `${row.orderNo}-${row.productName}`)}
                            onCheckedChange={() => toggleSelectItem(order)}
                        />
                     </TableCell>
                      {PAGE_COLUMNS.filter((col) => visibleColumns.includes(col.id)).map((col) => (
                        <TableCell key={col.id} className="whitespace-nowrap text-center">
                          {col.id === "status" ? (
                             <div className="flex justify-center">
                                <Badge className="bg-green-100 text-green-700">Excellent</Badge>
                             </div>
                          ) : row[col.id as keyof typeof row]}
                        </TableCell>
                      ))}
                   </TableRow>
                )})
              ) : (
                  <TableRow>
                      <TableCell colSpan={visibleColumns.length + 2} className="text-center py-4 text-muted-foreground">
                          No orders pending for commitment review
                      </TableCell>
                  </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </WorkflowStageShell>
  )
}
