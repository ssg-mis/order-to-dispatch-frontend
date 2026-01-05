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
import { Checkbox } from "@/components/ui/checkbox"

export default function DispatchMaterialPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [pendingOrders, setPendingOrders] = useState<any[]>([])
  const [historyOrders, setHistoryOrders] = useState<any[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [selectedOrders, setSelectedOrders] = useState<string[]>([])
  const [dispatchData, setDispatchData] = useState({
    dispatchDate: "",
    dispatchTime: "",
    warehouseLocation: "",
    materialReady: false,
    packagingComplete: false,
    labelsAttached: false,
  })

  useEffect(() => {
    const savedHistory = localStorage.getItem("workflowHistory")
    if (savedHistory) {
      const history = JSON.parse(savedHistory)

      
      const completed = history.filter(
        (item: any) => item.stage === "Dispatch Material" && item.status === "Completed"
      )
      setHistoryOrders(completed)
      
      const pending = history.filter(
        (item: any) => item.stage === "Check Delivery" && item.status === "Completed"
      ).filter(
        (item: any) => 
          !completed.some((completedItem: any) => completedItem.doNumber === item.doNumber)
      )
      setPendingOrders(pending)
    }
  }, [])

  const toggleSelectAll = () => {
    if (selectedOrders.length === pendingOrders.length) {
      setSelectedOrders([])
    } else {
      setSelectedOrders(pendingOrders.map((order) => order.doNumber))
    }
  }

  const toggleSelectOrder = (orderNo: string) => {
    if (selectedOrders.includes(orderNo)) {
      setSelectedOrders(selectedOrders.filter((id) => id !== orderNo))
    } else {
      setSelectedOrders([...selectedOrders, orderNo])
    }
  }

  const handleBulkDispatch = async () => {
    setIsProcessing(true)
    try {
      const savedHistory = localStorage.getItem("workflowHistory")
      const history = savedHistory ? JSON.parse(savedHistory) : []

      const ordersToDispatch = pendingOrders.filter((order) =>
        selectedOrders.includes(order.doNumber)
      )

      const updatedOrders = ordersToDispatch.map((order) => ({
        ...order,
        stage: "Dispatch Material",
        status: "Completed",
        dispatchData: {
          ...dispatchData,
          dispatchedAt: new Date().toISOString(),
        },
      }))

      // Update history
      updatedOrders.forEach((order) => history.push(order))
      localStorage.setItem("workflowHistory", JSON.stringify(history))
      
      // Update local state immediately
      setPendingOrders((prev) => prev.filter(order => !ordersToDispatch.some(d => d.doNumber === order.doNumber)))
      setHistoryOrders((prev) => [...prev, ...updatedOrders])
      setSelectedOrders([])

      // Update current order data (just taking the last one as current context if needed, or arguably this might be less relevant for bulk)
      if (updatedOrders.length > 0) {
        localStorage.setItem("currentOrderData", JSON.stringify(updatedOrders[updatedOrders.length - 1]))
      }

      toast({
        title: "Materials Dispatched",
        description: `${updatedOrders.length} orders moved to Vehicle Details stage.`,
      })

      setTimeout(() => {
        router.push("/vehicle-details")
      }, 1500)
    } finally {
      setIsProcessing(false)
    }
  }

  const allChecked = dispatchData.materialReady && dispatchData.packagingComplete && dispatchData.labelsAttached

  return (
    <WorkflowStageShell
      title="Stage 7: Dispatch Material"
      description="Prepare and dispatch materials for delivery."
      pendingCount={pendingOrders.length}
      historyData={historyOrders.map((order) => ({
        date: new Date(order.dispatchData?.dispatchedAt || new Date()).toLocaleDateString(),
        stage: "Dispatch Material",
        status: "Completed",
        remarks: `Dispatched: ${order.dispatchData?.dispatchDate}`,
      }))}
    >
      <div className="flex justify-end">
        <Button
          onClick={handleBulkDispatch}
          disabled={selectedOrders.length === 0 || isProcessing}
        >
          {isProcessing ? "Processing..." : `Dispatch Selected (${selectedOrders.length})`}
        </Button>
      </div>

      <Card className="border-none shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={pendingOrders.length > 0 && selectedOrders.length === pendingOrders.length}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Select all"
                />
              </TableHead>
              <TableHead>DO Number</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Products</TableHead>
              <TableHead>Delivery From</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pendingOrders.length > 0 ? (
              pendingOrders.map((order, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <Checkbox
                      checked={selectedOrders.includes(order.doNumber)}
                      onCheckedChange={() => toggleSelectOrder(order.doNumber)}
                      aria-label={`Select order ${order.doNumber}`}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{order.doNumber}</TableCell>
                  <TableCell>{order.customerName}</TableCell>
                  <TableCell>{order.productCount} Products</TableCell>
                  <TableCell>
                    {order.deliveryData?.deliveryFrom === "in-stock"
                      ? "In Stock"
                      : order.deliveryData?.deliveryFrom === "production"
                        ? "From Production"
                        : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge className="bg-orange-100 text-orange-700">Pending Dispatch</Badge>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No orders pending for dispatch
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </WorkflowStageShell>
  )
}
