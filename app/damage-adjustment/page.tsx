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
import { Upload, Settings2 } from "lucide-react"
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ALL_WORKFLOW_COLUMNS as ALL_COLUMNS } from "@/lib/workflow-columns"
import { damageAdjustmentApi } from "@/lib/api-service"

export default function DamageAdjustmentPage() {
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
  const [adjustmentData, setAdjustmentData] = useState({
    creditNoteDate: "",
    creditNoteNo: "",
    creditNoteQty: "",
    creditNoteAmount: "",
    netBalance: "",
    creditNoteCopy: null as File | null,
    remarks: "",
  })

  // Fetch Pending
  const fetchPending = async () => {
    try {
      const response = await damageAdjustmentApi.getPending({ limit: 1000 });
      if (response.success && response.data.orders) {
        setPendingOrders(response.data.orders);
      }
    } catch (error) {
      console.error("Failed to fetch pending damage adjustments:", error);
    }
  }

  // Fetch History
  const fetchHistory = async () => {
    try {
        const response = await damageAdjustmentApi.getHistory({ limit: 1000 });
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
        credit_note_date: adjustmentData.creditNoteDate,
        credit_note_no: adjustmentData.creditNoteNo,
        credit_note_qty: adjustmentData.creditNoteQty,
        credit_note_amount: adjustmentData.creditNoteAmount,
        net_banalce: adjustmentData.netBalance,
        credit_note_copy: adjustmentData.creditNoteCopy ? adjustmentData.creditNoteCopy.name : null,
        status_2: "Closed",
        remarks_3: adjustmentData.remarks || null // Using remarks_3 for consistency if needed, though status_2 is main
      };

      const response = await damageAdjustmentApi.submit(order.id, submitData);

      if (response.success) {
        toast({
          title: "Adjustment Processed",
          description: "Order workflow completed successfully!",
        })
        
        await fetchPending();
        await fetchHistory();
        
        // Reset form
        setAdjustmentData({
            creditNoteDate: "",
            creditNoteNo: "",
            creditNoteQty: "",
            creditNoteAmount: "",
            netBalance: "",
            creditNoteCopy: null,
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

  // Filter logic...
  const filteredPendingOrders = pendingOrders.filter(order => {
      let matches = true
      // Party Name
      if (filterValues.partyName && filterValues.partyName !== "all" && order.party_name !== filterValues.partyName) matches = false

      // Date Range
      const orderDateStr = order.timestamp || order.actual_9
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
      title="Stage 13: Damage Adjustment"
      description="Process credit notes and adjustments for damaged goods."
      pendingCount={filteredPendingOrders.length}
      historyData={historyOrders.map((order) => ({
        date: order.actual_9 ? new Date(order.actual_9).toLocaleDateString("en-GB") : "-",
        stage: "Damage Adjustment",
        status: order.status_2 || "Closed",
        remarks: order.credit_note_no ? `CN: ${order.credit_note_no}` : "Adjusted",
      }))}
      partyNames={customerNames}
      onFilterChange={setFilterValues}
      remarksColName="Adjustment"
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
                       status: "Pending Adjustment",
                       invoiceNo: order.invoice_no || "—",
                       invoiceDate: order.invoice_date || "—",
                       billAmount: order.bill_amount || "—",
                   }

                   return (
                   <TableRow key={index}>
                     <TableCell className="text-center">
                       <Dialog>
                         <DialogTrigger asChild>
                           <Button size="sm">Process Adjustment</Button>
                         </DialogTrigger>
                         <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                           <DialogHeader>
                             <DialogTitle>Damage Adjustment: {row.doNumber}</DialogTitle>
                           </DialogHeader>
                           <div className="space-y-4 py-4">
                             <div className="bg-red-50 p-4 rounded-md text-sm text-red-800 mb-4">
                               <p className="font-medium">Reported Damage:</p>
                               <p>SKU: {order.sku || "N/A"}</p>
                               <p>Qty: {order.damage_qty || "N/A"}</p>
                               <p>Status: {order.damage_status || "Damaged"}</p>
                             </div>

                             <div className="grid grid-cols-2 gap-4">
                               <div className="space-y-2">
                                 <Label>Credit Note Date</Label>
                                 <Input
                                   type="date"
                                   value={adjustmentData.creditNoteDate}
                                   onChange={(e) => setAdjustmentData({ ...adjustmentData, creditNoteDate: e.target.value })}
                                 />
                               </div>
                               <div className="space-y-2">
                                 <Label>Credit Note No</Label>
                                 <Input
                                   value={adjustmentData.creditNoteNo}
                                   onChange={(e) => setAdjustmentData({ ...adjustmentData, creditNoteNo: e.target.value })}
                                   placeholder="CN-XXX"
                                 />
                               </div>
                             </div>

                             <div className="grid grid-cols-2 gap-4">
                               <div className="space-y-2">
                                 <Label>Credit Note Qty</Label>
                                 <Input
                                   type="number"
                                   value={adjustmentData.creditNoteQty}
                                   onChange={(e) => setAdjustmentData({ ...adjustmentData, creditNoteQty: e.target.value })}
                                   placeholder="0.00"
                                 />
                               </div>
                               <div className="space-y-2">
                                 <Label>Credit Note Amount</Label>
                                 <Input
                                   type="number"
                                   value={adjustmentData.creditNoteAmount}
                                   onChange={(e) => setAdjustmentData({ ...adjustmentData, creditNoteAmount: e.target.value })}
                                   placeholder="₹ 0.00"
                                 />
                               </div>
                             </div>

                             <div className="space-y-2">
                               <Label>Net Balance</Label>
                               <Input
                                 type="number"
                                 value={adjustmentData.netBalance}
                                 onChange={(e) => setAdjustmentData({ ...adjustmentData, netBalance: e.target.value })}
                                 placeholder="₹ 0.00"
                               />
                             </div>

                             <div className="space-y-2">
                               <Label>Credit Note Copy</Label>
                               <div className="border-2 border-dashed rounded-lg p-4 text-center">
                                   <Input
                                     type="file"
                                     accept="application/pdf,image/*"
                                     onChange={(e) => {
                                       if (e.target.files?.[0]) {
                                         setAdjustmentData({ ...adjustmentData, creditNoteCopy: e.target.files[0] })
                                       }
                                     }}
                                     className="hidden"
                                     id="cn-upload"
                                   />
                                   <label htmlFor="cn-upload" className="cursor-pointer">
                                       <Upload className="h-6 w-6 mx-auto mb-1 text-muted-foreground" />
                                       <span className="text-xs text-muted-foreground">
                                           {adjustmentData.creditNoteCopy ? adjustmentData.creditNoteCopy.name : "Upload Copy"}
                                       </span>
                                   </label>
                               </div>
                             </div>

                             <div className="space-y-2">
                               <Label>Remarks</Label>
                               <Textarea
                                 value={adjustmentData.remarks}
                                 onChange={(e) => setAdjustmentData({ ...adjustmentData, remarks: e.target.value })}
                                 placeholder="Enter remarks"
                               />
                             </div>
                           </div>
                           <DialogFooter>
                             <Button
                               onClick={() => handleSubmit(order)}
                               disabled={!adjustmentData.creditNoteDate || isProcessing}
                             >
                               {isProcessing ? "Processing..." : "Complete Order"}
                             </Button>
                           </DialogFooter>
                         </DialogContent>
                       </Dialog>
                     </TableCell>
                     {ALL_COLUMNS.filter((col) => visibleColumns.includes(col.id)).map((col) => (
                        <TableCell key={col.id} className="whitespace-nowrap text-center">
                          {col.id === "status" ? (
                             <div className="flex justify-center">
                                <Badge variant="destructive">Pending Adjustment</Badge>
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
                    No orders pending for damage adjustment
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
