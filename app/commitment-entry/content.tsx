"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ArrowLeft, Download, Printer } from "lucide-react"

export function CommitmentEntryContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [orderData, setOrderData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const orderIndex = searchParams.get("index")
    if (orderIndex !== null) {
      const savedHistory = localStorage.getItem("workflowHistory")
      if (savedHistory) {
        const historyLogs = JSON.parse(savedHistory)
        const order = historyLogs[Number.parseInt(orderIndex)]
        if (order) {
          setOrderData(order)
          console.log("[v0] Commitment entry loaded:", order)
        } else {
          console.log("[v0] Order not found at index:", orderIndex)
        }
      }
    } else {
      const finalData = localStorage.getItem("finalOrderData")
      if (finalData) {
        const parsed = JSON.parse(finalData)
        setOrderData({
          orderNo: parsed.orderData?.doNumber || "DO-XXXA",
          customerName: parsed.orderData?.customerName || "Unknown",
          stage: "Commitment Review",
          status: "Approved",
          processedBy: "Current User",
          timestamp: new Date().toISOString(),
          data: parsed,
          productCount: parsed.orderData?.products?.length || 0,
        })
      }
    }
    setLoading(false)
  }, [searchParams])

  const formatDate = (isoString: string) => {
    const date = new Date(isoString)
    return date.toLocaleString()
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-muted rounded"></div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>
    )
  }

  if (!orderData) {
    return (
      <div className="p-6">
        <Button onClick={() => router.back()} className="gap-2 mb-6">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <Card className="text-center py-12">
          <p className="text-muted-foreground">Order not found</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <Button onClick={() => router.back()} variant="ghost" className="gap-2 mb-4">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Commitment Entry Details</h1>
          <p className="text-muted-foreground">Order #{orderData.orderNo}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2 bg-transparent">
            <Printer className="h-4 w-4" /> Print
          </Button>
          <Button variant="outline" className="gap-2 bg-transparent">
            <Download className="h-4 w-4" /> Download
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="bg-muted/10 border-b">
          <CardTitle className="text-lg">Order Overview</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-sm font-semibold text-muted-foreground">Order Number</p>
              <p className="text-lg font-bold">{orderData.orderNo}</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-muted-foreground">Customer</p>
              <p className="text-lg font-bold">{orderData.customerName}</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-muted-foreground">Stage</p>
              <p className="text-lg font-bold">{orderData.stage}</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-muted-foreground">Status</p>
              <Badge className="text-base py-1">{orderData.status}</Badge>
            </div>
            <div>
              <p className="text-sm font-semibold text-muted-foreground">Products</p>
              <p className="text-lg font-bold">{orderData.productCount || 0}</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-muted-foreground">Processed By</p>
              <p className="text-lg font-bold">{orderData.processedBy}</p>
            </div>
            <div className="col-span-2">
              <p className="text-sm font-semibold text-muted-foreground">Date & Time</p>
              <p className="text-lg font-bold">{formatDate(orderData.timestamp)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="bg-muted/10 border-b">
          <CardTitle className="text-lg">Customer Information</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-sm font-semibold text-muted-foreground">Customer Name</p>
              <p>{orderData.data?.orderData?.customerName}</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-muted-foreground">Contact Person</p>
              <p>{orderData.data?.orderData?.contactPerson}</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-muted-foreground">WhatsApp Number</p>
              <p>{orderData.data?.orderData?.whatsappNo}</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-muted-foreground">Customer Type</p>
              <p className="capitalize">{orderData.data?.orderData?.customerType}</p>
            </div>
            <div className="col-span-2">
              <p className="text-sm font-semibold text-muted-foreground">Address</p>
              <p>{orderData.data?.orderData?.customerAddress}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {orderData.data?.orderData?.products && orderData.data.orderData.products.length > 0 && (
        <Card>
          <CardHeader className="bg-muted/10 border-b">
            <CardTitle className="text-lg">Products</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product Name</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>UOM</TableHead>
                  <TableHead>Rate/Ltr</TableHead>
                  <TableHead>Remarks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orderData.data.orderData.products.map((product: any, idx: number) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium">{product.productName}</TableCell>
                    <TableCell>{product.orderQty}</TableCell>
                    <TableCell>{product.uom}</TableCell>
                    <TableCell>{product.rateLtr || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{product.remark || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {orderData.data?.preApprovalData && (
        <Card>
          <CardHeader className="bg-muted/10 border-b">
            <CardTitle className="text-lg">Pre-Approval Details</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Rate</TableHead>
                  <TableHead>Remarks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orderData.data.preApprovalData.products &&
                  orderData.data.preApprovalData.products.map((product: any, idx: number) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{product.productName}</TableCell>
                      <TableCell>{product.rate || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{product.remark || "—"}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {orderData.data?.commitmentReviewData && (
        <Card>
          <CardHeader className="bg-muted/10 border-b">
            <CardTitle className="text-lg">Commitment Review Details</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-semibold text-muted-foreground">Delivery Date</p>
                  <p>{orderData.data.commitmentReviewData.deliveryDate}</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-muted-foreground">Payment Terms</p>
                  <p>{orderData.data.commitmentReviewData.paymentTerms}</p>
                </div>
              </div>
              {orderData.data.commitmentReviewData.products && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Rate</TableHead>
                      <TableHead>Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orderData.data.commitmentReviewData.products.map((product: any, idx: number) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{product.productName}</TableCell>
                        <TableCell>{product.quantity}</TableCell>
                        <TableCell>{product.rate || "—"}</TableCell>
                        <TableCell>{product.amount || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
