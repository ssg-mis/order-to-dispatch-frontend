"use client"

import { Card } from "@/components/ui/card"
import { WorkflowStageShell } from "@/components/workflow/workflow-stage-shell"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Settings2, Loader2 } from "lucide-react"
import { useState, useEffect } from "react"



export default function PreApprovalPage() {
  const { toast } = useToast()
  const router = useRouter()
  const PAGE_COLUMNS = [
    { id: "soNo", label: "SO No." },
    { id: "deliveryPurpose", label: "Order Type (Delivery Purpose)" },
    { id: "startDate", label: "Start Date" },
    { id: "endDate", label: "End Date" },
    { id: "deliveryDate", label: "Delivery Date" },
    { id: "orderType", label: "Order Type" },
    { id: "customerType", label: "Customer Type" },
    { id: "partySoDate", label: "Party SO Date" },
    { id: "customerName", label: "Customer Name" },
    { id: "oilType", label: "Oil Type" },
    { id: "ratePer15Kg", label: "Rate Per 15 kg" },
    { id: "ratePerLtr", label: "Rate Per Ltr." }, // Aggregated
    { id: "productName", label: "Product Name" },
    { id: "totalWithGst", label: "Total Amount with GST" },
    { id: "transportType", label: "Type of Transporting" },
    { id: "contactPerson", label: "Customer Contact Person Name" },
    { id: "whatsapp", label: "Customer Contact Person Whatsapp No." },
    { id: "address", label: "Customer Address" },
    { id: "paymentTerms", label: "Payment Terms" },
    { id: "advanceTaken", label: "Advance Payment to be Taken" },
    { id: "advanceAmount", label: "Advance Amount" },
    { id: "isBroker", label: "Is this order Through Broker" },
    { id: "brokerName", label: "Broker Name (If Order Through Broker)" },
    { id: "uploadSo", label: "Upload SO." },
  ]

  const [visibleColumns, setVisibleColumns] = useState<string[]>([
    "soNo",
    "customerName",
    "deliveryPurpose",
    "deliveryDate",
    "oilType",
    "ratePer15Kg"
  ])
  const [isApproving, setIsApproving] = useState(false)
  const [pendingOrders, setPendingOrders] = useState<any[]>([])
  const [preApprovalData, setPreApprovalData] = useState<any>(null)
  const [productRates, setProductRates] = useState<{ [key: string]: { skuName: string; approvalQty: string; rate: string; remark: string } }>({})
  const [overallRemark, setOverallRemark] = useState("")

  const [history, setHistory] = useState<any[]>([])

  useEffect(() => {
    // 1. Load History
    const savedHistory = localStorage.getItem("workflowHistory")
    let historyData = []
    if (savedHistory) {
      historyData = JSON.parse(savedHistory)
      const stageHistory = historyData
        .filter((item: any) => item.stage === "Pre-Approval")
        .map((item: any) => ({
          ...item,
          date: item.date || (item.timestamp ? new Date(item.timestamp).toLocaleDateString("en-GB") : "-"),
          remarks: item.remarks || item.data?.overallRemark || "-"
        }))
      setHistory(stageHistory)
    }

    // 2. Load Persisted Pending Items
    const savedPending = localStorage.getItem("preApprovalPendingItems")
    let persistedPending = savedPending ? JSON.parse(savedPending) : []

    // 3. Load New Incoming Data
    const savedData = localStorage.getItem("orderData")
    if (savedData) {
      try {
        const data = JSON.parse(savedData)
        // Strict check: Only load into this page if it's explicitly for Pre-Approval
        if (data.stage === "Pre-Approval" || data.orderType === "pre-approval") {
             // Check if order is already processed in history
            const isProcessed = historyData.some(
                (item: any) => item.stage === "Pre-Approval" && (item.orderNo === (data.doNumber || "DO-XXXA"))
            )

            if (!isProcessed) {
                // Check if already in persisted list
                const exists = persistedPending.some((o: any) => 
                     (o.doNumber || o.orderNo) === (data.doNumber || data.orderNo)
                )
                
                if (!exists) {
                     persistedPending = [data, ...persistedPending]
                     localStorage.setItem("preApprovalPendingItems", JSON.stringify(persistedPending))
                     console.log("[Pre-Approval] Added new order to pending list:", data)
                }
            }
        }
      } catch (e) {
        console.error("Failed to parse orderData", e)
      }
    }

    // 4. Update State
    setPendingOrders(persistedPending)

    // 5. Load Pre-Approval Draft Data (if any)
    const savedPreApprovalData = localStorage.getItem("preApprovalData")
    if (savedPreApprovalData) {
      setPreApprovalData(JSON.parse(savedPreApprovalData))
    }
  }, [])

  const handleApprove = async (targetOrder: any) => {
    setIsApproving(true)
    try {
      const preApprovalSubmit = {
        ...preApprovalData,
        orderData: targetOrder,
        productRates,
        overallRemark,
        approvedAt: new Date().toISOString(),
        status: "approved",
      }
      localStorage.setItem("preApprovalData", JSON.stringify(preApprovalSubmit))

      const historyEntry = {
        orderNo: targetOrder?.doNumber || "DO-XXXA", // Use doNumber
        customerName: targetOrder?.customerName || "Unknown",
        stage: "Pre-Approval",
        status: "Completed",
        processedBy: "Current User",
        timestamp: new Date().toISOString(),
        date: new Date().toLocaleDateString("en-GB"),
        remarks: overallRemark || "-",
        data: preApprovalSubmit,
        productCount: targetOrder?.products?.length || 0,
      }

      const existingHistory = localStorage.getItem("workflowHistory")
      const history = existingHistory ? JSON.parse(existingHistory) : []
      history.push(historyEntry)
      localStorage.setItem("workflowHistory", JSON.stringify(history))

      localStorage.setItem(
        "commitmentReviewData",
        JSON.stringify({
          orderData: targetOrder,
          preApprovalData: preApprovalSubmit,
        }),
      )
      
      // Update local state immediately
      setHistory([...history.filter((h: any) => h.stage === "Pre-Approval"), historyEntry].map((item: any) => ({
          ...item,
          date: item.date || (item.timestamp ? new Date(item.timestamp).toLocaleDateString("en-GB") : "-"),
          remarks: item.remarks || item.data?.overallRemark || "-"
      })))
      
      const newPending = pendingOrders.filter(o => o.doNumber !== targetOrder.doNumber)
      setPendingOrders(newPending)
      localStorage.setItem("preApprovalPendingItems", JSON.stringify(newPending))

      toast({
        title: "Stage Completed",
        description: "Order moved to Before Entry in Commitment.",
      })
      setTimeout(() => {
        router.push("/approval-of-order")
      }, 1500)
    } finally {
      setIsApproving(false)
    }
  }



  const destinationColumnsCount = visibleColumns.length + 1
  
  /* Extract unique customer names */
  const customerNames = Array.from(new Set(pendingOrders.map(order => order.customerName || "Unknown")))

  const [filterValues, setFilterValues] = useState({
      status: "",
      startDate: "",
      endDate: "",
      partyName: ""
  })

  const filteredPendingOrders = pendingOrders.filter(order => {
      let matches = true
      
      // Filter by Party Name
      if (filterValues.partyName && filterValues.partyName !== "all" && order.customerName !== filterValues.partyName) {
          matches = false
      }

      // Filter by Date Range (using deliveryDate or soDate as fallback)
      const orderDateStr = order.deliveryDate || order.soDate
      if (orderDateStr) {
          const orderDate = new Date(orderDateStr)
          if (filterValues.startDate) {
              const start = new Date(filterValues.startDate)
              if (orderDate < start) matches = false
          }
          if (filterValues.endDate) {
              const end = new Date(filterValues.endDate)
              if (orderDate > end) matches = false
          }
      }

      // Filter by Status (On Time / Expire)
      // "Expire" = deliveryDate is in the past
      // "On Time" = deliveryDate is today or future
      if (filterValues.status) {
          const today = new Date()
          today.setHours(0, 0, 0, 0) // normalized today
          
          if (orderDateStr) {
             const deliveryDate = new Date(orderDateStr)
             if (filterValues.status === "expire") {
                 if (deliveryDate >= today) matches = false
             } else if (filterValues.status === "on-time") {
                 if (deliveryDate < today) matches = false
             }
          }
      }

      return matches
  })

  return (
    <WorkflowStageShell
      title="Stage 2: Pre-Approval"
      description="Review and set rates for item requirements."
      pendingCount={filteredPendingOrders.length}
      historyData={history}
        partyNames={customerNames}
        onFilterChange={setFilterValues}
    >
      <div className="space-y-4">
        <div className="flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="ml-auto bg-transparent">
                <Settings2 className="mr-2 h-4 w-4" />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[250px] max-h-[400px] overflow-y-auto">
              <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {PAGE_COLUMNS.map((col) => (
                <DropdownMenuCheckboxItem
                  key={col.id}
                  className="capitalize"
                  checked={visibleColumns.includes(col.id)}
                  onCheckedChange={(checked) => {
                    setVisibleColumns((prev) => (checked ? [...prev, col.id] : prev.filter((id) => id !== col.id)))
                  }}
                >
                  {col.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Card className="border-none shadow-sm overflow-auto max-h-[600px]">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-card shadow-sm">
              <TableRow>
                <TableHead className="w-[80px]">Action</TableHead>
                {PAGE_COLUMNS.filter((col) => visibleColumns.includes(col.id)).map((col) => (
                  <TableHead key={col.id} className="whitespace-nowrap text-center">
                    {col.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPendingOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={visibleColumns.length + 1} className="text-center py-8 text-muted-foreground">
                    No Data pending for Pre Approval
                  </TableCell>
                </TableRow>
              ) : filteredPendingOrders.map((rawOrder, i) => {
                const row = {
                   orderNo: rawOrder.doNumber || rawOrder.orderNo || "DO-XXXA",
                   deliveryPurpose: rawOrder.orderPurpose || "Week On Week",
                   customerType: rawOrder.customerType || "Existing",
                   orderType: rawOrder.orderType || "Regular",
                   soNo: rawOrder.soNumber || "SO-882",
                   partySoDate: rawOrder.soDate || "2024-03-21",
                   customerName: rawOrder.customerName || "Acme Corp",
                   // Handle new date fields
                   startDate: rawOrder.startDate || "—",
                   endDate: rawOrder.endDate || "—",
                   deliveryDate: rawOrder.deliveryDate || "—",
                   // Handle Rates Aggregation
                   oilType: rawOrder.preApprovalProducts?.map((p: any) => p.oilType).join(", ") || rawOrder.oilType || "—",
                   ratePerLtr: rawOrder.preApprovalProducts?.map((p: any) => p.ratePerLtr).join(", ") || rawOrder.ratePerLtr || "—",
                   ratePer15Kg: rawOrder.preApprovalProducts?.map((p: any) => p.rateLtr).join(", ") || rawOrder.rateLtr || "—",
                   
                   itemConfirm: rawOrder.itemConfirm?.toUpperCase() || "YES",
                   productName: rawOrder.products?.map((p: any) => p.productName).join(", ") || "",
                   uom: rawOrder.products?.map((p: any) => p.uom).join(", ") || "",
                   orderQty: rawOrder.products?.map((p: any) => p.orderQty).join(", ") || "",
                   altUom: rawOrder.products?.map((p: any) => p.altUom).join(", ") || "",
                   altQty: rawOrder.products?.map((p: any) => p.altQty).join(", ") || "",
                   
                   // Extended Columns
                   totalWithGst: rawOrder.totalWithGst || "—",
                   transportType: rawOrder.transportType || "—",
                   contactPerson: rawOrder.contactPerson || "—",
                   whatsapp: rawOrder.whatsappNo || "—",
                   address: rawOrder.customerAddress || "—",
                   paymentTerms: rawOrder.paymentTerms || "—",
                   advanceTaken: rawOrder.advancePaymentTaken || "—",
                   advanceAmount: rawOrder.advanceAmount || "—",
                   isBroker: rawOrder.isBrokerOrder || "—",
                   brokerName: rawOrder.brokerName || "—",
                   uploadSo: "so_document.pdf",
                   
                   products: (rawOrder.preApprovalProducts && rawOrder.preApprovalProducts.length > 0) 
                             ? rawOrder.preApprovalProducts 
                             : (rawOrder.products || []),
                 }

                return (
                <TableRow key={i}>
                  <TableCell>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="outline" className="h-8 bg-transparent">
                          Process
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>Pre-Approval Form: {row.orderNo}</DialogTitle>
                          <DialogDescription>Set required rates and remarks for each product item.</DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-6 py-4">
                          <div className="space-y-4">
                            {row.products && row.products.length > 0 ? (
                              row.products.map((product: any) => (
                                <div key={product.id} className="border p-4 rounded-lg bg-muted/20">
                                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                                    <div className="space-y-2 pb-1.5">
                                      <Label className="text-xs font-medium text-muted-foreground">Oil Type</Label>
                                      <p className="text-sm font-bold text-primary">
                                        {product.oilType || product.productName || "—"}
                                      </p>
                                    </div>
                                    
                                    <div className="space-y-1.5">
                                      <Label className="text-xs font-medium text-muted-foreground">SKU Name</Label>
                                      <Input
                                        className="h-9 bg-background"
                                        placeholder="Enter SKU"
                                        value={productRates[product.id]?.skuName || ""}
                                        onChange={(e) =>
                                          setProductRates({
                                            ...productRates,
                                            [product.id]: {
                                              ...productRates[product.id],
                                              skuName: e.target.value,
                                            },
                                          })
                                        }
                                      />
                                    </div>

                                    <div className="space-y-1.5">
                                      <Label className="text-xs font-medium text-muted-foreground">Approval Qty</Label>
                                      <Input
                                        className="h-9 bg-background"
                                        type="number"
                                        placeholder="-505-"
                                        value={productRates[product.id]?.approvalQty || ""}
                                        onChange={(e) =>
                                          setProductRates({
                                            ...productRates,
                                            [product.id]: {
                                              ...productRates[product.id],
                                              approvalQty: e.target.value,
                                            },
                                          })
                                        }
                                      />
                                    </div>

                                    <div className="space-y-1.5">
                                      <Label className="text-xs font-medium text-muted-foreground">Required Rate</Label>
                                      <Input
                                        className={`h-9 bg-background ${
                                          (parseFloat(productRates[product.id]?.rate || "0") < parseFloat(productRates[product.id]?.approvalQty || "0")) && productRates[product.id]?.rate
                                            ? "text-red-600" 
                                            : ""
                                        }`}
                                        type="number"
                                        placeholder="Rate"
                                        value={productRates[product.id]?.rate || ""}
                                        onChange={(e) =>
                                          setProductRates({
                                            ...productRates,
                                            [product.id]: {
                                              ...productRates[product.id],
                                              rate: e.target.value,
                                            },
                                          })
                                        }
                                      />
                                    </div>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="text-muted-foreground text-sm py-4">No products added</div>
                            )}
                          </div>
                          <div className="space-y-2">
                            <Label>Overall Stage Remark</Label>
                            <Textarea
                              placeholder="Type any general feedback here..."
                              value={overallRemark}
                              onChange={(e) => setOverallRemark(e.target.value)}
                            />
                          </div>
                        </div>
                          <DialogFooter>
                            <Button variant="ghost" className="mr-auto">
                              Reject Order
                            </Button>
                            {(() => {
                               const isValid = row.products?.every((p: any) => {
                                   const rate = parseFloat(productRates[p.id]?.rate || "0")
                                   const approval = parseFloat(productRates[p.id]?.approvalQty || "0")
                                   return rate >= approval && rate > 0
                               })
                               
                               return (
                                <Button onClick={() => handleApprove(rawOrder)} disabled={isApproving || !isValid}>
                                    {isApproving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    {isApproving ? "Processing..." : "Submit Pre-Approval"}
                                </Button>
                               )
                            })()}
                          </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </TableCell>
                  {PAGE_COLUMNS.filter((col) => visibleColumns.includes(col.id)).map((col) => (
                    <TableCell key={col.id} className="whitespace-nowrap text-center">
                      {row[col.id as keyof typeof row]}
                    </TableCell>
                  ))}
                </TableRow>
              )})}
            </TableBody>
          </Table>
        </Card>
      </div>
    </WorkflowStageShell>
  )
}