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
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Settings2 } from "lucide-react"
import { actualDispatchApi } from "@/lib/api-service"

export default function ActualDispatchPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [pendingOrders, setPendingOrders] = useState<any[]>([])
  const [historyOrders, setHistoryOrders] = useState<any[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [selectedOrders, setSelectedOrders] = useState<string[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [confirmDetails, setConfirmDetails] = useState<Record<string, { qty: string }>>({})
  const PAGE_COLUMNS = [
    { id: "orderNo", label: "DO Number" },
    { id: "customerName", label: "Customer Name" },
    { id: "qtyToDispatch", label: "Qty to Dispatch" },
    { id: "deliveryFrom", label: "Delivery From" },
    { id: "status", label: "Status" },

    // Requested Options
    { id: "soNo", label: "DO No." },
    { id: "deliveryPurpose", label: "Order Type (Delivery Purpose)" },
    { id: "startDate", label: "Start Date" },
    { id: "endDate", label: "End Date" },
    { id: "deliveryDate", label: "Delivery Date" },
    { id: "orderType", label: "Order Type" },
    { id: "customerType", label: "Customer Type" },
    { id: "partySoDate", label: "Party DO Date" },
    { id: "oilType", label: "Oil Type" },
    { id: "ratePer15Kg", label: "Rate Per 15 kg" }, 
    { id: "ratePerLtr", label: "Rate Per Ltr." }, // Aggregated
    { id: "rate", label: "Rate" },
    { id: "totalWithGst", label: "Total Amount with GST" },
    { id: "transportType", label: "Type of Transporting" },
    { id: "contactPerson", label: "Customer Contact Person Name" },
    { id: "whatsapp", label: "Customer Contact Person Whatsapp No." },
    { id: "address", label: "Customer Address" },
    { id: "paymentTerms", label: "Payment Terms" },
    { id: "advanceTaken", label: "Advance Payment to be Taken" },
    { id: "advanceAmount", label: "Advance Amount" },
    { id: "isBroker", label: "Is this order Through Broker" },
    { id: "brokerName", label: "Broker Name (If Order Through Broker)" },
    { id: "uploadSo", label: "Upload DO" },
    { id: "skuName", label: "SKU Name" },
    { id: "approvalQty", label: "Approval Qty" },
    { id: "skuRates", label: "Take Required Rates of Each Item" },
    { id: "remark", label: "Remark" },
    { id: "rateRightly", label: "Rate Rightly" },
    { id: "dealingInOrder", label: "We Are Dealing in Order" },
    { id: "partyCredit", label: "Party Credit" },
    { id: "dispatchConfirmed", label: "Dispatch Date is Confirmed" },
    { id: "overallStatus", label: "Overall Status of Order" },
    { id: "orderConfirmation", label: "Order Confirmation with Customer" },
    { id: "qtytobedispatched", label: "Qty to be Dispatched" },
    { id: "dispatchfrom", label: "Dispatch from"}
  ]

  const [visibleColumns, setVisibleColumns] = useState<string[]>([
    "orderNo",
    "customerName",
    "qtyToDispatch",
    "deliveryFrom",
    "status",
  ])

  // Fetch data from backend API
  const fetchPendingDispatches = async () => {
    try {
      console.log('[ACTUAL DISPATCH] Fetching pending from API...');
      const response = await actualDispatchApi.getPending({ limit: 1000 });
      console.log('[ACTUAL DISPATCH] API Response:', response);
      
      if (response.success && response.data.dispatches) {
        setPendingOrders(response.data.dispatches);
        console.log('[ACTUAL DISPATCH] Loaded', response.data.dispatches.length, 'pending dispatches');
      }
    } catch (error: any) {
      console.error("[ACTUAL DISPATCH] Failed to fetch pending:", error);
      toast({
        title: "Error",
        description: error?.message || "Failed to load pending dispatches",
        variant: "destructive",
      });
    }
  };

  const fetchDispatchHistory = async () => {
    try {
      const response = await actualDispatchApi.getHistory({ limit: 1000 });
      
      if (response.success && response.data.dispatches) {
        setHistoryOrders(response.data.dispatches);
      }
    } catch (error: any) {
      console.error("[ACTUAL DISPATCH] Failed to fetch history:", error);
    }
  };

  useEffect(() => {
    fetchPendingDispatches();
    fetchDispatchHistory();
  }, [])

  /* Extract unique customer names */
  const customerNames = Array.from(new Set(pendingOrders.map(order => order.customerName || "Unknown")))

  const [filterValues, setFilterValues] = useState({
      status: "",
      startDate: "",
      endDate: "",
      partyName: ""
  })

  const filteredPendingOrders = pendingOrders.filter(order => {
      let matches = true
      
      // Filter by Party Name
      if (filterValues.partyName && filterValues.partyName !== "all" && order.customerName !== filterValues.partyName) {
          matches = false
      }

      // Filter by Date Range
      const orderDateStr = order.actualDispatchData?.confirmedAt || order.dispatchData?.dispatchDate || order.dispatchData?.dispatchedAt || order.timestamp
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

      // Filter by Status (On Time / Expire)
      if (filterValues.status) {
          const today = new Date()
          today.setHours(0, 0, 0, 0)
          const targetDateStr = order.deliveryDate || order.timestamp
          if (targetDateStr) {
             const targetDate = new Date(targetDateStr)
             
             if (filterValues.status === "expire") {
                 if (targetDate < today) matches = true
                 else matches = false
             } else if (filterValues.status === "on-time") {
                 if (targetDate >= today) matches = true
                 else matches = false
             }
          }
      }

      return matches
  })

  // Map backend data to display format with Grouping
  const displayRows = useMemo(() => {
    const grouped: { [key: string]: any } = {}

    filteredPendingOrders.forEach((order: any) => {
       const doNumber = order.so_no || order.soNo || "DO-XXX"
       // Group by Base DO (e.g. DO-022 from DO-022A)
       const baseDoMatch = doNumber.match(/^(DO-\d+)/i)
       const baseDo = baseDoMatch ? baseDoMatch[1] : doNumber

       if (!grouped[baseDo]) {
          // Flatten some nested data for easier access in header
          const internalOrder = order.data?.orderData || order;
          const preApproval = order.data?.preApprovalData || internalOrder.preApprovalData || {};
          const checklist = order.data?.checklistResults || {};
          
          grouped[baseDo] = {
             ...order,
             _rowKey: baseDo,
             doNumber: baseDo, // Display Base DO
             orderNo: baseDo, // For column display
             customerName: order.party_name || order.customerName,
             
             // Detailed Fields (Robust Mapping)
             soNo: order.so_no || order.soNo || "—",
             deliveryPurpose: order.order_type_delivery_purpose || order.deliveryPurpose || "—",
             startDate: order.start_date || order.startDate || "—",
             endDate: order.end_date || order.endDate || "—",
             deliveryDate: order.delivery_date || order.deliveryDate || "—",
             orderType: order.order_type || order.orderType || "—",
             customerType: order.customer_type || order.customerType || "—",
             partySoDate: order.party_so_date || order.partySoDate || "—",
             oilType: order.oil_type || order.oilType || "—",
             ratePer15Kg: order.rate_per_15kg || order.ratePer15Kg || "—", 
             ratePerLtr: order.rate_per_ltr || order.ratePerLtr || "—",
             rate: order.rate_of_material || order.rate || "—",
             totalWithGst: order.total_amount_with_gst || order.totalWithGst || "—",
             transportType: order.type_of_transporting || order.transportType || "—",
             contactPerson: order.customer_contact_person_name || order.contactPerson || "—",
             whatsapp: order.customer_contact_person_whatsapp_no || order.whatsapp || "—",
             address: order.customer_address || order.address || "—",
             paymentTerms: order.payment_terms || order.paymentTerms || "—",
             advanceTaken: order.advance_payment_to_be_taken || order.advanceTaken || "—",
             advanceAmount: order.advance_amount || order.advanceAmount || "—",
             isBroker: order.is_order_through_broker || order.isBroker || "—",
             brokerName: order.broker_name || order.brokerName || "—",
             skuName: order.sku_name || order.skuName || "—",
             approvalQty: order.approval_qty || order.approvalQty || "—",
             // Checklist status
             rateRightly: order.rate_is_rightly_as_per_current_market_rate || checklist.rate || "—",
             dealingInOrder: order.we_are_dealing_in_ordered_sku || checklist.sku || "—",
             partyCredit: order.party_credit_status || checklist.credit || "—",
             dispatchConfirmed: order.dispatch_date_confirmed || checklist.dispatch || "—",
             overallStatus: order.overall_status_of_order || checklist.overall || "—",
             orderConfirmation: order.order_confirmation_with_customer || checklist.confirm || "—",

             // Initialize these for aggregation
             qtyToDispatch: 0,
             deliveryFrom: order.dispatch_from || order.deliveryFrom || "—",
             _allProducts: [],
             _productCount: 0
          }
       }
       
       // Add individual product to the group
       const productQty = parseFloat(order.qty_to_be_dispatched || order.qtyToDispatch || 0);
       grouped[baseDo]._allProducts.push({
          ...order,
          _rowKey: `${baseDo}-${order.d_sr_number || order.id}`,
          productName: order.product_name || order.productName,
          qtyToDispatch: order.qty_to_be_dispatched || order.qtyToDispatch,
          deliveryFrom: order.dispatch_from || order.deliveryFrom,
          dsrNumber: order.d_sr_number
       })
       
       // Aggregate total qty
       grouped[baseDo].qtyToDispatch += productQty
       grouped[baseDo]._productCount = grouped[baseDo]._allProducts.length
    })

    return Object.values(grouped)
  }, [filteredPendingOrders])

  const toggleSelectAll = () => {
    if (selectedOrders.length === displayRows.length) {
      setSelectedOrders([])
    } else {
      setSelectedOrders(displayRows.map((row) => row._rowKey))
    }
  }

  const toggleSelectOrder = (rowKey: string) => {
    if (!rowKey) return
    if (selectedOrders.includes(rowKey)) {
      setSelectedOrders(selectedOrders.filter((id) => id !== rowKey))
    } else {
      setSelectedOrders([...selectedOrders, rowKey])
    }
  }

  // State for popup selection
  const [selectedGroup, setSelectedGroup] = useState<any>(null)
  const [dialogSelectedProducts, setDialogSelectedProducts] = useState<string[]>([])

  const handleOpenDialog = (group?: any) => {
      const targetGroup = group || (selectedOrders.length > 0 ? displayRows.find(r => r._rowKey === selectedOrders[0]) : null);
      
      if (targetGroup) {
          setSelectedGroup(targetGroup)
          // Default: Select ALL products in the group
          setDialogSelectedProducts(targetGroup._allProducts.map((p: any) => p._rowKey))
          
          // Pre-fill confirmation details
          const newDetails: Record<string, { qty: string }> = {};
          targetGroup._allProducts.forEach((prod: any) => {
             const rowKey = prod._rowKey;
             newDetails[rowKey] = {
                qty: String(prod.qtyToDispatch) // Default to planned qty
             };
          });
          setConfirmDetails(newDetails);
          
          setIsDialogOpen(true)
      }
  }

  const toggleSelectDialogProduct = (key: string) => {
     if (dialogSelectedProducts.includes(key)) {
         setDialogSelectedProducts(prev => prev.filter(k => k !== key))
     } else {
         setDialogSelectedProducts(prev => [...prev, key])
     }
  }

  const performDispatchConfirmation = async () => {
    setIsProcessing(true)
    try {
      if (!selectedGroup || dialogSelectedProducts.length === 0) {
        setIsDialogOpen(false);
        return;
      }

      const successfulDispatches: any[] = []
      const failedDispatches: any[] = []
      
      const itemsToProcess = selectedGroup._allProducts.filter((p: any) => dialogSelectedProducts.includes(p._rowKey))

      // Submit each item to backend API
      for (const item of itemsToProcess) {
        const dsrNumber = item.d_sr_number || item.dsrNumber; 
        const rowKey = item._rowKey;
        const confirmedQty = confirmDetails[rowKey]?.qty;

        try {
          if (dsrNumber) {
            const dispatchData = {
              product_name_1: item.productName || item.product_name,
              actual_qty_dispatch: confirmedQty || item.qtyToDispatch,
            };

            console.log('[ACTUAL DISPATCH] Submitting for DSR:', dsrNumber, dispatchData);
            const response = await actualDispatchApi.submit(dsrNumber, dispatchData);
            
            if (response.success) {
              successfulDispatches.push({ item, dsrNumber });
            } else {
              failedDispatches.push({ item, error: response.message || 'Unknown error' });
            }
          } else {
            failedDispatches.push({ item, error: 'No DSR number found' });
          }
        } catch (error: any) {
          failedDispatches.push({ item, error: error?.message || 'Unknown error' });
        }
      }

      // Show results
      if (successfulDispatches.length > 0) {
        toast({
          title: "Dispatch Confirmed",
          description: `${successfulDispatches.length} dispatch(es) confirmed successfully.`,
        });

        setSelectedOrders([]);
        setIsDialogOpen(false); 
        setConfirmDetails({});
        setSelectedGroup(null);
        setDialogSelectedProducts([]);

        await fetchPendingDispatches();
        await fetchDispatchHistory();

        setTimeout(() => {
          router.push("/vehicle-details")
        }, 1500)
      }

      if (failedDispatches.length > 0) {
        toast({
          title: "Some Dispatches Failed",
          description: `${failedDispatches.length} dispatch(es) failed.`,
          variant: "destructive",
        })
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <WorkflowStageShell
      title="Stage 5: Actual Dispatch"
      description="Confirm actual dispatch details before vehicle assignment."
      pendingCount={displayRows.length}
      historyData={historyOrders.map((order) => ({
        date: new Date(order.actualDispatchData?.confirmedAt || order.timestamp || new Date()).toLocaleDateString("en-GB"),
        stage: "Actual Dispatch",
        status: "Completed",
        remarks: "Dispatch Confirmed",
      }))}
      partyNames={customerNames}
      onFilterChange={setFilterValues}
      remarksColName="Confirmation"
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
              {PAGE_COLUMNS.map((col) => (
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
            onClick={() => handleOpenDialog()}
            disabled={selectedOrders.length === 0}
          >
             {selectedOrders.length > 1 ? `Select 1 Group` : `Confirm Dispatch (${selectedOrders.length})`}
          </Button>
        </div>

        <Card className="border-none shadow-sm overflow-auto max-h-[600px]">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-card shadow-sm">
              <TableRow>
                <TableHead className="w-12 text-center">
                  <Checkbox
                    checked={displayRows.length > 0 && selectedOrders.length === displayRows.length}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                {PAGE_COLUMNS.filter((col) => visibleColumns.includes(col.id)).map((col) => (
                  <TableHead key={col.id} className="whitespace-nowrap text-center">
                    {col.label}
                  </TableHead>
                ))}
                <TableHead className="text-center">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayRows.length > 0 ? (
                displayRows.map((row) => {
                     const rowKey = row._rowKey;
                     return (
                       <TableRow key={rowKey} className={selectedOrders.includes(rowKey) ? "bg-blue-50/50" : ""}>
                         <TableCell className="text-center">
                           <Checkbox
                             checked={selectedOrders.includes(rowKey)}
                             onCheckedChange={() => toggleSelectOrder(rowKey)}
                           />
                         </TableCell>
                         {PAGE_COLUMNS.filter((col) => visibleColumns.includes(col.id)).map((col) => (
                           <TableCell key={col.id} className="whitespace-nowrap text-center">
                              {col.id === "status" ? (
                                 <div className="flex justify-center flex-col items-center gap-1">
                                   <Badge className="bg-blue-100 text-blue-700">Ready for Dispatch</Badge>
                                   {row._productCount > 1 && (
                                       <span className="text-[10px] text-slate-500 font-medium">({row._productCount} Items)</span>
                                   )}
                                 </div>
                              ) : col.id === "qtyToDispatch" ? (
                                  <div className="flex flex-col items-center">
                                      <span>{row.qtyToDispatch}</span>
                                      {row._productCount > 1 && <span className="text-[10px] text-slate-500">(Total)</span>}
                                  </div>
                              ) : (
                                 row[col.id as keyof typeof row]
                              )}
                           </TableCell>
                         ))}
                         <TableCell>
                             <Button variant="ghost" size="sm" onClick={() => {
                                 setSelectedOrders([rowKey])
                                 handleOpenDialog(row)
                             }}>
                                 <Settings2 className="w-4 h-4 text-slate-400 hover:text-blue-600" />
                             </Button>
                         </TableCell>
                       </TableRow>
                     )
                  })
               ) : (
                 <TableRow>
                   <TableCell colSpan={visibleColumns.length + 2} className="text-center py-8 text-muted-foreground">
                     No orders pending for actual dispatch
                   </TableCell>
                 </TableRow>
               )}
            </TableBody>
          </Table>
        </Card>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-6xl max-w-6xl! max-h-[95vh] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="text-xl font-bold text-slate-900 leading-none">
              Dispatch Confirmation: {selectedGroup?.doNumber || "Actual Dispatch"}
            </DialogTitle>
            <DialogDescription className="text-slate-500 mt-1.5">
              Verify and confirm the actual dispatch quantities.
            </DialogDescription>
          </DialogHeader>
          
          {selectedGroup && (
             <div className="space-y-6">
                {/* Order Details Header */}
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mt-4">
                    <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-3">Order Details</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-4">
                        <div>
                            <p className="text-xs text-slate-500 font-medium">Delivery Purpose</p>
                            <p className="text-sm font-semibold text-slate-900">{selectedGroup.deliveryPurpose}</p>
                        </div>
                        <div>
                            <p className="text-xs text-slate-500 font-medium">Order Type</p>
                            <p className="text-sm font-semibold text-slate-900">{selectedGroup.orderType}</p>
                        </div>
                        <div>
                             <p className="text-xs text-slate-500 font-medium">Dates</p>
                             <p className="text-xs font-semibold text-slate-900">
                                 Start: {selectedGroup.startDate}<br/>
                                 End: {selectedGroup.endDate}
                             </p>
                        </div>
                        <div>
                            <p className="text-xs text-slate-500 font-medium">Delivery Date</p>
                            <p className="text-sm font-semibold text-slate-900">{selectedGroup.deliveryDate}</p>
                        </div>
                        
                        <div>
                            <p className="text-xs text-slate-500 font-medium">Transport</p>
                            <p className="text-sm font-semibold text-slate-900">{selectedGroup.transportType}</p>
                        </div>
                        <div>
                            <p className="text-xs text-slate-500 font-medium">Customer</p>
                            <p className="text-sm font-semibold text-slate-900 truncate" title={selectedGroup.customerName}>{selectedGroup.customerName}</p>
                            <p className="text-xs text-slate-500">{selectedGroup.contactPerson} ({selectedGroup.whatsapp})</p>
                        </div>
                        <div className="md:col-span-2">
                             <p className="text-xs text-slate-500 font-medium">Address</p>
                             <p className="text-xs font-semibold text-slate-900 truncate" title={selectedGroup.address}>{selectedGroup.address}</p>
                        </div>

                        <div>
                            <p className="text-xs text-slate-500 font-medium">Payment Terms</p>
                            <p className="text-sm font-semibold text-slate-900">{selectedGroup.paymentTerms}</p>
                        </div>
                         <div>
                            <p className="text-xs text-slate-500 font-medium">Advance Payment</p>
                            <p className="text-sm font-semibold text-slate-900">
                                {selectedGroup.advanceTaken ? `Yes (${selectedGroup.advanceAmount})` : "No"}
                            </p>
                        </div>
                        <div>
                             <p className="text-xs text-slate-500 font-medium">Broker</p>
                             <p className="text-sm font-semibold text-slate-900">
                                 {selectedGroup.isBroker ? `Yes (${selectedGroup.brokerName})` : "No"}
                             </p>
                        </div>
                         <div>
                            <p className="text-xs text-slate-500 font-medium">Credit Status</p>
                             <div className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${selectedGroup.partyCredit === 'Good' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                {selectedGroup.partyCredit}
                            </div>
                        </div>
                        
                        <div className="col-span-full flex flex-wrap gap-4 pt-2 border-t border-slate-200 mt-2">
                            <div className="flex items-center gap-2">
                               <div className={`w-2 h-2 rounded-full ${selectedGroup.weDealInSku ? 'bg-green-500' : 'bg-red-500'}`} />
                               <span className="text-xs text-slate-600">We Deal in SKU?</span>
                           </div>
                            <div className="flex items-center gap-2">
                               <div className={`w-2 h-2 rounded-full ${selectedGroup.dispatchConfirmed ? 'bg-green-500' : 'bg-red-500'}`} />
                               <span className="text-xs text-slate-600">Dispatch Confirmed?</span>
                           </div>
                            <div className="flex items-center gap-2">
                               <div className={`w-2 h-2 rounded-full ${selectedGroup.overallStatus === 'Approved' ? 'bg-green-500' : 'bg-red-500'}`} />
                               <span className="text-xs text-slate-600">Overall Status: {selectedGroup.overallStatus}</span>
                           </div>
                           <div className="flex items-center gap-2">
                               <div className={`w-2 h-2 rounded-full ${selectedGroup.orderConfirmation ? 'bg-green-500' : 'bg-red-500'}`} />
                               <span className="text-xs text-slate-600">Cust. Confirmed?</span>
                           </div>
                        </div>
                    </div>
                </div>

                {/* Product Table */}
                <div className="border rounded-md mt-4 max-h-[400px] overflow-auto">
                    <Table>
                        <TableHeader className="bg-slate-50 sticky top-0 z-10">
                            <TableRow>
                                <TableHead className="w-[50px] text-center">
                                    <Checkbox 
                                        checked={dialogSelectedProducts.length > 0 && dialogSelectedProducts.length === selectedGroup._allProducts.length}
                                        onCheckedChange={(checked) => {
                                            if (checked) setDialogSelectedProducts(selectedGroup._allProducts.map((p: any) => p._rowKey))
                                            else setDialogSelectedProducts([])
                                        }}
                                    />
                                </TableHead>
                                <TableHead>Product Name</TableHead>
                                <TableHead>Planned Qty</TableHead>
                                <TableHead>Delivery From</TableHead>
                                <TableHead className="w-[180px]">Actual Qty Dispatched</TableHead>
                                <TableHead>Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {selectedGroup._allProducts.map((prod: any) => {
                                const rowKey = prod._rowKey;
                                return (
                                <TableRow key={rowKey} className={dialogSelectedProducts.includes(rowKey) ? "bg-blue-50/30" : ""}>
                                    <TableCell className="text-center">
                                        <Checkbox 
                                            checked={dialogSelectedProducts.includes(rowKey)}
                                            onCheckedChange={() => toggleSelectDialogProduct(rowKey)}
                                        />
                                    </TableCell>
                                    <TableCell className="font-medium text-xs">{prod.productName || "—"}</TableCell>
                                    <TableCell className="text-xs font-bold">{prod.qtyToDispatch}</TableCell>
                                    <TableCell className="text-xs">{prod.deliveryFrom}</TableCell>
                                    <TableCell>
                                        <Input
                                            type="number"
                                            className="h-8 text-xs"
                                            placeholder="Actual Qty"
                                            value={confirmDetails[rowKey]?.qty || ""}
                                            onChange={(e) =>
                                              setConfirmDetails((prev) => ({
                                                ...prev,
                                                [rowKey]: {
                                                   ...prev[rowKey],
                                                   qty: e.target.value
                                                }
                                              }))
                                            }
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="text-[10px] bg-orange-50 text-orange-700 border-orange-200">Pending</Badge>
                                    </TableCell>
                                </TableRow>
                            )})}
                        </TableBody>
                    </Table>
                </div>
            </div>
          )}

          <DialogFooter className="mt-4 border-t pt-4">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={performDispatchConfirmation} disabled={isProcessing || dialogSelectedProducts.length === 0}>
               {isProcessing ? "Processing..." : `Confirm Dispatch (${dialogSelectedProducts.length})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </WorkflowStageShell>
  )
}
