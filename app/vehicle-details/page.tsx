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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Settings2, Truck } from "lucide-react"
import { ALL_WORKFLOW_COLUMNS as ALL_COLUMNS } from "@/lib/workflow-columns"
import { Checkbox } from "@/components/ui/checkbox"
import { vehicleDetailsApi } from "@/lib/api-service"

export default function VehicleDetailsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [pendingOrders, setPendingOrders] = useState<any[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState<string[]>([
    "orderNo",
    "customerName",
    "status",
  ])
  const [vehicleData, setVehicleData] = useState({
    checkStatus: "",
    remarks: "",
    fitness: "",
    insurance: "",
    tax_copy: "",
    polution: "",
    permit1: "",
    permit2_out_state: "",
  })

  const [history, setHistory] = useState<any[]>([])
  const [selectedItems, setSelectedItems] = useState<any[]>([])

  // Fetch pending vehicle details from backend
  const fetchPendingVehicleDetails = async () => {
    try {
      console.log('[VEHICLE] Fetching pending vehicle details from API...');
      const response = await vehicleDetailsApi.getPending({ limit: 1000 });
      console.log('[VEHICLE] API Response:', response);
      
      if (response.success && response.data.vehicleDetails) {
        setPendingOrders(response.data.vehicleDetails);
        console.log('[VEHICLE] Loaded', response.data.vehicleDetails.length, 'pending vehicle details');
      }
    } catch (error: any) {
      console.error("[VEHICLE] Failed to fetch pending vehicle details:", error);
      toast({
        title: "Error",
        description: error?.message || "Failed to load pending vehicle details",
        variant: "destructive",
      });
      setPendingOrders([]); // Clear on error - don't use cache
    }
  };

  // Fetch vehicle details history from backend
  const fetchVehicleDetailsHistory = async () => {
    try {
      const response = await vehicleDetailsApi.getHistory({ limit: 1000 });
      
      if (response.success && response.data.vehicleDetails) {
        const mappedHistory = response.data.vehicleDetails.map((record: any) => ({
          orderNo: record.so_no,
          doNumber: record.d_sr_number,
          customerName: record.party_name,
          stage: "Vehicle Details",
          status: "Completed" as const,
          processedBy: "System",
          timestamp: record.actual_2,
          date: record.actual_2 ? new Date(record.actual_2).toLocaleDateString("en-GB") : "-",
          remarks: record.remarks || "-",
        }));
        setHistory(mappedHistory);
      }
    } catch (error: any) {
      console.error("[VEHICLE] Failed to fetch history:", error);
      setHistory([]); // Clear on error - don't use cache
    }
  };

  useEffect(() => {
    fetchPendingVehicleDetails();
    fetchVehicleDetailsHistory();
  }, []);

  /* Filter logic */
  const [filterValues, setFilterValues] = useState({
      status: "",
      startDate: "",
      endDate: "",
      partyName: ""
  })

  const filteredPendingOrders = pendingOrders.filter(order => {
      let matches = true
      if (filterValues.partyName && filterValues.partyName !== "all" && order.party_name !== filterValues.partyName) matches = false
      const orderDateStr = order.timestamp
      if (orderDateStr) {
          const orderDate = new Date(orderDateStr)
          if (filterValues.startDate && orderDate < new Date(filterValues.startDate)) matches = false
          if (filterValues.endDate && orderDate > new Date(filterValues.endDate)) matches = false
      }
      return matches
  })
  
  // Map backend data to display format
  const displayRows = useMemo(() => {
    return filteredPendingOrders.map((record: any) => ({
      id: record.id, // Keep DB ID for submission
      doNumber: record.d_sr_number,
      orderNo: record.so_no,
      customerName: record.party_name,
      productName: record.product_name,
      qtyToDispatch: record.qty_to_be_dispatched,
      transportType: record.type_of_transporting,
      deliveryFrom: record.dispatch_from,
      timestamp: record.timestamp,
      status: "Awaiting Vehicle",
    }))
  }, [filteredPendingOrders])

  const toggleSelectItem = (item: any) => {
    const key = `${item.id}`
    const isSelected = selectedItems.some(i => i.id === item.id)
    
    if (isSelected) {
      setSelectedItems(prev => prev.filter(i => i.id !== item.id))
    } else {
      setSelectedItems(prev => [...prev, item])
    }
  }

  const toggleSelectAll = () => {
    if (selectedItems.length === displayRows.length) {
      setSelectedItems([])
    } else {
      setSelectedItems([...displayRows])
    }
  }

  const handleAssignVehicle = async () => {
    if (selectedItems.length === 0) return
    setIsProcessing(true)
    try {
      const successfulSubmissions: any[] = []
      const failedSubmissions: any[] = []

      // Submit each item to backend API
      for (const item of selectedItems) {
        const recordId = item.id; // Use the lift_receiving_confirmation table ID
        
        try {
          if (recordId) {
            const submitData = {
              check_status: vehicleData.checkStatus,
              remarks: vehicleData.remarks,
              fitness: vehicleData.fitness || "pending",
              insurance: vehicleData.insurance || "pending",
              tax_copy: vehicleData.tax_copy || "pending",
              polution: vehicleData.polution || "pending",
              permit1: vehicleData.permit1 || "pending",
              permit2_out_state: vehicleData.permit2_out_state || "pending",
            };

            console.log('[VEHICLE] Submitting vehicle details for ID:', recordId, submitData);
            const response = await vehicleDetailsApi.submit(recordId, submitData);
            console.log('[VEHICLE] API Response:', response);
            
            if (response.success) {
              successfulSubmissions.push({ item, response });
            } else {
              failedSubmissions.push({ item, error: response.message || 'Unknown error' });
            }
          } else {
            console.warn('[VEHICLE] Skipping - no record ID found for:', item);
            failedSubmissions.push({ item, error: 'No record ID found' });
          }
        } catch (error: any) {
          console.error('[VEHICLE] Failed to submit vehicle details:', error);
          failedSubmissions.push({ item, error: error?.message || error?.toString() || 'Unknown error' });
        }
      }

      // Show results
      if (successfulSubmissions.length > 0) {
        toast({
          title: "Vehicle Assigned",
          description: `${successfulSubmissions.length} vehicle assignment(s) completed successfully.`,
        });

        // Clear selections and form
        setSelectedItems([]);
        setVehicleData({
          checkStatus: "",
          remarks: "",
          fitness: "",
          insurance: "",
          tax_copy: "",
          polution: "",
          permit1: "",
          permit2_out_state: "",
        });

        // Refresh data from backend
        await fetchPendingVehicleDetails();
        await fetchVehicleDetailsHistory();

        // Navigate to next stage after delay
        setTimeout(() => {
          router.push("/material-load")
        }, 1500)
      }

      if (failedSubmissions.length > 0) {
        console.error('[VEHICLE] Failed submissions:', failedSubmissions);
        toast({
          title: "Some Assignments Failed",
          description: `${failedSubmissions.length} assignment(s) failed. Check console for details.`,
          variant: "destructive",
        })
      }
    } catch (error: any) {
      console.error('[VEHICLE] Unexpected error:', error);
      toast({
        title: "Error",
        description: error?.message || "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false)
    }
  }

  /* Extract unique customer names */
  const customerNames = Array.from(new Set(pendingOrders.map(order => order.party_name || "Unknown")))

  return (
    <WorkflowStageShell
      title="Stage 6: Vehicle Details"
      description="Assign vehicle and driver for delivery."
      pendingCount={displayRows.length}
      historyData={history}
      partyNames={customerNames}
      onFilterChange={setFilterValues}
    >
      <div className="space-y-4">
        <div className="flex justify-end gap-2">
          <Dialog>
            <DialogTrigger asChild>
                <Button disabled={selectedItems.length === 0} className="bg-purple-600 hover:bg-purple-700">
                    <Truck className="mr-2 h-4 w-4" />
                    Assign Vehicle ({selectedItems.length})
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold text-slate-900 leading-none">Vehicle Details Assignment ({selectedItems.length} items)</DialogTitle>
                </DialogHeader>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 shadow-sm mt-4">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-blue-600/70 block px-1 mb-3">Selected Items ({selectedItems.length})</Label>
                    <div className="max-h-[180px] overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-3 pr-2 scrollbar-hide">
                        {selectedItems.map((item, idx) => (
                            <div key={idx} className="bg-white p-3 border border-slate-200 rounded-xl shadow-sm flex flex-col gap-1.5 relative overflow-hidden group hover:border-blue-200 transition-all">
                                <div className="absolute top-0 right-0 py-0.5 px-2 bg-slate-50 border-l border-b border-slate-100 rounded-bl-lg">
                                   <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">{item.doNumber || "—"}</span>
                                </div>
                                <div className="flex flex-col">
                                   <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider leading-none mb-1">DO-No: {item.orderNo}</span>
                                   <h4 className="text-xs font-bold text-slate-800 leading-tight truncate pr-16">{item.customerName || "—"}</h4>
                                </div>
                                <div className="pt-2 border-t border-slate-50 mt-0.5">
                                   <div className="flex items-center gap-1.5">
                                      <div className="w-1 h-1 rounded-full bg-blue-500" />
                                      <span className="text-xs font-bold text-blue-600 truncate">
                                        {item.productName || "—"}
                                      </span>
                                   </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="space-y-4 py-4">
                    <div className="">
                    <h4 className="text-sm font-medium mb-4 text-muted-foreground">Vehicle Documents</h4>
                    <div className="grid grid-cols-2 gap-4 text-xs">
                        <div className="space-y-1"><Label>Fitness Copy</Label><Input type="file" className="h-8 text-[10px]" /></div>
                        <div className="space-y-1"><Label>Insurance</Label><Input type="file" className="h-8 text-[10px]" /></div>
                        <div className="space-y-1"><Label>Tax Copy</Label><Input type="file" className="h-8 text-[10px]" /></div>
                        <div className="space-y-1"><Label>Pollution Check</Label><Input type="file" className="h-8 text-[10px]" /></div>
                    </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 border-t pt-4">
                        <div className="space-y-2">
                            <Label>Check Status</Label>
                            <Select value={vehicleData.checkStatus} onValueChange={(v) => setVehicleData({...vehicleData, checkStatus: v})}>
                                <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Accept">Accept</SelectItem>
                                    <SelectItem value="Reject">Reject</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Remarks</Label>
                            <Input value={vehicleData.remarks} onChange={(e) => setVehicleData({...vehicleData, remarks: e.target.value})} placeholder="Remarks" />
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={handleAssignVehicle} disabled={!vehicleData.checkStatus || isProcessing}>
                        {isProcessing ? "Processing..." : "Confirm & Assign"}
                    </Button>
                </DialogFooter>
            </DialogContent>
          </Dialog>

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
                <TableHead className="w-12 text-center">
                    <Checkbox checked={displayRows.length > 0 && selectedItems.length === displayRows.length} onCheckedChange={toggleSelectAll} />
                </TableHead>
                {ALL_COLUMNS.filter((col) => visibleColumns.includes(col.id)).map((col) => (
                  <TableHead key={col.id} className="whitespace-nowrap text-center">
                    {col.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayRows.length > 0 ? (
                displayRows.map((item, index) => {
                    const rowKey = `${item.id}`;
                    
                    return (
                   <TableRow key={rowKey} className={selectedItems.some(i => i.id === item.id) ? "bg-purple-50/50" : ""}>
                      <TableCell className="text-center">
                        <Checkbox checked={selectedItems.some(i => i.id === item.id)} onCheckedChange={() => toggleSelectItem(item)} />
                      </TableCell>
                      {ALL_COLUMNS.filter((col) => visibleColumns.includes(col.id)).map((col) => (
                        <TableCell key={col.id} className="whitespace-nowrap text-center text-xs">
                          {col.id === "status" ? (
                             <div className="flex justify-center">
                                <Badge className="bg-purple-100 text-purple-700">Awaiting Vehicle</Badge>
                             </div>
                          ) : (item as any)[col.id] || "—"}
                        </TableCell>
                      ))}
                   </TableRow>
                   )
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={visibleColumns.length + 1} className="text-center py-8 text-muted-foreground">
                    No orders pending for vehicle assignment
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
