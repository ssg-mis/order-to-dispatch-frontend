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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Upload } from "lucide-react"

export default function MaterialReceiptPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [pendingOrders, setPendingOrders] = useState<any[]>([])
  const [historyOrders, setHistoryOrders] = useState<any[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [receiptData, setReceiptData] = useState({
    receivedDate: "",
    hasDamage: "no",
    damageSku: "",
    damageQty: "",
    damageImage: null as File | null,
    receivedProof: null as File | null,
    remarks: "",
  })

  useEffect(() => {
    const savedHistory = localStorage.getItem("workflowHistory")
    if (savedHistory) {
      const history = JSON.parse(savedHistory)
      
      const completed = history.filter(
        (item: any) => item.stage === "Material Receipt" && (item.status === "Delivered" || item.status === "Damaged")
      )
      setHistoryOrders(completed)

      const pending = history.filter(
        (item: any) => item.stage === "Gate Out" && item.status === "Completed"
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
        stage: "Material Receipt",
        status: receiptData.hasDamage === "yes" ? "Damaged" : "Delivered",
        receiptData: {
          ...receiptData,
          receivedAt: new Date().toISOString(),
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

      if (receiptData.hasDamage === "yes") {
        toast({
          title: "Material Received with Damage",
          description: "Order moved to Damage Adjustment stage.",
          variant: "destructive",
        })
        setTimeout(() => {
          router.push("/damage-adjustment")
        }, 1500)
      } else {
        toast({
          title: "Material Received",
          description: "Order completed successfully!",
        })
        setTimeout(() => {
          router.push("/")
        }, 1500)
      }
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <WorkflowStageShell
      title="Stage 15: Confirm Material Receipt"
      description="Confirm material receipt and report any damages."
      pendingCount={pendingOrders.length}
      historyData={historyOrders.map((order) => ({
        date: new Date(order.receiptData?.receivedAt || new Date()).toLocaleDateString(),
        stage: "Material Receipt",
        status: order.status,
        remarks: order.receiptData?.hasDamage === "yes" ? `Damaged: ${order.receiptData.damageQty}` : "Received OK",
      }))}
    >
      <Card className="border-none shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead>Action</TableHead>
              <TableHead>Order No</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Gate Out Time</TableHead>
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
                        <Button size="sm">Confirm Receipt</Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>Material Receipt: {order.orderNo}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label>Material Received Date</Label>
                            <Input
                              type="date"
                              value={receiptData.receivedDate}
                              onChange={(e) => setReceiptData({ ...receiptData, receivedDate: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Damage Status</Label>
                            <RadioGroup
                              value={receiptData.hasDamage}
                              onValueChange={(value) => setReceiptData({ ...receiptData, hasDamage: value })}
                              className="flex gap-4"
                            >
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="no" id="no-damage" />
                                <Label htmlFor="no-damage" className="text-green-600 cursor-pointer">No</Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="yes" id="yes-damage" />
                                <Label htmlFor="yes-damage" className="text-red-600 cursor-pointer">Yes</Label>
                              </div>
                            </RadioGroup>
                          </div>

                          {receiptData.hasDamage === "yes" && (
                            <>
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label>SKU</Label>
                                  <Input
                                    value={receiptData.damageSku}
                                    onChange={(e) => setReceiptData({ ...receiptData, damageSku: e.target.value })}
                                    placeholder="Enter SKU"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>Damage QTY</Label>
                                  <Input
                                    type="number"
                                    value={receiptData.damageQty}
                                    onChange={(e) => setReceiptData({ ...receiptData, damageQty: e.target.value })}
                                    placeholder="Enter qty"
                                  />
                                </div>
                              </div>
                              <div className="space-y-2">
                                <Label>Damage Image</Label>
                                <Input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => {
                                    if (e.target.files?.[0]) {
                                      setReceiptData({ ...receiptData, damageImage: e.target.files[0] })
                                    }
                                  }}
                                />
                              </div>
                            </>
                          )}

                          <div className="space-y-2">
                            <Label>Received Image (Proof)</Label>
                            <Input
                              type="file"
                              accept="image/*,.pdf"
                              onChange={(e) => {
                                if (e.target.files?.[0]) {
                                  setReceiptData({ ...receiptData, receivedProof: e.target.files[0] })
                                }
                              }}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>Remarks</Label>
                            <Textarea
                              value={receiptData.remarks}
                              onChange={(e) => setReceiptData({ ...receiptData, remarks: e.target.value })}
                              placeholder="Enter remarks"
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button
                            onClick={() => handleSubmit(order)}
                            disabled={!receiptData.receivedDate || isProcessing}
                            variant={receiptData.hasDamage === "yes" ? "destructive" : "default"}
                          >
                            {isProcessing ? "Processing..." : "Confirm Receipt"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </TableCell>
                  <TableCell className="font-medium">{order.orderNo}</TableCell>
                  <TableCell>{order.customerName}</TableCell>
                  <TableCell>{order.gateOutData?.gateOutTime ? new Date(order.gateOutData.gateOutTime).toLocaleString() : "—"}</TableCell>
                  <TableCell>
                    <Badge className="bg-sky-100 text-sky-700">In Transit</Badge>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  No orders pending for receipt confirmation
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </WorkflowStageShell>
  )
}
