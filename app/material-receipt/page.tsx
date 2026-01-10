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
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Upload, Settings2 } from "lucide-react"
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ALL_WORKFLOW_COLUMNS as ALL_COLUMNS } from "@/lib/workflow-columns"

export default function MaterialReceiptPage() {
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
  const [receiptData, setReceiptData] = useState({
    receivedDate: "",
    hasDamage: "no",
    damageSku: "",
    damageQty: "",
    damageImage: null as File | null,
    receivedProof: null as File | null,
    remarks: "",
  })

  useEffect(() => {
    const savedHistory = localStorage.getItem("workflowHistory")
    if (savedHistory) {
      const history = JSON.parse(savedHistory)
      
      const completed = history.filter(
        (item: any) => item.stage === "Material Receipt" && (item.status === "Delivered" || item.status === "Damaged")
      )
      setHistoryOrders(completed)

      const pending = history.filter(
        (item: any) => item.stage === "Gate Out" && item.status === "Completed"
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
        stage: "Material Receipt",
        status: receiptData.hasDamage === "yes" ? "Damaged" : "Delivered",
        receiptData: {
          ...receiptData,
          receivedAt: new Date().toISOString(),
        },
      }

      const savedHistory = localStorage.getItem("workflowHistory")
      const history = savedHistory ? JSON.parse(savedHistory) : []
      history.push(updatedOrder)
      localStorage.setItem("workflowHistory", JSON.stringify(history))
      localStorage.setItem("currentOrderData", JSON.stringify(updatedOrder))

      // Update local state immediately
      const newPending = pendingOrders.filter(o => o.doNumber !== order.doNumber)
      setPendingOrders(newPending)
      setHistoryOrders((prev) => [...prev, updatedOrder])

      if (receiptData.hasDamage === "yes") {
        toast({
          title: "Material Received with Damage",
          description: "Order moved to Damage Adjustment stage.",
          variant: "destructive",
        })
        setTimeout(() => {
          router.push("/damage-adjustment")
        }, 1500)
      } else {
        toast({
          title: "Material Received",
          description: "Order completed successfully!",
        })
        setTimeout(() => {
          router.push("/")
        }, 1500)
      }
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
      const orderDateStr = order.receiptData?.receivedAt || order.gateOutData?.gateOutTime || order.timestamp
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
      title="Stage 12: Confirm Material Receipt"
      description="Confirm material receipt and report any damages."
      pendingCount={filteredPendingOrders.length}
      historyData={historyOrders.map((order) => ({
        date: new Date(order.receiptData?.receivedAt || new Date()).toLocaleDateString("en-GB"),
        stage: "Material Receipt",
        status: order.status,
        remarks: order.receiptData?.hasDamage === "yes" ? `Damaged: ${order.receiptData.damageQty}` : "Received OK",
      }))}
      partyNames={customerNames}
      onFilterChange={setFilterValues}
      remarksColName="Condition"
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
                  <TableHead key={col.id} className="whitespace-nowrap text-center">
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

                        const prodNames = internalOrder.products?.map((p: any) => p.productName).join(", ") || 
                                          internalOrder.preApprovalProducts?.map((p: any) => p.oilType).join(", ") || 
                                          "";
                        const uoms = internalOrder.products?.map((p: any) => p.uom).join(", ") || "";
                        const qtys = internalOrder.products?.map((p: any) => p.orderQty).join(", ") || "";
                        const altUoms = internalOrder.products?.map((p: any) => p.altUom).join(", ") || "";
                        const altQtys = internalOrder.products?.map((p: any) => p.altQty).join(", ") || "";
                        
                        const ratesLtr = internalOrder.preApprovalProducts?.map((p: any) => p.ratePerLtr).join(", ") || internalOrder.ratePerLtr || "—";
                        const rates15Kg = internalOrder.preApprovalProducts?.map((p: any) => p.rateLtr).join(", ") || internalOrder.rateLtr || "—";
                        const oilTypes = internalOrder.preApprovalProducts?.map((p: any) => p.oilType).join(", ") || internalOrder.oilType || "—";

                        const row = {
                          orderNo: internalOrder.doNumber || internalOrder.orderNo || "DO-XXX",
                          deliveryPurpose: internalOrder.orderPurpose || "—",
                          customerType: internalOrder.customerType || "—",
                          orderType: internalOrder.orderType || "—",
                          soNo: internalOrder.soNumber || "—",
                          partySoDate: internalOrder.soDate || "—",
                          customerName: internalOrder.customerName || "—",
                          itemConfirm: internalOrder.itemConfirm || "—",
                          productName: prodNames,
                          uom: uoms,
                          orderQty: qtys,
                          altUom: altUoms,
                          altQty: altQtys,
                          oilType: oilTypes,
                          ratePerLtr: ratesLtr,
                          ratePer15Kg: rates15Kg,
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
                          status: "In Transit", // Special handling for badge
                        }

                   return (
                   <TableRow key={index}>
                     <TableCell className="text-center">
                       <Dialog>
                         <DialogTrigger asChild>
                           <Button size="sm">Confirm Receipt</Button>
                         </DialogTrigger>
                         <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                           <DialogHeader>
                             <DialogTitle>Material Receipt: {order.orderNo}</DialogTitle>
                           </DialogHeader>
                           <div className="space-y-4 py-4">
                             <div className="space-y-2">
                               <Label>Material Received Date</Label>
                               <Input
                                 type="date"
                                 value={receiptData.receivedDate}
                                 onChange={(e) => setReceiptData({ ...receiptData, receivedDate: e.target.value })}
                               />
                             </div>
                             <div className="space-y-2">
                               <Label>Damage Status</Label>
                               <RadioGroup
                                 value={receiptData.hasDamage}
                                 onValueChange={(value) => setReceiptData({ ...receiptData, hasDamage: value })}
                                 className="flex gap-4"
                               >
                                 <div className="flex items-center space-x-2">
                                   <RadioGroupItem value="no" id="no-damage" />
                                   <Label htmlFor="no-damage" className="text-green-600 cursor-pointer">No</Label>
                                 </div>
                                 <div className="flex items-center space-x-2">
                                   <RadioGroupItem value="yes" id="yes-damage" />
                                   <Label htmlFor="yes-damage" className="text-red-600 cursor-pointer">Yes</Label>
                                 </div>
                               </RadioGroup>
                             </div>

                             {receiptData.hasDamage === "yes" && (
                               <>
                                 <div className="grid grid-cols-2 gap-4">
                                   <div className="space-y-2">
                                     <Label>SKU</Label>
                                     <Input
                                       value={receiptData.damageSku}
                                       onChange={(e) => setReceiptData({ ...receiptData, damageSku: e.target.value })}
                                       placeholder="Enter SKU"
                                     />
                                   </div>
                                   <div className="space-y-2">
                                     <Label>Damage QTY</Label>
                                     <Input
                                       type="number"
                                       value={receiptData.damageQty}
                                       onChange={(e) => setReceiptData({ ...receiptData, damageQty: e.target.value })}
                                       placeholder="Enter qty"
                                     />
                                   </div>
                                 </div>
                                 <div className="space-y-2">
                                   <Label>Damage Image</Label>
                                   <Input
                                     type="file"
                                     accept="image/*"
                                     onChange={(e) => {
                                       if (e.target.files?.[0]) {
                                         setReceiptData({ ...receiptData, damageImage: e.target.files[0] })
                                       }
                                     }}
                                   />
                                 </div>
                               </>
                             )}

                             <div className="space-y-2">
                               <Label>Received Image (Proof)</Label>
                               <Input
                                 type="file"
                                 accept="image/*,.pdf"
                                 onChange={(e) => {
                                   if (e.target.files?.[0]) {
                                     setReceiptData({ ...receiptData, receivedProof: e.target.files[0] })
                                   }
                                 }}
                               />
                             </div>

                             <div className="space-y-2">
                               <Label>Remarks</Label>
                               <Textarea
                                 value={receiptData.remarks}
                                 onChange={(e) => setReceiptData({ ...receiptData, remarks: e.target.value })}
                                 placeholder="Enter remarks"
                               />
                             </div>
                           </div>
                           <DialogFooter>
                             <Button
                               onClick={() => handleSubmit(order)}
                               disabled={!receiptData.receivedDate || isProcessing}
                               variant={receiptData.hasDamage === "yes" ? "destructive" : "default"}
                             >
                               {isProcessing ? "Processing..." : "Confirm Receipt"}
                             </Button>
                           </DialogFooter>
                         </DialogContent>
                       </Dialog>
                     </TableCell>
                     {ALL_COLUMNS.filter((col) => visibleColumns.includes(col.id)).map((col) => (
                        <TableCell key={col.id} className="whitespace-nowrap text-center">
                          {col.id === "status" ? (
                             <div className="flex justify-center">
                                <Badge className="bg-sky-100 text-sky-700">In Transit</Badge>
                             </div>
                          ) : row[col.id as keyof typeof row]}
                        </TableCell>
                      ))}
                   </TableRow>
                   )
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={visibleColumns.length + 1} className="text-center py-8 text-muted-foreground">
                    No orders pending for receipt confirmation
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
