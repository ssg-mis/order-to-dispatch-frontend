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
import { Upload, X, Plus } from "lucide-react"

export default function EInvoicePage() {
  const router = useRouter()
  const { toast } = useToast()
  const [pendingOrders, setPendingOrders] = useState<any[]>([])
  const [historyOrders, setHistoryOrders] = useState<any[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  /* eslint-disable @typescript-eslint/no-unused-vars */
  const [eInvoiceData, setEInvoiceData] = useState({
    invoiceDate: "",
    invoiceNo: "",
    invoiceFiles: [] as File[],
    qty: "",
    billAmount: "",
  })
  /* eslint-enable @typescript-eslint/no-unused-vars */

  useEffect(() => {
    const savedHistory = localStorage.getItem("workflowHistory")
    if (savedHistory) {
      const history = JSON.parse(savedHistory)
      
      const completed = history.filter(
        (item: any) => item.stage === "E-Invoice" && item.status === "Completed"
      )
      setHistoryOrders(completed)

      const pending = history.filter(
        (item: any) => item.stage === "Check Invoice" && item.status === "Completed"
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
        stage: "E-Invoice",
        status: "Completed",
        eInvoiceData: {
          invoiceDate: eInvoiceData.invoiceDate,
          invoiceNo: eInvoiceData.invoiceNo,
          invoiceFilesCount: eInvoiceData.invoiceFiles.length,
          qty: eInvoiceData.qty,
          billAmount: eInvoiceData.billAmount,
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
        title: "E-Invoice Created",
        description: "Order moved to Gate Out stage.",
      })

      setTimeout(() => {
        router.push("/gate-out")
      }, 1500)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <WorkflowStageShell
      title="Stage 13: E-Invoice & E-Way Bill"
      description="Generate e-invoice and e-way bill for the order."
      pendingCount={pendingOrders.length}
      historyData={historyOrders.map((order) => ({
        date: new Date(order.eInvoiceData?.createdAt || new Date()).toLocaleDateString(),
        stage: "E-Invoice",
        status: "Completed",
        remarks: `Amount: ${order.eInvoiceData?.billAmount}`,
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
                        <Button size="sm">Generate</Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-lg">
                        <DialogHeader>
                          <DialogTitle>E-Invoice & E-Way Bill: {order.orderNo}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Invoice Date</Label>
                              <Input
                                type="date"
                                value={eInvoiceData.invoiceDate}
                                onChange={(e) => setEInvoiceData({ ...eInvoiceData, invoiceDate: e.target.value })}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Invoice No</Label>
                              <Input
                                value={order.invoiceData?.invoiceNo || order.invoiceNo || ""}
                                disabled
                                className="bg-muted"
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                             <Label>Invoice Copy (Multiple)</Label>
                              <div className="flex flex-wrap gap-4">
                                {eInvoiceData.invoiceFiles.map((file, index) => (
                                  <div key={index} className="relative w-24 h-24 border rounded overflow-hidden group">
                                    <div className="w-full h-full bg-muted flex items-center justify-center text-xs text-center p-1 break-all">
                                      {file.name}
                                    </div>
                                    <button
                                      onClick={() => {
                                        const newFiles = [...eInvoiceData.invoiceFiles]
                                        newFiles.splice(index, 1)
                                        setEInvoiceData({ ...eInvoiceData, invoiceFiles: newFiles })
                                      }}
                                      className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </div>
                                ))}
                                <label className="w-24 h-24 border-2 border-dashed rounded flex flex-col items-center justify-center cursor-pointer hover:bg-muted/50 transition-colors">
                                  <Plus className="h-6 w-6 text-muted-foreground" />
                                  <span className="text-xs text-muted-foreground mt-1">Add File</span>
                                  <input
                                    type="file"
                                    accept=".pdf,.jpg,.png"
                                    multiple
                                    className="hidden"
                                    onChange={(e) => {
                                      if (e.target.files) {
                                        const newFiles = Array.from(e.target.files)
                                        setEInvoiceData({
                                          ...eInvoiceData,
                                          invoiceFiles: [...eInvoiceData.invoiceFiles, ...newFiles],
                                        })
                                      }
                                    }}
                                  />
                                </label>
                              </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Quantity</Label>
                              <Input
                                type="number"
                                value={eInvoiceData.qty}
                                onChange={(e) => setEInvoiceData({ ...eInvoiceData, qty: e.target.value })}
                                placeholder="Enter quantity"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Bill Amount</Label>
                              <Input
                                type="number"
                                value={eInvoiceData.billAmount}
                                onChange={(e) => setEInvoiceData({ ...eInvoiceData, billAmount: e.target.value })}
                                placeholder="Enter bill amount"
                              />
                            </div>
                          </div>
                        </div>
                        <DialogFooter>
                          <Button
                            onClick={() => handleSubmit(order)}
                            disabled={!eInvoiceData.invoiceDate || !eInvoiceData.qty || !eInvoiceData.billAmount || isProcessing}
                          >
                            {isProcessing ? "Processing..." : "Submit & Continue"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </TableCell>
                  <TableCell className="font-medium">{order.orderNo}</TableCell>
                  <TableCell>{order.customerName}</TableCell>
                  <TableCell>{order.invoiceData?.invoiceNo || "—"}</TableCell>
                  <TableCell>
                    <Badge className="bg-violet-100 text-violet-700">Pending E-Invoice</Badge>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  No orders pending for e-invoice generation
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </WorkflowStageShell>
  )
}
