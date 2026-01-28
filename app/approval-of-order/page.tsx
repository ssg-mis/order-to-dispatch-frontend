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
      // Process selected products from the dialog
      const itemsToProcess = allProductsFromSelectedGroups.filter(p => dialogSelectedProducts.includes(p._rowKey))
      
      for (const item of itemsToProcess) {
        const orderData = item._orderData || {};
        const orderIdentifier = item._originalOrderId || orderData.doNumber || orderData.orderNo || "ORD-XXX";
        const productName = item.productName || item.oilType || "Unknown";
        const product = item;

        console.log('[APPROVAL] Processing item:', {
          orderIdentifier,
          productName,
          productId: product?.id,
          hasRejection,
          checklistValues
        });

        // Create a focused order object with ONLY the approved/rejected product
        const focusedOrderData = {
            ...orderData,
            products: orderData.orderType === "regular" ? [product] : [],
            preApprovalProducts: orderData.orderType === "pre-approval" ? [product] : (orderData.preApprovalProducts?.some((p: any) => p.oilType) ? [product] : []),
            _product: product // keep for reference
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
            customerName: orderData.customerName || "Unknown",
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
            orderType: orderData.orderType || "regular"
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
  const [dialogSelectedProducts, setDialogSelectedProducts] = useState<string[]>([])

  const toggleSelectDialogProduct = (key: string) => {
    setDialogSelectedProducts(prev => 
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }

  // Get all flattened products from selected Groups
  const allProductsFromSelectedGroups = useMemo(() => {
    return selectedItems.flatMap(group => group._allProducts || [])
  }, [selectedItems])

  const toggleSelectItem = (item: any) => {
    const key = item._rowKey
    const isSelected = selectedItems.some(i => i._rowKey === key)
    
    if (isSelected) {
      setSelectedItems(prev => prev.filter(i => i._rowKey !== key))
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
      setDialogSelectedProducts([])
    } else {
      // Pick the first one as representative for the dialog fields
      if (selectedItems.length > 0) {
        setSelectedOrder(selectedItems[0])
        // Select all products by default
        const allKeys = selectedItems.flatMap(g => g._allProducts || []).map((p: any) => p._rowKey)
        setDialogSelectedProducts(allKeys)
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

  // Group orders by base DO number (DO-022A, DO-022B → DO-022)
  const displayRows = useMemo(() => {
    const grouped: { [key: string]: any } = {}
    
    filteredPendingOrders.forEach((order) => {
      const orderId = order.doNumber || order.orderNo || "DO-XXX"
      // Extract base DO number (remove suffix like A, B, C)
      const baseDoMatch = orderId.match(/^(DO-\d+)/i)
      const baseDo = baseDoMatch ? baseDoMatch[1] : orderId
      
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

      if (!grouped[baseDo]) {
        grouped[baseDo] = {
          ...order,
          _displayDo: baseDo,
          _rowKey: baseDo,
          _allProducts: [],
          _productCount: 0
        }
      }
      
      // Aggregate products
      if (products && products.length > 0) {
        products.forEach((prod: any) => {
          // Check if already verified
          const pName = prod.productName || prod.oilType;
          const isVerified = history.some(h => 
            (h.orderNo === orderId || h.orderNo === baseDo) && 
            (h.data?.orderData?._product?.productName === pName || h.data?.orderData?._product?.oilType === pName)
          );
          
          if (!isVerified) {
             grouped[baseDo]._allProducts.push({
              ...prod,
              _originalOrderId: orderId,
              _orderData: order,
              _rowKey: `${baseDo}-${prod._pid || prod.id}`
            })
          }
        })
      } else if (!history.some(h => h.orderNo === orderId)) {
           // Case for no products but still pending order
           // Or handle as empty
      }
      
      grouped[baseDo]._productCount = grouped[baseDo]._allProducts.length
    })
    
    // Filter out groups with no pending products
    return Object.values(grouped).filter(g => g._productCount > 0)
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

                {/* Order Details Section (from first selected group) */}
                {selectedItems.length > 0 && (
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3 mt-4">
                    <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-3">
                        Order Details {selectedItems.length > 1 && <span className="text-xs font-normal text-slate-500 normal-case ml-2">(Showing details for {selectedItems[0].doNumber} + {selectedItems.length - 1} others)</span>}
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div>
                        <p className="text-xs text-slate-500 font-medium">Delivery Purpose</p>
                        <p className="text-sm font-semibold text-slate-900">{selectedItems[0].orderPurpose || "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 font-medium">Order Type</p>
                        <p className="text-sm font-semibold text-slate-900">{selectedItems[0].orderType || "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 font-medium">Dates</p>
                        <p className="text-xs font-semibold text-slate-900">
                            Start: {selectedItems[0].startDate || "—"}<br/>
                            End: {selectedItems[0].endDate || "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 font-medium">Delivery Date</p>
                        <p className="text-sm font-semibold text-slate-900">{selectedItems[0].deliveryDate || "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 font-medium">Transport</p>
                        <p className="text-sm font-semibold text-slate-900">{selectedItems[0].transportType || "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 font-medium">Customer</p>
                        <p className="text-sm font-semibold text-slate-900 truncate" title={selectedItems[0].customerName}>{selectedItems[0].customerName || "—"}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-xs text-slate-500 font-medium">Address</p>
                        <p className="text-sm font-semibold text-slate-900 truncate">{selectedItems[0].customerAddress || "—"}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Products Table */}
                <div className="border rounded-md mt-4 max-h-[400px] overflow-auto">
                    <Table>
                        <TableHeader className="bg-slate-50 sticky top-0">
                            <TableRow>
                                <TableHead className="w-[50px] text-center">
                                    <Checkbox 
                                        checked={dialogSelectedProducts.length > 0 && dialogSelectedProducts.length === allProductsFromSelectedGroups.length}
                                        onCheckedChange={(checked) => {
                                            if (checked) setDialogSelectedProducts(allProductsFromSelectedGroups.map(p => p._rowKey))
                                            else setDialogSelectedProducts([])
                                        }}
                                    />
                                </TableHead>
                                <TableHead>Order No</TableHead>
                                <TableHead>Product Name</TableHead>
                                <TableHead>Qty</TableHead>
                                <TableHead>Rate</TableHead>
                                <TableHead>Review Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {allProductsFromSelectedGroups.map((prod: any, idx) => (
                                <TableRow key={prod._rowKey || idx} className={dialogSelectedProducts.includes(prod._rowKey) ? "bg-blue-50/30" : ""}>
                                    <TableCell className="text-center">
                                        <Checkbox 
                                            checked={dialogSelectedProducts.includes(prod._rowKey)}
                                            onCheckedChange={() => toggleSelectDialogProduct(prod._rowKey)}
                                        />
                                    </TableCell>
                                    <TableCell className="text-xs font-semibold text-slate-700">{prod._originalOrderId || "—"}</TableCell>
                                    <TableCell className="font-medium text-xs">{prod.productName || "—"}</TableCell>
                                    <TableCell className="text-xs font-bold">{prod.orderQty}</TableCell>
                                    <TableCell className="text-xs">{prod.rate || "—"}</TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200">Pending Review</Badge>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
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
                       : `Approve ${dialogSelectedProducts.length} Selected Item(s)`}
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
                   const products = order._allProducts || []
                   const firstProduct = products[0]
                   
                   const CUSTOMER_MAP: Record<string, string> = {
                     cust1: "Acme Corp",
                     cust2: "Global Industries",
                     cust3: "Zenith Supply",
                   }

                   // Get aggregated oil types
                   const oilTypes = Array.from(new Set(products.map((p:any) => p.oilType || p.productName))).filter(Boolean).join(", ")

                   const row = {
                     orderNo: order._displayDo || order.doNumber || order.orderNo || "DO-XXX",
                     deliveryPurpose: order.orderPurpose || "—",
                     customerType: order.customerType || "—",
                     orderType: order.orderType || "—",
                     soNo: order.soNumber || "—",
                     partySoDate: order.soDate || order.partySoDate || "—",
                     customerName: CUSTOMER_MAP[order.customerName] || order.customerName || "—",
                     startDate: order.startDate || "—",
                     endDate: order.endDate || "—",
                     deliveryDate: order.deliveryDate || "—",
                     
                     // Rates & Product Details - Show Summary
                     oilType: oilTypes || "—",
                     ratePerLtr: firstProduct?.ratePerLtr || "—",
                     ratePer15Kg: firstProduct?.rateLtr || "—",
                     productName: `${products.length} Products`, // Show count
                     uom: firstProduct?.uom || "—",
                     orderQty: products.reduce((sum: number, p: any) => sum + (Number(p.orderQty) || 0), 0).toFixed(2),
                     altUom: firstProduct?.altUom || "—",
                     altQty: products.reduce((sum: number, p: any) => sum + (Number(p.altQty) || 0), 0).toFixed(2),
                     rate: firstProduct?.rate || "—",

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
                     
                     status: "Pending",
                   }

                   return (
                   <TableRow 
                      key={order._rowKey}
                      className={selectedItems.some(i => i._rowKey === order._rowKey) ? "bg-blue-50/50" : ""}
                   >
                     <TableCell className="text-center">
                        <Checkbox 
                            checked={selectedItems.some(i => i._rowKey === order._rowKey)}
                            onCheckedChange={() => toggleSelectItem(order)}
                        />
                     </TableCell>
                      {PAGE_COLUMNS.filter((col) => visibleColumns.includes(col.id)).map((col) => (
                        <TableCell key={col.id} className="whitespace-nowrap text-center">
                          {col.id === "status" ? (
                             <div className="flex justify-center gap-2">
                                <Badge variant="outline" className="text-xs bg-slate-100 text-slate-700 border-slate-200">
                                   {order._productCount} Items
                                </Badge>
                             </div>
                          ) : col.id === "productName" ? (
                             <span className="font-medium text-slate-700">{row.productName}</span>
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
