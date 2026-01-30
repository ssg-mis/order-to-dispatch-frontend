"use client"

import { useEffect, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { WorkflowStageShell } from "@/components/workflow/workflow-stage-shell"
import { cn } from "@/lib/utils"
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
import { Upload, X, Plus, Settings2, ShieldAlert, ShieldCheck, Truck, ChevronDown, ChevronUp } from "lucide-react"
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ALL_WORKFLOW_COLUMNS as ALL_COLUMNS } from "@/lib/workflow-columns"
import { securityGuardApprovalApi } from "@/lib/api-service"

export default function SecurityApprovalPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [confirmDetails, setConfirmDetails] = useState<Record<string, { qty: string }>>({})
  const [expandedOrders, setExpandedOrders] = useState<string[]>([])
  const [pendingOrders, setPendingOrders] = useState<any[]>([])
  const [historyOrders, setHistoryOrders] = useState<any[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState<string[]>([
    "orderNo",
    "customerName",
    "status",
  ])
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [selectedGroups, setSelectedGroups] = useState<any[]>([])
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
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
  if (selectedGroups.length === 0) return
  
  // Submit only selected products across all groups
  const allSelectedProducts = selectedGroups.flatMap(group => 
    group._allProducts.filter((p: any) => selectedProducts.includes(p._rowKey))
  )
  
  if (allSelectedProducts.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one product to process",
        variant: "destructive"
      })
      return
    }

    setIsProcessing(true)
    try {
      const successfulSubmissions: any[] = []
      const failedSubmissions: any[] = []

      // Submit each selected product to backend API
    for (const product of allSelectedProducts) {
      const recordId = product.id; // Use the lift_receiving_confirmation table ID
        
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
              successfulSubmissions.push({ product, response });
            } else {
              failedSubmissions.push({ product, error: response.message || 'Unknown error' });
            }
          } else {
            console.warn('[SECURITY] Skipping - no record ID found for:', product);
            failedSubmissions.push({ product, error: 'No record ID found' });
          }
        } catch (error: any) {
          console.error('[SECURITY] Failed to submit approval:', error);
          failedSubmissions.push({ product, error: error?.message || error?.toString() || 'Unknown error' });
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
        setIsDialogOpen(false);
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

  // Group orders by Customer Name (Party Name)
  const displayRows = useMemo(() => {
    const grouped: { [key: string]: any } = {}

    filteredPendingOrders.forEach((order: any) => {
       const partyName = order.party_name || order.partyName || "Unknown Customer"
       const doNumber = order.so_no || order.soNo || "—"
       
       if (!grouped[partyName]) {
          grouped[partyName] = {
             _rowKey: partyName,
             customerName: partyName,
             doNumberList: new Set<string>(),
             _allProducts: [],
             _ordersMap: {}, // Group items by DO for interleaved view
             _productCount: 0
          }
       }
       
       const group = grouped[partyName]
       group.doNumberList.add(doNumber)
       
       // Handle interleaved grouping (by unique DO)
       const baseDo = doNumber.split(/[A-Z]$/)[0] // Simple base DO extraction
       if (!group._ordersMap[baseDo]) {
         group._ordersMap[baseDo] = {
           _products: [],
           depoName: order.depo_name || order.depoName || "—",
           deliveryPurpose: order.order_type_delivery_purpose || "—",
           orderType: order.order_type || "—",
           startDate: order.start_date,
           endDate: order.end_date,
           deliveryDate: order.delivery_date,
           transportType: order.type_of_transporting || "—",
           contactPerson: order.customer_contact_person_name || "—",
           whatsapp: order.customer_contact_person_whatsapp_no || "—",
           address: order.customer_address || "—",
           paymentTerms: order.payment_terms || "—",
           advanceAmount: order.advance_amount || 0,
           isBroker: order.is_order_through_broker || false,
           brokerName: order.broker_name || "—",
           partyCredit: order.party_credit_status || "Good",
           orderPunchRemarks: order.remark || "—"
         }
       }
       
       const product = {
         ...order,
         _rowKey: `${partyName}-${order.d_sr_number || order.id}`,
         id: order.id,
         specificOrderNo: doNumber,
         productName: order.product_name || order.productName,
         qtyToDispatch: order.actual_qty_dispatch || order.qty_to_be_dispatched || 0,
         deliveryFrom: order.dispatch_from || "—",
         actualQty: order.actual_qty_dispatch,
         truckNo: order.truck_no,
         rstNo: order.rst_no,
         grossWeight: order.gross_weight,
         tareWeight: order.tare_weight,
         netWeight: order.net_weight,
         transporterName: order.transporter_name,
         dsrNumber: order.d_sr_number
       }

       group._ordersMap[baseDo]._products.push(product)
       group._allProducts.push(product)
       group._productCount = group._allProducts.length
    })

    // Finalize groups (convert Set to comma string)
    return Object.values(grouped).map(group => ({
      ...group,
      doNumber: Array.from(group.doNumberList as Set<string>).join(", ")
    }))
  }, [filteredPendingOrders])

  const toggleSelectItem = (itemKey: string) => {
    setSelectedItems(prev => 
      prev.includes(itemKey) 
        ? prev.filter(k => k !== itemKey)
        : [...prev, itemKey]
    )
  }

  const toggleSelectAll = () => {
    if (selectedItems.length === displayRows.length) {
      setSelectedItems([])
    } else {
      setSelectedItems(displayRows.map(r => r._rowKey))
    }
  }

  const handleOpenDialog = () => {
    if (selectedItems.length === 0) return
    
    const targets = displayRows.filter(r => selectedItems.includes(r._rowKey))
    if (targets.length > 0) {
      setSelectedGroups(targets)
      // Select all products for all selected groups by default
      const allRowKeys = targets.flatMap(g => g._allProducts.map((p: any) => p._rowKey))
      setSelectedProducts(allRowKeys)
      
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
      })
      setIsDialogOpen(true)
    }
  }

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
              <Button variant="outline" size="sm" className="bg-transparent border-2">
                <Settings2 className="mr-2 h-4 w-4" />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-62.5 max-h-100 overflow-y-auto">
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

          <Button 
            onClick={handleOpenDialog}
            disabled={selectedItems.length === 0} 
            className="bg-purple-600 hover:bg-purple-700 shadow-lg font-black uppercase tracking-tighter italic"
          >
            <Upload className="mr-2 h-4 w-4" />
            Process Security ({selectedItems.length})
          </Button>
        </div>

        <Card className="border-none shadow-xl rounded-3xl overflow-hidden bg-white/50 backdrop-blur-md">
          <Table>
            <TableHeader className="bg-slate-50 sticky top-0 z-10">
              <TableRow>
                <TableHead className="w-12 text-center">
                    <Checkbox checked={displayRows.length > 0 && selectedItems.length === displayRows.length} onCheckedChange={toggleSelectAll} />
                </TableHead>
                <TableHead className="text-[10px] uppercase font-black text-slate-500 tracking-wider">DO NUMBERS</TableHead>
                <TableHead className="text-[10px] uppercase font-black text-slate-500 tracking-wider">CUSTOMER NAME</TableHead>
                <TableHead className="text-[10px] uppercase font-black text-slate-500 tracking-wider text-center">ITEM COUNT</TableHead>
                <TableHead className="text-[10px] uppercase font-black text-slate-500 tracking-wider text-center">STATUS</TableHead>
                <TableHead className="text-center text-[10px] uppercase font-black">ACTIONS</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayRows.length > 0 ? (
                displayRows.map((group) => (
                   <TableRow key={group._rowKey} className={cn("hover:bg-purple-50/30 transition-colors", selectedItems.includes(group._rowKey) ? "bg-purple-50/50" : "")}>
                      <TableCell className="text-center p-4">
                        <Checkbox checked={selectedItems.includes(group._rowKey)} onCheckedChange={() => toggleSelectItem(group._rowKey)} />
                      </TableCell>
                      <TableCell className="p-4">
                        <div className="flex flex-wrap gap-1 max-w-sm">
                           {group.doNumber.split(", ").map((doNum: string) => (
                             <Badge key={doNum} variant="outline" className="bg-white text-purple-700 border-purple-200 font-bold text-[10px]">{doNum}</Badge>
                           ))}
                        </div>
                      </TableCell>
                      <TableCell className="p-4 font-black text-slate-700 uppercase tracking-tighter italic">{group.customerName}</TableCell>
                      <TableCell className="text-center p-4">
                        <div className="flex flex-col items-center">
                           <span className="font-black text-lg text-slate-800">{group._productCount}</span>
                           <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Products</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center p-4">
                        <Badge className="bg-orange-100 text-orange-700 border-orange-200 font-black text-[10px] uppercase">Pending Guard</Badge>
                      </TableCell>
                      <TableCell className="text-center p-4">
                         <Button variant="ghost" size="sm" onClick={() => {
                            setSelectedItems([group._rowKey])
                            handleOpenDialog()
                         }}>
                            <Settings2 className="w-4 h-4 text-slate-400 hover:text-purple-600" />
                         </Button>
                      </TableCell>
                   </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-20">
                    <div className="flex flex-col items-center gap-2">
                       <ShieldAlert className="w-12 h-12 text-slate-200" />
                       <p className="text-slate-400 font-black uppercase tracking-widest text-xs">No vehicles pending for security check</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* Split-View Dialog (Premium Refactor) */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-6xl! max-h-[95vh] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="text-xl font-bold text-slate-900 leading-none">
              Security Verification: Batch Approval
            </DialogTitle>
            <DialogDescription className="text-slate-500 mt-1.5 font-medium">
              Audit vehicle, load, and driver credentials for {selectedGroups.length} Selected Customer(s).
            </DialogDescription>
          </DialogHeader>
          
          {selectedGroups.length > 0 && (
             <div className="space-y-12 mt-6">
                {selectedGroups.map((group, groupIdx) => (
                  <div key={group._rowKey} className="space-y-6">
                    <h2 className="text-xl font-black text-slate-800 border-b-4 border-slate-100 pb-2 mt-4 uppercase tracking-tight flex items-center justify-between">
                      {group.customerName}
                      <Badge className="bg-blue-600 text-white ml-3 px-3 py-1 font-black">
                        {group._productCount} PRODUCTS
                      </Badge>
                    </h2>

                    {Object.entries(group._ordersMap).map(([baseDo, orderDetails]: [string, any], orderIdx) => {
                      const orderProducts = orderDetails._products;
                      const allOrderSelected = orderProducts.every((p: any) => selectedProducts.includes(p._rowKey));
                      const isExpanded = expandedOrders.includes(baseDo);
                      const toggleExpand = () => {
                        setExpandedOrders(prev => isExpanded ? prev.filter(id => id !== baseDo) : [...prev, baseDo]);
                      };

                      // Use details from the first product of the order for the details bar
                      const firstProd = orderProducts[0] || {};

                      return (
                        <div key={`${group._rowKey}-${baseDo}`} className="space-y-4 border-2 border-slate-100 rounded-3xl overflow-hidden bg-white shadow-sm">
                          <div className="bg-blue-600 px-5 py-3 flex items-center justify-between cursor-pointer" onClick={toggleExpand}>
                             <div className="flex items-center gap-4">
                               <Badge className="bg-white text-blue-800 hover:bg-white px-4 py-1.5 text-sm font-black tracking-tight rounded-full shadow-sm">
                                  ORDER: {baseDo}
                               </Badge>
                               <div className="flex flex-col">
                                 <span className="text-[10px] text-blue-100 font-black uppercase tracking-widest leading-none mb-1">GROUP {groupIdx + 1} | SECTION {orderIdx + 1}</span>
                                 <span className="text-xs text-blue-100 font-bold leading-none">
                                   {orderProducts.filter((p: any) => selectedProducts.includes(p._rowKey)).length} Items Selected
                                 </span>
                               </div>
                             </div>
                             <div className="flex items-center gap-3">
                               <div className="text-[11px] text-blue-50 font-bold uppercase tracking-widest mr-2 leading-none cursor-pointer">
                                 {isExpanded ? 'HIDE DISPATCH DETAILS ▲' : 'CLICK TO SHOW DETAILS ▼'}
                               </div>
                               <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/20 rounded-full">
                                  {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                                </Button>
                             </div>
                          </div>

                          <div className="px-5 pb-5 space-y-4">
                            {/* Collapsible Dispatch Details Bar */}
                            {isExpanded && (
                              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 grid grid-cols-2 md:grid-cols-4 gap-6 shadow-inner mt-2 animate-in slide-in-from-top-2 duration-300">
                                  <div>
                                    <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Truck No</p>
                                    <p className="text-sm font-black text-blue-800">{firstProd.truck_no || firstProd.truckNo || "—"}</p>
                                  </div>
                                  <div>
                                    <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Transporter</p>
                                    <p className="text-xs font-bold text-slate-900 leading-tight">{firstProd.transporter_name || "—"}</p>
                                  </div>
                                  <div>
                                    <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Transport Type</p>
                                    <p className="text-xs font-bold text-slate-900 leading-none">{firstProd.type_of_transporting || "—"}</p>
                                  </div>
                                  <div>
                                    <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Credit Status</p>
                                    <Badge className={cn("text-[10px] font-black px-2 py-0.5", orderDetails.partyCredit === 'Good' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')}>
                                        {orderDetails.partyCredit}
                                    </Badge>
                                  </div>

                                  <div className="md:col-span-4 h-px bg-slate-200 my-1" />

                                  <div>
                                    <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Fitness</p>
                                    <p className="text-xs font-bold text-slate-700">{firstProd.fitness || "—"}</p>
                                  </div>
                                  <div>
                                    <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Insurance</p>
                                    <p className="text-xs font-bold text-slate-700">{firstProd.insurance || "—"}</p>
                                  </div>
                                  <div>
                                    <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Pollution</p>
                                    <p className="text-xs font-bold text-slate-700">{firstProd.polution || "—"}</p>
                                  </div>
                                  <div>
                                    <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Tax Copy</p>
                                    <p className="text-xs font-bold text-slate-700">{firstProd.tax_copy || "—"}</p>
                                  </div>

                                  <div>
                                    <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Permit 1</p>
                                    <p className="text-xs font-bold text-slate-700">{firstProd.permit1 || "—"}</p>
                                  </div>
                                  <div>
                                    <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Permit 2 (Out State)</p>
                                    <p className="text-xs font-bold text-slate-700">{firstProd.permit2_out_state || "—"}</p>
                                  </div>
                                  <div>
                                    <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Audit Status</p>
                                    <Badge variant="outline" className={cn("text-[9px] font-black", firstProd.check_status === 'OK' ? "text-green-600 border-green-200 bg-green-50" : "text-amber-600 border-amber-200 bg-amber-50")}>
                                      {firstProd.check_status || "—"}
                                    </Badge>
                                  </div>
                                  <div>
                                    <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Audit Remarks</p>
                                    <p className="text-[10px] font-medium text-slate-500 italic leading-tight">{firstProd.remarks || "—"}</p>
                                  </div>

                                  <div className="md:col-span-4 h-px bg-slate-200 my-1" />

                                  <div>
                                    <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">RST No</p>
                                    <p className="text-xs font-black text-slate-900">#{firstProd.rst_no || "—"}</p>
                                  </div>
                                  <div>
                                    <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Weight Slip</p>
                                    <p className="text-xs font-bold text-slate-700">{firstProd.weightment_slip_copy || "—"}</p>
                                  </div>
                                  <div>
                                    <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Gross / Tare / Net</p>
                                    <p className="text-xs font-black text-slate-900">{firstProd.gross_weight || "0"} / {firstProd.tare_weight || "0"} / <span className="text-blue-600">{firstProd.net_weight || "0"}</span></p>
                                  </div>
                                  <div>
                                    <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Weight Diff Reason</p>
                                    <p className="text-[10px] font-bold text-red-500 italic">{firstProd.reason_of_difference_in_weight_if_any_speacefic || "—"}</p>
                                  </div>
                              </div>
                            )}

                            {/* Simple Product Table (Always Visible) */}
                            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-white">
                              <Table>
                                <TableHeader className="bg-slate-50">
                                  <TableRow>
                                    <TableHead className="w-12 text-center h-10">
                                      <Checkbox 
                                        checked={allOrderSelected}
                                        onCheckedChange={(checked) => {
                                          if (checked) {
                                            setSelectedProducts(prev => Array.from(new Set([...prev, ...orderProducts.map((p: any) => p._rowKey)])))
                                          } else {
                                            setSelectedProducts(prev => prev.filter(k => !orderProducts.some((p: any) => p._rowKey === k)))
                                          }
                                        }}
                                      />
                                    </TableHead>
                                    <TableHead className="text-[10px] uppercase font-black h-10">PRODUCT INFO</TableHead>
                                    <TableHead className="text-[10px] uppercase font-black text-center h-10">QTY</TableHead>
                                    <TableHead className="text-[10px] uppercase font-black text-center h-10">STATUS</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {orderProducts.map((product: any) => (
                                    <TableRow key={product._rowKey} className={cn(selectedProducts.includes(product._rowKey) ? "bg-blue-50/20" : "", "h-14")}>
                                      <TableCell className="text-center p-2">
                                        <Checkbox 
                                          checked={selectedProducts.includes(product._rowKey)}
                                          onCheckedChange={() => {
                                            if (selectedProducts.includes(product._rowKey)) {
                                              setSelectedProducts(prev => prev.filter(k => k !== product._rowKey))
                                            } else {
                                              setSelectedProducts(prev => [...prev, product._rowKey])
                                            }
                                          }}
                                        />
                                      </TableCell>
                                      <TableCell className="p-2">
                                        <div className="flex flex-col">
                                          <span className="text-xs font-black text-slate-800 uppercase tracking-tight">{product.productName}</span>
                                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{product.specificOrderNo}</span>
                                        </div>
                                      </TableCell>
                                      <TableCell className="text-center p-2">
                                        <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700 font-black text-xs px-3">
                                          {product.actual_qty_dispatch || product.actualQty || "0"}
                                        </Badge>
                                      </TableCell>
                                      <TableCell className="text-center p-2">
                                        <Badge className="bg-green-100 text-green-700 border-green-200 font-black text-[9px] uppercase">Loaded OK</Badge>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}

                {/* 2. Final Verification Form (Bottom Content) */}
                <div className="pt-8 space-y-8 animate-in fade-in duration-500 border-t-4 border-slate-100">
                    <div className="flex items-center gap-3">
                       <div className="w-1.5 h-6 bg-blue-600 rounded-full" />
                       <h3 className="text-sm font-black text-slate-800 uppercase tracking-[0.2em]">Six-Point Security Verdict</h3>
                    </div>

                    <div className="bg-slate-50 border-2 border-slate-100 rounded-3xl p-8 space-y-8 shadow-sm">
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-2">
                               <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Bilty/GR Number</Label>
                               <Input 
                                 placeholder="E.G. BL-100293" 
                                 className="h-14 border-2 border-slate-200 rounded-2xl px-6 font-black text-xl text-slate-700 focus:border-blue-600 transition-all uppercase placeholder:text-slate-300"
                                 value={uploadData.biltyNo}
                                 onChange={(e) => setUploadData(p => ({...p, biltyNo: e.target.value}))}
                               />
                            </div>
                            <div className="space-y-2">
                               <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Bilty Image</Label>
                               <div className="relative h-14">
                                  <Input type="file" className="hidden" id="bilty-img" onChange={(e) => {
                                      if (e.target.files?.[0]) setUploadData(p => ({...p, biltyImage: e.target.files![0]}))
                                  }} />
                                  <Label htmlFor="bilty-img" className="absolute inset-0 border-2 border-dashed border-slate-200 rounded-2xl flex items-center justify-center bg-white cursor-pointer hover:bg-slate-50 hover:border-blue-300 transition-all">
                                     <span className="text-[11px] font-black uppercase text-slate-400 tracking-widest">
                                        {uploadData.biltyImage ? "IMAGE SELECTED" : "UPLOAD SCANNED COPY"}
                                     </span>
                                  </Label>
                               </div>
                            </div>
                         </div>

                         <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                               {Object.entries(uploadData.checklist).map(([key, val]) => (
                                 <div key={key} className={cn("flex items-center gap-3 p-4 rounded-2xl border-2 transition-all cursor-pointer", val ? "bg-white border-blue-500 shadow-md" : "bg-white border-slate-100")}>
                                    <Checkbox id={key} checked={val} onCheckedChange={(checked) => setUploadData(p => ({...p, checklist: {...p.checklist, [key]: !!checked}}))} />
                                    <Label htmlFor={key} className="text-[10px] font-black uppercase text-slate-600 cursor-pointer tracking-tighter">{key.replace(/([A-Z])/g, ' $1')}</Label>
                                 </div>
                               ))}
                         </div>

                         <div className="space-y-3">
                            <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Vehicle Proof Images</Label>
                            <div className="flex flex-wrap gap-4">
                               {uploadData.vehicleImages.map((file, idx) => (
                                 <div key={idx} className="w-24 h-24 rounded-2xl border-2 border-slate-100 overflow-hidden relative group shadow-sm">
                                    <img src={URL.createObjectURL(file)} className="w-full h-full object-cover" />
                                    <button onClick={() => {
                                      const images = [...uploadData.vehicleImages]
                                      images.splice(idx, 1)
                                      setUploadData(p => ({...p, vehicleImages: images}))
                                    }} className="absolute inset-0 bg-red-600/80 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"><X className="w-4 h-4" /></button>
                                 </div>
                               ))}
                               <label className="w-24 h-24 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center bg-white cursor-pointer hover:bg-slate-50 hover:border-blue-300 transition-all">
                                  <Plus className="w-7 h-7 text-slate-200" />
                                  <input type="file" multiple className="hidden" onChange={(e) => {
                                      if (e.target.files) setUploadData(p => ({...p, vehicleImages: [...p.vehicleImages, ...Array.from(e.target.files!)]}))
                                  }} />
                               </label>
                            </div>
                         </div>
                    </div>
                </div>
             </div>
          )}

          <DialogFooter className="mt-8 border-t pt-6 bg-slate-50/50 -mx-6 -mb-6 p-6">
            <Button variant="ghost" className="font-bold text-slate-500" onClick={() => setIsDialogOpen(false)}>Discard</Button>
            <Button 
               onClick={handleBulkSubmit} 
               disabled={isProcessing || selectedProducts.length === 0}
               className="bg-purple-600 hover:bg-purple-700 h-12 px-8 rounded-xl shadow-lg font-black uppercase tracking-tighter italic text-lg"
            >
              {isProcessing ? "Verifying..." : `Authorize Security Gatepass (${selectedProducts.length})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </WorkflowStageShell>
  )
}