"use client"

import { Suspense, useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { WorkflowStageShell } from "@/components/workflow/workflow-stage-shell"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useRouter } from "next/navigation"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

function CommitmentEntryContent() {
  const router = useRouter()
  const { toast } = useToast()
  const [isConfirming, setIsConfirming] = useState(false)
  const [commitmentData, setCommitmentData] = useState<any>(null)
  const [pendingOrders, setPendingOrders] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState("pending")
  const [manualDoNumber, setManualDoNumber] = useState("")
  const [totalWeight, setTotalWeight] = useState("")
  const [packingSlip, setPackingSlip] = useState<File | null>(null)

  // Load history data for the history tab
  const [historyData, setHistoryData] = useState<any[]>([])

  useEffect(() => {
    // Load local history first
    const savedHistory = localStorage.getItem("workflowHistory")
    if (savedHistory) {
      const historyData = JSON.parse(savedHistory)
      const stageHistory = historyData.filter((item: any) => item.stage === "Commitment Entry")
      setHistoryData(stageHistory)

      // Calculate Pending Orders
      // 1. Find all orders that passed Pre-Approval AND Commitment Review
      const commitmentReviewApproved = historyData.filter(
        (item: any) => item.stage === "Commitment Review" && item.status === "Approved"
      )

      // 2. Filter out orders that already passed Commitment Entry
      const pending = commitmentReviewApproved.filter((reviewItem: any) => {
        // Check if this order exists in the stage history with a completed/approved status or even just processed
         return !stageHistory.some((doneItem: any) => doneItem.orderNo === reviewItem.orderNo)
      })

      // 3. Extract the actual order data for display
      const mappedPending = pending.map((item: any) => {
         // item.data.orderData contains the original order details
         return item.data.orderData
      })

      setPendingOrders(mappedPending)
    }
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setPackingSlip(e.target.files[0])
    }
  }

  const handleConfirmEntry = async (orderData: any) => {
    if (!manualDoNumber || !totalWeight) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      })
      return
    }

    setIsConfirming(true)
    try {
      const finalData = {
        orderData,
        manualDoNumber,
        totalWeight,
        packingSlipName: packingSlip ? packingSlip.name : null,
        enteredAt: new Date().toISOString(),
        status: "Approved",
        commitmentStatus: "Entered",
      }

      const existingHistory = localStorage.getItem("workflowHistory")
      const history = existingHistory ? JSON.parse(existingHistory) : []

      const historyEntry = {
        doNumber: manualDoNumber || "DO-002A",
        orderNo: orderData.soNumber || orderData.doNumber || "ORD-XXX", // Maintain consistent order tracking
        customerName: orderData?.customerName || "Unknown",
        stage: "Commitment Entry",
        status: "Approved",
        processedBy: "Current User",
        timestamp: new Date().toISOString(),
        data: finalData,
        productCount: orderData?.products?.length || 0,
      }

      history.push(historyEntry)
      localStorage.setItem("workflowHistory", JSON.stringify(history))
      
      // Update local state immediately
      setHistoryData((prev) => [...prev, historyEntry])
      setPendingOrders(prev => prev.filter(o => (o.doNumber || o.soNumber) !== (orderData.doNumber || orderData.soNumber)))

      // Update the final order data with commitment entry
      // localStorage.setItem("finalOrderData", JSON.stringify(finalData)) // No longer relying on single object

      toast({
        title: "Commitment Entered",
        description: "Commitment has been successfully entered.",
      })

      setTimeout(() => {
        // localStorage.removeItem("finalOrderData") // Clean up
        // localStorage.removeItem("commitmentEntryData")
        router.push("/overall-checking") // Redirect to Stage 5: Overall Checking
      }, 1500)
    } finally {
      setIsConfirming(false)
    }
  }

  const historyContent = (
    <Card className="border-none shadow-sm overflow-hidden">
      <Table>
        <TableHeader className="bg-muted/30">
          <TableRow>

            <TableHead>DO Number</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Product</TableHead>
            <TableHead>Credit Score</TableHead>
            <TableHead>Day Pending</TableHead>
            <TableHead>Packing Slip</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {historyData
            .filter((item) => item.stage === "Commitment Entry")
            .map((item, index) => (
              <TableRow key={index}>
                <TableCell className="font-medium">{item.doNumber}</TableCell>
                <TableCell>{item.customerName}</TableCell>
                <TableCell>{item.stage}</TableCell>
                <TableCell>
                  {item.status === "Approved" ? (
                    <Badge className="bg-green-100 text-green-700">Approved</Badge>
                  ) : (
                    <Badge variant="destructive">Rejected</Badge>
                  )}
                </TableCell>
                <TableCell>{item.processedBy}</TableCell>
                <TableCell>{new Date(item.timestamp).toLocaleString()}</TableCell>
                <TableCell>{item.productCount}</TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table>
    </Card>
  )

  return (
    <WorkflowStageShell
      title="Stage 4: Commitment Entry"
      description="Final verification and entry of commitment data."
      pendingCount={pendingOrders.length}
      historyData={historyData}
      historyContent={historyContent}
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

            {pendingOrders.map((item, i) => (
              <TableRow key={i}>
                <TableCell>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button size="sm">Enter Commitment</Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-xl">
                      <DialogHeader>
                        <DialogTitle>Commitment Entry Checklist: {item.soNumber || item.doNumber}</DialogTitle>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="manualDoNumber">MANUAL ALLOT DO NUMBER</Label>
                            <Input
                              id="manualDoNumber"
                              type="text"
                              value={manualDoNumber}
                              onChange={(e) => setManualDoNumber(e.target.value)}
                              placeholder="Enter DO Number (e.g. DO-002A)"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="totalWeight">TOTAL WEIGHT OF ORDER PUNCH IN SOFTWARE FOR DISPATCH TIME WEIGHT CHECKING</Label>
                            <Input
                              id="totalWeight"
                              type="number"
                              value={totalWeight}
                              onChange={(e) => setTotalWeight(e.target.value)}
                              placeholder="Enter Total Weight"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="packingSlip">Packing Slip</Label>
                            <Input
                              id="packingSlip"
                              type="file"
                              accept="image/*"
                              onChange={handleFileChange}
                              className="cursor-pointer"
                            />
                          </div>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button
                          onClick={() => handleConfirmEntry(item)}
                          disabled={isConfirming}
                          className="w-full"
                          variant="default"
                        >
                          {isConfirming
                            ? "Processing..."
                            : "Submit"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </TableCell>
                <TableCell className="font-medium">{item.soNumber || item.doNumber}</TableCell>
                <TableCell>{item.customerName}</TableCell>
                <TableCell>
                  <span className="text-sm">
                    {item.products?.length || 0} {item.products?.length === 1 ? "Product" : "Products"}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge className="bg-green-100 text-green-700">Excellent</Badge>
                </TableCell>
                <TableCell>1 Day</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </WorkflowStageShell>
  )
}

export default function CommitmentEntryPage() {
  return (
    <Suspense fallback={<CommitmentEntryLoading />}>
      <CommitmentEntryContent />
    </Suspense>
  )
}

function CommitmentEntryLoading() {
  return (
    <div className="p-6">
      <div className="animate-pulse space-y-4">
        <div className="h-10 bg-muted rounded"></div>
        <div className="h-64 bg-muted rounded"></div>
      </div>
    </div>
  )
}