"use client"

import { useEffect, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { WorkflowStageShell } from "@/components/workflow/workflow-stage-shell"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/hooks/use-toast"
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
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Settings2 } from "lucide-react"
import { ALL_WORKFLOW_COLUMNS as ALL_COLUMNS } from "@/lib/workflow-columns"
import { materialLoadApi } from "@/lib/api-service"

export default function MaterialLoadPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [pendingOrders, setPendingOrders] = useState<any[]>([])
  const [historyOrders, setHistoryOrders] = useState<any[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState<string[]>([
    "orderNo",
    "customerName",
    "productName",
    "status",
  ])
  const [selectedItems, setSelectedItems] = useState<any[]>([])
  const [loadData, setLoadData] = useState({
    actualQty: "",
    weightmentSlip: "",
    rstNo: "",
    grossWeight: "",
    tareWeight: "",
    netWeight: "",
    totalWeight: "",
    grossWeightPacking: "",
    netWeightPacking: "",
    otherItemWeight: "",
    dharamkataWeight: "",
    differanceWeight: "",
    transporterName: "",
    reason: "",
    truckNo: "",
    vehicleNoPlateImage: "",
  })

  // Fetch pending material loads from backend
  const fetchPendingMaterialLoads = async () => {
    try {
      console.log('[MATERIAL LOAD] Fetching pending material loads from API...');
      const response = await materialLoadApi.getPending({ limit: 1000 });
      console.log('[MATERIAL LOAD] API Response:', response);
      
      if (response.success && response.data.materialLoads) {
        setPendingOrders(response.data.materialLoads);
        console.log('[MATERIAL LOAD] Loaded', response.data.materialLoads.length, 'pending material loads');
      }
    } catch (error: any) {
      console.error("[MATERIAL LOAD] Failed to fetch pending material loads:", error);
      toast({
        title: "Error",
        description: error?.message || "Failed to load pending material loads",
        variant: "destructive",
      });
      setPendingOrders([]);
    }
  };

  // Fetch material load history from backend
  const fetchMaterialLoadHistory = async () => {
    try {
      const response = await materialLoadApi.getHistory({ limit: 1000 });
      
      if (response.success && response.data.materialLoads) {
        const mappedHistory = response.data.materialLoads.map((record: any) => ({
          orderNo: record.so_no,
          doNumber: record.d_sr_number,
          customerName: record.party_name,
          stage: "Material Load",
          status: "Completed" as const,
          processedBy: "System",
          timestamp: record.actual_3,
          date: record.actual_3 ? new Date(record.actual_3).toLocaleDateString("en-GB") : "-",
          remarks: `NET: ${record.net_weight || 0}kg`,
        }));
        setHistoryOrders(mappedHistory);
      }
    } catch (error: any) {
      console.error("[MATERIAL LOAD] Failed to fetch history:", error);
      setHistoryOrders([]);
    }
  };

  useEffect(() => {
    fetchPendingMaterialLoads();
    fetchMaterialLoadHistory();
  }, []);

  // Auto-calculate packing weights
  useEffect(() => {
    const netPacking = parseFloat(loadData.netWeightPacking) || 0
    const otherPacking = parseFloat(loadData.otherItemWeight) || 0
    const grossPacking = netPacking + otherPacking
    
    setLoadData(prev => ({
      ...prev,
      grossWeightPacking: (loadData.netWeightPacking || loadData.otherItemWeight) ? grossPacking.toFixed(2) : ""
    }))
  }, [loadData.netWeightPacking, loadData.otherItemWeight])

  // Auto-calculate difference
  useEffect(() => {
    const dharamWeight = parseFloat(loadData.dharamkataWeight) || 0
    const grossPacking = parseFloat(loadData.grossWeightPacking) || 0
    const diff = dharamWeight - grossPacking
    
    setLoadData(prev => ({
      ...prev,
      differanceWeight: (loadData.dharamkataWeight || loadData.grossWeightPacking) ? diff.toFixed(2) : ""
    }))
  }, [loadData.dharamkataWeight, loadData.grossWeightPacking])

  const handleBulkSubmit = async () => {
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
              actual_qty: parseFloat(loadData.actualQty) || null,
              weightment_slip_copy: loadData.weightmentSlip || null,
              rst_no: loadData.rstNo || null,
              gross_weight: parseFloat(loadData.grossWeight) || null,
              tare_weight: parseFloat(loadData.tareWeight) || null,
              net_weight: parseFloat(loadData.netWeight) || parseFloat(loadData.grossWeightPacking) || null,
              transporter_name: loadData.transporterName || null,
              reason_of_difference_in_weight_if_any_speacefic: loadData.reason || null,
              truck_no: loadData.truckNo || null,
              vehicle_no_plate_image: loadData.vehicleNoPlateImage || null,
            };

            console.log('[MATERIAL LOAD] Submitting material load for ID:', recordId, submitData);
            const response = await materialLoadApi.submit(recordId, submitData);
            console.log('[MATERIAL LOAD] API Response:', response);
            
            if (response.success) {
              successfulSubmissions.push({ item, response });
            } else {
              failedSubmissions.push({ item, error: response.message || 'Unknown error' });
            }
          } else {
            console.warn('[MATERIAL LOAD] Skipping - no record ID found for:', item);
            failedSubmissions.push({ item, error: 'No record ID found' });
          }
        } catch (error: any) {
          console.error('[MATERIAL LOAD] Failed to submit material load:', error);
          failedSubmissions.push({ item, error: error?.message || error?.toString() || 'Unknown error' });
        }
      }

      // Show results
      if (successfulSubmissions.length > 0) {
        toast({
          title: "Material Loaded",
          description: `${successfulSubmissions.length} material load(s) completed successfully.`,
        });

        // Clear selections and form
        setSelectedItems([]);
        setLoadData({
          actualQty: "",
          weightmentSlip: "",
          rstNo: "",
          grossWeight: "",
          tareWeight: "",
          netWeight: "",
          totalWeight: "",
          grossWeightPacking: "",
          netWeightPacking: "",
          otherItemWeight: "",
          dharamkataWeight: "",
          differanceWeight: "",
          transporterName: "",
          reason: "",
          truckNo: "",
          vehicleNoPlateImage: "",
        });

        // Refresh data from backend
        await fetchPendingMaterialLoads();
        await fetchMaterialLoadHistory();

        // Navigate to next stage after delay
        setTimeout(() => {
          router.push("/security-approval")
        }, 1500)
      }

      if (failedSubmissions.length > 0) {
        console.error('[MATERIAL LOAD] Failed submissions:', failedSubmissions);
        toast({
          title: "Some Loads Failed",
          description: `${failedSubmissions.length} load(s) failed. Check console for details.`,
          variant: "destructive",
        })
      }
    } catch (error: any) {
      console.error('[MATERIAL LOAD] Unexpected error:', error);
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

  const [filterValues, setFilterValues] = useState({
      status: "",
      startDate: "",
      endDate: "",
      partyName: ""
  })

  // Selection Logic
  const toggleSelectItem = (item: any) => {
    const itemKey = `${item.id}`;
    setSelectedItems((prev) =>
      prev.some((i) => i.id === item.id)
        ? prev.filter((i) => i.id !== item.id)
        : [...prev, item]
    )
  }

  const toggleSelectAll = () => {
    if (selectedItems.length === displayRows.length && displayRows.length > 0) {
      setSelectedItems([])
    } else {
      setSelectedItems(displayRows)
    }
  }

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
      status: "Ready to Load",
    }))
  }, [filteredPendingOrders])

  return (
    <WorkflowStageShell
      title="Stage 7: Material Load"
      description="Record material loading details and weights."
      pendingCount={displayRows.length}
      historyData={historyOrders}
      partyNames={customerNames}
      onFilterChange={setFilterValues}
      remarksColName="Weight Details"
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

          <Dialog>
             <DialogTrigger asChild>
               <Button
                 disabled={selectedItems.length === 0 || isProcessing}
                 className="bg-blue-600 hover:bg-blue-700 font-bold shadow-md transform active:scale-95 transition-all"
               >
                 Load Material ({selectedItems.length})
               </Button>
             </DialogTrigger>
             <DialogContent className="sm:max-w-6xl !max-w-6xl max-h-[95vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="text-xl font-bold text-slate-900 leading-none">Bulk Material Load ({selectedItems.length} Items)</DialogTitle>
                  <DialogDescription className="text-slate-500 mt-1.5">Enter common loading details for all selected items.</DialogDescription>
                </DialogHeader>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 shadow-sm mt-4">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-blue-600/70 block px-1 mb-3">Selected Items ({selectedItems.length})</Label>
                    <div className="max-h-[200px] overflow-y-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 pr-2 scrollbar-hide">
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
                                   <div className="mt-2 pt-2 border-t border-slate-50 grid grid-cols-2 gap-2">
                                       <div className="flex flex-col">
                                          <span className="text-[9px] text-slate-400 font-medium">Qty</span>
                                          <span className="text-[10px] font-bold text-slate-700">{item.qtyToDispatch || "—"}</span>
                                       </div>
                                       <div className="flex flex-col">
                                          <span className="text-[9px] text-slate-400 font-medium">Transport</span>
                                          <span className="text-[10px] font-bold text-slate-700 truncate">{item.transportType || "—"}</span>
                                       </div>
                                   </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="py-6 space-y-8">
                  <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-sm">
                    <h3 className="text-sm font-bold text-slate-800 px-1 flex items-center gap-2 uppercase tracking-tight">
                      <div className="w-1.5 h-4 bg-blue-600 rounded-full" />
                      General Details
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-2">
                        <Label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Actual Qty (Total)</Label>
                        <Input
                          type="number"
                          value={loadData.actualQty || ""}
                          onChange={(e) => setLoadData(prev => ({ ...prev, actualQty: e.target.value }))}
                          placeholder="Qty"
                          className="bg-white border-slate-200 h-10"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">RST No</Label>
                        <Input
                          value={loadData.rstNo || ""}
                          onChange={(e) => setLoadData(prev => ({ ...prev, rstNo: e.target.value }))}
                          placeholder="RST No"
                          className="bg-white border-slate-200 h-10"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Truck No.</Label>
                        <Input
                          value={loadData.truckNo || ""}
                          onChange={(e) => setLoadData(prev => ({ ...prev, truckNo: e.target.value }))}
                          placeholder="Truck No"
                          className="bg-white border-slate-200 uppercase font-mono h-10"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Transporter Name</Label>
                        <Input
                          value={loadData.transporterName || ""}
                          onChange={(e) => setLoadData(prev => ({ ...prev, transporterName: e.target.value }))}
                          placeholder="Transporter"
                          className="bg-white border-slate-200 h-10"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Gross Weight</Label>
                        <Input
                          type="number"
                          value={loadData.grossWeight || ""}
                          onChange={(e) => setLoadData(prev => ({ ...prev, grossWeight: e.target.value }))}
                          placeholder="Gross"
                          className="bg-white border-slate-200 h-10"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Tare Weight</Label>
                        <Input
                          type="number"
                          value={loadData.tareWeight || ""}
                          onChange={(e) => setLoadData(prev => ({ ...prev, tareWeight: e.target.value }))}
                          placeholder="Tare"
                          className="bg-white border-slate-200 h-10"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-indigo-50/30 p-4 rounded-lg border border-indigo-100 shadow-sm">
                      <h3 className="text-sm font-bold text-indigo-800 mb-4 px-1 flex items-center gap-2">
                        <div className="w-1 h-4 bg-indigo-500 rounded-full" />
                        Packing Weight Info
                      </h3>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-[10px] uppercase font-bold text-indigo-600 tracking-wider">Net (Packing)</Label>
                            <Input
                              type="number"
                              value={loadData.netWeightPacking || ""}
                              onChange={(e) => setLoadData(prev => ({ ...prev, netWeightPacking: e.target.value }))}
                              placeholder="Net"
                              className="bg-white border-indigo-200 h-10"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[10px] uppercase font-bold text-indigo-600 tracking-wider">Other Items</Label>
                            <Input
                              type="number"
                              value={loadData.otherItemWeight || ""}
                              onChange={(e) => setLoadData(prev => ({ ...prev, otherItemWeight: e.target.value }))}
                              placeholder="Other"
                              className="bg-white border-indigo-200 h-10"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[10px] uppercase font-bold text-indigo-600 tracking-wider">Gross Packing Weight</Label>
                          <Input
                            type="number"
                            value={loadData.grossWeightPacking || ""}
                            readOnly
                            className="bg-indigo-100 border-indigo-200 font-bold text-indigo-700 h-10"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="bg-amber-50/30 p-4 rounded-lg border border-amber-100 shadow-sm">
                      <h3 className="text-sm font-bold text-amber-800 mb-4 px-1 flex items-center gap-2">
                        <div className="w-1 h-4 bg-amber-500 rounded-full" />
                        Dharamkata Verification
                      </h3>
                      <div className="space-y-4">
                         <div className="grid grid-cols-2 gap-4">
                           <div className="space-y-2">
                             <Label className="text-[10px] uppercase font-bold text-amber-600 tracking-wider">Dharamkata Weight</Label>
                             <Input
                               type="number"
                               value={loadData.dharamkataWeight || ""}
                               onChange={(e) => setLoadData(prev => ({ ...prev, dharamkataWeight: e.target.value }))}
                               placeholder="Weight"
                               className="bg-white border-amber-200 h-10"
                             />
                           </div>
                           <div className="space-y-2">
                             <Label className="text-[10px] uppercase font-bold text-amber-600 tracking-wider">Difference</Label>
                             <Input
                               type="number"
                               value={loadData.differanceWeight || ""}
                               readOnly
                               className="bg-amber-100 border-amber-200 font-bold text-amber-700 h-10"
                             />
                           </div>
                         </div>
                         <div className="space-y-2">
                           <Label className="text-[10px] uppercase font-bold text-amber-600 tracking-wider">Reason of Difference</Label>
                           <Input
                             value={loadData.reason || ""}
                             onChange={(e) => setLoadData(prev => ({ ...prev, reason: e.target.value }))}
                             placeholder="Reason if any"
                             className="bg-white border-amber-200 h-10"
                           />
                         </div>
                      </div>
                    </div>
                  </div>

                  {/* Verification Artifacts Section */}
                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 shadow-sm">
                    <h3 className="text-sm font-bold text-slate-800 mb-4 px-1 flex items-center gap-2">
                      <div className="w-1 h-4 bg-slate-600 rounded-full" />
                      Verification Artifacts
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Weightment Slip Copy</Label>
                        <Input type="file" className="bg-white cursor-pointer" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Vehicle No. Plate Image</Label>
                        <Input type="file" className="bg-white cursor-pointer" />
                      </div>
                    </div>
                  </div>
                </div>

                <DialogFooter>
                   <Button variant="outline" onClick={() => (document.querySelector('[data-state="open"] button[aria-label="Close"]') as HTMLElement)?.click()}>
                     Cancel
                   </Button>
                   <Button onClick={handleBulkSubmit} disabled={isProcessing} className="bg-blue-600 hover:bg-blue-700 lg:min-w-[200px]">
                     {isProcessing ? "Processing..." : "Complete Bulk Load"}
                   </Button>
                </DialogFooter>
             </DialogContent>
          </Dialog>
        </div>

        <Card className="border-none shadow-sm overflow-auto max-h-[600px]">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-card shadow-sm">
              <TableRow>
                <TableHead className="w-12 text-center">
                  <Checkbox 
                    checked={displayRows.length > 0 && selectedItems.length === displayRows.length}
                    onCheckedChange={toggleSelectAll}
                  />
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
                displayRows.map((item: any, index: number) => {
                   const rowKey = `${item.id}`;
                   const isSelected = selectedItems.some(i => i.id === item.id);

                   return (
                   <TableRow key={`${index}-${rowKey}`} className={isSelected ? "bg-blue-50/50" : ""}>
                     <TableCell className="text-center">
                        <Checkbox 
                          checked={isSelected}
                          onCheckedChange={() => toggleSelectItem(item)}
                        />
                     </TableCell>
                     {ALL_COLUMNS.filter((col) => visibleColumns.includes(col.id)).map((col) => (
                       <TableCell key={col.id} className="whitespace-nowrap text-center text-xs">
                         {col.id === "status" ? (
                            <div className="flex justify-center">
                               <Badge className="bg-indigo-100 text-indigo-700">Ready to Load</Badge>
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
                    No items pending for material loading
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