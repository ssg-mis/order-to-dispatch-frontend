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
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

export default function CheckInvoicePage() {
  const router = useRouter()
  const { toast } = useToast()
  const [pendingOrders, setPendingOrders] = useState<any[]>([])
  const [historyOrders, setHistoryOrders] = useState<any[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [checkData, setCheckData] = useState({
    status: "approve",
    remarks: "",
  })

  useEffect(() => {
    const savedHistory = localStorage.getItem("workflowHistory")
    if (savedHistory) {
      const history = JSON.parse(savedHistory)
      
      const completed = history.filter(
        (item: any) => item.stage === "Check Invoice" && item.status === "Completed"
      )
      setHistoryOrders(completed)

      const pending = history.filter(
        (item: any) => item.stage === "Make Invoice" && item.status === "Completed"
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
        stage: "Check Invoice",
        status: checkData.status === "approve" ? "Completed" : "Rejected",
        checkInvoiceData: {
          ...checkData,
          checkedAt: new Date().toISOString(),
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
      
      if (checkData.status === "approve") {
        setHistoryOrders((prev) => [...prev, updatedOrder])
        toast({
          title: "Invoice Approved",
          description: "Order moved to E-Invoice stage.",
        })
        setTimeout(() => {
          router.push("/e-invoice")
        }, 1500)
      } else {
        toast({
          title: "Invoice Rejected",
          description: "Order sent back for correction.",
          variant: "destructive",
        })
      }
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <WorkflowStageShell
      title="Stage 12: Check Invoice"
      description="Review and verify invoice details."
      pendingCount={pendingOrders.length}
      historyData={historyOrders.map((order) => ({
        date: new Date(order.checkInvoiceData?.checkedAt || new Date()).toLocaleDateString(),
        stage: "Check Invoice",
        status: order.checkInvoiceData?.status === "approve" ? "Approved" : "Rejected",
        remarks: order.checkInvoiceData?.remarks || "-",
      }))}
    >
      <Card className="border-none shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead>Action</TableHead>
              <TableHead>Order No</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Invoice No</TableHead>
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
                        <Button size="sm">Check</Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-lg">
                        <DialogHeader>
                          <DialogTitle>Check Invoice: {order.orderNo}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label>Invoice Status</Label>
                            <RadioGroup
                              value={checkData.status}
                              onValueChange={(value) => setCheckData({ ...checkData, status: value })}
                              className="flex gap-4"
                            >
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="approve" id="approve" />
                                <Label htmlFor="approve" className="text-green-600 cursor-pointer">
                                  Approve
                                </Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="reject" id="reject" />
                                <Label htmlFor="reject" className="text-red-600 cursor-pointer">
                                  Reject
                                </Label>
                              </div>
                            </RadioGroup>
                          </div>
                          <div className="space-y-2">
                            <Label>Remarks</Label>
                            <Textarea
                              value={checkData.remarks}
                              onChange={(e) => setCheckData({ ...checkData, remarks: e.target.value })}
                              placeholder="Enter any remarks..."
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button
                            onClick={() => handleSubmit(order)}
                            disabled={isProcessing}
                            variant={checkData.status === "reject" ? "destructive" : "default"}
                          >
                            {isProcessing ? "Processing..." : checkData.status === "approve" ? "Approve Invoice" : "Reject Invoice"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </TableCell>
                  <TableCell className="font-medium">{order.orderNo}</TableCell>
                  <TableCell>{order.customerName}</TableCell>
                  <TableCell>{order.invoiceData?.invoiceNo || "—"}</TableCell>
                  <TableCell>
                    <Badge className="bg-teal-100 text-teal-700">Pending Review</Badge>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  No invoices pending for review
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </WorkflowStageShell>
  )
}
