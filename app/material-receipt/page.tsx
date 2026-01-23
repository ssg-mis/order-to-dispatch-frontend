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
                   }

                   return (
                   <TableRow key={index}>
                     <TableCell className="text-center">
                       <Dialog>
                         <DialogTrigger asChild>
                           <Button size="sm">Confirm Receipt</Button>
                         </DialogTrigger>
                         <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                           <DialogHeader>
                             <DialogTitle>Material Receipt: {row.doNumber}</DialogTitle>
                           </DialogHeader>
                           <div className="space-y-4 py-4">
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
                           </div>
                           <DialogFooter>
                             <Button
                               onClick={() => handleSubmit(order)}
                               disabled={!receiptData.receivedDate || isProcessing}
                               variant={receiptData.hasDamage === "yes" ? "destructive" : "default"}
                             >
                               {isProcessing ? "Processing..." : "Confirm Receipt"}
                             </Button>
                           </DialogFooter>
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