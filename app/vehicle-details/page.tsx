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
import { Settings2 } from "lucide-react"
import { ALL_WORKFLOW_COLUMNS as ALL_COLUMNS } from "@/lib/workflow-columns"

export default function VehicleDetailsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [pendingOrders, setPendingOrders] = useState<any[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState<string[]>([
    "orderNo",
    "customerName",
    "status",
  ])
  const [vehicleData, setVehicleData] = useState({
    checkStatus: "",
    remarks: "",
  })

  const [history, setHistory] = useState<any[]>([])

  useEffect(() => {
    const savedHistory = localStorage.getItem("workflowHistory")
    if (savedHistory) {
      const historyData = JSON.parse(savedHistory)
      
      const completed = historyData.filter(
        (item: any) => item.stage === "Vehicle Details" && item.status === "Completed"
      )

      const pending = historyData.filter(
        (item: any) => item.stage === "Actual Dispatch" && item.status === "Completed"
      ).filter(
        (item: any) => 
          !completed.some((completedItem: any) => 
             (completedItem.doNumber && item.doNumber && completedItem.doNumber === item.doNumber) || 
             (completedItem.orderNo && item.orderNo && completedItem.orderNo === item.orderNo)
          )
      )
      setPendingOrders(pending)

      const stageHistory = historyData
        .filter((item: any) => item.stage === "Vehicle Details")
        .map((item: any) => ({
           ...item,
           date: item.date || (item.timestamp ? new Date(item.timestamp).toLocaleDateString("en-GB") : "-"),
           remarks: item.remarks || item.vehicleData?.remarks || "-"
        }))
      setHistory(stageHistory)
    }
  }, [])

  const handleAssignVehicle = async (order: any) => {
    setIsProcessing(true)
    try {
      const updatedOrder = {
        ...order,
        stage: "Vehicle Details",
        status: "Completed",
        vehicleData: {
          ...vehicleData,
          assignedAt: new Date().toISOString(),
        },
      }

      const historyEntry = {
        orderNo: order.orderNo,
        customerName: order.customerName,
        stage: "Vehicle Details",
        status: "Completed",
        processedBy: "Current User",
        timestamp: new Date().toISOString(),
        date: new Date().toLocaleDateString("en-GB"),
        remarks: vehicleData.remarks || "-",
        vehicleData: { ...vehicleData, assignedAt: new Date().toISOString() }
      }

      const savedHistory = localStorage.getItem("workflowHistory")
      const historyList = savedHistory ? JSON.parse(savedHistory) : []
      historyList.push(historyEntry)
      localStorage.setItem("workflowHistory", JSON.stringify(historyList))
      localStorage.setItem("currentOrderData", JSON.stringify(updatedOrder))
      
      // Update local state
      setHistory([...historyList.filter((h: any) => h.stage === "Vehicle Details"), historyEntry].map((item: any) => ({
          ...item,
          date: item.date || (item.timestamp ? new Date(item.timestamp).toLocaleDateString("en-GB") : "-"),
          remarks: item.remarks || item.vehicleData?.remarks || "-"
      })))

      toast({
        title: "Vehicle Assigned",
        description: "Order moved to Material Load stage.",
      })

      setTimeout(() => {
        router.push("/material-load")
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
      const orderDateStr = order.actualDispatchData?.confirmedAt || order.timestamp
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
      title="Stage 6: Vehicle Details"
      description="Assign vehicle and driver for delivery."
      pendingCount={filteredPendingOrders.length}
      historyData={history}
      partyNames={customerNames}
      onFilterChange={setFilterValues}
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
                      status: "Awaiting Vehicle", // Special handling for badge
                    }

                   return (
                   <TableRow key={index}>
                     <TableCell>
                       <Dialog>
                         <DialogTrigger asChild>
                           <Button size="sm">Assign Vehicle</Button>
                         </DialogTrigger>
                         <DialogContent className="max-w-lg">
                           <DialogHeader>
                             <DialogTitle>Vehicle Details: {order.orderNo || "DO-005A"}</DialogTitle>
                           </DialogHeader>
                           <div className="space-y-4 py-4">
                             <div className="">
                               <h4 className="text-sm font-medium mb-4 text-muted-foreground">Vehicle Documents</h4>
                               <div className="grid grid-cols-2 gap-4">
                                 <div className="space-y-2">
                                   <Label>Fitness Certificate</Label>
                                   <Input type="file" />
                                 </div>
                                 <div className="space-y-2">
                                   <Label>Insurance</Label>
                                   <Input type="file" />
                                 </div>
                                 <div className="space-y-2">
                                   <Label>Tax Copy</Label>
                                   <Input type="file" />
                                 </div>
                                 <div className="space-y-2">
                                   <Label>Pollution Check</Label>
                                   <Input type="file" />
                                 </div>
                                 <div className="space-y-2">
                                   <Label>Permit 1</Label>
                                   <Input type="file" />
                                 </div>
                                 <div className="space-y-2">
                                   <Label>Permit 2 (Out State)</Label>
                                   <Input type="file" />
                                 </div>
                               </div>
                             </div>

                             <div className="border-t pt-4 mt-4 space-y-4">
                               <div className="grid grid-cols-2 gap-4">
                                 <div className="space-y-2">
                                   <Label>Check Status</Label>
                                   <Select
                                     value={vehicleData.checkStatus}
                                     onValueChange={(value) =>
                                       setVehicleData({ ...vehicleData, checkStatus: value })
                                     }
                                   >
                                     <SelectTrigger>
                                       <SelectValue placeholder="Select status" />
                                     </SelectTrigger>
                                     <SelectContent>
                                       <SelectItem value="Accept">Accept</SelectItem>
                                       <SelectItem value="Reject">Reject</SelectItem>
                                     </SelectContent>
                                   </Select>
                                 </div>
                                 <div className="space-y-2">
                                   <Label>Remarks</Label>
                                   <Input
                                     value={vehicleData.remarks}
                                     onChange={(e) =>
                                       setVehicleData({ ...vehicleData, remarks: e.target.value })
                                     }
                                     placeholder="Enter remarks"
                                   />
                                 </div>
                               </div>
                             </div>
                           </div>
                           <DialogFooter>
                             <Button
                               onClick={() => handleAssignVehicle(order)}
                               disabled={!vehicleData.checkStatus || isProcessing}
                             >
                               {isProcessing ? "Processing..." : "Assign Vehicle"}
                             </Button>
                           </DialogFooter>
                         </DialogContent>
                       </Dialog>
                     </TableCell>
                     {ALL_COLUMNS.filter((col) => visibleColumns.includes(col.id)).map((col) => (
                       <TableCell key={col.id} className="whitespace-nowrap text-center">
                         {col.id === "status" ? (
                            <div className="flex justify-center">
                               <Badge className="bg-purple-100 text-purple-700">Awaiting Vehicle</Badge>
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
                    No orders pending for vehicle assignment
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
