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
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Settings2 } from "lucide-react"
import { ALL_WORKFLOW_COLUMNS as ALL_COLUMNS } from "@/lib/workflow-columns"
import { checkInvoiceApi } from "@/lib/api-service"

export default function CheckInvoicePage() {
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
  const [checkData, setCheckData] = useState({
    status: "",
    remarks: "",
  })

  // Fetch Pending
  const fetchPending = async () => {
    try {
      const response = await checkInvoiceApi.getPending({ limit: 1000 });
      if (response.success && response.data.invoices) {
        setPendingOrders(response.data.invoices);
      }
    } catch (error) {
      console.error("Failed to fetch pending invoices:", error);
    }
  }

  // Fetch History
  const fetchHistory = async () => {
    try {
        const response = await checkInvoiceApi.getHistory({ limit: 1000 });
        if (response.success && response.data.invoices) {
          setHistoryOrders(response.data.invoices);
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
        status_1: checkData.status,
        remarks_2: checkData.remarks,
      };

      const response = await checkInvoiceApi.submit(order.id, submitData);

      if (response.success) {
        toast({
            title: "Invoice Verified",
            description: "Invoice has been checked and verified.",
        })
        
        await fetchPending();
        await fetchHistory();
        
        // Reset form
        setCheckData({ status: "", remarks: "" });

        // If you want to navigate away, un-comment this:
        // setTimeout(() => {
        //   router.push("/gate-out")
        // }, 1500)
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
      // using timestamp or planned_6 date
      const orderDateStr = order.timestamp || order.planned_6
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
      title="Stage 10: Check Invoice"
      description="Review and verify invoice details."
      pendingCount={filteredPendingOrders.length}
      historyData={historyOrders.map((order) => ({
        date: order.actual_6 ? new Date(order.actual_6).toLocaleDateString("en-GB") : "-",
        stage: "Check Invoice",
        status: order.status_1 || "Verified",
        remarks: order.remarks_2 || "-",
      }))}
      partyNames={customerNames}
      onFilterChange={setFilterValues}
      remarksColName="Verification Status"
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
                       status: "Pending Review",
                       // invoice specific fields
                       invoiceNo: order.invoice_no || "—",
                       invoiceDate: order.invoice_date || "—",
                       billAmount: order.bill_amount || "—",
                       
                       // extra fields if needed
                       customerAddress: order.customer_address || "—",
                       paymentTerms: order.payment_terms || "—",
                   }

                   return (
                   <TableRow key={index}>
                     <TableCell>
                       <Dialog>
                         <DialogTrigger asChild>
                           <Button size="sm">Verify Invoice</Button>
                         </DialogTrigger>
                         <DialogContent className="max-w-lg">
                           <DialogHeader>
                             <DialogTitle>Verify Invoice: {row.doNumber}</DialogTitle>
                           </DialogHeader>
                           <div className="space-y-4 py-4">
                             <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span className="font-semibold">Invoice No:</span> {row.invoiceNo}
                                </div>
                                <div>
                                    <span className="font-semibold">Invoice Date:</span> {row.invoiceDate}
                                </div>
                                <div>
                                    <span className="font-semibold">Bill Amount:</span> {row.billAmount}
                                </div>
                             </div>

                             <div className="space-y-2">
                               <Label>Verification Status</Label>
                               <Input
                                 value={checkData.status}
                                 onChange={(e) => setCheckData({ ...checkData, status: e.target.value })}
                                 placeholder="e.g. Verified, Issues Found"
                               />
                             </div>
                             <div className="space-y-2">
                               <Label>Remarks</Label>
                               <Textarea
                                 value={checkData.remarks}
                                 onChange={(e) => setCheckData({ ...checkData, remarks: e.target.value })}
                                 placeholder="Enter verification remarks..."
                               />
                             </div>
                           </div>
                           <DialogFooter>
                             <Button
                               onClick={() => handleSubmit(order)}
                               disabled={!checkData.status || isProcessing}
                             >
                               {isProcessing ? "Processing..." : "Submit Verification"}
                             </Button>
                           </DialogFooter>
                         </DialogContent>
                       </Dialog>
                     </TableCell>
                     {ALL_COLUMNS.filter((col) => visibleColumns.includes(col.id)).map((col) => (
                        <TableCell key={col.id} className="whitespace-nowrap text-center">
                          {col.id === "status" ? (
                             <div className="flex justify-center">
                                <Badge className="bg-yellow-100 text-yellow-700">Pending Review</Badge>
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
                    No invoices pending for review
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