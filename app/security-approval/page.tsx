"use client"

import { useEffect, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { WorkflowStageShell } from "@/components/workflow/workflow-stage-shell"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { Checkbox } from "@/components/ui/checkbox"
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
import { Upload, X, Plus, Settings2 } from "lucide-react"
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ALL_WORKFLOW_COLUMNS as ALL_COLUMNS } from "@/lib/workflow-columns"
import { securityGuardApprovalApi } from "@/lib/api-service"

export default function SecurityApprovalPage() {
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
  const [uploadData, setUploadData] = useState({
    biltyNo: "",
    biltyImage: null as File | null,
    vehicleImages: [] as File[],
    checklist: {
      mallLoad: false,
      qtyMatch: false,
      gaadiCovered: false,
      image: false,
      driverCond: false,
    }
  })

  // Fetch pending security approvals from backend
  const fetchPendingApprovals = async () => {
    try {
      console.log('[SECURITY] Fetching pending approvals from API...');
      const response = await securityGuardApprovalApi.getPending({ limit: 1000 });
      console.log('[SECURITY] API Response:', response);
      
      if (response.success && response.data.approvals) {
        setPendingOrders(response.data.approvals);
        console.log('[SECURITY] Loaded', response.data.approvals.length, 'pending approvals');
      }
    } catch (error: any) {
      console.error("[SECURITY] Failed to fetch pending approvals:", error);
      toast({
        title: "Error",
        description: error?.message || "Failed to load pending approvals",
        variant: "destructive",
      });
      setPendingOrders([]);
    }
  };

  // Fetch security approval history from backend
  const fetchApprovalHistory = async () => {
    try {
      const response = await securityGuardApprovalApi.getHistory({ limit: 1000 });
      
      if (response.success && response.data.approvals) {
        const mappedHistory = response.data.approvals.map((record: any) => ({
          orderNo: record.so_no,
          doNumber: record.d_sr_number,
          customerName: record.party_name,
          stage: "Security Approval",
          status: "Completed" as const,
          processedBy: "System",
          timestamp: record.actual_4,
          date: record.actual_4 ? new Date(record.actual_4).toLocaleDateString("en-GB") : "-",
          remarks: record.bilty_no || "-",
        }));
        setHistoryOrders(mappedHistory);
      }
    } catch (error: any) {
      console.error("[SECURITY] Failed to fetch history:", error);
      setHistoryOrders([]);
    }
  };

  useEffect(() => {
    fetchPendingApprovals();
    fetchApprovalHistory();
  }, []);

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
              bilty_no: uploadData.biltyNo || null,
              bilty_image: uploadData.biltyImage?.name || null,
              vehicle_image_attachemrnt: uploadData.vehicleImages.length > 0 ? uploadData.vehicleImages.map(f => f.name).join(',') : null,
            };

            console.log('[SECURITY] Submitting approval for ID:', recordId, submitData);
            const response = await securityGuardApprovalApi.submit(recordId, submitData);
            console.log('[SECURITY] API Response:', response);
            
            if (response.success) {
              successfulSubmissions.push({ item, response });
            } else {
              failedSubmissions.push({ item, error: response.message || 'Unknown error' });
            }
          } else {
            console.warn('[SECURITY] Skipping - no record ID found for:', item);
            failedSubmissions.push({ item, error: 'No record ID found' });
          }
        } catch (error: any) {
          console.error('[SECURITY] Failed to submit approval:', error);
          failedSubmissions.push({ item, error: error?.message || error?.toString() || 'Unknown error' });
        }
      }

      // Show results
      if (successfulSubmissions.length > 0) {
        toast({
          title: "Security Approved",
          description: `${successfulSubmissions.length} approval(s) completed successfully.`,
        });

        // Clear selections and form
        setSelectedItems([]);
        setUploadData({
          biltyNo: "",
          biltyImage: null,
          vehicleImages: [],
          checklist: {
            mallLoad: false,
            qtyMatch: false,
            gaadiCovered: false,
            image: false,
            driverCond: false,
          }
        });

        // Refresh data from backend
        await fetchPendingApprovals();
        await fetchApprovalHistory();

        // Navigate to next stage after delay
        setTimeout(() => {
          router.push("/make-invoice")
        }, 1500)
      }

      if (failedSubmissions.length > 0) {
        console.error('[SECURITY] Failed submissions:', failedSubmissions);
        toast({
          title: "Some Approvals Failed",
          description: `${failedSubmissions.length} approval(s) failed. Check console for details.`,
          variant: "destructive",
        })
      }
    } catch (error: any) {
      console.error('[SECURITY] Unexpected error:', error);
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
      // New fields
      actualQty: record.actual_qty_dispatch,
      rstNo: record.rst_no,
      grossWeight: record.gross_weight,
      tareWeight: record.tare_weight,
      netWeight: record.net_weight,
      transporterName: record.transporter_name,
      reasonForDiff: record.reason_of_difference_in_weight_if_any_speacefic,
      truckNo: record.truck_no,
      timestamp: record.timestamp,
      status: "Pending Security",
    }))
  }, [filteredPendingOrders])

  return (
    <WorkflowStageShell
      title="Stage 8: Security Guard Approval"
      description="Upload bilty and vehicle images for security verification."
      pendingCount={displayRows.length}
      historyData={historyOrders}
      partyNames={customerNames}
      onFilterChange={setFilterValues}
      remarksColName="Attachments"
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
                 Batch Approve ({selectedItems.length})
               </Button>
             </DialogTrigger>
             <DialogContent className="sm:max-w-6xl !max-w-6xl max-h-[95vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="text-xl font-bold text-slate-900 leading-none">Bulk Security Approval ({selectedItems.length} Items)</DialogTitle>
                  <DialogDescription className="text-slate-500 mt-1.5">Verify and approve all selected items in this batch.</DialogDescription>
                </DialogHeader>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 shadow-sm mt-4">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-blue-600/70 block px-1 mb-3">Selected Items ({selectedItems.length})</Label>
                    <div className="max-h-[200px] overflow-y-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pr-2 scrollbar-hide">
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
                                   <div className="flex items-center gap-1.5 mb-2">
                                      <div className="w-1 h-1 rounded-full bg-blue-500" />
                                      <span className="text-xs font-bold text-blue-600 truncate">
                                        {item.productName || "—"}
                                      </span>
                                   </div>
                                    <div className="grid grid-cols-2 gap-x-2 gap-y-1 bg-slate-50 p-2 rounded-lg">
                                        <div className="flex flex-col">
                                            <span className="text-[8px] text-slate-400 uppercase font-bold">Actual Qty</span>
                                            <span className="text-[10px] font-bold text-slate-700">{item.actualQty || "—"}</span>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[8px] text-slate-400 uppercase font-bold">Truck No</span>
                                            <span className="text-[10px] font-bold text-slate-700">{item.truckNo || "—"}</span>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[8px] text-slate-400 uppercase font-bold">RST No</span>
                                            <span className="text-[10px] font-bold text-slate-700">{item.rstNo || "—"}</span>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[8px] text-slate-400 uppercase font-bold">Transport</span>
                                            <span className="text-[10px] font-bold text-slate-700 truncate">{item.transporterName || "—"}</span>
                                        </div>
                                        <div className="flex flex-col col-span-2 mt-1 pt-1 border-t border-slate-200">
                                            <div className="flex justify-between items-center text-[9px]">
                                                <span className="text-slate-500">Gross: <span className="font-bold text-slate-700">{item.grossWeight || "—"}</span></span>
                                                <span className="text-slate-500">Tare: <span className="font-bold text-slate-700">{item.tareWeight || "—"}</span></span>
                                                <span className="text-slate-500">Net: <span className="font-bold text-blue-600">{item.netWeight || "—"}</span></span>
                                            </div>
                                        </div>
                                        {item.reasonForDiff && (
                                            <div className="flex flex-col col-span-2 mt-1 bg-amber-50 p-1 rounded border border-amber-100">
                                                <span className="text-[8px] text-amber-600 font-bold uppercase">Weight Diff Reason</span>
                                                <span className="text-[9px] text-amber-800 leading-tight">{item.reasonForDiff}</span>
                                            </div>
                                        )}
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
Document Verification
                    </h3>
                    <div className="space-y-4">
                       <div className="space-y-2">
                         <Label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Bilty Number</Label>
                         <Input
                           value={uploadData.biltyNo}
                           onChange={(e) => setUploadData({ ...uploadData, biltyNo: e.target.value })}
                           placeholder="Enter Bilty Number"
                           className="bg-white"
                         />
                       </div>
                       <div className="space-y-2">
                         <Label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Bilty Image (Scanned Copy)</Label>
                         <Input
                           type="file"
                           accept="image/*"
                           className="bg-white cursor-pointer"
                           onChange={(e) => {
                             if (e.target.files?.[0]) {
                               setUploadData({ ...uploadData, biltyImage: e.target.files[0] })
                             }
                           }}
                         />
                       </div>
                    </div>
                  </div>

                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-5 space-y-4 shadow-sm">
                    <h3 className="text-sm font-bold text-slate-700 px-1 flex items-center gap-2 uppercase tracking-tight">
                      <div className="w-1.5 h-4 bg-slate-400 rounded-full" />
                      Security Checkpoints (Batch Verification)
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                       <div className="flex items-center space-x-2 bg-white p-3 rounded-lg border border-slate-200">
                         <Checkbox 
                           id="bulk-mallLoad" 
                           checked={uploadData.checklist.mallLoad}
                           onCheckedChange={(checked) => setUploadData(prev => ({ ...prev, checklist: { ...prev.checklist, mallLoad: !!checked } }))}
                         />
                         <Label htmlFor="bulk-mallLoad" className="text-sm font-medium cursor-pointer">Mall Load Properly</Label>
                       </div>
                       <div className="flex items-center space-x-2 bg-white p-3 rounded-lg border border-slate-200">
                         <Checkbox 
                           id="bulk-qtyMatch" 
                           checked={uploadData.checklist.qtyMatch}
                           onCheckedChange={(checked) => setUploadData(prev => ({ ...prev, checklist: { ...prev.checklist, qtyMatch: !!checked } }))}
                         />
                         <Label htmlFor="bulk-qtyMatch" className="text-sm font-medium cursor-pointer">Qty Matching</Label>
                       </div>
                       <div className="flex items-center space-x-2 bg-white p-3 rounded-lg border border-slate-200">
                         <Checkbox 
                           id="bulk-gaadiCovered" 
                           checked={uploadData.checklist.gaadiCovered}
                           onCheckedChange={(checked) => setUploadData(prev => ({ ...prev, checklist: { ...prev.checklist, gaadiCovered: !!checked } }))}
                         />
                         <Label htmlFor="bulk-gaadiCovered" className="text-sm font-medium cursor-pointer">Gaadi Proper Dhaka hua hai</Label>
                       </div>
                       <div className="flex items-center space-x-2 bg-white p-3 rounded-lg border border-slate-200">
                         <Checkbox 
                           id="bulk-driverCond" 
                           checked={uploadData.checklist.driverCond}
                           onCheckedChange={(checked) => setUploadData(prev => ({ ...prev, checklist: { ...prev.checklist, driverCond: !!checked } }))}
                         />
                         <Label htmlFor="bulk-driverCond" className="text-sm font-medium cursor-pointer">Driver Condition Good</Label>
                       </div>
                       <div className="flex items-center space-x-2 bg-white p-3 rounded-lg border border-slate-200">
                         <Checkbox 
                           id="bulk-imageCheck" 
                           checked={uploadData.checklist.image}
                           onCheckedChange={(checked) => setUploadData(prev => ({ ...prev, checklist: { ...prev.checklist, image: !!checked } }))}
                         />
                         <Label htmlFor="bulk-imageCheck" className="text-sm font-medium cursor-pointer">Vehicle Photos Verified</Label>
                       </div>
                    </div>
                  </div>

                  {uploadData.checklist.image && (
                    <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-sm animate-in fade-in slide-in-from-top-2">
                       <h3 className="text-sm font-bold text-slate-800 px-1 flex items-center gap-2">
                        <div className="w-1.5 h-4 bg-amber-500 rounded-full" />
                        Vehicle Proof (Images)
                       </h3>
                       <div className="flex flex-wrap gap-4">
                         {uploadData.vehicleImages.map((file, index) => (
                           <div key={index} className="relative w-24 h-24 border rounded-lg overflow-hidden group shadow-sm">
                             <img
                               src={URL.createObjectURL(file)}
                               alt={`Vehicle ${index + 1}`}
                               className="w-full h-full object-cover"
                             />
                             <button
                               onClick={() => {
                                 const newImages = [...uploadData.vehicleImages]
                                 newImages.splice(index, 1)
                                 setUploadData({ ...uploadData, vehicleImages: newImages })
                               }}
                               className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                             >
                               <X className="h-3 w-3" />
                             </button>
                           </div>
                         ))}
                         <label className="w-24 h-24 border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 hover:border-slate-400 transition-all">
                           <Plus className="h-6 w-6 text-slate-400" />
                           <span className="text-[10px] text-slate-400 mt-1 font-bold">ADD PROOF</span>
                           <input
                             type="file"
                             accept="image/*"
                             multiple
                             className="hidden"
                             onChange={(e) => {
                               if (e.target.files) {
                                 const newFiles = Array.from(e.target.files)
                                 setUploadData({
                                   ...uploadData,
                                   vehicleImages: [...uploadData.vehicleImages, ...newFiles],
                                 })
                               }
                             }}
                           />
                         </label>
                       </div>
                    </div>
                  )}
                </div>

                <DialogFooter className="mt-4">
                   <Button variant="outline" onClick={() => (document.querySelector('[data-state="open"] button[aria-label="Close"]') as HTMLElement)?.click()}>
                     Cancel
                   </Button>
                   <Button 
                     onClick={handleBulkSubmit} 
                     disabled={isProcessing || !uploadData.checklist.mallLoad || !uploadData.checklist.qtyMatch} 
                     className="bg-blue-600 hover:bg-blue-700 lg:min-w-[200px]"
                   >
                     {isProcessing ? "Approving..." : "Complete Batch Approval"}
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
                               <Badge className="bg-amber-100 text-amber-700">Pending Security</Badge>
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
                    No orders pending for security approval
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