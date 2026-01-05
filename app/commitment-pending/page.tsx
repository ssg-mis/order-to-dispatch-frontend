"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { WorkflowStageShell } from "@/components/workflow/workflow-stage-shell"
import { CheckCircle2, Clock, Eye } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export default function CommitmentPendingPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [pendingOrder, setPendingOrder] = useState<any>(null)
  const [isCompleting, setIsCompleting] = useState(false)
  const [currentOrderIndex, setCurrentOrderIndex] = useState<number | null>(null)

  useEffect(() => {
    const savedIndex = localStorage.getItem("currentOrderIndex")
    const savedFinalData = localStorage.getItem("finalOrderData")

    if (savedFinalData) {
      setPendingOrder(JSON.parse(savedFinalData))
    }

    if (savedIndex) {
      setCurrentOrderIndex(Number.parseInt(savedIndex))
    }
  }, [])

  const handleCompleteOrder = async () => {
    setIsCompleting(true)
    try {
      toast({
        title: "Order Completed",
        description: "Order has been successfully completed and moved to dashboard.",
      })

      setTimeout(() => {
        localStorage.removeItem("orderData")
        localStorage.removeItem("preApprovalData")
        localStorage.removeItem("commitmentReviewData")
        localStorage.removeItem("finalOrderData")
        localStorage.removeItem("currentOrderIndex")
        router.push("/")
      }, 1500)
    } finally {
      setIsCompleting(false)
    }
  }

  const handleViewCommitmentEntry = () => {
    if (currentOrderIndex !== null) {
      router.push(`/commitment-entry?index=${currentOrderIndex}`)
    }
  }

  return (
    <WorkflowStageShell
      title="Stage 4: Commitment Pending"
      description="Order is pending for final commitment entry completion."
      pendingCount={1}
      historyData={[]}
    >
      <div className="grid gap-6 max-w-4xl">
        <Card className="border-2 border-yellow-200 bg-yellow-50/30">
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-yellow-600" />
              <div>
                <CardTitle>Order Status: Pending Commitment</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  All approvals completed. Ready for final commitment entry.
                </p>
              </div>
            </div>
            <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-200">
              Pending
            </Badge>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="bg-muted/10 border-b">
            <CardTitle>Order Details Summary</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
              <div>
                <p className="text-sm font-semibold text-muted-foreground">Customer Name</p>
                <p className="text-lg font-bold">{pendingOrder?.orderData?.customerName || "N/A"}</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-muted-foreground">SO Number</p>
                <p className="text-lg font-bold">{pendingOrder?.orderData?.soNumber || "N/A"}</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-muted-foreground">Total Products</p>
                <p className="text-lg font-bold">{pendingOrder?.orderData?.products?.length || 0}</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-muted-foreground">Order Type</p>
                <p className="text-lg font-bold capitalize">{pendingOrder?.orderData?.orderType || "N/A"}</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-muted-foreground">Customer Type</p>
                <p className="text-lg font-bold capitalize">{pendingOrder?.orderData?.customerType || "N/A"}</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-muted-foreground">Verification Status</p>
                <Badge className="mt-1 bg-green-100 text-green-800">All Approved</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="bg-green-50 border-b border-green-200">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <CardTitle className="text-green-900">Verification Results</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-3">
              {pendingOrder?.checklistResults &&
                Object.entries(pendingOrder.checklistResults).map(([key, value]: any) => (
                  <div key={key} className="flex items-center justify-between p-3 rounded-lg bg-muted/20">
                    <span className="capitalize font-medium">{key.replace(/([A-Z])/g, " $1").trim()}</span>
                    <Badge className={value === "approve" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                      {value === "approve" ? "✓ Approved" : "✗ Rejected"}
                    </Badge>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button
            onClick={handleViewCommitmentEntry}
            disabled={currentOrderIndex === null}
            size="lg"
            className="flex-1 gap-2"
          >
            <Eye className="h-4 w-4" /> View Commitment Entry Details
          </Button>
          <Button onClick={handleCompleteOrder} disabled={isCompleting} size="lg" className="flex-1">
            {isCompleting ? "Completing..." : "Complete Order & Return to Dashboard"}
          </Button>
        </div>
      </div>
    </WorkflowStageShell>
  )
}
