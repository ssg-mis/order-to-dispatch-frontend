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
import { Upload, Settings2 } from "lucide-react"
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ALL_WORKFLOW_COLUMNS as ALL_COLUMNS } from "@/lib/workflow-columns"
import { gateOutApi } from "@/lib/api-service"

export default function GateOutPage() {
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
  const [gateOutData, setGateOutData] = useState({
    gatePassFile: null as File | null,
    vehicleLoadedImage: null as File | null,
    gateOutTime: "",
  })

  // Fetch Pending
  const fetchPending = async () => {
    try {
      const response = await gateOutApi.getPending({ limit: 1000 });
      if (response.success && response.data.orders) {
        setPendingOrders(response.data.orders);
      }
    } catch (error) {
      console.error("Failed to fetch pending gate out:", error);
    }
  }

  // Fetch History
  const fetchHistory = async () => {
    try {
        const response = await gateOutApi.getHistory({ limit: 1000 });
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
      // In a real app, we would upload files first and get URLs
      // For now, we'll just simulate passing file names if present
      const submitData = {
        gate_pass: gateOutData.gatePassFile ? gateOutData.gatePassFile.name : null,
        vehicle_image: gateOutData.vehicleLoadedImage ? gateOutData.vehicleLoadedImage.name : null,
        // gateOutTime will be set by server timestamp
      };

      const response = await gateOutApi.submit(order.id, submitData);

      if (response.success) {
        toast({
            title: "Gate Out Completed",
            description: "Order moved to Material Receipt stage.",
        })
        
        await fetchPending();
        await fetchHistory();
        
        // Reset form
        setGateOutData({ gatePassFile: null, vehicleLoadedImage: null, gateOutTime: "" });

        // If you want to navigate away, un-comment this:
        // setTimeout(() => {
        //   router.push("/material-receipt")
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
      // using timestamp or actual_6 date
      const orderDateStr = order.timestamp || order.actual_6
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
      title="Stage 11: Gate Out"
      description="Record gate out details and upload gate pass."
      pendingCount={filteredPendingOrders.length}
      historyData={historyOrders.map((order) => ({
        date: order.actual_7 ? new Date(order.actual_7).toLocaleDateString("en-GB") : "-",
        stage: "Gate Out",
        status: "Completed",
        remarks: order.gate_pass_copy ? "Pass Uploaded" : "-",
      }))}
      partyNames={customerNames}
      onFilterChange={setFilterValues}
      remarksColName="Evidence"
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
                       status: "Ready for Gate Out",
                       
                       // invoice fields might be relevant
                       invoiceNo: order.invoice_no || "—",
                       invoiceDate: order.invoice_date || "—",
                       billAmount: order.bill_amount || "—",
                       
                       // driver details
                       vehicleNo: order.truck_no || "—",
                       driverName: "—", // Driver details not available in this stage
                       
                       // vehicle weights
                       grossWeight: order.gross_weight || "—",
                       tareWeight: order.tare_weight || "—",
                       netWeight: order.net_weight || "—",
                   }

                   return (
                   <TableRow key={index}>
                     <TableCell>
                       <Dialog>
                         <DialogTrigger asChild>
                           <Button size="sm">Gate Out</Button>
                         </DialogTrigger>
                         <DialogContent className="max-w-lg">
                           <DialogHeader>
                             <DialogTitle>Gate Out: {row.doNumber}</DialogTitle>
                           </DialogHeader>
                           <div className="space-y-4 py-4">
                             {/*
                             <div className="space-y-2">
                               <Label>Gate Out Time</Label>
                               <Input
                                 type="datetime-local"
                                 value={gateOutData.gateOutTime}
                                 onChange={(e) => setGateOutData({ ...gateOutData, gateOutTime: e.target.value })}
                               />
                             </div>
                             */}
                             <div className="space-y-2">
                               <Label>Upload Gate Pass</Label>
                               <div className="border-2 border-dashed rounded-lg p-6 text-center">
                                 <Input
                                   type="file"
                                   accept="image/*,.pdf"
                                   onChange={(e) => {
                                     if (e.target.files?.[0]) {
                                       setGateOutData({ ...gateOutData, gatePassFile: e.target.files[0] })
                                     }
                                   }}
                                   className="hidden"
                                   id="gatepass-upload"
                                 />
                                 <label htmlFor="gatepass-upload" className="cursor-pointer">
                                   <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                                   <p className="text-sm text-muted-foreground">
                                     {gateOutData.gatePassFile ? gateOutData.gatePassFile.name : "Click to upload gate pass"}
                                   </p>
                                 </label>
                               </div>
                             </div>
                             <div className="space-y-2">
                               <Label>Upload Vehicle Loaded Image</Label>
                               <div className="border-2 border-dashed rounded-lg p-6 text-center">
                                 <Input
                                   type="file"
                                   accept="image/*"
                                   onChange={(e) => {
                                     if (e.target.files?.[0]) {
                                       setGateOutData({ ...gateOutData, vehicleLoadedImage: e.target.files[0] })
                                     }
                                   }}
                                   className="hidden"
                                   id="vehicle-loaded-upload"
                                 />
                                 <label htmlFor="vehicle-loaded-upload" className="cursor-pointer">
                                   <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                                   <p className="text-sm text-muted-foreground">
                                     {gateOutData.vehicleLoadedImage ? gateOutData.vehicleLoadedImage.name : "Click to upload vehicle image"}
                                   </p>
                                 </label>
                               </div>
                             </div>
                           </div>
                           <DialogFooter>
                             <Button onClick={() => handleSubmit(order)} disabled={isProcessing}>
                               {isProcessing ? "Processing..." : "Complete Gate Out"}
                             </Button>
                           </DialogFooter>
                         </DialogContent>
                       </Dialog>
                     </TableCell>
                     {ALL_COLUMNS.filter((col) => visibleColumns.includes(col.id)).map((col) => (
                        <TableCell key={col.id} className="whitespace-nowrap text-center">
                          {col.id === "status" ? (
                             <div className="flex justify-center">
                                <Badge className="bg-rose-100 text-rose-700">Ready for Gate Out</Badge>
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
                    No orders pending for gate out
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