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
import { Upload, Settings2 } from "lucide-react"
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ALL_WORKFLOW_COLUMNS as ALL_COLUMNS } from "@/lib/workflow-columns"

export default function GateOutPage() {
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
  const [gateOutData, setGateOutData] = useState({
    gatePassFile: null as File | null,
    vehicleLoadedImage: null as File | null,
    gateOutTime: "",
  })

  useEffect(() => {
    const savedHistory = localStorage.getItem("workflowHistory")
    if (savedHistory) {
      const history = JSON.parse(savedHistory)
      
      const completed = history.filter(
        (item: any) => item.stage === "Gate Out" && item.status === "Completed"
      )
      setHistoryOrders(completed)

      const pending = history.filter(
        (item: any) => item.stage === "Check Invoice" && item.status === "Completed"
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
        stage: "Gate Out",
        status: "Completed",
        gateOutData: {
          gateOutTime: gateOutData.gateOutTime || new Date().toISOString(),
          gatePassUploaded: !!gateOutData.gatePassFile,
          vehicleImageUploaded: !!gateOutData.vehicleLoadedImage,
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

      toast({
        title: "Gate Out Completed",
        description: "Order moved to Material Receipt stage.",
      })

      setTimeout(() => {
        router.push("/material-receipt")
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
      const orderDateStr = order.gateOutData?.gateOutTime || order.checkInvoiceData?.checkedAt || order.timestamp
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
      title="Stage 11: Gate Out"
      description="Record gate out details and upload gate pass."
      pendingCount={filteredPendingOrders.length}
      historyData={historyOrders.map((order) => ({
        date: new Date(order.gateOutData?.gateOutTime || new Date()).toLocaleDateString("en-GB"),
        stage: "Gate Out",
        status: "Completed",
        remarks: order.gateOutData?.gatePassUploaded ? "Pass Uploaded" : "-",
      }))}
      partyNames={customerNames}
      onFilterChange={setFilterValues}
      remarksColName="Evidence"
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
                   // Safe extraction of nested order data if it exists
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
                     status: "Ready for Gate Out", // Special handling for badge
                   }

                   return (
                   <TableRow key={index}>
                     <TableCell>
                       <Dialog>
                         <DialogTrigger asChild>
                           <Button size="sm">Gate Out</Button>
                         </DialogTrigger>
                         <DialogContent className="max-w-lg">
                           <DialogHeader>
                             <DialogTitle>Gate Out: {order.orderNo}</DialogTitle>
                           </DialogHeader>
                           <div className="space-y-4 py-4">
                             <div className="space-y-2">
                               <Label>Gate Out Time</Label>
                               <Input
                                 type="datetime-local"
                                 value={gateOutData.gateOutTime}
                                 onChange={(e) => setGateOutData({ ...gateOutData, gateOutTime: e.target.value })}
                               />
                             </div>
                             <div className="space-y-2">
                               <Label>Upload Gate Pass</Label>
                               <div className="border-2 border-dashed rounded-lg p-6 text-center">
                                 <Input
                                   type="file"
                                   accept="image/*,.pdf"
                                   onChange={(e) => {
                                     if (e.target.files?.[0]) {
                                       setGateOutData({ ...gateOutData, gatePassFile: e.target.files[0] })
                                     }
                                   }}
                                   className="hidden"
                                   id="gatepass-upload"
                                 />
                                 <label htmlFor="gatepass-upload" className="cursor-pointer">
                                   <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                                   <p className="text-sm text-muted-foreground">
                                     {gateOutData.gatePassFile ? gateOutData.gatePassFile.name : "Click to upload gate pass"}
                                   </p>
                                 </label>
                               </div>
                             </div>
                             <div className="space-y-2">
                               <Label>Upload Vehicle Loaded Image</Label>
                               <div className="border-2 border-dashed rounded-lg p-6 text-center">
                                 <Input
                                   type="file"
                                   accept="image/*"
                                   onChange={(e) => {
                                     if (e.target.files?.[0]) {
                                       setGateOutData({ ...gateOutData, vehicleLoadedImage: e.target.files[0] })
                                     }
                                   }}
                                   className="hidden"
                                   id="vehicle-loaded-upload"
                                 />
                                 <label htmlFor="vehicle-loaded-upload" className="cursor-pointer">
                                   <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                                   <p className="text-sm text-muted-foreground">
                                     {gateOutData.vehicleLoadedImage ? gateOutData.vehicleLoadedImage.name : "Click to upload vehicle image"}
                                   </p>
                                 </label>
                               </div>
                             </div>
                           </div>
                           <DialogFooter>
                             <Button onClick={() => handleSubmit(order)} disabled={isProcessing}>
                               {isProcessing ? "Processing..." : "Complete Gate Out"}
                             </Button>
                           </DialogFooter>
                         </DialogContent>
                       </Dialog>
                     </TableCell>
                     {ALL_COLUMNS.filter((col) => visibleColumns.includes(col.id)).map((col) => (
                        <TableCell key={col.id} className="whitespace-nowrap text-center">
                          {col.id === "status" ? (
                             <div className="flex justify-center">
                                <Badge className="bg-rose-100 text-rose-700">Ready for Gate Out</Badge>
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
                    No orders pending for gate out
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
