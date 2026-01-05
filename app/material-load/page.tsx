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

export default function MaterialLoadPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [pendingOrders, setPendingOrders] = useState<any[]>([])
  const [historyOrders, setHistoryOrders] = useState<any[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
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
          !completed.some((completedItem: any) => completedItem.doNumber === item.doNumber)
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

  return (
    <WorkflowStageShell
      title="Stage 9: Material Load"
      description="Record material loading details and weights."
      pendingCount={pendingOrders.length}
      historyData={historyOrders.map((order) => ({
        date: new Date(order.loadData?.completedAt || new Date()).toLocaleDateString(),
        stage: "Material Load",
        status: "Completed",
        remarks: `NET: ${order.loadData?.netWeight}kg`,
      }))}
    >
      <Card className="border-none shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead>Action</TableHead>
              <TableHead>Order No</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Remarks</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pendingOrders.length > 0 ? (
              pendingOrders.map((order, index) => (
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
                  <TableCell className="font-medium">{order.orderNo}</TableCell>
                  <TableCell>{order.customerName}</TableCell>
                  <TableCell>{order.vehicleData?.remarks || "—"}</TableCell>
                  <TableCell>
                    <Badge className="bg-indigo-100 text-indigo-700">Ready to Load</Badge>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  No orders pending for material loading
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </WorkflowStageShell>
  )
}
