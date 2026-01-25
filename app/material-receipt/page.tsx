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
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Upload, Settings2 } from "lucide-react"
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ALL_WORKFLOW_COLUMNS as ALL_COLUMNS } from "@/lib/workflow-columns"
import { confirmMaterialReceiptApi } from "@/lib/api-service"

export default function MaterialReceiptPage() {
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
  const [receiptData, setReceiptData] = useState({
    receivedDate: "",
    hasDamage: "no",
    damageSku: "",
    damageQty: "",
    damageImage: null as File | null,
    receivedProof: null as File | null,
    remarks: "",
  })

  // Fetch Pending
  const fetchPending = async () => {
    try {
      const response = await confirmMaterialReceiptApi.getPending({ limit: 1000 });
      if (response.success && response.data.orders) {
        setPendingOrders(response.data.orders);
      }
    } catch (error) {
      console.error("Failed to fetch pending material receipts:", error);
    }
  }

  // Fetch History
  const fetchHistory = async () => {
    try {
        const response = await confirmMaterialReceiptApi.getHistory({ limit: 1000 });
        if (response.success && response.data.orders) {
          setHistoryOrders(response.data.orders);
        }
    } catch (error) {
        console.error("Failed to fetch history:", error);
    }
  }

  useEffect(() => {
    fetchPending();
    fetchHistory();
  }, [])

  const handleSubmit = async (order: any) => {
    setIsProcessing(true)
    try {
      const submitData = {
        material_received_date: receiptData.receivedDate,
        damage_status: receiptData.hasDamage === "yes" ? "Damaged" : "Delivered",
        received_image_proof: receiptData.receivedProof ? receiptData.receivedProof.name : null,
        sku: receiptData.hasDamage === "yes" ? receiptData.damageSku : null,
        damage_qty: receiptData.hasDamage === "yes" ? receiptData.damageQty : null,
        damage_image: (receiptData.hasDamage === "yes" && receiptData.damageImage) ? receiptData.damageImage.name : null,
        remarks_3: receiptData.remarks || null
      };

      const response = await confirmMaterialReceiptApi.submit(order.id, submitData);

      if (response.success) {
        if (receiptData.hasDamage === "yes") {
            toast({
              title: "Material Received with Damage",
              description: "Order moved to Damage Adjustment stage.",
              variant: "destructive",
            })
            // setTimeout(() => router.push("/damage-adjustment"), 1500)
          } else {
            toast({
              title: "Material Received",
              description: "Order completed successfully!",
            })
            // setTimeout(() => router.push("/"), 1500)
          }
        
        await fetchPending();
        await fetchHistory();
        
        // Reset form
        setReceiptData({
            receivedDate: "",
            hasDamage: "no",
            damageSku: "",
            damageQty: "",
            damageImage: null,
            receivedProof: null,
            remarks: "",
        });

      } else {
         throw new Error(response.message || "Failed to submit");
      }

    } catch (error: any) {
      console.error("Submit error:", error);
      toast({
        title: "Error",
        description: error.message || "Something went wrong",
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

  const filteredPendingOrders = pendingOrders.filter(order => {
      let matches = true
      
      // Filter by Party Name
      if (filterValues.partyName && filterValues.partyName !== "all" && order.party_name !== filterValues.partyName) {
          matches = false
      }

      // Filter by Date Range
      const orderDateStr = order.timestamp || order.actual_8
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
      title="Stage 12: Confirm Material Receipt"
      description="Confirm material receipt and report any damages."
      pendingCount={filteredPendingOrders.length}
      historyData={historyOrders.map((order) => ({
        date: order.actual_8 ? new Date(order.actual_8).toLocaleDateString("en-GB") : "-",
        stage: "Material Receipt",
        status: order.damage_status || "Completed",
        remarks: order.damage_status === "Damaged" ? `Damaged: ${order.damage_qty}` : "Received OK",
      }))}
      partyNames={customerNames}
      onFilterChange={setFilterValues}
      remarksColName="Condition"
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
                   const row: any = {
                       orderNo: order.so_no || "—",
                       doNumber: order.d_sr_number || "—",
                       customerName: order.party_name || "—",
                       productName: order.product_name || "—",
                       qtyToDispatch: order.qty_to_be_dispatched || "—",
                       deliveryFrom: order.dispatch_from || "—",
                       transportType: order.type_of_transporting || "—",
                       status: "In Transit",
                       
                       invoiceNo: order.invoice_no || "—",
                       invoiceDate: order.invoice_date || "—",
                       billAmount: order.bill_amount || "—",

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
                     <TableCell className="text-center">
                       <Dialog>
                         <DialogTrigger asChild>
                           <Button size="sm">Confirm Receipt</Button>
                         </DialogTrigger>
                         <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                           <DialogHeader>
                             <DialogTitle>Material Receipt: {row.doNumber}</DialogTitle>
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

                                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                                      <h4 className="font-bold text-slate-700 mb-2 border-b border-slate-200 pb-1">Invoice Details</h4>
                                      <div className="grid grid-cols-2 gap-2">
                                          <div><span className="text-slate-500 text-xs">Invoice No:</span> <span className="font-medium text-slate-800">{row.invoiceNo}</span></div>
                                          <div><span className="text-slate-500 text-xs">Bill Amount:</span> <span className="font-medium text-slate-800">{row.billAmount}</span></div>
                                          <div className="col-span-2"><span className="text-slate-500 text-xs">Invoice Date:</span> <span className="font-medium text-slate-800">{row.invoiceDate}</span></div>
                                      </div>
                                  </div>
                              </div>

                              {/* Right Column: Receipt Form */}
                              <div className="space-y-4 border-l pl-6 border-slate-100">
                                 <h3 className="font-bold text-lg text-slate-900">Confirm Receipt</h3>

                                 <div className="space-y-4 py-2">
                                     <div className="space-y-2">
                                       <Label>Material Received Date</Label>
                                       <Input
                                         type="date"
                                         value={receiptData.receivedDate}
                                         onChange={(e) => setReceiptData({ ...receiptData, receivedDate: e.target.value })}
                                       />
                                     </div>
                                     <div className="space-y-2">
                                       <Label>Damage Status</Label>
                                       <RadioGroup
                                         value={receiptData.hasDamage}
                                         onValueChange={(value) => setReceiptData({ ...receiptData, hasDamage: value })}
                                         className="flex gap-4"
                                       >
                                         <div className="flex items-center space-x-2">
                                           <RadioGroupItem value="no" id="no-damage" />
                                           <Label htmlFor="no-damage" className="text-green-600 cursor-pointer">No</Label>
                                         </div>
                                         <div className="flex items-center space-x-2">
                                           <RadioGroupItem value="yes" id="yes-damage" />
                                           <Label htmlFor="yes-damage" className="text-red-600 cursor-pointer">Yes</Label>
                                         </div>
                                       </RadioGroup>
                                     </div>
        
                                     {receiptData.hasDamage === "yes" && (
                                       <>
                                         <div className="grid grid-cols-2 gap-4">
                                           <div className="space-y-2">
                                             <Label>SKU</Label>
                                             <Input
                                               value={receiptData.damageSku}
                                               onChange={(e) => setReceiptData({ ...receiptData, damageSku: e.target.value })}
                                               placeholder="Enter SKU"
                                             />
                                           </div>
                                           <div className="space-y-2">
                                             <Label>Damage QTY</Label>
                                             <Input
                                               type="number"
                                               value={receiptData.damageQty}
                                               onChange={(e) => setReceiptData({ ...receiptData, damageQty: e.target.value })}
                                               placeholder="Enter qty"
                                             />
                                           </div>
                                         </div>
                                         <div className="space-y-2">
                                           <Label>Damage Image</Label>
                                           <div className="border-2 border-dashed rounded-lg p-4 text-center">
                                               <Input
                                                 type="file"
                                                 accept="image/*"
                                                 onChange={(e) => {
                                                   if (e.target.files?.[0]) {
                                                     setReceiptData({ ...receiptData, damageImage: e.target.files[0] })
                                                   }
                                                 }}
                                                 className="hidden"
                                                 id="damage-upload"
                                               />
                                               <label htmlFor="damage-upload" className="cursor-pointer">
                                                   <Upload className="h-6 w-6 mx-auto mb-1 text-muted-foreground" />
                                                   <span className="text-xs text-muted-foreground">
                                                       {receiptData.damageImage ? receiptData.damageImage.name : "Upload Damage Image"}
                                                   </span>
                                               </label>
                                           </div>
                                         </div>
                                       </>
                                     )}
        
                                     <div className="space-y-2">
                                       <Label>Received Image (Proof)</Label>
                                       <div className="border-2 border-dashed rounded-lg p-4 text-center">
                                           <Input
                                             type="file"
                                             accept="image/*,.pdf"
                                             onChange={(e) => {
                                               if (e.target.files?.[0]) {
                                                 setReceiptData({ ...receiptData, receivedProof: e.target.files[0] })
                                               }
                                             }}
                                             className="hidden"
                                             id="proof-upload"
                                           />
                                           <label htmlFor="proof-upload" className="cursor-pointer">
                                               <Upload className="h-6 w-6 mx-auto mb-1 text-muted-foreground" />
                                               <span className="text-xs text-muted-foreground">
                                                   {receiptData.receivedProof ? receiptData.receivedProof.name : "Upload Proof"}
                                               </span>
                                           </label>
                                       </div>
                                     </div>
        
                                     <div className="space-y-2">
                                       <Label>Remarks</Label>
                                       <Textarea
                                         value={receiptData.remarks}
                                         onChange={(e) => setReceiptData({ ...receiptData, remarks: e.target.value })}
                                         placeholder="Enter remarks"
                                       />
                                     </div>
                                 
                                     <div className="pt-4">
                                         <Button
                                           onClick={() => handleSubmit(order)}
                                           disabled={!receiptData.receivedDate || isProcessing}
                                           className="w-full"
                                           variant={receiptData.hasDamage === "yes" ? "destructive" : "default"}
                                         >
                                           {isProcessing ? "Processing..." : "Confirm Receipt"}
                                         </Button>
                                     </div>
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
                                <Badge className="bg-sky-100 text-sky-700">In Transit</Badge>
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
                    No orders pending for receipt confirmation
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