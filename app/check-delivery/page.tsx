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

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export default function CheckDeliveryPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [pendingOrders, setPendingOrders] = useState<any[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [deliveryData, setDeliveryData] = useState({
    deliveryFrom: "",
  })
  const [historyOrders, setHistoryOrders] = useState<any[]>([])

  useEffect(() => {
    const savedHistory = localStorage.getItem("workflowHistory")
    if (savedHistory) {
      const history = JSON.parse(savedHistory)
      
      const completed = history.filter(
        (item: any) => item.stage === "Check Delivery" && item.status === "Completed"
      )
      setHistoryOrders(completed)

      const pending = history.filter(
        (item: any) => item.stage === "Overall Checking" && item.status === "Completed"
      ).filter(
        (item: any) => 
          !completed.some((completedItem: any) => completedItem.doNumber === item.doNumber)
      )
      setPendingOrders(pending)
    }
  }, [])

  const handleConfirm = async (order: any) => {
    setIsProcessing(true)
    try {
      const updatedOrder = {
        ...order,
        stage: "Check Delivery",
        status: "Completed",
        deliveryData: {
          ...deliveryData,
          confirmedAt: new Date().toISOString(),
        },
      }

      const savedHistory = localStorage.getItem("workflowHistory")
      const history = savedHistory ? JSON.parse(savedHistory) : []
      history.push(updatedOrder)
      localStorage.setItem("workflowHistory", JSON.stringify(history))
      localStorage.setItem("currentOrderData", JSON.stringify(updatedOrder))

      toast({
        title: "Delivery Confirmed",
        description: "Order moved to Dispatch Material stage.",
      })

      const newPending = pendingOrders.filter(o => o.doNumber !== order.doNumber)
      setPendingOrders(newPending)
      setHistoryOrders((prev) => [...prev, updatedOrder])

      setTimeout(() => {
        router.push("/dispatch-material")
      }, 1500)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <WorkflowStageShell
      title="Stage 6: Check Delivery"
      description="Confirm delivery details and schedule."
      pendingCount={pendingOrders.length}
      historyData={historyOrders.map((order) => ({
        date: new Date(order.deliveryData?.confirmedAt || new Date()).toLocaleDateString(),
        stage: "Check Delivery",
        status: "Completed",
        remarks: order.deliveryData?.deliveryFrom === "in-stock" ? "In Stock" :
          order.deliveryData?.deliveryFrom === "production" ? "From Production" : "-",
      }))}
    >
      <Card className="border-none shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead>Action</TableHead>
              <TableHead>DO Number</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Products</TableHead>
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
                        <Button size="sm">Schedule</Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-lg">
                        <DialogHeader>
                          <DialogTitle>Schedule Delivery: {order.doNumber}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label>Delivery From</Label>
                            <Select
                              value={deliveryData.deliveryFrom}
                              onValueChange={(value) =>
                                setDeliveryData({ ...deliveryData, deliveryFrom: value })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select Source" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="in-stock">In Stock</SelectItem>
                                <SelectItem value="production">From Production</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <DialogFooter>
                          <Button
                            onClick={() => handleConfirm(order)}
                            disabled={!deliveryData.deliveryFrom || isProcessing}
                          >
                            {isProcessing ? "Processing..." : "Confirm Delivery"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </TableCell>
                  <TableCell className="font-medium">{order.doNumber}</TableCell>
                  <TableCell>{order.customerName}</TableCell>
                  <TableCell>{order.productCount} Products</TableCell>
                  <TableCell>
                    <Badge className="bg-blue-100 text-blue-700">Ready</Badge>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  No orders pending for delivery scheduling
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </WorkflowStageShell>
  )
}
