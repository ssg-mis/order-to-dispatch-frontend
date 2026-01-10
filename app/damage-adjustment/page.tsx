"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { WorkflowStageShell } from "@/components/workflow/workflow-stage-shell"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Upload, Settings2 } from "lucide-react"
import { ALL_WORKFLOW_COLUMNS as ALL_COLUMNS } from "@/lib/workflow-columns"

export default function DamageAdjustmentPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [pendingOrders, setPendingOrders] = useState<any[]>([])
  const [historyOrders, setHistoryOrders] = useState<any[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState<string[]>([
    "orderNo",
    "customerName",
    "status",
  ])
  const [adjustmentData, setAdjustmentData] = useState({
    status: "",
    creditNoteDate: "",
    creditNoteNo: "",
    creditNoteCopy: null as File | null,
    creditQty: "",
    creditAmount: "",
    netBalance: "",
  })

  useEffect(() => {
    const savedHistory = localStorage.getItem("workflowHistory")
    if (savedHistory) {
      const history = JSON.parse(savedHistory)
      
      const completed = history.filter(
        (item: any) => item.stage === "Damage Adjustment" && item.status === "Adjusted"
      )
      setHistoryOrders(completed)

      const pending = history.filter(
        (item: any) => item.stage === "Material Receipt" && item.status === "Damaged"
      ).filter(
        (item: any) => 
          !completed.some((completedItem: any) => 
            (completedItem.doNumber && item.doNumber && completedItem.doNumber === item.doNumber) ||
            (completedItem.orderNo && item.orderNo && completedItem.orderNo === item.orderNo)
          )
      )
      setPendingOrders(pending)
    }
  }, [])

  const handleSubmit = async (order: any) => {
    setIsProcessing(true)
    try {
      const updatedOrder = {
        ...order,
        stage: "Damage Adjustment",
        status: "Adjusted",
        adjustmentData: {
          ...adjustmentData,
          adjustedAt: new Date().toISOString(),
        },
      }

      const savedHistory = localStorage.getItem("workflowHistory")
      const history = savedHistory ? JSON.parse(savedHistory) : []
      history.push(updatedOrder)
      localStorage.setItem("workflowHistory", JSON.stringify(history))

      // Update local state immediately
      const newPending = pendingOrders.filter(o => o.doNumber !== order.doNumber)
      setPendingOrders(newPending)
      setHistoryOrders((prev) => [...prev, updatedOrder])

      toast({
        title: "Damage Adjusted",
        description: "Order adjustment completed and saved to history.",
      })

      setTimeout(() => {
        router.push("/")
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
      const orderDateStr = order.adjustmentData?.adjustedAt || order.receiptData?.receivedAt || order.timestamp
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
      title="Stage 13: Damage Adjustment"
      description="Process credit notes and adjustments for damaged goods."
      pendingCount={filteredPendingOrders.length}
      historyData={historyOrders.map((order) => ({
        date: new Date(order.adjustmentData?.adjustedAt || new Date()).toLocaleDateString("en-GB"),
        stage: "Damage Adjustment",
        status: "Adjusted",
        remarks: `Note: ${order.adjustmentData?.creditNoteNo || "-"}`,
      }))}
      partyNames={customerNames}
      onFilterChange={setFilterValues}
      remarksColName="Credit Note"
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
              {ALL_COLUMNS.map((col) => (
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
                {ALL_COLUMNS.filter((col) => visibleColumns.includes(col.id)).map((col) => (
                  <TableHead key={col.id} className="whitespace-nowrap">
                    {col.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPendingOrders.length > 0 ? (
                    filteredPendingOrders.map((order, index) => {
                        const internalOrder = order.data?.orderData || order;
                        const preApproval = order.data?.preApprovalData || internalOrder.preApprovalData || {};

                        const row = {
                          orderNo: internalOrder.doNumber || internalOrder.orderNo || "DO-XXX",
                          deliveryPurpose: internalOrder.orderPurpose || "—",
                          customerType: internalOrder.customerType || "—",
                          orderType: internalOrder.orderType || "—",
                          soNo: internalOrder.soNumber || "—",
                          partySoDate: internalOrder.soDate || "—",
                          customerName: internalOrder.customerName || "—",
                          itemConfirm: internalOrder.itemConfirm || "—",
                          productName: internalOrder.products?.map((p: any) => p.productName).join(", ") || "",
                          uom: internalOrder.products?.map((p: any) => p.uom).join(", ") || "",
                          orderQty: internalOrder.products?.map((p: any) => p.orderQty).join(", ") || "",
                          altUom: internalOrder.products?.map((p: any) => p.altUom).join(", ") || "",
                          altQty: internalOrder.products?.map((p: any) => p.altQty).join(", ") || "",
                          oilType: internalOrder.oilType || "—",
                          ratePerLtr: internalOrder.ratePerLtr || "—",
                          rateOfMaterial: internalOrder.rateMaterial || "—",
                          totalWithGst: internalOrder.totalWithGst || "—",
                          transportType: internalOrder.dispatchData?.transportType || "—",
                          uploadSo: "so_document.pdf",
                          contactPerson: internalOrder.contactPerson || "—",
                          whatsapp: internalOrder.whatsappNo || "—",
                          address: internalOrder.customerAddress || "—",
                          paymentTerms: internalOrder.paymentTerms || "—",
                          advanceTaken: internalOrder.advancePaymentTaken || "—",
                          advanceAmount: internalOrder.advanceAmount || "—",
                          isBroker: internalOrder.isBrokerOrder || "—",
                          brokerName: internalOrder.brokerName || "—",
                          deliveryDate: internalOrder.deliveryDate || "—",
                          qtyToDispatch: internalOrder.dispatchData?.qtyToDispatch || "—",
                          deliveryFrom: internalOrder.deliveryData?.deliveryFrom || "—",
                          status: "Damaged", // Special handling for badge
                        }

                   return (
                   <TableRow key={index}>
                     <TableCell>
                       <Dialog>
                         <DialogTrigger asChild>
                           <Button size="sm">Adjust</Button>
                         </DialogTrigger>
                         <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                           <DialogHeader>
                             <DialogTitle>Damage Adjustment: {order.orderNo}</DialogTitle>
                           </DialogHeader>
                           <div className="space-y-4 py-4">
                             <div className="space-y-2">
                               <Label>Status</Label>
                               <Select
                                 value={adjustmentData.status}
                                 onValueChange={(value) => setAdjustmentData({ ...adjustmentData, status: value })}
                               >
                                 <SelectTrigger>
                                   <SelectValue placeholder="Select status" />
                                 </SelectTrigger>
                                 <SelectContent>
                                   <SelectItem value="credit_note">Credit Note Issued</SelectItem>
                                   <SelectItem value="replacement">Replacement Sent</SelectItem>
                                   <SelectItem value="waived">Amount Waived</SelectItem>
                                   <SelectItem value="pending">Pending Investigation</SelectItem>
                                 </SelectContent>
                               </Select>
                             </div>
                             <div className="grid grid-cols-2 gap-4">
                               <div className="space-y-2">
                                 <Label>Credit Note Date</Label>
                                 <Input
                                   type="date"
                                   value={adjustmentData.creditNoteDate}
                                   onChange={(e) => setAdjustmentData({ ...adjustmentData, creditNoteDate: e.target.value })}
                                 />
                               </div>
                               <div className="space-y-2">
                                 <Label>Credit Note No</Label>
                                 <Input
                                   value={adjustmentData.creditNoteNo}
                                   onChange={(e) => setAdjustmentData({ ...adjustmentData, creditNoteNo: e.target.value })}
                                   placeholder="Enter credit note no"
                                 />
                               </div>
                             </div>
                             <div className="space-y-2">
                               <Label>Upload Credit Note Copy</Label>
                               <div className="border-2 border-dashed rounded-lg p-4 text-center">
                                 <Input
                                   type="file"
                                   accept=".pdf,.jpg,.png"
                                   onChange={(e) => {
                                     if (e.target.files?.[0]) {
                                       setAdjustmentData({ ...adjustmentData, creditNoteCopy: e.target.files[0] })
                                     }
                                   }}
                                   className="hidden"
                                   id="creditnote-upload"
                                 />
                                 <label htmlFor="creditnote-upload" className="cursor-pointer">
                                   <Upload className="h-6 w-6 mx-auto mb-1 text-muted-foreground" />
                                   <p className="text-sm text-muted-foreground">
                                     {adjustmentData.creditNoteCopy ? adjustmentData.creditNoteCopy.name : "Upload credit note"}
                                   </p>
                                 </label>
                               </div>
                             </div>
                             <div className="grid grid-cols-3 gap-4">
                               <div className="space-y-2">
                                 <Label>Credit Qty</Label>
                                 <Input
                                   type="number"
                                   value={adjustmentData.creditQty}
                                   onChange={(e) => setAdjustmentData({ ...adjustmentData, creditQty: e.target.value })}
                                   placeholder="Qty"
                                 />
                               </div>
                               <div className="space-y-2">
                                 <Label>Credit Amount</Label>
                                 <Input
                                   type="number"
                                   value={adjustmentData.creditAmount}
                                   onChange={(e) => setAdjustmentData({ ...adjustmentData, creditAmount: e.target.value })}
                                   placeholder="Amount"
                                 />
                               </div>
                               <div className="space-y-2">
                                 <Label>Net Balance</Label>
                                 <Input
                                   type="number"
                                   value={adjustmentData.netBalance}
                                   onChange={(e) => setAdjustmentData({ ...adjustmentData, netBalance: e.target.value })}
                                   placeholder="Balance"
                                 />
                               </div>
                             </div>
                           </div>
                           <DialogFooter>
                             <Button
                               onClick={() => handleSubmit(order)}
                               disabled={!adjustmentData.status || isProcessing}
                             >
                               {isProcessing ? "Processing..." : "Submit Adjustment"}
                             </Button>
                           </DialogFooter>
                         </DialogContent>
                       </Dialog>
                     </TableCell>
                     {ALL_COLUMNS.filter((col) => visibleColumns.includes(col.id)).map((col) => (
                       <TableCell key={col.id} className="whitespace-nowrap">
                         {col.id === "status" ? (
                            <Badge className="bg-red-100 text-red-700">Damaged</Badge>
                         ) : row[col.id as keyof typeof row]}
                       </TableCell>
                     ))}
                   </TableRow>
                   )
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={visibleColumns.length + 1} className="text-center py-8 text-muted-foreground">
                    No orders pending for damage adjustment
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
