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
import { Settings2, ChevronDown, ChevronUp } from "lucide-react"
import { dispatchPlanningApi } from "@/lib/api-service"
import { cn } from "@/lib/utils"

export default function DispatchMaterialPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [pendingOrders, setPendingOrders] = useState<any[]>([])
  const [historyOrders, setHistoryOrders] = useState<any[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [selectedGroup, setSelectedGroup] = useState<any>(null)
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
  const [expandedOrders, setExpandedOrders] = useState<string[]>([])

  const PAGE_COLUMNS = [
    { id: "orderNo", label: "DO Number" },
    { id: "processId", label: "Process ID" },
    { id: "customerName", label: "Customer Name" },
    { id: "productName", label: "Products Name" },
    { id: "transportType", label: "Type of Transporting" },
    { id: "orderPunchRemarks", label: "Order Punch Remarks" },
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
    "processId",
    "customerName",
    "productName",
    "transportType",
    "orderPunchRemarks",
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

  const [selectedItems, setSelectedItems] = useState<any[]>([])
  const [dialogSelectedProducts, setDialogSelectedProducts] = useState<string[]>([])

  const toggleSelectAll = () => {
    if (selectedItems.length === displayRows.length) {
      setSelectedItems([])
    } else {
      setSelectedItems([...displayRows])
    }
  }

  const toggleSelectItem = (item: any) => {
    const key = item._rowKey
    const isSelected = selectedItems.some(i => i._rowKey === key)
    
    if (isSelected) {
      setSelectedItems(prev => prev.filter(i => i._rowKey !== key))
    } else {
      setSelectedItems(prev => [...prev, item])
    }
  }

  const handleOpenDialog = () => {
      if (selectedItems.length > 0) {
          setSelectedGroup(selectedItems[0])
          // Default: Select ALL products in all selected groups for dispatch
          const allKeys = selectedItems.flatMap(g => g._allProducts || []).map((p: any) => p._rowKey)
          setDialogSelectedProducts(allKeys)
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

  // Get all flattened products from selected Groups
  const allProductsFromSelectedGroups = useMemo(() => {
    return selectedItems.flatMap(group => group._allProducts || [])
  }, [selectedItems])

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

  const handleBulkDispatch = async () => {
    setIsProcessing(true)
    try {
      if (selectedItems.length === 0 || dialogSelectedProducts.length === 0) {
        toast({
          title: "No Items Selected",
          description: "Please select items to dispatch",
          variant: "destructive",
        });
        return;
      }

      const successfulDispatches: any[] = []
      const failedDispatches: any[] = []
      
      const itemsToProcess = allProductsFromSelectedGroups.filter((p: any) => dialogSelectedProducts.includes(p._rowKey))

      // 1. Validation Check: Ensure no quantities are 0
      const itemsWithZeroQty = itemsToProcess.filter(item => {
        const rowKey = item._rowKey;
        const qty = dispatchDetails[rowKey]?.qty !== undefined ? dispatchDetails[rowKey].qty : (item.remainingDispatchQty !== undefined ? item.remainingDispatchQty : item.approvalQty);
        return Number(qty) <= 0;
      });

      if (itemsWithZeroQty.length > 0) {
        toast({
          title: "Submission Blocked",
          description: "Select quantity greater than 0 to dispatch items.",
          variant: "destructive",
        });
        setIsProcessing(false);
        return;
      }

      // Submit each item to backend API
      for (const item of itemsToProcess) {
        const orderId = item.id // Use the order_dispatch table ID from backend
        const rowKey = item._rowKey;
        
        const deliveryVal = dispatchDetails[rowKey]?.deliveryFrom || "in-stock";
        const dispatchQty = dispatchDetails[rowKey]?.qty !== undefined ? dispatchDetails[rowKey].qty : (item.remainingDispatchQty !== undefined ? item.remainingDispatchQty : item.approvalQty);
        
        try {
          if (orderId) {
            const dispatchData = {
              dispatch_from: deliveryVal,
              dispatch_qty: dispatchQty,
            };

            const response = await dispatchPlanningApi.submit(orderId, dispatchData);
            
            if (response.success) {
              successfulDispatches.push({ item, dsrNumber: response.data?.dsrNumber });
            } else {
              failedDispatches.push({ item, error: response.message || 'Unknown error' });
            }
          }
        } catch (error: any) {
          failedDispatches.push({ item, error: error?.message || error?.toString() || 'Unknown error' });
        }
      }

      // Show results
      if (successfulDispatches.length > 0) {
        toast({
          title: "Dispatches Submitted Successfully",
          description: `${successfulDispatches.length} dispatch(es) submitted.`,
        });

        setSelectedItems([]);
        setDispatchDetails({});
        setDialogSelectedProducts([]);
        setIsDialogOpen(false);

        await fetchPendingDispatches();
        await fetchDispatchHistory();

        setTimeout(() => {
          router.push("/actual-dispatch")
        }, 1500)
      }

      if (failedDispatches.length > 0) {
        toast({
          title: "Some Dispatches Failed",
          description: `${failedDispatches.length} dispatch(es) failed.`,
          variant: "destructive",
        })
      }
    } catch (error: any) {
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
  const customerNames = Array.from(new Set(pendingOrders.map(order => order.customer_name || order.customerName || "Unknown")))

  const [filterValues, setFilterValues] = useState({
      search: "",
      status: "",
      startDate: "",
      endDate: "",
      partyName: ""
  })

  const filteredPendingOrders = pendingOrders.filter(order => {
      let matches = true
      
      // 1. Search Filter (DO Number, Customer Name, Product Name)
      if (filterValues.search) {
          const searchTerm = filterValues.search.toLowerCase();
          const orderNo = (order.order_no || order.orderNo || "").toLowerCase();
          const customerName = (order.customerName || order.customer_name || "").toLowerCase();
          const productName = (order.product_name || "").toLowerCase();
          
          if (!orderNo.includes(searchTerm) && !customerName.includes(searchTerm) && !productName.includes(searchTerm)) {
              matches = false;
          }
      }

      // 2. Party Name Filter
      if (matches && filterValues.partyName && filterValues.partyName !== "all" && order.customerName !== filterValues.partyName) {
          matches = false
      }

      // 3. Date Range Filter
      if (matches && (filterValues.startDate || filterValues.endDate)) {
          const orderDateStr = order.dispatchData?.dispatchDate || order.deliveryDate || order.timestamp;
          if (orderDateStr) {
              const orderDate = new Date(orderDateStr);
              orderDate.setHours(0, 0, 0, 0);

              if (filterValues.startDate) {
                  const start = new Date(filterValues.startDate)
                  start.setHours(0, 0, 0, 0)
                  if (orderDate < start) matches = false
              }
              if (matches && filterValues.endDate) {
                  const end = new Date(filterValues.endDate)
                  end.setHours(0, 0, 0, 0)
                  if (orderDate > end) matches = false
              }
          } else if (filterValues.startDate || filterValues.endDate) {
              // If filtering by date but order has no date, treat as no match
              matches = false;
          }
      }

      // 4. Status Filter (On Time / Expire)
      if (matches && filterValues.status) {
          const today = new Date()
          today.setHours(0, 0, 0, 0)
          const targetDateStr = order.deliveryDate || order.timestamp
          if (targetDateStr) {
             const targetDate = new Date(targetDateStr)
             targetDate.setHours(0, 0, 0, 0)
             
             if (filterValues.status === "expire") {
                 if (targetDate >= today) matches = false
             } else if (filterValues.status === "on-time") {
                 if (targetDate < today) matches = false
             }
          } else {
              matches = false;
          }
      }

      return matches
  })

  // Group by base DO number (removing uniqueness by Customer Name as per request)
  const filteredHistory = useMemo(() => {
    return historyOrders.map(order => ({
      orderNo: order.dispatchPlanningData?.orderNo || order.order_no || "-",
      customerName: order.customer_name || "-",
      timestamp: order.dispatchPlanningData?.confirmedAt || order.timestamp,
      date: new Date(order.dispatchPlanningData?.confirmedAt || order.timestamp || new Date()).toLocaleDateString("en-GB"),
      stage: "Dispatch Planning",
      status: "Completed",
      remarks: order.dispatchPlanningData?.dispatchDate ? `Date: ${order.dispatchPlanningData.dispatchDate}` : "Dispatch Plannned",
    })).filter(item => {
      let matches = true
      
      if (filterValues.search) {
        const search = filterValues.search.toLowerCase()
        if (!item.orderNo?.toLowerCase().includes(search) && 
            !item.customerName?.toLowerCase().includes(search)) {
          matches = false
        }
      }
      
      if (filterValues.partyName && filterValues.partyName !== "all" && item.customerName !== filterValues.partyName) {
          matches = false
      }

      const itemDateStr = item.timestamp
      if (itemDateStr) {
          const itemDate = new Date(itemDateStr)
          if (filterValues.startDate) {
              const start = new Date(filterValues.startDate)
              start.setHours(0,0,0,0)
              if (itemDate < start) matches = false
          }
          if (filterValues.endDate) {
              const end = new Date(filterValues.endDate)
              end.setHours(23,59,59,999)
              if (itemDate > end) matches = false
          }
      }
      
      return matches
    })
  }, [historyOrders, filterValues])

  const displayRows = useMemo(() => {
    const grouped: { [key: string]: any } = {}
    
    filteredPendingOrders.forEach((order: any) => {
      const orderId = order.order_no || order.orderNo || "DO-XXX"
      
      // Strip suffix (A, B, C...) from DO number for grouping/display
      const baseDoMatch = orderId.match(/^(DO-\d+)/i)
      const baseDo = baseDoMatch ? baseDoMatch[1] : orderId
      
      // Group by Order Number (baseDo)
      const groupKey = baseDo
      
      if (!grouped[groupKey]) {
        grouped[groupKey] = {
          ...order,
          customerName: order.customer_name || order.customerName || "—",
          transportType: order.type_of_transporting || order.transportType || "—",
          _displayDo: baseDo,
          _rowKey: groupKey,
          _allProducts: [],
          _productCount: 0,
          _ordersMap: {} // Map to store details for each base DO
        }
      }

      const internalOrder = order.data?.orderData || order;
      if (!grouped[groupKey]._ordersMap[baseDo]) {
         grouped[groupKey]._ordersMap[baseDo] = {
            ...order,
            baseDo,
            _products: [],
            // Robust Mapping for Header
            deliveryPurpose: internalOrder.order_type_delivery_purpose || internalOrder.orderPurpose || "—",
            startDate: internalOrder.start_date || internalOrder.startDate || "—",
            endDate: internalOrder.end_date || internalOrder.endDate || "—",
            deliveryDate: internalOrder.delivery_date || internalOrder.deliveryDate || internalOrder.timestamp || "—",
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
            depoName: internalOrder.depo_name || internalOrder.depoName || "—",
            orderPunchRemarks: internalOrder.order_punch_remarks || internalOrder.orderPunchRemarks || "—",
            custContactName: internalOrder.customer_contact_person_name || internalOrder.contactPerson || "—",
            weDealInSku: internalOrder.we_are_dealing_in_ordered_sku || false,
            creditStatus: internalOrder.party_credit_status || internalOrder.creditStatus || "—",
            dispatchConfirmed: internalOrder.dispatch_date_confirmed || false,
            overallStatus: internalOrder.overall_status_of_order || internalOrder.overallStatus || "—",
            custConfirmation: internalOrder.order_confirmation_with_customer || false,
         }
      }

      // Add product to the group
      const productWithMeta = {
        ...order,
        _rowKey: `${baseDo}-${order.id}`,
        id: order.id,
        orderNo: order.order_no,
        productName: order.product_name || order._product?.productName || order._product?.oilType,
        oilType: order.oil_type || order._product?.oilType,
        orderQty: order.order_quantity || order._product?.orderQty,
        rate: order.rate || order._product?.rate,
        approvalQty: order.approval_qty || order.order_quantity,
        remainingDispatchQty: order.remaining_dispatch_qty !== null ? order.remaining_dispatch_qty : (order.approval_qty || order.order_quantity),
      }
      
      grouped[groupKey]._ordersMap[baseDo]._products.push(productWithMeta)
      grouped[groupKey]._allProducts.push(productWithMeta)
    })
    
    return Object.values(grouped).map((group: any) => ({
      ...group,
      orderNo: group._displayDo,
      processId: group.processid || group._allProducts[0]?.processid || "—",
      transportType: Array.from(new Set(Object.values(group._ordersMap).map((o: any) => o.transportType))).filter(t => t && t !== "—").join(", ") || "—",
      orderPunchRemarks: Array.from(new Set(Object.values(group._ordersMap).map((o: any) => o.orderPunchRemarks))).filter(Boolean).join("; ") || "—",
      _productCount: group._allProducts.length
    })).filter(group => group._productCount > 0)
  }, [filteredPendingOrders])

  return (
    <WorkflowStageShell
      title="Stage 4: Dispatch Planning"
      description="Prepare and Dispatch Plannings for delivery."
      pendingCount={displayRows.length}
      historyData={filteredHistory}
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
          disabled={selectedItems.length === 0}
        >
          {selectedItems.length > 1 ? `Select 1 Group to Dispatch` : `Dispatch Selected (${selectedItems.length})`}
        </Button>
      </div>

      <Card className="border-none shadow-sm overflow-hidden overflow-auto max-h-[600px]">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-card shadow-sm">
            <TableRow>
              <TableHead className="w-12 text-center">
                <Checkbox
                  checked={displayRows.length > 0 && selectedItems.length === displayRows.length}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Select all"
                />
              </TableHead>
              {PAGE_COLUMNS.filter((col) => visibleColumns.includes(col.id)).map((col) => (
                <TableHead key={col.id} className="whitespace-nowrap text-center">
                  {col.label}
                </TableHead>
              ))}
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayRows.length > 0 ? (
                displayRows.map((row) => {
                   const isSelected = selectedItems.some(i => i._rowKey === row._rowKey);
                   
                   return (
                   <TableRow key={row._rowKey} className={isSelected ? "bg-blue-50/50" : ""}>
                     <TableCell className="text-center">
                       <Checkbox
                         checked={isSelected}
                         onCheckedChange={() => toggleSelectItem(row)}
                       />
                     </TableCell>
                     
                     {PAGE_COLUMNS.filter((col) => visibleColumns.includes(col.id)).map((col) => (
                       <TableCell key={col.id} className="whitespace-nowrap text-center text-xs">
                         {col.id === "status" ? (
                            <div className="flex justify-center flex-col items-center gap-1">
                              <Badge className="bg-orange-100 text-orange-700">Pending</Badge>
                              {row._productCount > 1 && (
                                  <span className="text-[10px] text-slate-500 font-medium">({row._productCount} Items)</span>
                              )}
                            </div>
                         ) : col.id === "productName" ? (
                              <div className="flex flex-col items-center">
                                  <span className="font-medium text-slate-700">{row._allProducts[0]?.productName}</span>
                                  {row._productCount > 1 && (
                                      <span className="text-[10px] text-slate-500">+ {row._productCount - 1} more types</span>
                                  )}
                              </div>
                          ) : (
                             row[col.id as keyof typeof row] || "—"
                          )}
                       </TableCell>
                     ))}
                     
                     <TableCell>
                         <Button variant="ghost" size="sm" onClick={() => {
                             setSelectedItems([row])
                             handleOpenDialog()
                         }}>
                             <Settings2 className="w-4 h-4 text-slate-400 hover:text-blue-600" />
                         </Button>
                     </TableCell>
                   </TableRow>
                   )
                 })
               ) : (
              <TableRow>
                <TableCell colSpan={visibleColumns.length + 2} className="text-center py-8 text-muted-foreground">
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
              Dispatch Planning
            </DialogTitle>
            <DialogDescription className="text-slate-500 mt-1.5">
              Review order details and set dispatch quantities for products.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-8 mt-4">
            {/* Group by Customer -> Multiple Orders -> Consolidated Table */}
            <div className="space-y-12 mt-6">
              {(() => {
                const groupedByCustomer: Record<string, any[]> = {};
                selectedItems.forEach(item => {
                  const custName = item.customerName || item.customer_name || "Unknown";
                  if (!groupedByCustomer[custName]) groupedByCustomer[custName] = [];
                  groupedByCustomer[custName].push(item);
                });

                return Object.entries(groupedByCustomer).map(([custName, items]) => (
                  <div key={custName} className="space-y-6">
                    <h2 className="text-xl font-black text-blue-900 border-b-4 border-blue-100 pb-2 mt-4 uppercase tracking-tight flex items-center justify-between">
                      {custName}
                      <Badge className="bg-blue-600 text-white ml-3 px-3 py-1 font-black">
                        {items.reduce((acc, current) => acc + current._productCount, 0)} PRODUCTS
                      </Badge>
                    </h2>

                    {items.map((group) => (
                      Object.entries(group._ordersMap).map(([baseDo, orderDetails]: [string, any], orderIdx) => {
                        const isExpanded = expandedOrders.includes(baseDo);
                        const toggleExpand = () => {
                          setExpandedOrders(prev => isExpanded ? prev.filter(id => id !== baseDo) : [...prev, baseDo]);
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
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/20 rounded-full">
                                  {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                                </Button>
                              </div>
                            </div>

                            {isExpanded && (
                              <div className="px-5 pb-5 animate-in slide-in-from-top-2 duration-200">
                                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 shadow-inner">
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                                    <div>
                                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">Depo Name</p>
                                      <p className="text-sm font-bold text-slate-900 leading-tight">{orderDetails.depoName || "—"}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">Delivery Purpose</p>
                                      <p className="text-sm font-bold text-slate-900 leading-tight">{orderDetails.deliveryPurpose}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">Order Type</p>
                                      <p className="text-sm font-bold text-slate-900 leading-tight">{orderDetails.orderType}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">Dates</p>
                                      <p className="text-xs font-bold text-slate-900">S: {formatDate(orderDetails.startDate)} | E: {formatDate(orderDetails.endDate)}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">Delivery Date</p>
                                      <p className="text-sm font-bold text-slate-900 leading-tight">{formatDate(orderDetails.deliveryDate)}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">Transport</p>
                                      <p className="text-sm font-bold text-slate-900 leading-tight">{orderDetails.transportType}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">Contact Person</p>
                                      <p className="text-sm font-bold text-slate-900 truncate">{orderDetails.custContactName || "—"}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">WhatsApp No.</p>
                                      <p className="text-sm font-bold text-slate-900 leading-tight">{orderDetails.whatsapp || "—"}</p>
                                    </div>
                                    <div className="col-span-2">
                                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">Address</p>
                                      <p className="text-sm font-bold text-slate-900 truncate" title={orderDetails.address}>{orderDetails.address}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">Payment Terms</p>
                                      <p className="text-sm font-bold text-slate-900 leading-tight">{orderDetails.paymentTerms}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">Advance Amount</p>
                                      <p className="text-base font-black text-blue-700 leading-tight">
                                        ₹{orderDetails.advanceAmount || 0} {orderDetails.advanceTaken ? "(REQ)" : "(NO)"}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">Broker</p>
                                      <p className="text-sm font-bold text-slate-900 leading-tight">{orderDetails.isBroker ? orderDetails.brokerName : "No"}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">Credit Status</p>
                                      <Badge className={cn("text-[10px] font-bold px-2 py-0.5", orderDetails.creditStatus === 'Good' ? 'bg-green-100 text-green-700 hover:bg-green-100' : 'bg-red-100 text-red-700 hover:bg-red-100')}>
                                        {orderDetails.creditStatus}
                                      </Badge>
                                    </div>
                                    <div className="col-span-4 bg-amber-50 p-4 rounded-xl border border-amber-100 flex items-start gap-4 mt-2">
                                      <div className="bg-amber-100 p-2 rounded-lg"><Settings2 className="h-5 w-5 text-amber-600" /></div>
                                      <div>
                                        <p className="text-[11px] text-amber-800 font-black uppercase tracking-widest mb-1 leading-none">Order Punch Remarks</p>
                                        <p className="text-sm font-medium text-slate-700 italic leading-snug">"{orderDetails.orderPunchRemarks || "No special instructions provided."}"</p>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })
                    ))}

                    <div className="space-y-4">
                      <div className="flex items-center justify-between border-b pb-2">
                        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                          Consolidated Product List - {custName}
                        </h3>
                      </div>
                      <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-white">
                        <Table>
                          <TableHeader className="bg-slate-50">
                            <TableRow>
                              <TableHead className="w-12 text-center text-[10px] uppercase font-black text-slate-500 tracking-wider">
                                <Checkbox 
                                  checked={items.flatMap(i => i._allProducts).every(p => dialogSelectedProducts.includes(p._rowKey))}
                                  onCheckedChange={(checked) => {
                                    const keys = items.flatMap(i => i._allProducts).map(p => p._rowKey);
                                    if (checked) setDialogSelectedProducts(prev => Array.from(new Set([...prev, ...keys])));
                                    else setDialogSelectedProducts(prev => prev.filter(k => !keys.includes(k)));
                                  }}
                                />
                              </TableHead>
                              <TableHead className="text-[10px] uppercase font-black text-slate-500 tracking-wider">Sub-Order</TableHead>
                              <TableHead className="text-[10px] uppercase font-black text-slate-500 tracking-wider">Product Name</TableHead>
                              <TableHead className="text-[10px] uppercase font-black text-slate-500 tracking-wider text-center">Approval</TableHead>
                              <TableHead className="w-32 text-[10px] uppercase font-black text-slate-500 tracking-wider">Qty to Dispatch</TableHead>
                              <TableHead className="w-40 text-[10px] uppercase font-black text-slate-500 tracking-wider">Delivery From</TableHead>
                              <TableHead className="text-[10px] uppercase font-black text-slate-500 tracking-wider text-center">Remaining</TableHead>
                              <TableHead className="text-[10px] uppercase font-black text-slate-500 tracking-wider text-center">Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {items.flatMap(i => i._allProducts).map((prod) => {
                              const rowKey = prod._rowKey;
                              const maxLimit = prod.remainingDispatchQty !== undefined ? prod.remainingDispatchQty : prod.approvalQty;
                              const currentDispatchQty = dispatchDetails[rowKey]?.qty !== undefined ? dispatchDetails[rowKey].qty : maxLimit;

                              return (
                                <TableRow key={rowKey} className={cn(dialogSelectedProducts.includes(rowKey) ? "bg-blue-50/30" : "")}>
                                  <TableCell className="text-center p-3">
                                    <Checkbox checked={dialogSelectedProducts.includes(rowKey)} onCheckedChange={() => toggleSelectDialogProduct(rowKey)} />
                                  </TableCell>
                                  <TableCell className="text-[10px] font-semibold text-slate-700 p-1">{prod.orderNo || "—"}</TableCell>
                                  <TableCell className="font-medium text-[11px] p-2">{prod.productName || "—"}</TableCell>

                                  <TableCell className="text-[10px] font-bold text-blue-600 p-2 text-center">{prod.approvalQty || "—"}</TableCell>
                                  <TableCell className="p-2">
                                    <Input type="number" className="h-7 text-[10px] font-bold" value={currentDispatchQty} onChange={(e) => {
                                      let val = Number(e.target.value);
                                      const maxVal = Number(maxLimit);
                                      if (val > maxVal) val = maxVal;
                                      setDispatchDetails((prev) => ({ ...prev, [rowKey]: { ...prev[rowKey], qty: val.toString() } }));
                                    }} />
                                  </TableCell>
                                  <TableCell className="p-2">
                                    <Select value={dispatchDetails[rowKey]?.deliveryFrom || "in-stock"} onValueChange={(val) => setDispatchDetails((prev) => ({ ...prev, [rowKey]: { ...prev[rowKey], deliveryFrom: val } }))}>
                                      <SelectTrigger className="h-7 text-[10px] font-bold"><SelectValue placeholder="Source" /></SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="in-stock" className="text-[10px]">In Stock</SelectItem>
                                        <SelectItem value="production" className="text-[10px]">Production</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </TableCell>
                                  <TableCell className="text-[10px] font-bold text-slate-500 p-2 text-center">{maxLimit}</TableCell>
                                  <TableCell className="p-2 text-center">
                                    <Badge variant="outline" className="text-[9px] bg-orange-50 text-orange-700 border-orange-200 uppercase font-black">Pending</Badge>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                          <tfoot className="bg-slate-100/80 border-t-2 border-slate-200">
                            <TableRow>
                              <TableCell colSpan={3} className="p-3 text-right">
                                <span className="text-[10px] uppercase font-black text-slate-500 tracking-wider">Totals:</span>
                              </TableCell>

                              <TableCell className="p-3 text-center">
                                <Badge variant="secondary" className="bg-blue-100 text-blue-800 font-black px-2 shadow-sm border-blue-200">
                                  {items.flatMap(i => i._allProducts).reduce((sum, p) => sum + (parseFloat(p.approvalQty) || 0), 0)}
                                </Badge>
                              </TableCell>
                              <TableCell className="p-3">
                                <Badge variant="secondary" className="bg-green-100 text-green-800 font-black px-2 shadow-sm border-green-200 w-full justify-center">
                                  {items.flatMap(i => i._allProducts).reduce((sum, p) => {
                                    const rowKey = p._rowKey;
                                    const maxLimit = p.remainingDispatchQty !== undefined ? p.remainingDispatchQty : p.approvalQty;
                                    const currentDispatchQty = dispatchDetails[rowKey]?.qty !== undefined ? dispatchDetails[rowKey].qty : maxLimit;
                                    return sum + (parseFloat(currentDispatchQty) || 0);
                                  }, 0)}
                                </Badge>
                              </TableCell>
                              <TableCell />
                              <TableCell className="p-3 text-center">
                                <Badge variant="secondary" className="bg-slate-200 text-slate-700 font-black px-2 shadow-sm border-slate-300">
                                  {items.flatMap(i => i._allProducts).reduce((sum, p) => {
                                    const maxLimit = p.remainingDispatchQty !== undefined ? p.remainingDispatchQty : p.approvalQty;
                                    return sum + (parseFloat(maxLimit) || 0);
                                  }, 0)}
                                </Badge>
                              </TableCell>
                              <TableCell />
                            </TableRow>
                          </tfoot>
                        </Table>
                      </div>
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>

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