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
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Settings2 } from "lucide-react"
import { ALL_WORKFLOW_COLUMNS as ALL_COLUMNS } from "@/lib/workflow-columns"

export default function MaterialLoadPage() {
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
  const [loadData, setLoadData] = useState({
    actualQty: "",
    weightmentSlip: "",
    rstNo: "",
    grossWeight: "",
    tareWeight: "",
    netWeight: "",
    totalWeight: "",
    differentWeight: "",
    transporterName: "",
    reason: "",
    truckNo: "",
    vehicleNoPlateImage: "",
  })

  useEffect(() => {
    const savedHistory = localStorage.getItem("workflowHistory")
    if (savedHistory) {
      const history = JSON.parse(savedHistory)
      
      const completed = history.filter(
        (item: any) => item.stage === "Material Load" && item.status === "Completed"
      )
      setHistoryOrders(completed)

      const pending = history.filter(
        (item: any) => item.stage === "Vehicle Details" && item.status === "Completed"
      ).filter(
        (item: any) => 
          !completed.some((completedItem: any) => (completedItem.doNumber || completedItem.orderNo) === (item.doNumber || item.orderNo))
      )
      setPendingOrders(pending)
    }
  }, [])

  useEffect(() => {
    const gross = parseFloat(loadData.grossWeight) || 0
    const tare = parseFloat(loadData.tareWeight) || 0
    const net = gross - tare
    
    setLoadData(prev => ({
      ...prev,
      netWeight: net > 0 ? net.toFixed(2) : ""
    }))
  }, [loadData.grossWeight, loadData.tareWeight])

  const handleSubmit = async (order: any) => {
    setIsProcessing(true)
    try {
      const updatedOrder = {
        ...order,
        stage: "Material Load",
        status: "Completed",
        loadData: {
          ...loadData,
          completedAt: new Date().toISOString(),
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
        title: "Material Loaded",
        description: "Order moved to Security Approval stage.",
      })

      setTimeout(() => {
        router.push("/security-approval")
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
      const orderDateStr = order.loadData?.completedAt || order.vehicleData?.assignedAt || order.timestamp
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
      title="Stage 7: Material Load"
      description="Record material loading details and weights."
      pendingCount={filteredPendingOrders.length}
      historyData={historyOrders.map((order) => ({
        date: new Date(order.loadData?.completedAt || new Date()).toLocaleDateString("en-GB"),
        stage: "Material Load",
        status: "Completed",
        remarks: `NET: ${order.loadData?.netWeight}kg`,
      }))}
      partyNames={customerNames}
      onFilterChange={setFilterValues}
      remarksColName="Weight Details"
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
                   const prodNames = order.products?.map((p: any) => p.productName).join(", ") || "";
                   const uoms = order.products?.map((p: any) => p.uom).join(", ") || "";
                   const qtys = order.products?.map((p: any) => p.orderQty).join(", ") || "";
                   const altUoms = order.products?.map((p: any) => p.altUom).join(", ") || "";
                   const altQtys = order.products?.map((p: any) => p.altQty).join(", ") || "";
                   
                   const ratesLtr = order.preApprovalProducts?.map((p: any) => p.ratePerLtr).join(", ") || order.ratePerLtr || "—";
                   const rates15Kg = order.preApprovalProducts?.map((p: any) => p.rateLtr).join(", ") || order.rateLtr || "—";
                   const oilTypes = order.preApprovalProducts?.map((p: any) => p.oilType).join(", ") || order.oilType || "—";

                   const row = {
                     orderNo: order.doNumber || order.orderNo || "DO-XXX",
                     deliveryPurpose: order.orderPurpose || "—",
                     customerType: order.customerType || "—",
                     orderType: order.orderType || "—",
                     soNo: order.soNumber || "—",
                     partySoDate: order.soDate || "—",
                     customerName: order.customerName || "—",
                     itemConfirm: order.itemConfirm || "—",
                     productName: prodNames,
                     uom: uoms,
                     orderQty: qtys,
                     altUom: altUoms,
                     altQty: altQtys,
                     oilType: oilTypes,
                     ratePerLtr: ratesLtr,
                     ratePer15Kg: rates15Kg,
                     rateOfMaterial: order.rateMaterial || "—",
                     totalWithGst: order.totalWithGst || "—",
                     transportType: order.dispatchData?.transportType || "—",
                     uploadSo: "so_document.pdf",
                     contactPerson: order.contactPerson || "—",
                     whatsapp: order.whatsappNo || "—",
                     address: order.customerAddress || "—",
                     paymentTerms: order.paymentTerms || "—",
                     advanceTaken: order.advancePaymentTaken || "—",
                     advanceAmount: order.advanceAmount || "—",
                     isBroker: order.isBrokerOrder || "—",
                     brokerName: order.brokerName || "—",
                     deliveryDate: order.deliveryDate || "—",
                     qtyToDispatch: order.dispatchData?.qtyToDispatch || "—",
                     deliveryFrom: order.deliveryData?.deliveryFrom || "—",
                     status: "Ready to Load", // Special handling for badge
                   }

                   return (
                   <TableRow key={index}>
                     <TableCell>
                       <Dialog>
                         <DialogTrigger asChild>
                           <Button size="sm">Load Material</Button>
                         </DialogTrigger>
                         <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                           <DialogHeader>
                             <DialogTitle>Material Load: {order.orderNo}</DialogTitle>
                           </DialogHeader>
                           <div className="space-y-4 py-4">
                             <div className="grid grid-cols-2 gap-4">
                               <div className="space-y-2">
                                 <Label>Actual QTY</Label>
                                 <Input
                                   type="number"
                                   value={loadData.actualQty}
                                   onChange={(e) => setLoadData({ ...loadData, actualQty: e.target.value })}
                                   placeholder="Enter actual qty"
                                 />
                               </div>
                               <div className="space-y-2">
                                 <Label>Weightment Slip Copy</Label>
                                 <Input type="file" />
                               </div>
                             </div>
                             
                             <div className="grid grid-cols-2 gap-4">
                               <div className="space-y-2">
                                 <Label>RST No</Label>
                                 <Input
                                   value={loadData.rstNo}
                                   onChange={(e) => setLoadData({ ...loadData, rstNo: e.target.value })}
                                   placeholder="Enter RST no"
                                 />
                               </div>
                               <div className="space-y-2">
                                 <Label>Truck No.</Label>
                                 <Input
                                   value={loadData.truckNo}
                                   onChange={(e) => setLoadData({ ...loadData, truckNo: e.target.value })}
                                   placeholder="Enter truck no"
                                 />
                               </div>
                             </div>

                             <div className="grid grid-cols-2 gap-4">
                               <div className="space-y-2">
                                 <Label>Gross Weight</Label>
                                 <Input
                                   type="number"
                                   value={loadData.grossWeight}
                                   onChange={(e) => setLoadData({ ...loadData, grossWeight: e.target.value })}
                                   placeholder="Enter gross weight"
                                 />
                               </div>
                               <div className="space-y-2">
                                 <Label>Tare Weight</Label>
                                 <Input
                                   type="number"
                                   value={loadData.tareWeight}
                                   onChange={(e) => setLoadData({ ...loadData, tareWeight: e.target.value })}
                                   placeholder="Enter tare weight"
                                 />
                               </div>
                             </div>

                             <div className="grid grid-cols-2 gap-4">
                               <div className="space-y-2">
                                 <Label>Net Weight</Label>
                                 <Input 
                                   value={loadData.netWeight} 
                                   onChange={(e) => setLoadData({ ...loadData, netWeight: e.target.value })}
                                   placeholder="Net weight"
                                 />
                               </div>
                               <div className="space-y-2">
                                 <Label>Total Weight</Label>
                                 <Input
                                   type="number"
                                   value={loadData.totalWeight}
                                   onChange={(e) => setLoadData({ ...loadData, totalWeight: e.target.value })}
                                   placeholder="Enter total weight"
                                 />
                               </div>
                             </div>

                             <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                 <Label>Different Weight</Label>
                                 <Input
                                   type="number"
                                   value={loadData.differentWeight}
                                   onChange={(e) => setLoadData({ ...loadData, differentWeight: e.target.value })}
                                   placeholder="Enter difference"
                                   className={parseFloat(loadData.differentWeight) > 20 ? "text-red-600 font-bold border-red-300 focus-visible:ring-red-300" : ""}
                                 />
                                 {parseFloat(loadData.differentWeight) > 20 && (
                                   <p className="text-xs text-red-600">Difference exceeds 20kg limit</p>
                                 )}
                               </div>
                               <div className="space-y-2">
                                 <Label>Transporter Name</Label>
                                 <Input
                                   value={loadData.transporterName}
                                   onChange={(e) => setLoadData({ ...loadData, transporterName: e.target.value })}
                                   placeholder="Enter transporter name"
                                 />
                               </div>
                             </div>

                             <div className="grid grid-cols-2 gap-4">
                               <div className="space-y-2">
                                 <Label>Reason of Difference in Weight</Label>
                                 <Input
                                   value={loadData.reason}
                                   onChange={(e) => setLoadData({ ...loadData, reason: e.target.value })}
                                   placeholder="Enter reason"
                                 />
                               </div>
                               <div className="space-y-2">
                                 <Label>Vehicle No. Plate Image</Label>
                                 <Input type="file" />
                               </div>
                             </div>
                           </div>
                           <DialogFooter>
                             <Button onClick={() => handleSubmit(order)} disabled={isProcessing}>
                               {isProcessing ? "Processing..." : "Submit & Continue"}
                             </Button>
                           </DialogFooter>
                         </DialogContent>
                       </Dialog>
                     </TableCell>
                     {ALL_COLUMNS.filter((col) => visibleColumns.includes(col.id)).map((col) => (
                       <TableCell key={col.id} className="whitespace-nowrap text-center">
                         {col.id === "status" ? (
                            <div className="flex justify-center">
                               <Badge className="bg-indigo-100 text-indigo-700">Ready to Load</Badge>
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
                    No orders pending for material loading
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
