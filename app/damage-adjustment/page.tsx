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
import { Upload } from "lucide-react"

export default function DamageAdjustmentPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [pendingOrders, setPendingOrders] = useState<any[]>([])
  const [historyOrders, setHistoryOrders] = useState<any[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [adjustmentData, setAdjustmentData] = useState({
    status: "",
    creditNoteDate: "",
    creditNoteNo: "",
    creditNoteCopy: null as File | null,
    creditQty: "",
    creditAmount: "",
    netBalance: "",
  })

  useEffect(() => {
    const savedHistory = localStorage.getItem("workflowHistory")
    if (savedHistory) {
      const history = JSON.parse(savedHistory)
      
      const completed = history.filter(
        (item: any) => item.stage === "Damage Adjustment" && item.status === "Adjusted"
      )
      setHistoryOrders(completed)

      const pending = history.filter(
        (item: any) => item.stage === "Material Receipt" && item.status === "Damaged"
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
        stage: "Damage Adjustment",
        status: "Adjusted",
        adjustmentData: {
          ...adjustmentData,
          adjustedAt: new Date().toISOString(),
        },
      }

      const savedHistory = localStorage.getItem("workflowHistory")
      const history = savedHistory ? JSON.parse(savedHistory) : []
      history.push(updatedOrder)
      localStorage.setItem("workflowHistory", JSON.stringify(history))

      // Update local state immediately
      const newPending = pendingOrders.filter(o => o.doNumber !== order.doNumber)
      setPendingOrders(newPending)
      setHistoryOrders((prev) => [...prev, updatedOrder])

      toast({
        title: "Damage Adjusted",
        description: "Order adjustment completed and saved to history.",
      })

      setTimeout(() => {
        router.push("/")
      }, 1500)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <WorkflowStageShell
      title="Stage 16: Damage Adjustment"
      description="Process credit notes and adjustments for damaged goods."
      pendingCount={pendingOrders.length}
      historyData={historyOrders.map((order) => ({
        date: new Date(order.adjustmentData?.adjustedAt || new Date()).toLocaleDateString(),
        stage: "Damage Adjustment",
        status: "Adjusted",
        remarks: `Note: ${order.adjustmentData?.creditNoteNo || "-"}`,
      }))}
    >
      <Card className="border-none shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead>Action</TableHead>
              <TableHead>Order No</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Damage SKU</TableHead>
              <TableHead>Damage Qty</TableHead>
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
                        <Button size="sm">Adjust</Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>Damage Adjustment: {order.orderNo}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label>Status</Label>
                            <Select
                              value={adjustmentData.status}
                              onValueChange={(value) => setAdjustmentData({ ...adjustmentData, status: value })}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select status" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="credit_note">Credit Note Issued</SelectItem>
                                <SelectItem value="replacement">Replacement Sent</SelectItem>
                                <SelectItem value="waived">Amount Waived</SelectItem>
                                <SelectItem value="pending">Pending Investigation</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Credit Note Date</Label>
                              <Input
                                type="date"
                                value={adjustmentData.creditNoteDate}
                                onChange={(e) => setAdjustmentData({ ...adjustmentData, creditNoteDate: e.target.value })}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Credit Note No</Label>
                              <Input
                                value={adjustmentData.creditNoteNo}
                                onChange={(e) => setAdjustmentData({ ...adjustmentData, creditNoteNo: e.target.value })}
                                placeholder="Enter credit note no"
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label>Upload Credit Note Copy</Label>
                            <div className="border-2 border-dashed rounded-lg p-4 text-center">
                              <Input
                                type="file"
                                accept=".pdf,.jpg,.png"
                                onChange={(e) => {
                                  if (e.target.files?.[0]) {
                                    setAdjustmentData({ ...adjustmentData, creditNoteCopy: e.target.files[0] })
                                  }
                                }}
                                className="hidden"
                                id="creditnote-upload"
                              />
                              <label htmlFor="creditnote-upload" className="cursor-pointer">
                                <Upload className="h-6 w-6 mx-auto mb-1 text-muted-foreground" />
                                <p className="text-sm text-muted-foreground">
                                  {adjustmentData.creditNoteCopy ? adjustmentData.creditNoteCopy.name : "Upload credit note"}
                                </p>
                              </label>
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-2">
                              <Label>Credit Qty</Label>
                              <Input
                                type="number"
                                value={adjustmentData.creditQty}
                                onChange={(e) => setAdjustmentData({ ...adjustmentData, creditQty: e.target.value })}
                                placeholder="Qty"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Credit Amount</Label>
                              <Input
                                type="number"
                                value={adjustmentData.creditAmount}
                                onChange={(e) => setAdjustmentData({ ...adjustmentData, creditAmount: e.target.value })}
                                placeholder="Amount"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Net Balance</Label>
                              <Input
                                type="number"
                                value={adjustmentData.netBalance}
                                onChange={(e) => setAdjustmentData({ ...adjustmentData, netBalance: e.target.value })}
                                placeholder="Balance"
                              />
                            </div>
                          </div>
                        </div>
                        <DialogFooter>
                          <Button
                            onClick={() => handleSubmit(order)}
                            disabled={!adjustmentData.status || isProcessing}
                          >
                            {isProcessing ? "Processing..." : "Submit Adjustment"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </TableCell>
                  <TableCell className="font-medium">{order.orderNo}</TableCell>
                  <TableCell>{order.customerName}</TableCell>
                  <TableCell>{order.receiptData?.damageSku || "—"}</TableCell>
                  <TableCell>{order.receiptData?.damageQty || "—"}</TableCell>
                  <TableCell>
                    <Badge className="bg-red-100 text-red-700">Damaged</Badge>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No orders pending for damage adjustment
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </WorkflowStageShell>
  )
}
