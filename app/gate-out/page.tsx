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
import { Upload } from "lucide-react"

export default function GateOutPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [pendingOrders, setPendingOrders] = useState<any[]>([])
  const [historyOrders, setHistoryOrders] = useState<any[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
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
        (item: any) => item.stage === "E-Invoice" && item.status === "Completed"
      ).filter(
        (item: any) => 
          !completed.some((completedItem: any) => completedItem.doNumber === item.doNumber)
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

  return (
    <WorkflowStageShell
      title="Stage 14: Gate Out"
      description="Record gate out details and upload gate pass."
      pendingCount={pendingOrders.length}
      historyData={historyOrders.map((order) => ({
        date: new Date(order.gateOutData?.gateOutTime || new Date()).toLocaleDateString(),
        stage: "Gate Out",
        status: "Completed",
        remarks: order.gateOutData?.gatePassUploaded ? "Pass Uploaded" : "-",
      }))}
    >
      <Card className="border-none shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead>Action</TableHead>
              <TableHead>DO Number</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Truck No</TableHead>
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
                  <TableCell className="font-medium">{order.orderNo}</TableCell>
                  <TableCell>{order.customerName}</TableCell>
                  <TableCell>{order.loadData?.truckNo || "—"}</TableCell>
                  <TableCell>
                    <Badge className="bg-rose-100 text-rose-700">Ready for Gate Out</Badge>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  No orders pending for gate out
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </WorkflowStageShell>
  )
}
