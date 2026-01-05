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

export default function MakeInvoicePage() {
  const router = useRouter()
  const { toast } = useToast()
  const [pendingOrders, setPendingOrders] = useState<any[]>([])
  const [historyOrders, setHistoryOrders] = useState<any[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [invoiceData, setInvoiceData] = useState({
    invoiceNo: "",
    invoiceFile: null as File | null,
  })

  useEffect(() => {
    const savedHistory = localStorage.getItem("workflowHistory")
    if (savedHistory) {
      const history = JSON.parse(savedHistory)
      
      const completed = history.filter(
        (item: any) => item.stage === "Make Invoice" && item.status === "Completed"
      )
      setHistoryOrders(completed)

      const pending = history.filter(
        (item: any) => item.stage === "Security Approval" && item.status === "Completed"
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
        stage: "Make Invoice",
        status: "Completed",
        invoiceData: {
          invoiceNo: invoiceData.invoiceNo,
          invoiceUploaded: !!invoiceData.invoiceFile,
          createdAt: new Date().toISOString(),
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
        title: "Invoice Created",
        description: "Order moved to Check Invoice stage.",
      })

      setTimeout(() => {
        router.push("/check-invoice")
      }, 1500)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <WorkflowStageShell
      title="Stage 11: Make Invoice (Proforma)"
      description="Create proforma invoice for the order."
      pendingCount={pendingOrders.length}
      historyData={historyOrders.map((order) => ({
        date: new Date(order.invoiceData?.createdAt || new Date()).toLocaleDateString(),
        stage: "Make Invoice",
        status: "Completed",
        remarks: order.invoiceData?.invoiceNo || "Generated",
      }))}
    >
      <Card className="border-none shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead>Action</TableHead>
              <TableHead>Order No</TableHead>
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
                        <Button size="sm">Create Invoice</Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-lg">
                        <DialogHeader>
                          <DialogTitle>Make Invoice: {order.orderNo}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label>Invoice Number</Label>
                            <Input
                              value={invoiceData.invoiceNo}
                              onChange={(e) => setInvoiceData({ ...invoiceData, invoiceNo: e.target.value })}
                              placeholder="Enter invoice number"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Upload Invoice</Label>
                            <div className="border-2 border-dashed rounded-lg p-6 text-center">
                              <Input
                                type="file"
                                accept=".pdf,.jpg,.png"
                                onChange={(e) => {
                                  if (e.target.files?.[0]) {
                                    setInvoiceData({ ...invoiceData, invoiceFile: e.target.files[0] })
                                  }
                                }}
                                className="hidden"
                                id="invoice-upload"
                              />
                              <label htmlFor="invoice-upload" className="cursor-pointer">
                                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                                <p className="text-sm text-muted-foreground">
                                  {invoiceData.invoiceFile ? invoiceData.invoiceFile.name : "Click to upload invoice"}
                                </p>
                              </label>
                            </div>
                          </div>
                        </div>
                        <DialogFooter>
                          <Button
                            onClick={() => handleSubmit(order)}
                            disabled={!invoiceData.invoiceNo || isProcessing}
                          >
                            {isProcessing ? "Processing..." : "Submit Invoice"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </TableCell>
                  <TableCell className="font-medium">{order.orderNo}</TableCell>
                  <TableCell>{order.customerName}</TableCell>
                  <TableCell>{order.productCount} Products</TableCell>
                  <TableCell>
                    <Badge className="bg-cyan-100 text-cyan-700">Pending Invoice</Badge>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  No orders pending for invoice creation
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </WorkflowStageShell>
  )
}
