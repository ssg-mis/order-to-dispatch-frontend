"use client"

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

export default function ActualDispatchPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [pendingOrders, setPendingOrders] = useState<any[]>([])
  const [historyOrders, setHistoryOrders] = useState<any[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [selectedOrders, setSelectedOrders] = useState<string[]>([])
  const PAGE_COLUMNS = [
    { id: "orderNo", label: "DO Number" },
    { id: "customerName", label: "Customer Name" },
    { id: "qtyToDispatch", label: "Qty to Dispatch" },
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
    { id: "ratePerLtr", label: "Rate Per Ltr." }, // Aggregated
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
    { id: "uploadSo", label: "Upload DO" },
    { id: "skuName", label: "SKU Name" },
    { id: "approvalQty", label: "Approval Qty" },
    { id: "skuRates", label: "Take Required Rates of Each Item" },
    { id: "remark", label: "Remark" },
    { id: "rateRightly", label: "Rate Rightly" },
    { id: "dealingInOrder", label: "We Are Dealing in Order" },
    { id: "partyCredit", label: "Party Credit" },
    { id: "dispatchConfirmed", label: "Dispatch Date is Confirmed" },
    { id: "overallStatus", label: "Overall Status of Order" },
    { id: "orderConfirmation", label: "Order Confirmation with Customer" },
    { id: "qtytobedispatched", label: "Qty to be Dispatched" },
    { id: "dispatchfrom", label: "Dispatch from"}
  ]

  const [visibleColumns, setVisibleColumns] = useState<string[]>([
    "orderNo",
    "customerName",
    "qtyToDispatch",
    "deliveryFrom",
    "status",
  ])

  useEffect(() => {
    const savedHistory = localStorage.getItem("workflowHistory")
    if (savedHistory) {
      const history = JSON.parse(savedHistory)
      
      const completed = history.filter(
        (item: any) => item.stage === "Actual Dispatch" && item.status === "Completed"
      )
      setHistoryOrders(completed)
      
      const pending = history.filter(
        (item: any) => (item.stage === "Dispatch Planning" || item.stage === "Dispatch Material") && 
                       (item.status === "Completed" || item.status === "Approved")
      ).filter(
        (item: any) => 
          !completed.some((completedItem: any) => 
             (completedItem.doNumber && item.doNumber && completedItem.doNumber === item.doNumber) || 
             (completedItem.orderNo && item.orderNo && completedItem.orderNo === item.orderNo)
          )
      )
      
      // Sort by newest
      const sortedPending = pending.reverse();
      setPendingOrders(sortedPending)
    }
  }, [])

  const toggleSelectAll = () => {
    // Only toggle visible/filtered orders to avoid selecting hidden ones
    const ids = filteredPendingOrders.map(o => o.doNumber || o.orderNo);
    if (selectedOrders.length === ids.length && ids.length > 0) {
      setSelectedOrders([])
    } else {
       setSelectedOrders(ids)
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

  const handleBulkConfirm = async () => {
    setIsProcessing(true)
    try {
      const savedHistory = localStorage.getItem("workflowHistory")
      const history = savedHistory ? JSON.parse(savedHistory) : []

      const ordersToDispatch = pendingOrders.filter((order) =>
        selectedOrders.includes(order.doNumber || order.orderNo)
      )

      const updatedOrders = ordersToDispatch.map((order) => ({
        ...order,
        stage: "Actual Dispatch",
        status: "Completed",
        actualDispatchData: {
          confirmedAt: new Date().toISOString(),
          dispatchedQty: order.qtyToDispatch || order.dispatchData?.qtyToDispatch,
          transportMode: order.transportType || order.dispatchData?.transportType
        },
      }))

      // Update history
      updatedOrders.forEach((order) => history.push(order))
      localStorage.setItem("workflowHistory", JSON.stringify(history))
      
      // Update local state immediately
      setPendingOrders((prev) => prev.filter(order => !ordersToDispatch.some(d => (d.doNumber || d.orderNo) === (order.doNumber || order.orderNo))))
      setHistoryOrders((prev) => [...prev, ...updatedOrders])
      setSelectedOrders([])

      // Update current order data
      if (updatedOrders.length > 0) {
        localStorage.setItem("currentOrderData", JSON.stringify(updatedOrders[updatedOrders.length - 1]))
      }

      toast({
        title: "Dispatch Confirmed",
        description: `${updatedOrders.length} orders moved to Vehicle Details stage.`,
      })

      setTimeout(() => {
        router.push("/vehicle-details")
      }, 1500)
    } finally {
      setIsProcessing(false)
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
      const orderDateStr = order.actualDispatchData?.confirmedAt || order.dispatchData?.dispatchDate || order.dispatchData?.dispatchedAt || order.timestamp
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
      title="Stage 5: Actual Dispatch"
      description="Confirm actual dispatch details before vehicle assignment."
      pendingCount={filteredPendingOrders.length}
      historyData={historyOrders.map((order) => ({
        date: new Date(order.actualDispatchData?.confirmedAt || order.timestamp || new Date()).toLocaleDateString("en-GB"),
        stage: "Actual Dispatch",
        status: "Completed",
        remarks: "Dispatch Confirmed",
      }))}
      partyNames={customerNames}
      onFilterChange={setFilterValues}
      remarksColName="Confirmation"
    >
      <div className="space-y-4">
        <div className="flex justify-end gap-2">
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
            onClick={handleBulkConfirm}
            disabled={selectedOrders.length === 0 || isProcessing}
          >
            {isProcessing ? "Processing..." : `Confirm Dispatch (${selectedOrders.length})`}
          </Button>
        </div>

        <Card className="border-none shadow-sm overflow-auto max-h-[600px]">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-card shadow-sm">
              <TableRow>
                <TableHead className="w-12">
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
                     // Robust data fetching
                     const deliveryFromVal = order.dispatchData?.deliveryFrom || order.deliveryFrom || order.data?.orderData?.deliveryData?.deliveryFrom || order.deliveryData?.deliveryFrom || "—";
                     const qtyVal = order.qtyToDispatch || order.dispatchData?.qtyToDispatch || order.qtytobedispatched || "—";
                     
                     const preApproval = order.data?.preApprovalData || {};
                     const productRates = preApproval.productRates || {};
                     const checklist = order.data?.checklistResults || {};

                     // SKU/Rates
                     const skuNames = Object.values(productRates).map((p: any) => p.skuName).filter(Boolean).join(", ") || "—";
                     const approvalQtys = Object.values(productRates).map((p: any) => p.approvalQty).filter(Boolean).join(", ") || "—";
                     const reqRates = Object.values(productRates).map((p: any) => p.rate).filter(Boolean).join(", ") || "—";
                     
                     // Rates
                     const ratesLtr = order.preApprovalProducts?.map((p: any) => p.ratePerLtr).join(", ") || order.ratePerLtr || "—";
                     const rates15Kg = order.preApprovalProducts?.map((p: any) => p.rateLtr).join(", ") || order.rateLtr || "—";
                     
                     const deliveryFromDisplay = deliveryFromVal === "in-stock" ? "In Stock" : deliveryFromVal === "production" ? "Production" : deliveryFromVal;

                     const row = {
                       orderNo: order.doNumber || order.orderNo || "DO-XXX",
                       deliveryPurpose: order.orderPurpose || "—",
                       customerType: order.customerType || "—",
                       orderType: order.orderType || "—",
                       soNo: order.soNumber || "—",
                       partySoDate: order.soDate || "—",
                       customerName: order.customerName || "—",
                       
                       startDate: order.startDate || "—",
                       endDate: order.endDate || "—",
                       deliveryDate: order.deliveryDate || "—",
                       oilType: order.preApprovalProducts?.map((p: any) => p.oilType).join(", ") || order.oilType || "—",
                       ratePerLtr: ratesLtr,
                       ratePer15Kg: rates15Kg,
                       
                       totalWithGst: order.totalWithGst || "—",
                       transportType: order.transportType || order.dispatchData?.transportType || "—",
                       contactPerson: order.contactPerson || "—",
                       whatsapp: order.whatsappNo || "—",
                       address: order.customerAddress || "—",
                       paymentTerms: order.paymentTerms || "—",
                       advanceTaken: order.advancePaymentTaken || "—",
                       advanceAmount: order.advanceAmount || "—",
                       isBroker: order.isBrokerOrder || "—",
                       brokerName: order.brokerName || "—",
                       uploadSo: "do_document.pdf",
                       
                       skuName: skuNames,
                       approvalQty: approvalQtys,
                       skuRates: reqRates,
                       remark: order.remarks || order.preApprovalRemark || preApproval.overallRemark || "—",
                       
                       // Checklist/Status
                       rateRightly: checklist.rate || "—",
                       dealingInOrder: checklist.sku || "—",
                       partyCredit: checklist.credit || "—",
                       dispatchConfirmed: checklist.dispatch || "—",
                       overallStatus: checklist.overall || "—",
                       orderConfirmation: checklist.confirm || "—",
                       
                       qtyToDispatch: qtyVal,
                       qtytobedispatched: qtyVal,
                       deliveryFrom: deliveryFromDisplay,
                       dispatchfrom: deliveryFromDisplay,
                       status: "Pending Confirmation",
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
                                 <Badge className="bg-blue-100 text-blue-700">Ready for Dispatch</Badge>
                               </div>
                            ) : (
                               row[col.id as keyof typeof row]
                            )}
                         </TableCell>
                       ))}
                     </TableRow>
                   )
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={visibleColumns.length + 1} className="text-center py-8 text-muted-foreground">
                    No orders pending for actual dispatch
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
