"use client"

import { Card } from "@/components/ui/card"
import { WorkflowStageShell } from "@/components/workflow/workflow-stage-shell"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useRouter } from "next/navigation"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useToast } from "@/hooks/use-toast"
import { useState, useEffect } from "react"

export default function CommitmentReviewPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [isConfirming, setIsConfirming] = useState(false)
  const [commitmentData, setCommitmentData] = useState<any>(null)
  const [orderData, setOrderData] = useState<any>(null)
  const [checklistValues, setChecklistValues] = useState<Record<string, string>>({
    rate: "approve",
    sku: "approve",
    credit: "approve",
    dispatch: "approve",
    overall: "approve",
    confirm: "approve",
  })

  const [history, setHistory] = useState<any[]>([])

  useEffect(() => {
    const savedHistory = localStorage.getItem("workflowHistory")
    let historyData = []
    if (savedHistory) {
      historyData = JSON.parse(savedHistory)
      const stageHistory = historyData.filter((item: any) => item.stage === "Commitment Review")
      setHistory(stageHistory)
    }

    const savedCommitmentData = localStorage.getItem("commitmentReviewData")
    if (savedCommitmentData) {
      const data = JSON.parse(savedCommitmentData)
      
      const isProcessed = historyData.some(
        (item: any) => item.stage === "Commitment Review" && (item.orderNo === (data.orderData?.soNumber || "ORD-XXX"))
      )

      if (!isProcessed) {
        setCommitmentData(data)
        if (data.orderData) {
          setOrderData(data.orderData)
        }
      } else {
        setCommitmentData(null)
        setOrderData(null)
      }
    } else {
      const savedOrderData = localStorage.getItem("orderData")
      if (savedOrderData) {
        const parsedOrderData = JSON.parse(savedOrderData)
        
        const isProcessed = historyData.some(
            (item: any) => item.stage === "Commitment Review" && (item.orderNo === (parsedOrderData.soNumber || "ORD-XXX"))
        )

        if (!isProcessed) {
           setOrderData(parsedOrderData)
        } else {
           setOrderData(null)
        }
      }
    }
  }, [])

  const checkItems = [
    { id: "rate", label: "Rate Right?" },
    { id: "sku", label: "We Deal in SKU?" },
    { id: "credit", label: "Credit OK?" },
    { id: "dispatch", label: "Dispatch Confirmed?" },
    { id: "overall", label: "Overall Status?" },
    { id: "confirm", label: "Customer Confirmation?" },
  ]

  const handleChecklistChange = (itemId: string, value: string) => {
    setChecklistValues((prev) => ({
      ...prev,
      [itemId]: value,
    }))
  }

  const handleConfirmCommitment = async () => {
    setIsConfirming(true)
    try {
      const hasRejection = Object.values(checklistValues).includes("reject")

      // Identify Order Number consistently using doNumber if available, else soNumber, else fallback
      const orderIdentifier = orderData?.doNumber || orderData?.soNumber || "ORD-XXX";

      if (hasRejection) {
        const historyEntry = {
          orderNo: orderIdentifier,
          customerName: orderData?.customerName || "Unknown",
          stage: "Commitment Review",
          status: "Rejected",
          processedBy: "Current User",
          timestamp: new Date().toISOString(),
          data: {
            orderData,
            commitmentReviewData: commitmentData,
            checklistResults: checklistValues,
            rejectedAt: new Date().toISOString(),
          },
          productCount: orderData?.products?.length || 0,
        }

        const existingHistory = localStorage.getItem("workflowHistory")
        const history = existingHistory ? JSON.parse(existingHistory) : []
        history.push(historyEntry)
        localStorage.setItem("workflowHistory", JSON.stringify(history))

        toast({
          title: "Order Rejected",
          description: "Order has been rejected and saved to history.",
          variant: "destructive",
        })

         // Update local state immediately
        setHistory((prev) => [...prev, historyEntry])
        setOrderData(null)
        setCommitmentData(null)

        setTimeout(() => {
          localStorage.removeItem("orderData")
          localStorage.removeItem("preApprovalData")
          localStorage.removeItem("commitmentReviewData")
          // router.push("/history")
        }, 1500)
      } else {
        const finalData = {
          orderData,
          commitmentReviewData: commitmentData,
          checklistResults: checklistValues,
          confirmedAt: new Date().toISOString(),
          status: "Approved",
        }

        const existingHistory = localStorage.getItem("workflowHistory")
        const currentHistory = existingHistory ? JSON.parse(existingHistory) : []
        const currentOrderIndex = currentHistory.length

        const historyEntry = {
          orderNo: orderIdentifier,
          customerName: orderData?.customerName || "Unknown",
          stage: "Commitment Review",
          status: "Approved",
          processedBy: "Current User",
          timestamp: new Date().toISOString(),
          data: finalData,
          productCount: orderData?.products?.length || 0,
        }

        currentHistory.push(historyEntry)
        localStorage.setItem("workflowHistory", JSON.stringify(currentHistory))
        localStorage.setItem("currentOrderIndex", String(currentOrderIndex))
        localStorage.setItem("finalOrderData", JSON.stringify(finalData))
        
        // Update local state immediately
        setHistory((prev) => [...prev, historyEntry])
        setOrderData(null)
        setCommitmentData(null)

        toast({
          title: "Commitment Verified",
          description: "Order has been approved and moved to commitment pending.",
        })

        setTimeout(() => {
          localStorage.removeItem("preApprovalData")
          localStorage.removeItem("commitmentReviewData")
          router.push("/commitment-entry")
        }, 1500)
      }
    } finally {
      setIsConfirming(false)
    }
  }

  return (
    <WorkflowStageShell
      title="Stage 3: Before Commitment"
      description="Six-point verification check before commitment entry."
      pendingCount={orderData ? 1 : 0}
      historyData={history}
    >
      <Card className="border-none shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead>Action</TableHead>
              <TableHead>DO Number</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Products</TableHead>
              <TableHead>Credit Score</TableHead>
              <TableHead>Days Pending</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orderData ? (
              <TableRow>
                <TableCell>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button size="sm">Verify Order</Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-xl">
                      <DialogHeader>
                        <DialogTitle>Verification Checklist: {orderData?.soNumber}</DialogTitle>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        {checkItems.map((item) => (
                          <div key={item.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/20">
                            <Label className="text-base">{item.label}</Label>
                            <RadioGroup
                              value={checklistValues[item.id]}
                              onValueChange={(value) => handleChecklistChange(item.id, value)}
                              className="flex gap-4"
                            >
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="approve" id={`${item.id}-ok`} />
                                <Label htmlFor={`${item.id}-ok`} className="text-green-600 cursor-pointer">
                                  Approve
                                </Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="reject" id={`${item.id}-no`} />
                                <Label htmlFor={`${item.id}-no`} className="text-red-600 cursor-pointer">
                                  Reject
                                </Label>
                              </div>
                            </RadioGroup>
                          </div>
                        ))}
                      </div>
                      <DialogFooter>
                        <Button
                          onClick={handleConfirmCommitment}
                          disabled={isConfirming}
                          className="w-full"
                          variant={Object.values(checklistValues).includes("reject") ? "destructive" : "default"}
                        >
                          {isConfirming
                            ? "Processing..."
                            : Object.values(checklistValues).includes("reject")
                              ? "Reject & Save to History"
                              : "Approve All & Go to Commitment Entry"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </TableCell>
                <TableCell className="font-medium">{orderData?.soNumber || "DO-002A"}</TableCell>
                <TableCell>{orderData?.customerName || "Acme Corp"}</TableCell>
                <TableCell>
                  <span className="text-sm">
                    {orderData?.products?.length || 0} {orderData?.products?.length === 1 ? "Product" : "Products"}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge className="bg-green-100 text-green-700">Excellent</Badge>
                </TableCell>
                <TableCell>2 Days</TableCell>
              </TableRow>
            ) : (
                <TableRow>
                    <TableCell colSpan={6} className="text-center py-4 text-muted-foreground">
                        No orders pending for commitment review
                    </TableCell>
                </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </WorkflowStageShell>
  )
}
