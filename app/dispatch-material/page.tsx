"use client"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"

import { useEffect, useState } from "react"
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
    { id: "soNo", label: "SO No." },
    { id: "deliveryPurpose", label: "Order Type (Delivery Purpose)" },
    { id: "startDate", label: "Start Date" },
    { id: "endDate", label: "End Date" },
    { id: "deliveryDate", label: "Delivery Date" },
    { id: "orderType", label: "Order Type" },
    { id: "customerType", label: "Customer Type" },
    { id: "partySoDate", label: "Party SO Date" },
    { id: "oilType", label: "Oil Type" },
    { id: "ratePer15Kg", label: "Rate Per 15 kg" },
    { id: "ratePerLtr", label: "Rate Per Ltr" },
    { id: "totalWithGst", label: "Total Amount with GST" },
    { id: "contactPerson", label: "Customer Contact Person Name" },
    { id: "whatsapp", label: "Customer Contact Person Whatsapp No." },
    { id: "address", label: "Customer Address" },
    { id: "paymentTerms", label: "Payment Terms" },
    { id: "advanceTaken", label: "Advance Payment to be Taken" },
    { id: "advanceAmount", label: "Advance Amount" },
    { id: "isBroker", label: "Is this order Through Broker" },
    { id: "brokerName", label: "Broker Name (If Order Through Broker)" },
    { id: "uploadSo", label: "Upload SO" },
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

  useEffect(() => {
    const savedHistory = localStorage.getItem("workflowHistory")
    if (savedHistory) {
      const history = JSON.parse(savedHistory)

      
      const completed = history.filter(
        (item: any) => (item.stage === "Dispatch Material" || item.stage === "Dispatch Planning") && item.status === "Completed"
      )
      setHistoryOrders(completed)
      
      const pending = history.filter(
        (item: any) => item.stage === "Approval Of Order" && item.status === "Approved"
      ).filter(
        (item: any) => 
          !completed.some((completedItem: any) => 
            (completedItem.doNumber && item.doNumber && completedItem.doNumber === item.doNumber) ||
            (completedItem.orderNo && item.orderNo && completedItem.orderNo === item.orderNo) ||
            (completedItem.doNumber === `DO-${item.orderNo}`)
          )
      )
      setPendingOrders(pending)
    }
  }, [])

  const toggleSelectAll = () => {
    if (selectedOrders.length === pendingOrders.length) {
      setSelectedOrders([])
    } else {
      setSelectedOrders(pendingOrders.map((order) => order.doNumber || order.orderNo))
    }
  }

  const toggleSelectOrder = (orderNo: string) => {
    if (!orderNo) return
    if (selectedOrders.includes(orderNo)) {
      setSelectedOrders(selectedOrders.filter((id) => id !== orderNo))
    } else {
      setSelectedOrders([...selectedOrders, orderNo])
    }
  }

  const handleBulkDispatch = async () => {
    setIsProcessing(true)
    try {
      const savedHistory = localStorage.getItem("workflowHistory")
      const history = savedHistory ? JSON.parse(savedHistory) : []

      const ordersToDispatch = pendingOrders.filter((order) =>
        selectedOrders.includes(order.doNumber || order.orderNo)
      )

      const updatedOrders = ordersToDispatch.map((order) => {
        // Ensure we have a DO Number. If not, generate one or use OrderNo with prefix if needed
        const existingDoNumber = order.doNumber;
        // If orderNo matches DO format (DO-...), use it. Else generate or prefix.
        // For simplicity/robustness, if doNumber is missing, we can assign one.
        // If "hsfjk" is the orderNo, maybe make DO-hsfjk or just generate DO-{Random}
        // User requested distinct format "DO-001". Since we don't have a counter, we'll try to use orderNo if it looks like an ID, else "DO-" + orderNo
        
        const finalDoNumber = existingDoNumber || (order.orderNo?.startsWith("DO-") ? order.orderNo : `DO-${order.orderNo}`);
        
        // Extract values reliably
        const qtyVal = dispatchDetails[order.doNumber || order.orderNo]?.qty || "";
        const deliveryVal = dispatchDetails[order.doNumber || order.orderNo]?.deliveryFrom || order.deliveryData?.deliveryFrom || order.data?.orderData?.deliveryData?.deliveryFrom || "";
        const transportVal = order.transportType || order.data?.orderData?.transportType || "";

        return {
          ...order,
          doNumber: finalDoNumber, // Ensure this property is set for future stages
          stage: "Dispatch Material",
          status: "Completed",
          
          // Save at top level for easier access
          qtyToDispatch: qtyVal,
          deliveryFrom: deliveryVal,
          qtytobedispatched: qtyVal, // Redundant key for compatibility
          dispatchfrom: deliveryVal, // Redundant key for compatibility

          dispatchData: {
            ...dispatchData,
            dispatchedAt: new Date().toISOString(),
            qtyToDispatch: qtyVal,
            // store the selected source (In Stock/Production)
            deliveryFrom: deliveryVal,
            // store the actual transport type (Self/Others)
            transportType: transportVal,
          },
        }
      })

      // Update history
      updatedOrders.forEach((order) => history.push(order))
      localStorage.setItem("workflowHistory", JSON.stringify(history))
      
      // Update local state immediately
      setPendingOrders((prev) => prev.filter(order => !ordersToDispatch.some(d => (d.doNumber || d.orderNo) === (order.doNumber || order.orderNo))))
      setHistoryOrders((prev) => [...prev, ...updatedOrders])
      setSelectedOrders([])
      setDispatchDetails({})

      // Update current order data (just taking the last one as current context if needed, or arguably this might be less relevant for bulk)
      if (updatedOrders.length > 0) {
        localStorage.setItem("currentOrderData", JSON.stringify(updatedOrders[updatedOrders.length - 1]))
      }

      toast({
        title: "Materials Dispatched",
        description: `${updatedOrders.length} orders moved to Actual Dispatch stage.`,
      })

      setTimeout(() => {
        router.push("/actual-dispatch")
      }, 1500)
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

  return (
    <WorkflowStageShell
      title="Stage 4: Dispatch Planning"
      description="Prepare and Dispatch Plannings for delivery."
      pendingCount={filteredPendingOrders.length}
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
                  checked={filteredPendingOrders.length > 0 && selectedOrders.length === filteredPendingOrders.length}
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
            {filteredPendingOrders.length > 0 ? (
                filteredPendingOrders.map((order, index) => {
                  // Map Data
                   // Safe extraction of nested order data if it exists (from Approval stage history)
                   const internalOrder = order.data?.orderData || order;
                   const preApproval = order.data?.preApprovalData || internalOrder.preApprovalData || {};
                   const productRates = preApproval.productRates || {};
                   
                   const prodNames = internalOrder.products?.map((p: any) => p.productName).filter(Boolean).join(" | ") || 
                                     internalOrder.preApprovalProducts?.map((p: any) => p.oilType).filter(Boolean).join(" | ") || 
                                     "";
                   const ratesLtr = internalOrder.preApprovalProducts?.map((p: any) => p.ratePerLtr).join(", ") || internalOrder.ratePerLtr || "—";
                   const rates15Kg = internalOrder.preApprovalProducts?.map((p: any) => p.rateLtr).join(", ") || internalOrder.rateLtr || "—";
                   const oilTypes = internalOrder.preApprovalProducts?.map((p: any) => p.oilType).join(", ") || internalOrder.oilType || "—";
                   
                   // SKU/Rates from productRates map
                   const skuNames = Object.values(productRates).map((p: any) => p.skuName).filter(Boolean).join(", ") || "—";
                   // Only show approval quantities if they were explicitly set during Pre-Approval
                   const approvalQtys = Object.values(productRates).map((p: any) => p.approvalQty).filter(Boolean).join(", ") || "—";
                   const reqRates = Object.values(productRates).map((p: any) => p.rate).filter(Boolean).join(", ") || "—";
                   
                     const row = {
                      orderNo: internalOrder.doNumber || internalOrder.orderNo,
                      customerName: internalOrder.customerName,
                      productName: prodNames, // Always show names, not count
                      transportType: internalOrder.transportType || "—",
                      status: "Pending Dispatch", // Special handling
                     
                     soNo: internalOrder.soNumber || "—",
                     deliveryPurpose: internalOrder.orderPurpose || "—",
                     startDate: internalOrder.startDate || "—",
                     endDate: internalOrder.endDate || "—",
                     deliveryDate: internalOrder.deliveryDate || "—",
                     orderType: internalOrder.orderType || "—",
                     customerType: internalOrder.customerType || "—",
                     partySoDate: internalOrder.soDate || "—",
                     oilType: oilTypes,
                     ratePer15Kg: rates15Kg,
                     ratePerLtr: ratesLtr,
                     totalWithGst: internalOrder.totalWithGst || "—",
                     contactPerson: internalOrder.contactPerson || "—",
                     whatsapp: internalOrder.whatsappNo || "—",
                     address: internalOrder.customerAddress || "—",
                     paymentTerms: internalOrder.paymentTerms || "—",
                     advanceTaken: internalOrder.advancePaymentTaken || "—",
                     advanceAmount: internalOrder.advanceAmount || "—",
                     isBroker: internalOrder.isBrokerOrder || "—",
                     brokerName: internalOrder.brokerName || "—",
                     uploadSo: "so_document.pdf",
                     skuName: skuNames,
                     approvalQty: approvalQtys,
                     skuRates: reqRates,
                     remark: order.remarks || internalOrder.preApprovalRemark || preApproval.overallRemark || "—",
                  }
                  
                  return (
                  <TableRow key={index}>
                    <TableCell>
                      <Checkbox
                        checked={selectedOrders.includes(order.doNumber || order.orderNo)}
                        onCheckedChange={() => toggleSelectOrder(order.doNumber || order.orderNo)}
                        aria-label={`Select order ${order.doNumber || order.orderNo}`}
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
                            className="h-8 w-[100px] mx-auto"
                            value={dispatchDetails[order.doNumber || order.orderNo]?.qty || ""}
                            onChange={(e) =>
                              setDispatchDetails((prev) => ({
                                ...prev,
                                [order.doNumber || order.orderNo]: {
                                   ...prev[order.doNumber || order.orderNo],
                                   qty: e.target.value
                                }
                              }))
                            }
                            disabled={!selectedOrders.includes(order.doNumber || order.orderNo)}
                          />
                        ) : col.id === "deliveryFrom" ? (
                           <Select
                            value={dispatchDetails[order.doNumber || order.orderNo]?.deliveryFrom || order.deliveryData?.deliveryFrom || order.data?.orderData?.deliveryData?.deliveryFrom || ""}
                            onValueChange={(val) =>
                              setDispatchDetails((prev) => ({
                                ...prev,
                                [order.doNumber || order.orderNo]: {
                                   ...prev[order.doNumber || order.orderNo],
                                   deliveryFrom: val
                                }
                              }))
                            }
                            disabled={!selectedOrders.includes(order.doNumber || order.orderNo)}
                          >
                            <SelectTrigger className="h-8 w-[130px] mx-auto">
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