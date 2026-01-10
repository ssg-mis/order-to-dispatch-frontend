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
import { Upload } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Settings2 } from "lucide-react"
import { ALL_WORKFLOW_COLUMNS as ALL_COLUMNS } from "@/lib/workflow-columns"

export default function MakeInvoicePage() {
  const router = useRouter()
  const { toast } = useToast()
  const [pendingOrders, setPendingOrders] = useState<any[]>([])
  const [historyOrders, setHistoryOrders] = useState<any[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState<string[]>([
    "orderNo",
    "customerName",
    "status",
  ])
  const [invoiceType, setInvoiceType] = useState<"independent" | "common" | "">("")
  const [invoiceData, setInvoiceData] = useState({
    invoiceNo: "",
    invoiceDate: new Date().toISOString().split('T')[0], // Default to today
    qty: "",
    billAmount: "",
    invoiceFile: null as File | null,
  })

  useEffect(() => {
    // ... existing useEffect logic ...
    const savedHistory = localStorage.getItem("workflowHistory")
    if (savedHistory) {
      const history = JSON.parse(savedHistory)
      
      const completed = history.filter(
        (item: any) => item.stage === "Make Invoice" && item.status === "Completed"
      )
      setHistoryOrders(completed)

      const pending = history.filter(
        (item: any) => item.stage === "Security Approval" && item.status === "Completed"
      ).filter(
        (item: any) => 
          !completed.some((completedItem: any) => 
            (completedItem.doNumber && item.doNumber && completedItem.doNumber === item.doNumber) ||
            (completedItem.orderNo && item.orderNo && completedItem.orderNo === item.orderNo)
          )
      )
      setPendingOrders(pending)
    }
  }, [])

  const handleSubmit = async (order: any) => {
    setIsProcessing(true)
    try {
      const updatedOrder = {
        ...order,
        stage: "Make Invoice",
        status: "Completed",
        invoiceData: {
          type: invoiceType,
          invoiceNo: invoiceData.invoiceNo,
          invoiceDate: invoiceType === 'independent' ? invoiceData.invoiceDate : null,
          qty: invoiceData.qty,
          billAmount: invoiceType === 'independent' ? invoiceData.billAmount : null,
          invoiceUploaded: !!invoiceData.invoiceFile,
          createdAt: new Date().toISOString(),
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
        title: "Invoice Created",
        description: "Order moved to Check Invoice stage.",
      })

      setTimeout(() => {
        router.push("/check-invoice")
      }, 1500)
    } finally {
      setIsProcessing(false)
    }
  }

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

      // Filter by Date Range
      const orderDateStr = order.securityData?.approvedAt || order.loadData?.completedAt || order.timestamp
      if (orderDateStr) {
          const orderDate = new Date(orderDateStr)
          if (filterValues.startDate) {
              const start = new Date(filterValues.startDate)
              start.setHours(0,0,0,0)
              if (orderDate < start) matches = false
          }
          if (filterValues.endDate) {
              const end = new Date(filterValues.endDate)
              end.setHours(23,59,59,999)
              if (orderDate > end) matches = false
          }
      }

      // Filter by Status (On Time / Expire)
      if (filterValues.status) {
          const today = new Date()
          today.setHours(0, 0, 0, 0)
          const targetDateStr = order.deliveryDate || order.timestamp
          if (targetDateStr) {
             const targetDate = new Date(targetDateStr)
             
             if (filterValues.status === "expire") {
                 if (targetDate < today) matches = true
                 else matches = false
             } else if (filterValues.status === "on-time") {
                 if (targetDate >= today) matches = true
                 else matches = false
             }
          }
      }

      return matches
  })

  return (
    <WorkflowStageShell
      title="Stage 9: Make Invoice (Proforma)"
      description="Create proforma invoice for the order."
      pendingCount={filteredPendingOrders.length}
      historyData={historyOrders.map((order) => ({
        date: new Date(order.invoiceData?.createdAt || new Date()).toLocaleDateString("en-GB"),
        stage: "Make Invoice",
        status: "Completed",
        remarks: order.invoiceData?.invoiceNo || "Generated",
      }))}
      partyNames={customerNames}
      onFilterChange={setFilterValues}
      remarksColName="Invoice No"
    >
      <div className="space-y-4">
        <div className="flex justify-end gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="bg-transparent">
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

        <Card className="border-none shadow-sm overflow-auto max-h-[600px]">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-card shadow-sm">
              <TableRow>
                <TableHead className="w-[80px]">Action</TableHead>
                {ALL_COLUMNS.filter((col) => visibleColumns.includes(col.id)).map((col) => (
                  <TableHead key={col.id} className="whitespace-nowrap text-center">
                    {col.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPendingOrders.length > 0 ? (
                filteredPendingOrders.map((order, index) => {
                   const prodNames = order.products?.map((p: any) => p.productName).join(", ") || "";
                   const uoms = order.products?.map((p: any) => p.uom).join(", ") || "";
                   const qtys = order.products?.map((p: any) => p.orderQty).join(", ") || "";
                   const altUoms = order.products?.map((p: any) => p.altUom).join(", ") || "";
                   const altQtys = order.products?.map((p: any) => p.altQty).join(", ") || "";
                   
                   const ratesLtr = order.preApprovalProducts?.map((p: any) => p.ratePerLtr).join(", ") || order.ratePerLtr || "—";
                   const rates15Kg = order.preApprovalProducts?.map((p: any) => p.rateLtr).join(", ") || order.rateLtr || "—";
                   const oilTypes = order.preApprovalProducts?.map((p: any) => p.oilType).join(", ") || order.oilType || "—";

                   const row = {
                     orderNo: order.doNumber || order.orderNo || "DO-XXX",
                     deliveryPurpose: order.orderPurpose || "—",
                     customerType: order.customerType || "—",
                     orderType: order.orderType || "—",
                     soNo: order.soNumber || "—",
                     partySoDate: order.soDate || "—",
                     customerName: order.customerName || "—",
                     itemConfirm: order.itemConfirm || "—",
                     productName: prodNames,
                     uom: uoms,
                     orderQty: qtys,
                     altUom: altUoms,
                     altQty: altQtys,
                     oilType: oilTypes,
                     ratePerLtr: ratesLtr,
                     ratePer15Kg: rates15Kg,
                     rateOfMaterial: order.rateMaterial || "—",
                     totalWithGst: order.totalWithGst || "—",
                     transportType: order.dispatchData?.transportType || "—",
                     uploadSo: "so_document.pdf",
                     contactPerson: order.contactPerson || "—",
                     whatsapp: order.whatsappNo || "—",
                     address: order.customerAddress || "—",
                     paymentTerms: order.paymentTerms || "—",
                     advanceTaken: order.advancePaymentTaken || "—",
                     advanceAmount: order.advanceAmount || "—",
                     isBroker: order.isBrokerOrder || "—",
                     brokerName: order.brokerName || "—",
                     deliveryDate: order.deliveryDate || "—",
                     qtyToDispatch: order.dispatchData?.qtyToDispatch || "—",
                     deliveryFrom: order.deliveryData?.deliveryFrom || "—",
                     status: "Pending Invoice", // Special handling for badge
                   }

                   return (
                   <TableRow key={index}>
                     <TableCell>
                       <Dialog>
                         <DialogTrigger asChild>
                           <Button size="sm">Create Invoice</Button>
                         </DialogTrigger>
                         <DialogContent className="max-w-lg">
                           <DialogHeader>
                             <DialogTitle>Make Invoice: {order.orderNo}</DialogTitle>
                           </DialogHeader>
                           <div className="space-y-4 py-4">
                             
                             <div className="space-y-2">
                                 <Label>Build Type</Label>
                                 <Select value={invoiceType} onValueChange={(val: any) => setInvoiceType(val)}>
                                   <SelectTrigger>
                                     <SelectValue placeholder="Select Type" />
                                   </SelectTrigger>
                                   <SelectContent>
                                     <SelectItem value="independent">Independent</SelectItem>
                                     <SelectItem value="common">Common</SelectItem>
                                   </SelectContent>
                                 </Select>
                             </div>

                             {invoiceType === "independent" && (
                               <div className="space-y-2">
                                   <Label>Invoice Date</Label>
                                   <Input 
                                       type="date" 
                                       value={invoiceData.invoiceDate} 
                                       onChange={(e) => setInvoiceData({...invoiceData, invoiceDate: e.target.value})} 
                                   />
                               </div>
                             )}

                             <div className="space-y-2">
                               <Label>Invoice Number</Label>
                               <Input
                                 value={invoiceData.invoiceNo}
                                 onChange={(e) => setInvoiceData({ ...invoiceData, invoiceNo: e.target.value })}
                                 placeholder="Enter invoice number"
                               />
                             </div>
                             
                             <div className="space-y-2">
                               <Label>Qty</Label>
                               <Input
                                 type="number"
                                 value={invoiceData.qty}
                                 onChange={(e) => setInvoiceData({ ...invoiceData, qty: e.target.value })}
                                 placeholder="Enter Quantity"
                               />
                             </div>

                             {invoiceType === "independent" && (
                               <div className="space-y-2">
                                   <Label>Bill Amount</Label>
                                   <Input
                                       type="number" 
                                       value={invoiceData.billAmount} 
                                       onChange={(e) => setInvoiceData({...invoiceData, billAmount: e.target.value})} 
                                       placeholder="Enter Bill Amount"
                                   />
                               </div>
                             )}

                             <div className="space-y-2">
                               <Label>Upload Invoice</Label>
                               <div className="border-2 border-dashed rounded-lg p-6 text-center">
                                 <Input
                                   type="file"
                                   accept=".pdf,.jpg,.png"
                                   onChange={(e) => {
                                     if (e.target.files?.[0]) {
                                       setInvoiceData({ ...invoiceData, invoiceFile: e.target.files[0] })
                                     }
                                   }}
                                   className="hidden"
                                   id="invoice-upload"
                                 />
                                 <label htmlFor="invoice-upload" className="cursor-pointer">
                                   <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                                   <p className="text-sm text-muted-foreground">
                                     {invoiceData.invoiceFile ? invoiceData.invoiceFile.name : "Click to upload invoice"}
                                   </p>
                                 </label>
                               </div>
                             </div>
                           </div>
                           <DialogFooter>
                             <Button
                               onClick={() => handleSubmit(order)}
                               disabled={!invoiceData.invoiceNo || !invoiceType || isProcessing}
                             >
                               {isProcessing ? "Processing..." : "Submit Invoice"}
                             </Button>
                           </DialogFooter>
                         </DialogContent>
                       </Dialog>
                     </TableCell>
                     {ALL_COLUMNS.filter((col) => visibleColumns.includes(col.id)).map((col) => (
                        <TableCell key={col.id} className="whitespace-nowrap text-center">
                          {col.id === "status" ? (
                             <div className="flex justify-center">
                                <Badge className="bg-cyan-100 text-cyan-700">Pending Invoice</Badge>
                             </div>
                          ) : row[col.id as keyof typeof row]}
                        </TableCell>
                      ))}
                   </TableRow>
                   )
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={visibleColumns.length + 1} className="text-center py-8 text-muted-foreground">
                    No orders pending for invoice creation
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </WorkflowStageShell>
  )
}
