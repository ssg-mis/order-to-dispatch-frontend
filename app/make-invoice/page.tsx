"use client"

import { useEffect, useState, useMemo } from "react"
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
import { makeInvoiceApi } from "@/lib/api-service"

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

  // Fetch pending invoices
  const fetchPendingInvoices = async () => {
    try {
      const response = await makeInvoiceApi.getPending({ limit: 1000 });
      if (response.success && response.data.invoices) {
        setPendingOrders(response.data.invoices);
      }
    } catch (error: any) {
      console.error("Failed to fetch pending invoices:", error);
      toast({
        title: "Error",
        description: "Failed to load pending invoices",
        variant: "destructive",
      });
    }
  };

  // Fetch history
  const fetchInvoiceHistory = async () => {
    try {
      const response = await makeInvoiceApi.getHistory({ limit: 1000 });
      if (response.success && response.data.invoices) {
        setHistoryOrders(response.data.invoices);
      }
    } catch (error: any) {
      console.error("Failed to fetch invoice history:", error);
    }
  };

  useEffect(() => {
    fetchPendingInvoices();
    fetchInvoiceHistory();
  }, [])

  const handleSubmit = async (order: any) => {
    setIsProcessing(true)
    try {
      const submitData = {
        bill_type: invoiceType,
        invoice_no: invoiceData.invoiceNo,
        invoice_date: invoiceType === 'independent' ? invoiceData.invoiceDate : null,
        qty: invoiceData.qty || null,
        bill_amount: invoiceType === 'independent' ? invoiceData.billAmount : null,
        invoice_copy: invoiceData.invoiceFile ? invoiceData.invoiceFile.name : null,
      };

      const response = await makeInvoiceApi.submit(order.id, submitData);

      if (response.success) {
        toast({
          title: "Invoice Created",
          description: "Order moved to Check Invoice stage.",
        })

        // Refresh lists
        await fetchPendingInvoices();
        await fetchInvoiceHistory();

        // Close dialog implicitly by re-fetching
        // Reset form
        setInvoiceData({
            invoiceNo: "",
            invoiceDate: new Date().toISOString().split('T')[0],
            qty: "",
            billAmount: "",
            invoiceFile: null,
        });
        setInvoiceType("");

        setTimeout(() => {
          router.push("/check-invoice")
        }, 1500)
      } else {
        throw new Error(response.message || "Submission failed");
      }
    } catch (error: any) {
      console.error("Submit error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to submit invoice",
        variant: "destructive",
      })
    } finally {
      setIsProcessing(false)
    }
  }

  /* Extract unique customer names */
  const customerNames = Array.from(new Set(pendingOrders.map(order => order.party_name || "Unknown")))

  const [filterValues, setFilterValues] = useState({
      status: "",
      startDate: "",
      endDate: "",
      partyName: ""
  })

  // Filter logic
  const filteredPendingOrders = pendingOrders.filter(order => {
      let matches = true
      
      // Filter by Party Name
      if (filterValues.partyName && filterValues.partyName !== "all" && order.party_name !== filterValues.partyName) {
          matches = false
      }

      // Filter by Date Range
      const orderDateStr = order.timestamp
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

      return matches
  })

  return (
    <WorkflowStageShell
      title="Stage 9: Make Invoice (Proforma)"
      description="Create proforma invoice for the order."
      pendingCount={filteredPendingOrders.length}
      historyData={historyOrders.map((order) => ({
        date: order.actual_5 ? new Date(order.actual_5).toLocaleDateString("en-GB") : "-",
        stage: "Make Invoice",
        status: "Completed",
        remarks: order.invoice_no || "Generated",
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
                   // Map backend data to display row
                   const row: any = {
                     orderNo: order.so_no || "—",
                     doNumber: order.d_sr_number || "—",
                     customerName: order.party_name || "—",
                     productName: order.product_name || "—",
                     qtyToDispatch: order.qty_to_be_dispatched || "—",
                     deliveryFrom: order.dispatch_from || "—",
                     transportType: order.type_of_transporting || "—",
                     status: "Pending Invoice",
                     // Detailed fields
                     productName1: order.product_name_1,
                     actualQtyDispatch: order.actual_qty_dispatch,
                     checkStatus: order.check_status,
                     remarks: order.remarks,
                     fitness: order.fitness,
                     insurance: order.insurance,
                     taxCopy: order.tax_copy,
                     polution: order.polution,
                     permit1: order.permit1,
                     permit2: order.permit2_out_state,
                     actualQty: order.actual_qty,
                     weightmentSlip: order.weightment_slip_copy,
                     rstNo: order.rst_no,
                     transporterName: order.transporter_name,
                     reasonDiff: order.reason_of_difference_in_weight_if_any_speacefic,
                     truckNo: order.truck_no,
                     vehicleImage: order.vehicle_no_plate_image,
                     biltyNo: order.bilty_no,
                     grossWeight: order.gross_weight,
                     tareWeight: order.tare_weight,
                     netWeight: order.net_weight,
                   }

                   return (
                   <TableRow key={index}>
                     <TableCell>
                       <Dialog>
                         <DialogTrigger asChild>
                           <Button size="sm">Create Invoice</Button>
                         </DialogTrigger>
                         <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                           <DialogHeader>
                             <DialogTitle>Make Invoice: {row.doNumber}</DialogTitle>
                           </DialogHeader>
                           
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
                              {/* Left Column: Read-Only Details */}
                              <div className="space-y-4 text-sm">
                                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                                      <h4 className="font-bold text-slate-700 mb-2 border-b border-slate-200 pb-1">Order Details</h4>
                                      <div className="grid grid-cols-2 gap-2">
                                          <div><span className="text-slate-500 text-xs">SO No:</span> <span className="font-medium text-slate-800">{row.orderNo}</span></div>
                                          <div><span className="text-slate-500 text-xs">Customer:</span> <span className="font-medium text-slate-800">{row.customerName}</span></div>
                                          <div><span className="text-slate-500 text-xs">Product:</span> <span className="font-medium text-slate-800">{row.productName}</span></div>
                                          <div><span className="text-slate-500 text-xs">Qty To Dispatch:</span> <span className="font-medium text-slate-800">{row.qtyToDispatch}</span></div>
                                      </div>
                                  </div>

                                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                                      <h4 className="font-bold text-slate-700 mb-2 border-b border-slate-200 pb-1">Vehicle & Transport</h4>
                                      <div className="grid grid-cols-2 gap-2">
                                          <div><span className="text-slate-500 text-xs">Truck No:</span> <span className="font-medium text-slate-800">{row.truckNo || "-"}</span></div>
                                          <div><span className="text-slate-500 text-xs">Transporter:</span> <span className="font-medium text-slate-800">{row.transporterName || "-"}</span></div>
                                          <div><span className="text-slate-500 text-xs">Transport Type:</span> <span className="font-medium text-slate-800">{row.transportType}</span></div>
                                          <div><span className="text-slate-500 text-xs">RST No:</span> <span className="font-medium text-slate-800">{row.rstNo || "-"}</span></div>
                                          <div><span className="text-slate-500 text-xs">Driver Status:</span> <span className="font-medium text-slate-800">{row.checkStatus || "-"}</span></div>
                                          <div className="col-span-2"><span className="text-slate-500 text-xs">Remarks:</span> <span className="font-medium text-slate-800">{row.remarks || "-"}</span></div>
                                      </div>
                                  </div>

                                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                                      <h4 className="font-bold text-slate-700 mb-2 border-b border-slate-200 pb-1">Dispatch & Weights</h4>
                                      <div className="grid grid-cols-2 gap-2">
                                          <div><span className="text-slate-500 text-xs">Actual Qty:</span> <span className="font-medium text-slate-800">{row.actualQty || "-"}</span></div>
                                          <div><span className="text-slate-500 text-xs">Bilty No:</span> <span className="font-medium text-slate-800">{row.biltyNo || "-"}</span></div>
                                          <div><span className="text-slate-500 text-xs">Gross Wt:</span> <span className="font-medium text-slate-800">{row.grossWeight || "-"}</span></div>
                                          <div><span className="text-slate-500 text-xs">Tare Wt:</span> <span className="font-medium text-slate-800">{row.tareWeight || "-"}</span></div>
                                          <div><span className="text-slate-500 text-xs">Net Wt:</span> <span className="font-medium text-blue-600">{row.netWeight || "-"}</span></div>
                                          {row.reasonDiff && (
                                              <div className="col-span-2 bg-amber-50 p-1 rounded border border-amber-100 mt-1">
                                                  <span className="text-xs text-amber-600 font-bold">Diff Reason:</span> <span className="text-xs text-amber-800">{row.reasonDiff}</span>
                                              </div>
                                          )}
                                      </div>
                                  </div>
                                  

                              </div>

                              {/* Right Column: Invoice Form */}
                              <div className="space-y-4 border-l pl-6 border-slate-100">
                                 <h3 className="font-bold text-lg text-slate-900">Generate Invoice</h3>
                                 
                                 <div className="space-y-2">
                                     <Label>Bill Type</Label>
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
                                           onChange={(e) => setInvoiceData({...invoiceData, billAmount: e.target.value })} 
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

                                 <div className="pt-4">
                                   <Button
                                     onClick={() => handleSubmit(order)}
                                     disabled={!invoiceData.invoiceNo || !invoiceType || isProcessing}
                                     className="w-full bg-blue-600 hover:bg-blue-700"
                                   >
                                     {isProcessing ? "Processing..." : "Submit Invoice"}
                                   </Button>
                                 </div>
                              </div>
                           </div>
                         </DialogContent>
                       </Dialog>
                     </TableCell>
                     {ALL_COLUMNS.filter((col) => visibleColumns.includes(col.id)).map((col) => (
                        <TableCell key={col.id} className="whitespace-nowrap text-center">
                          {col.id === "status" ? (
                             <div className="flex justify-center">
                                <Badge className="bg-cyan-100 text-cyan-700">Pending Invoice</Badge>
                             </div>
                          ) : row[col.id as keyof typeof row] || "—"}
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