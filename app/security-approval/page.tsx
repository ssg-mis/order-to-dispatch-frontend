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

export default function SecurityApprovalPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [pendingOrders, setPendingOrders] = useState<any[]>([])
  const [historyOrders, setHistoryOrders] = useState<any[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [uploadData, setUploadData] = useState({
    biltyImage: null as File | null,
    vehicleImages: [] as File[],
  })

  useEffect(() => {
    const savedHistory = localStorage.getItem("workflowHistory")
    if (savedHistory) {
      const history = JSON.parse(savedHistory)
      
      const completed = history.filter(
        (item: any) => item.stage === "Security Approval" && item.status === "Completed"
      )
      setHistoryOrders(completed)

      const pending = history.filter(
        (item: any) => item.stage === "Material Load" && item.status === "Completed"
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
        stage: "Security Approval",
        status: "Completed",
        securityData: {
          biltyUploaded: !!uploadData.biltyImage,
          vehicleImagesCount: uploadData.vehicleImages.length,
          approvedAt: new Date().toISOString(),
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
        title: "Security Approved",
        description: "Order moved to Make Invoice stage.",
      })

      setTimeout(() => {
        router.push("/make-invoice")
      }, 1500)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <WorkflowStageShell
      title="Stage 10: Security Guard Approval"
      description="Upload bilty and vehicle images for security verification."
      pendingCount={pendingOrders.length}
      historyData={historyOrders.map((order) => ({
        date: new Date(order.securityData?.approvedAt || new Date()).toLocaleDateString(),
        stage: "Security Approval",
        status: "Completed",
        remarks: `${order.securityData?.vehicleImagesCount} Images`,
      }))}
    >
      <Card className="border-none shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead>Action</TableHead>
              <TableHead>Order No</TableHead>
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
                        <Button size="sm">Approve</Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-lg">
                        <DialogHeader>
                          <DialogTitle>Security Approval: {order.orderNo}</DialogTitle>
                        </DialogHeader>
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label>Bilty Image</Label>
                              <Input
                                type="file"
                                accept="image/*"
                                onChange={(e) => {
                                  if (e.target.files?.[0]) {
                                    setUploadData({ ...uploadData, biltyImage: e.target.files[0] })
                                  }
                                }}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Vehicle Images</Label>
                              <div className="flex flex-wrap gap-4">
                                {uploadData.vehicleImages.map((file, index) => (
                                  <div key={index} className="relative w-24 h-24 border rounded overflow-hidden group">
                                    <img
                                      src={URL.createObjectURL(file)}
                                      alt={`Vehicle ${index + 1}`}
                                      className="w-full h-full object-cover"
                                    />
                                    <button
                                      onClick={() => {
                                        const newImages = [...uploadData.vehicleImages]
                                        newImages.splice(index, 1)
                                        setUploadData({ ...uploadData, vehicleImages: newImages })
                                      }}
                                      className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </div>
                                ))}
                                <label className="w-24 h-24 border-2 border-dashed rounded flex flex-col items-center justify-center cursor-pointer hover:bg-muted/50 transition-colors">
                                  <Plus className="h-6 w-6 text-muted-foreground" />
                                  <span className="text-xs text-muted-foreground mt-1">Add Image</span>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    className="hidden"
                                    onChange={(e) => {
                                      if (e.target.files) {
                                        const newFiles = Array.from(e.target.files)
                                        setUploadData({
                                          ...uploadData,
                                          vehicleImages: [...uploadData.vehicleImages, ...newFiles],
                                        })
                                      }
                                    }}
                                  />
                                </label>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                Upload multiple vehicle images (front, back, side)
                              </p>
                            </div>
                          </div>
                        <DialogFooter>
                          <Button onClick={() => handleSubmit(order)} disabled={isProcessing}>
                            {isProcessing ? "Processing..." : "Approve & Continue"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </TableCell>
                  <TableCell className="font-medium">{order.orderNo}</TableCell>
                  <TableCell>{order.customerName}</TableCell>
                  <TableCell>{order.loadData?.truckNo || "—"}</TableCell>
                  <TableCell>
                    <Badge className="bg-amber-100 text-amber-700">Pending Security</Badge>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  No orders pending for security approval
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </WorkflowStageShell>
  )
}
