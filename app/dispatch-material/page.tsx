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
import { Settings2 } from "lucide-react"
import { dispatchPlanningApi } from "@/lib/api-service"

export default function DispatchMaterialPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [pendingOrders, setPendingOrders] = useState<any[]>([])
  const [historyOrders, setHistoryOrders] = useState<any[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [selectedOrders, setSelectedOrders] = useState<string[]>([])
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
    { id: "qtyDispatch", label: "Qty to be Dispatch" },
    { id: "deliveryFrom", label: "Delivery From" },
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
    "qtyDispatch",
    "deliveryFrom",
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

  const toggleSelectAll = () => {
    if (selectedOrders.length === displayRows.length) {
      setSelectedOrders([])
    } else {
      setSelectedOrders(displayRows.map((row) => `${row.doNumber || row.orderNo}-${row._product?.id || row._product?.productName || row._product?.oilType || 'no-id'}`))
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



  const handleBulkDispatch = async () => {
    setIsProcessing(true)
    try {
      const itemsToDispatch = displayRows.filter((row) =>
        selectedOrders.includes(`${row.doNumber || row.orderNo}-${row._product?.id || row._product?.productName || row._product?.oilType || 'no-id'}`)
      )

      if (itemsToDispatch.length === 0) {
        toast({
          title: "No Items Selected",
          description: "Please select items to dispatch",
          variant: "destructive",
        });
        return;
      }

      const successfulDispatches: any[] = []
      const failedDispatches: any[] = []

      // Submit each item to backend API
      for (const item of itemsToDispatch) {
        const orderId = item.id // Use the order_dispatch table ID from backend
        const rowKey = `${item.doNumber || item.orderNo}-${item._product?.id || item._product?.productName || item._product?.oilType || 'no-id'}`;
        
        // Extract values reliably
        const deliveryVal = dispatchDetails[rowKey]?.deliveryFrom || "";

        try {
          if (orderId) {
            // Call backend API to submit dispatch planning
            const dispatchData = {
              dispatch_from: deliveryVal,
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

  // Flatten orders for table display
  const displayRows = useMemo(() => {
    // Backend returns flat data with snake_case fields
    // Map to the format expected by the table
    return filteredPendingOrders.map((order: any) => ({
      ...order,
      id: order.id, // Keep the database ID for API calls
      doNumber: order.order_no,
      orderNo: order.order_no,
      customerName: order.customer_name,
      productName: order.product_name,
      deliveryDate: order.delivery_date,
      transportType: order.type_of_transporting,
      _product: {
        id: order.id,
        productName: order.product_name,
        orderQty: order.order_quantity,
      },
    }))
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
          onClick={handleBulkDispatch}
          disabled={selectedOrders.length === 0 || isProcessing}
        >
          {isProcessing ? "Processing..." : `Dispatch Selected (${selectedOrders.length})`}
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
                displayRows.map((item, index) => {
                   const order = item;
                   const p = order._product;
                   const rowKey = `${order.doNumber || order.orderNo}-${p?.id || p?.productName || p?.oilType || 'no-id'}`;

                   // Map Data
                   const internalOrder = order.data?.orderData || order;
                   const preApproval = order.data?.preApprovalData || internalOrder.preApprovalData || {};
                   const productRates = preApproval.productRates || {};
                   
                   const prodName = p?.productName || p?.oilType || "—";
                   const rateLtr = p?.ratePerLtr || p?.rateLtr || internalOrder.ratePerLtr || "—";
                   const rate15Kg = p?.ratePer15Kg || p?.rateLtr || internalOrder.rateLtr || "—";
                   const oilType = p?.oilType || internalOrder.oilType || "—";
                   
                   // SKU/Rates from productRates map - filter by current product if possible
                   // In this page, we'll show what's available for this product row
                   const skuName = productRates[p?.id]?.skuName || "—";
                   const approvalQty = productRates[p?.id]?.approvalQty || "—";
                   const reqRate = productRates[p?.id]?.rate || "—";
                   
                     const row = {
                      orderNo: internalOrder.doNumber || internalOrder.orderNo,
                      customerName: internalOrder.customerName,
                      productName: prodName, 
                      transportType: internalOrder.transportType || "—",
                      rate: p?.rate || "—",
                      status: "Pending Dispatch", 
                     
                     soNo: internalOrder.soNumber || "—",
                     deliveryPurpose: internalOrder.orderPurpose || "—",
                     startDate: internalOrder.startDate || "—",
                     endDate: internalOrder.endDate || "—",
                     deliveryDate: internalOrder.deliveryDate || "—",
                     orderType: internalOrder.orderType || "—",
                     customerType: internalOrder.customerType || "—",
                     partySoDate: internalOrder.soDate || "—",
                     oilType: oilType,
                     ratePer15Kg: rate15Kg,
                     ratePerLtr: rateLtr,
                     totalWithGst: internalOrder.totalWithGst || "—",
                     contactPerson: internalOrder.contactPerson || "—",
                     whatsapp: internalOrder.whatsappNo || "—",
                     address: internalOrder.customerAddress || "—",
                     paymentTerms: internalOrder.paymentTerms || "—",
                     advanceTaken: internalOrder.advancePaymentTaken || "—",
                     advanceAmount: internalOrder.advanceAmount || "—",
                     isBroker: internalOrder.isBrokerOrder || "—",
                     brokerName: internalOrder.brokerName || "—",
                      uploadSo: "do_document.pdf",
                     skuName: skuName,
                     approvalQty: approvalQty,
                     skuRates: reqRate,
                     remark: order.remarks || internalOrder.preApprovalRemark || preApproval.overallRemark || "—",
                  }
                  
                  return (
                  <TableRow key={rowKey} className={selectedOrders.includes(rowKey) ? "bg-blue-50/50" : ""}>
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
                           <div className="flex justify-center">
                             <Badge className="bg-orange-100 text-orange-700">Pending Dispatch</Badge>
                           </div>
                        ) : col.id === "qtyDispatch" ? (
                           <Input
                            type="number"
                            placeholder="Qty"
                            className="h-8 w-[100px] mx-auto bg-white"
                            value={dispatchDetails[rowKey]?.qty || ""}
                            onChange={(e) =>
                              setDispatchDetails((prev) => ({
                                ...prev,
                                [rowKey]: {
                                   ...prev[rowKey],
                                   qty: e.target.value
                                }
                              }))
                            }
                            disabled={!selectedOrders.includes(rowKey)}
                          />
                        ) : col.id === "deliveryFrom" ? (
                           <Select
                            value={dispatchDetails[rowKey]?.deliveryFrom || order.deliveryData?.deliveryFrom || order.data?.orderData?.deliveryData?.deliveryFrom || ""}
                            onValueChange={(val) =>
                              setDispatchDetails((prev) => ({
                                ...prev,
                                [rowKey]: {
                                   ...prev[rowKey],
                                   deliveryFrom: val
                                }
                              }))
                            }
                            disabled={!selectedOrders.includes(rowKey)}
                          >
                            <SelectTrigger className="h-8 w-[130px] mx-auto bg-white">
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="in-stock">In Stock</SelectItem>
                              <SelectItem value="production">Production</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                           row[col.id as keyof typeof row]
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                )})
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
    </WorkflowStageShell>
  )
}