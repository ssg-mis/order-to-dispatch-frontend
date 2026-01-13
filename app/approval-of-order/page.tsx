"use client"

import { Card } from "@/components/ui/card"
import { WorkflowStageShell } from "@/components/workflow/workflow-stage-shell"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useRouter } from "next/navigation"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useToast } from "@/hooks/use-toast"
import { useState, useEffect } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Settings2 } from "lucide-react"


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
    "status",
  ])
  
  // State for list of orders
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

  useEffect(() => {
    // 1. Load History
    const savedHistory = localStorage.getItem("workflowHistory")
    let historyData = []
    if (savedHistory) {
      historyData = JSON.parse(savedHistory)
      // Filter for both old and new stage names to keep history visible
      const stageHistory = historyData.filter((item: any) => 
          item.stage === "Commitment Review" || item.stage === "Approval Of Order"
      )
      
      // Map history to match Shell expectations (date, remarks)
      // Create a map of Pre-Approval remarks for fallback
      const preApprovalMap = new Map();
      historyData.forEach((h: any) => {
          if (h.stage === "Pre-Approval" && h.orderNo) {
             preApprovalMap.set(h.orderNo, h.data?.overallRemark || h.data?.preApprovalData?.overallRemark);
          }
      });

      const formattedHistory = stageHistory.map((item: any) => {
          let remark = item.remarks;
          if (!remark || remark === "-") {
              remark = preApprovalMap.get(item.orderNo) || "Verified"; 
          }
          return {
            ...item,
            stage: "Approval Of Order", // Force display name update
            date: item.date || (item.timestamp ? new Date(item.timestamp).toLocaleDateString("en-GB") : "-"),
            remarks: remark
          }
      })
      setHistory(formattedHistory)
    }
      
      // LOGIC: Use a "Latest Stage" approach to determine pending items from history.
      const latestStatusByOrder = new Map();
      historyData.forEach((entry: any) => {
          const key = entry.orderNo || entry.doNumber
          if (key) {
            latestStatusByOrder.set(key, entry);
          }
      });

      const pendingFromHistory: any[] = [];
      latestStatusByOrder.forEach((entry, orderNo) => {
          // Case 1: Pre-Approval Completed -> Ready for Approval
          if (entry.stage === "Pre-Approval" && entry.status === "Completed") {
               // Merge metadata from pre-approval into the order object so it's carried forward
               const rawOrder = entry.data?.orderData || entry.data || entry;
               const orderData = {
                   ...rawOrder,
                   preApprovalData: entry.data // Keep the full pre-approval context
               }
               // Attach the remark
               if (entry.data?.overallRemark) {
                   orderData.preApprovalRemark = entry.data.overallRemark;
               }
               pendingFromHistory.push(orderData);
          }
          // Case 2: Regular Order from History directly (if stored there by punch)
          else if (entry.stage === "Approval Of Order" && entry.status === "Pending") {
               const orderData = entry; 
               pendingFromHistory.push(orderData);
          }
      });
      
      // 2. Load Persisted Pending Items (for Direct Regular Orders)
      const savedPending = localStorage.getItem("approvalPendingItems")
      let persistedPending = savedPending ? JSON.parse(savedPending) : []

      // 3. Load New Incoming Data (Regular Order Handoff)
      const savedOrderData = localStorage.getItem("orderData")
      if (savedOrderData) {
        try {
            const data = JSON.parse(savedOrderData)
            // Only add if it's meant for this stage and strictly Pending (Regular Order)
            if (data.stage === "Approval Of Order" && data.status === "Pending") {
                // Check if already processed in history
                const isProcessed = historyData.some(
                    (item: any) => item.stage === "Approval Of Order" && (item.orderNo === (data.doNumber || "DO-XXX"))
                )
                
                if (!isProcessed) {
                     // Check if already in persisted list
                     const exists = persistedPending.some((o: any) => 
                         (o.doNumber || o.orderNo) === (data.doNumber || data.orderNo)
                     )
                     if (!exists) {
                         persistedPending = [data, ...persistedPending]
                         localStorage.setItem("approvalPendingItems", JSON.stringify(persistedPending))
                     }
                }
            }
        } catch(e) {}
      }

      // 4. Merge history pending and direct persisted pending
      const mergedPending = [...pendingFromHistory]
      
      persistedPending.forEach((item: any) => {
          const exists = mergedPending.some(o => (o.doNumber || o.orderNo) === (item.doNumber || item.orderNo))
          if (!exists) {
              mergedPending.push(item)
          }
      })
      
      // Sort by recency
      // mergedPending.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

      setPendingOrders(mergedPending)
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
    if (!selectedOrder) return;
    
    setIsConfirming(true)
    try {
      const hasRejection = Object.values(checklistValues).includes("reject")

      // Identify Order Number consistently
      const orderIdentifier = selectedOrder.doNumber || selectedOrder.soNumber || selectedOrder.orderNo || "ORD-XXX";

      // Cleanup local storage if this matches the single-item buffer
      const savedCommitmentData = localStorage.getItem("commitmentReviewData")
      if (savedCommitmentData) {
          try {
              const parsed = JSON.parse(savedCommitmentData)
              const directOrderNo = parsed?.orderData?.doNumber || parsed?.orderData?.orderNo
              if (directOrderNo === orderIdentifier) {
                  localStorage.removeItem("commitmentReviewData")
              }
          } catch (e) {}
      }

      if (hasRejection) {
        const historyEntry = {
          orderNo: orderIdentifier,
          customerName: selectedOrder.customerName || "Unknown",
          stage: "Approval Of Order", // Renamed from Commitment Review
          status: "Rejected",
          processedBy: "Current User",
          timestamp: new Date().toISOString(),
          date: new Date().toLocaleDateString("en-GB"),
          remarks: "Rejected by User",
          data: {
            orderData: selectedOrder,
            checklistResults: checklistValues,
            rejectedAt: new Date().toISOString(),
          },
          productCount: selectedOrder.products?.length || 0,
        }

        const existingHistory = localStorage.getItem("workflowHistory")
        const history = existingHistory ? JSON.parse(existingHistory) : []
        history.push(historyEntry)
        localStorage.setItem("workflowHistory", JSON.stringify(history))

        toast({
          title: "Order Rejected",
          description: "Order has been rejected and saved to history.",
          variant: "destructive",
        })

         // Update local state immediately
        setHistory((prev) => [...prev, historyEntry])

        const newPending = pendingOrders.filter(o => (o.doNumber || o.orderNo) !== orderIdentifier)
        setPendingOrders(newPending)
        
        // Update persisted list as well
        const savedPending = localStorage.getItem("approvalPendingItems")
        if (savedPending) {
           const list = JSON.parse(savedPending)
           const updatedList = list.filter((o: any) => (o.doNumber || o.orderNo) !== orderIdentifier)
           localStorage.setItem("approvalPendingItems", JSON.stringify(updatedList))
        }

        setSelectedOrder(null)

      } else {
        const finalData = {
          orderData: {
            ...selectedOrder,
            deliveryData: {
                deliveryFrom: sourceOfMaterial
            }
          },
          checklistResults: checklistValues,
          confirmedAt: new Date().toISOString(),
          status: "Approved",
        }

        const existingHistory = localStorage.getItem("workflowHistory")
        const currentHistory = existingHistory ? JSON.parse(existingHistory) : []
        
        const historyEntry = {
          orderNo: orderIdentifier,
          customerName: selectedOrder.customerName || "Unknown",
          stage: "Approval Of Order",
          status: "Approved",
          processedBy: "Current User",
          timestamp: new Date().toISOString(),
          date: new Date().toLocaleDateString("en-GB"),
          remarks: "Verified & Approved",
          data: finalData,
          productCount: selectedOrder.products?.length || 0,
        }

        currentHistory.push(historyEntry)
        localStorage.setItem("workflowHistory", JSON.stringify(currentHistory))
        
        // Update local state immediately
        setHistory((prev) => [...prev, historyEntry])
        
        const newPending = pendingOrders.filter(o => (o.doNumber || o.orderNo) !== orderIdentifier)
        setPendingOrders(newPending)

        // Update persisted list as well
        const savedPending = localStorage.getItem("approvalPendingItems")
        if (savedPending) {
           const list = JSON.parse(savedPending)
           const updatedList = list.filter((o: any) => (o.doNumber || o.orderNo) !== orderIdentifier)
           localStorage.setItem("approvalPendingItems", JSON.stringify(updatedList))
        }

        setSelectedOrder(null)

        toast({
          title: "Commitment Verified",
          description: "Order has been approved and moved to Dispatch Material.",
        })
        
        // Don't auto-redirect if there are more items, unless user wants to follow the flow. 
        // For now, staying on page is better for bulk processing, or we can redirect if list is empty.
        if (pendingOrders.length <= 1) {
             setTimeout(() => {
               router.push("/dispatch-material")
             }, 1000)
        }
      }
    } finally {
      setIsConfirming(false)
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

  return (
    <WorkflowStageShell
      title="Stage 3: Approval Of Order"
      description="Six-point verification check before commitment entry."
      pendingCount={filteredPendingOrders.length}
      historyData={history}
        partyNames={customerNames}
        onFilterChange={setFilterValues}
    >
      <div className="space-y-4">
        <div className="flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="ml-auto bg-transparent">
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
                <TableHead className="w-[80px]">Action</TableHead>
                {PAGE_COLUMNS.filter((col) => visibleColumns.includes(col.id)).map((col) => (
                  <TableHead key={col.id} className="whitespace-nowrap text-center">
                    {col.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPendingOrders.length > 0 ? (
                filteredPendingOrders.map((order: any, index: number) => {
                   // Ensure rate arrays are handled if they exist in preApprovalProducts, else fallback to root props
                   const prodNames = order.products?.map((p: any) => p.productName).join(", ") || "";
                   const uoms = order.products?.map((p: any) => p.uom).join(", ") || "";
                   const qtys = order.products?.map((p: any) => p.orderQty).join(", ") || "";
                   const altUoms = order.products?.map((p: any) => p.altUom).join(", ") || "";
                   const altQtys = order.products?.map((p: any) => p.altQty).join(", ") || "";
                   
                   const ratesLtr = order.preApprovalProducts?.map((p: any) => p.ratePerLtr).join(", ") || order.ratePerLtr || "—";
                   const rates15Kg = order.preApprovalProducts?.map((p: any) => p.rateLtr).join(", ") || order.rateLtr || "—";

                   const row = {
                     orderNo: order.doNumber || order.orderNo || "DO-XXX",
                     deliveryPurpose: order.orderPurpose || "—",
                     customerType: order.customerType || "—",
                     orderType: order.orderType || "—",
                     soNo: order.soNumber || "—",
                     partySoDate: order.soDate || "—",
                     customerName: order.customerName || "—",
                     // New Date Columns
                     startDate: order.startDate || "—",
                     endDate: order.endDate || "—",
                     deliveryDate: order.deliveryDate || "—",
                     
                     // Rates
                     oilType: order.preApprovalProducts?.map((p: any) => p.oilType).join(", ") || order.oilType || "—",
                     ratePerLtr: ratesLtr,
                     ratePer15Kg: rates15Kg,

                     // Product Details
                     productName: prodNames,
                     uom: uoms,
                     orderQty: qtys,
                     altUom: altUoms,
                     altQty: altQtys,

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
                     
                     status: "Excellent", // Badge fallback
                   }

                   return (
                   <TableRow key={index}>
                     <TableCell>
                       <Dialog open={selectedOrder?.doNumber === order.doNumber} onOpenChange={(open) => {
                           if (open) setSelectedOrder(order)
                           else setSelectedOrder(null)
                       }}>
                         <DialogTrigger asChild>
                           <Button size="sm" onClick={() => setSelectedOrder(order)}>Verify Order</Button>
                         </DialogTrigger>
                         <DialogContent className="max-w-xl">
                           <DialogHeader>
                             <DialogTitle>Verification Checklist: {selectedOrder?.soNumber || selectedOrder?.doNumber}</DialogTitle>
                           </DialogHeader>
                           <div className="grid gap-4 py-4">
                             {/* <div className="space-y-2 p-3 rounded-lg bg-muted/20">
                                 <Label className="text-base font-semibold">Source of Material</Label>
                                 <Select value={sourceOfMaterial} onValueChange={setSourceOfMaterial}>
                                     <SelectTrigger className="bg-background">
                                         <SelectValue placeholder="Select Source" />
                                     </SelectTrigger>
                                     <SelectContent>
                                         <SelectItem value="in-stock">In Stock</SelectItem>
                                         <SelectItem value="production">From Production</SelectItem>
                                     </SelectContent>
                                 </Select>
                             </div> */}
                             {checkItems.map((item) => (
                               <div key={item.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/20">
                                 <Label className="text-base">{item.label}</Label>
                                 <RadioGroup
                                   value={checklistValues[item.id]}
                                   onValueChange={(value) => handleChecklistChange(item.id, value)}
                                   className="flex gap-4"
                                 >
                                   <div className="flex items-center space-x-2">
                                     <RadioGroupItem value="approve" id={`${item.id}-ok`} />
                                     <Label htmlFor={`${item.id}-ok`} className="text-green-600 cursor-pointer">
                                       Approve
                                     </Label>
                                   </div>
                                   <div className="flex items-center space-x-2">
                                     <RadioGroupItem value="reject" id={`${item.id}-no`} />
                                     <Label htmlFor={`${item.id}-no`} className="text-red-600 cursor-pointer">
                                       Reject
                                     </Label>
                                   </div>
                                 </RadioGroup>
                               </div>
                             ))}
                           </div>
                           <DialogFooter>
                             <Button
                               onClick={handleConfirmCommitment}
                               disabled={isConfirming}
                               className="w-full"
                               variant={Object.values(checklistValues).includes("reject") ? "destructive" : "default"}
                             >
                               {isConfirming
                                 ? "Processing..."
                                 : Object.values(checklistValues).includes("reject")
                                   ? "Reject & Save to History"
                                   : "Approve All & Go to Dispatch Material"}
                             </Button>
                           </DialogFooter>
                         </DialogContent>
                       </Dialog>
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
                      <TableCell colSpan={visibleColumns.length + 1} className="text-center py-4 text-muted-foreground">
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
