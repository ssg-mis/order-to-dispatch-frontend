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

const ALL_COLUMNS = [
  { id: "orderNo", label: "DO Number" },
  { id: "deliveryPurpose", label: "ORDER TYPE (DELIVERY PURPOSE)" },
  { id: "customerType", label: "Customer Type" },
  { id: "orderType", label: "ORDER TYPE" },
  { id: "soNo", label: "SO No." },
  { id: "partySoDate", label: "Party SO Date" },
  { id: "customerName", label: "Customer Name" },
  { id: "itemConfirm", label: "Item Confirm" },
  { id: "productName", label: "Product Name" },
  { id: "uom", label: "UOM" },
  { id: "orderQty", label: "Order Quantity" },
  { id: "altUom", label: "Alternate UOM" },
  { id: "altQty", label: "Alternate Qty (Kg)" },
  { id: "oilType", label: "Oil Type" },
  { id: "ratePerLtr", label: "Rate Per Ltr" },
  { id: "rateOfMaterial", label: "Rate Of Material" },
  { id: "totalWithGst", label: "Total Amount With Gst" },
  { id: "transportType", label: "Type Of Transporting" },
  { id: "uploadSo", label: "Upload SO" },
  { id: "contactPerson", label: "Customer Contact Person Name" },
  { id: "whatsapp", label: "Customer Contact Person WhatsApp No." },
  { id: "address", label: "Customer Address" },
  { id: "paymentTerms", label: "Payments Terms" },
  { id: "advanceTaken", label: "Advance Payment to Be Taken" },
  { id: "advanceAmount", label: "Advance Amount" },
  { id: "isBroker", label: "Is This Order Through Broker" },
  { id: "brokerName", label: "Brocker Name (IF ORDER THROUGH BROCKER)" },
  { id: "deliveryDate", label: "Expected Delivery Date" },
]

const DUMMY_ORDERS = [
  {
    doNumber: "DO-001",
    orderPurpose: "Week On Week",
    customerType: "Existing",
    orderType: "Regular",
    soNumber: "SO-101",
    soDate: "2024-03-20",
    customerName: "Tech Solutions Ltd",
    itemConfirm: "YES",
    products: [
      { id: "p1", productName: "Industrial Oil A", uom: "Ltr", orderQty: "1000" },
      { id: "p2", productName: "Lubricant B", uom: "Kg", orderQty: "500" }
    ],
    oilType: "Industrial",
    rateMaterial: "₹50,000",
    totalWithGst: "₹59,000",
    transportType: "Company Vehicle",
    contactPerson: "Alice Smith",
    whatsappNo: "+91 9876543210",
    customerAddress: "Sector 18, Gurgaon",
    paymentTerms: "Net 30",
    advancePaymentTaken: "NO",
    isBrokerOrder: "NO",
    deliveryDate: "2024-03-25"
  },
  {
    doNumber: "DO-002",
    orderPurpose: "Monthly Stock",
    customerType: "New",
    orderType: "Urgent",
    soNumber: "SO-102",
    soDate: "2024-03-21",
    customerName: "Global Manufacturing",
    itemConfirm: "YES",
    products: [
      { id: "p3", productName: "Hydraulic Fluid X", uom: "Ltr", orderQty: "2000" }
    ],
    oilType: "Hydraulic",
    rateMaterial: "₹1,20,000",
    totalWithGst: "₹1,41,600",
    transportType: "Customer Vehicle",
    contactPerson: "Bob Jones",
    whatsappNo: "+91 9876543211",
    customerAddress: "MIDC, Pune",
    paymentTerms: "Advance",
    advancePaymentTaken: "YES",
    advanceAmount: "₹50,000",
    isBrokerOrder: "NO",
    deliveryDate: "2024-03-24"
  },
  {
    doNumber: "DO-003",
    orderPurpose: "Trial Order",
    customerType: "New",
    orderType: "Sample",
    soNumber: "SO-103",
    soDate: "2024-03-22",
    customerName: "Sunrise Traders",
    itemConfirm: "YES",
    products: [
      { id: "p4", productName: "Base Oil 500", uom: "Ltr", orderQty: "200" }
    ],
    oilType: "Base Oil",
    rateMaterial: "₹15,000",
    totalWithGst: "₹17,700",
    transportType: "Third Party",
    contactPerson: "Charlie Brown",
    whatsappNo: "+91 9876543212",
    customerAddress: "Okhla, Delhi",
    paymentTerms: "Net 7",
    advancePaymentTaken: "NO",
    isBrokerOrder: "YES",
    brokerName: "Ramesh Brokers",
    deliveryDate: "2024-03-26"
  },
  {
    doNumber: "DO-004",
    orderPurpose: "Regular Stock",
    customerType: "Existing",
    orderType: "Regular",
    soNumber: "SO-104",
    soDate: "2024-03-22",
    customerName: "Alpha Constructions",
    itemConfirm: "YES",
    products: [
      { id: "p5", productName: "Gear Oil 90", uom: "Ltr", orderQty: "500" },
      { id: "p6", productName: "Grease MP", uom: "Kg", orderQty: "100" }
    ],
    oilType: "Gear Oil",
    rateMaterial: "₹45,000",
    totalWithGst: "₹53,100",
    transportType: "Company Vehicle",
    contactPerson: "David Miller",
    whatsappNo: "+91 9876543213",
    customerAddress: "Noida, UP",
    paymentTerms: "Net 45",
    advancePaymentTaken: "NO",
    isBrokerOrder: "NO",
    deliveryDate: "2024-03-29"
  },
  {
    doNumber: "DO-005",
    orderPurpose: "Project Supply",
    customerType: "Existing",
    orderType: "Contract",
    soNumber: "SO-105",
    soDate: "2024-03-23",
    customerName: "Mega Infrastructure",
    itemConfirm: "YES",
    products: [
      { id: "p7", productName: "Transformer Oil", uom: "Ltr", orderQty: "5000" }
    ],
    oilType: "Transformer",
    rateMaterial: "₹3,50,000",
    totalWithGst: "₹4,13,000",
    transportType: "Customer Vehicle",
    contactPerson: "Eva Green",
    whatsappNo: "+91 9876543214",
    customerAddress: "Manesar, Haryana",
    paymentTerms: "LC",
    advancePaymentTaken: "NO",
    isBrokerOrder: "NO",
    deliveryDate: "2024-04-01"
  }
]

export default function PreApprovalPage() {
  const { toast } = useToast()
  const router = useRouter()
  const [visibleColumns, setVisibleColumns] = useState<string[]>([
    "orderNo",
    "customerName",
    "productName",
    "totalWithGst",
  ])
  const [isApproving, setIsApproving] = useState(false)
  const [pendingOrders, setPendingOrders] = useState<any[]>(DUMMY_ORDERS)
  const [preApprovalData, setPreApprovalData] = useState<any>(null)
  const [productRates, setProductRates] = useState<{ [key: string]: { rate: string; remark: string } }>({})
  const [overallRemark, setOverallRemark] = useState("")

  const [history, setHistory] = useState<any[]>([])

  useEffect(() => {
    const savedHistory = localStorage.getItem("workflowHistory")
    let historyData = []
    if (savedHistory) {
      historyData = JSON.parse(savedHistory)
      const stageHistory = historyData.filter((item: any) => item.stage === "Pre-Approval")
      setHistory(stageHistory)
    }

    const savedData = localStorage.getItem("orderData")
    if (savedData) {
      const data = JSON.parse(savedData)
      // Check if order is already processed
      const isProcessed = historyData.some(
        (item: any) => item.stage === "Pre-Approval" && (item.orderNo === (data.doNumber || "DO-XXXA"))
      )

      if (!isProcessed) {
        // Prevent duplicates
        setPendingOrders(prev => {
          if (prev.some(o => o.doNumber === data.doNumber)) return prev
          return [data, ...prev]
        })
        console.log("[v0] Order data loaded from localStorage:", data)
      } else {
        console.log("[v0] Order already processed, skipping.")
      }
    }

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
      setHistory([...history, historyEntry])
      setPendingOrders(prev => prev.filter(o => o.doNumber !== targetOrder.doNumber))

      toast({
        title: "Stage Completed",
        description: "Order moved to Before Entry in Commitment.",
      })
      setTimeout(() => {
        router.push("/commitment-review")
      }, 1500)
    } finally {
      setIsApproving(false)
    }
  }



  const destinationColumnsCount = visibleColumns.length + 1

  return (
    <WorkflowStageShell
      title="Stage 2: Pre-Approval"
      description="Review and set rates for item requirements."
      pendingCount={pendingOrders.length}
      historyData={history}
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
              {ALL_COLUMNS.map((col) => (
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

        <Card className="border-none shadow-sm overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="w-[80px]">Action</TableHead>
                {ALL_COLUMNS.filter((col) => visibleColumns.includes(col.id)).map((col) => (
                  <TableHead key={col.id} className="whitespace-nowrap">
                    {col.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingOrders.map((rawOrder, i) => {
                const row = {
                   orderNo: rawOrder.doNumber || "DO-XXXA",
                   deliveryPurpose: rawOrder.orderPurpose || "Week On Week",
                   customerType: rawOrder.customerType || "Existing",
                   orderType: rawOrder.orderType || "Regular",
                   soNo: rawOrder.soNumber || "SO-882",
                   partySoDate: rawOrder.soDate || "2024-03-21",
                   customerName: rawOrder.customerName || "Acme Corp",
                   itemConfirm: rawOrder.itemConfirm?.toUpperCase() || "YES",
                   products: rawOrder.products || [],
                   oilType: rawOrder.oilType || "Palm Oil",
                   ratePerLtr: "₹95",
                   rateOfMaterial: rawOrder.rateMaterial || "₹42,500",
                   totalWithGst: rawOrder.totalWithGst || "₹50,150",
                   transportType: rawOrder.transportType || "Company Vehicle",
                   uploadSo: "so_document.pdf",
                   contactPerson: rawOrder.contactPerson || "John Doe",
                   whatsapp: rawOrder.whatsappNo || "+91 9876543210",
                   address: rawOrder.customerAddress || "123 Business Park, Mumbai",
                   paymentTerms: rawOrder.paymentTerms || "Net 30",
                   advanceTaken: rawOrder.advancePaymentTaken || "YES",
                   advanceAmount: rawOrder.advanceAmount || "₹15,000",
                   isBroker: rawOrder.isBrokerOrder || "NO",
                   brokerName: rawOrder.brokerName || "-",
                   deliveryDate: rawOrder.deliveryDate || "2024-03-28",
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
                            <div className="grid grid-cols-3 gap-4 font-semibold text-sm text-muted-foreground px-1 pb-2 border-b">
                              <div>Product Name</div>
                              <div>Required Rate</div>
                              <div>Remark</div>
                            </div>
                            {row.products && row.products.length > 0 ? (
                              row.products.map((product: any) => (
                                <div key={product.id} className="grid grid-cols-3 gap-4 items-start">
                                  <div className="pt-2">
                                    <span className="font-medium">{product.productName || "Product"}</span>
                                    <div className="text-xs text-muted-foreground mt-1">
                                      UOM: {product.uom} | Qty: {product.orderQty}
                                    </div>
                                  </div>
                                  <Input
                                    type="number"
                                    placeholder="Enter Rate"
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
                                  <Input
                                    placeholder="Add Remark"
                                    value={productRates[product.id]?.remark || ""}
                                    onChange={(e) =>
                                      setProductRates({
                                        ...productRates,
                                        [product.id]: {
                                          ...productRates[product.id],
                                          remark: e.target.value,
                                        },
                                      })
                                    }
                                  />
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
                          <Button onClick={() => handleApprove(rawOrder)} disabled={isApproving}>
                             {isApproving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                             {isApproving ? "Processing..." : "Submit Pre-Approval"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </TableCell>
                  {ALL_COLUMNS.filter((col) => visibleColumns.includes(col.id)).map((col) => (
                    <TableCell key={col.id} className="whitespace-nowrap">
                      {col.id === "productName" ? (
                        <div className="text-sm">
                          {row.products?.map((p: any) => (
                            <div key={p.id}>{p.productName}</div>
                          ))}
                        </div>
                      ) : (
                        row[col.id as keyof typeof row]
                      )}
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
