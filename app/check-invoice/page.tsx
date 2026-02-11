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
  DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { CheckCircle, Settings2 } from "lucide-react"
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ALL_WORKFLOW_COLUMNS as ALL_COLUMNS } from "@/lib/workflow-columns"
import { checkInvoiceApi } from "@/lib/api-service"
import { cn } from "@/lib/utils"

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

  // Selection & Dialog State
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [selectedGroups, setSelectedGroups] = useState<any[]>([]) // Changed to array for multi-group support
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [expandedOrders, setExpandedOrders] = useState<string[]>([]) // State to manage expanded sections

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

  /* Filter Logic */
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

  /* Grouping Logic */
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
             _ordersMap: {}, // Group items by specific DO for interleaved view
             _productCount: 0
          }
       }
       
       const group = grouped[partyName]
       group.doNumberList.add(doNumber)
       
       const orderKey = doNumber;
       
       if (!group._ordersMap[orderKey]) {
         group._ordersMap[orderKey] = {
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
           totalAmount: order.total_amount_with_gst || "—",
           oilType: order.oil_type || "—",
           // Check Invoice specific data
           invoiceNo: order.invoice_no,
           invoiceDate: order.invoice_date,
           biltyNo: order.bilty_no,
           rstNo: order.rst_no,
           grossWeight: order.gross_weight,
           tareWeight: order.tare_weight,
           netWeight: order.net_weight,
           transporterName: order.transporter_name,
           truckNo: order.truck_no,
           diffReason: order.reason_of_difference_in_weight_if_any_speacefic
         }
       }
       
       const product = {
          ...order,
          _rowKey: `${partyName}-${order.id}`,
          id: order.id,
          specificOrderNo: doNumber,
          productName: order.product_name,
          invoiceNo: order.invoice_no,
          invoiceDate: order.invoice_date,
          billAmount: order.bill_amount,
          qty: order.qty,
          actualQty: order.actual_qty_dispatch || order.actual_qty,
          truckNo: order.truck_no,
          rstNo: order.rst_no,
          grossWeight: order.gross_weight,
          tareWeight: order.tare_weight,
          netWeight: order.net_weight,
          transporterName: order.transporter_name,
          // Newly requested fields
          fitness: order.fitness,
          insurance: order.insurance,
          tax_copy: order.tax_copy,
          polution: order.polution,
          permit1: order.permit1,
          permit2_out_state: order.permit2_out_state,
          weightment_slip_copy: order.weightment_slip_copy,
          vehicle_no_plate_image: order.vehicle_no_plate_image,
          bilty_image: order.bilty_image,
          vehicle_image_attachemrnt: order.vehicle_image_attachemrnt,
          reason_of_difference_in_weight_if_any_speacefic: order.reason_of_difference_in_weight_if_any_speacefic,
          processid: order.processid || null
       }
       
       group._ordersMap[orderKey]._products.push(product)
       group._allProducts.push(product)
       group._productCount = group._allProducts.length
    })

    // Convert Set to string for display
    return Object.values(grouped).map(group => ({
       ...group,
       doNumber: Array.from(group.doNumberList).join(", "),
       processId: group._allProducts[0]?.processid || "—"
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
    
    // Get all selected groups
    const targets = displayRows.filter(r => selectedItems.includes(r._rowKey))
    if (targets.length > 0) {
      setSelectedGroups(targets)
      // Select all products by default from all selected groups
      const allProdKeys = targets.flatMap(g => g._allProducts.map((p: any) => p._rowKey))
      setSelectedProducts(allProdKeys)
      
      // Reset form
      setCheckData({ status: "", remarks: "" })
      setExpandedOrders([]) // Reset expanded state
      
      setIsDialogOpen(true)
    }
  }

  const handleSubmit = async () => {
    if (selectedGroups.length === 0 || !checkData.status) {
        toast({
            title: "Validation Error",
            description: "Please enter verification status.",
            variant: "destructive"
        })
        return
    }

    // Flatten all selected products from all selected groups
    const productsToSubmit = selectedGroups.flatMap(group => 
      group._allProducts.filter((p: any) => selectedProducts.includes(p._rowKey))
    )
    
    if (productsToSubmit.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one product to verify",
        variant: "destructive"
      })
      return
    }

    setIsProcessing(true)
    try {
      const successfulSubmissions: any[] = []
      const failedSubmissions: any[] = []

      for (const product of productsToSubmit) {
        const submitData = {
            status_1: checkData.status,
            remarks_2: checkData.remarks,
        };

        try {
            console.log(`[CHECK] Submitting for ID ${product.id}`, submitData);
            const response = await checkInvoiceApi.submit(product.id, submitData);
            
            if (response.success) {
                successfulSubmissions.push(product);
            } else {
                failedSubmissions.push({ product, error: response.message });
            }
        } catch (err: any) {
             console.error(`[CHECK] Failed for ID ${product.id}`, err);
             failedSubmissions.push({ product, error: err.message });
        }
      }

      if (successfulSubmissions.length > 0) {
        toast({
          title: "Invoices Verified",
          description: `Successfully verified ${successfulSubmissions.length} items.`,
        })
        
        await fetchPending();
        await fetchHistory();
        
        setIsDialogOpen(false)
        setSelectedItems([])
      }

      if (failedSubmissions.length > 0) {
        toast({
            title: "Partial Failure",
            description: `Failed to process ${failedSubmissions.length} items.`,
            variant: "destructive"
        })
      }

    } catch (error: any) {
      console.error("Batch submit error:", error);
      toast({
        title: "Error",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const customerNames = Array.from(new Set(pendingOrders.map(order => order.party_name || order.partyName || "Unknown Customer")))

  return (
    <WorkflowStageShell
      title="Stage 10: Check Invoice"
      description="Review and verify invoices grouped by Customer."
      pendingCount={displayRows.length}
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
        {/* Action Bar */}
        <div className="flex justify-end gap-2">
           <Button 
            onClick={handleOpenDialog}
            disabled={selectedItems.length === 0} 
            className="bg-blue-600 hover:bg-blue-700"
          >
            <CheckCircle className="mr-2 h-4 w-4" />
            Verify Invoice ({selectedItems.length})
          </Button>

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

        {/* Main Table (Grouped) */}
        <Card className="border-none shadow-sm overflow-auto max-h-[600px]">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-card shadow-sm">
              <TableRow>
                <TableHead className="w-12 text-center">
                    <Checkbox checked={displayRows.length > 0 && selectedItems.length === displayRows.length} onCheckedChange={toggleSelectAll} />
                </TableHead>
                <TableHead className="whitespace-nowrap text-center">DO Number</TableHead>
                <TableHead className="whitespace-nowrap text-center">Process ID</TableHead>
                <TableHead className="whitespace-nowrap text-center">Customer Name</TableHead>
                <TableHead className="whitespace-nowrap text-center">Products</TableHead>
                <TableHead className="whitespace-nowrap text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayRows.length > 0 ? (
                displayRows.map((group) => (
                   <TableRow key={group._rowKey} className={selectedItems.includes(group._rowKey) ? "bg-blue-50/50" : ""}>
                      <TableCell className="text-center">
                        <Checkbox checked={selectedItems.includes(group._rowKey)} onCheckedChange={() => toggleSelectItem(group._rowKey)} />
                      </TableCell>
                      <TableCell className="text-center text-xs font-medium">{group.doNumber}</TableCell>
                      <TableCell className="text-center text-xs font-medium">{group.processId}</TableCell>
                      <TableCell className="text-center text-xs">{group.customerName}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{group._productCount} items</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                         <Badge className="bg-yellow-100 text-yellow-700">Pending Review</Badge>
                      </TableCell>
                   </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No invoices pending for review
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </div>

       {/* Split-View Dialog */}
       <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="!max-w-[95vw] w-full max-h-[95vh] overflow-y-auto p-0">
          <div className="p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-900 border-b pb-4 mb-4">
              Verify Invoices - {selectedGroups.length > 1 ? `${selectedGroups.length} Parties Selected` : selectedGroups[0]?.customerName}
            </DialogTitle>
          </DialogHeader>

          {selectedGroups.length > 0 && (
            <div className="space-y-12 mt-6">
               {selectedGroups.map((group, groupIdx) => {
                 const allProducts = group._allProducts;
                 const allSelected = allProducts.every((p: any) => selectedProducts.includes(p._rowKey));
                 const isExpanded = expandedOrders.includes(group._rowKey);
                 const toggleExpand = () => {
                   setExpandedOrders(prev => isExpanded ? prev.filter(id => id !== group._rowKey) : [...prev, group._rowKey]);
                 };

                 const uniqueOrderDetails = Object.values(group._ordersMap);

                 return (
                   <div key={group._rowKey} className="space-y-6">
                      <h2 className="text-xl font-black text-slate-800 border-b-4 border-slate-100 pb-2 mt-4 uppercase tracking-tight flex items-center justify-between">
                        {group.customerName}
                        <Badge className="bg-blue-600 text-white ml-3 px-3 py-1 font-black">
                          {group._productCount} PRODUCTS
                        </Badge>
                      </h2>

                      <div className="space-y-4 border-2 border-slate-100 rounded-3xl overflow-hidden bg-white shadow-sm">
                        <div className="bg-blue-600 px-5 py-3 flex items-center justify-between cursor-pointer" onClick={toggleExpand}>
                           <div className="flex items-center gap-4">
                             <Badge className="bg-white text-blue-800 hover:bg-white px-4 py-1.5 text-sm font-black tracking-tight rounded-full shadow-sm uppercase">
                                DISPATCH DETAILS
                             </Badge>
                             <div className="flex flex-col">
                               <span className="text-[10px] text-blue-100 font-black uppercase tracking-widest leading-none mb-1">GROUP {groupIdx + 1} | {group.doNumber}</span>
                               <span className="text-xs text-blue-100 font-bold leading-none">
                                 {allProducts.filter((p: any) => selectedProducts.includes(p._rowKey)).length} Items Checked
                               </span>
                             </div>
                           </div>
                           <div className="flex items-center gap-3">
                             <div className="text-[11px] text-blue-50 font-bold uppercase tracking-widest mr-2 leading-none">
                               {isExpanded ? 'HIDE AUDIT DATA ▲' : 'SHOW AUDIT DATA ▼'}
                             </div>
                           </div>
                        </div>

                        <div className="px-5 pb-5 space-y-4">
                          {/* Consolidated Collapsible Audit Details Bar */}
                          {isExpanded && (
                            <div className="space-y-6 animate-in slide-in-from-top-2 duration-300 mt-2">
                              {uniqueOrderDetails.map((orderDetails: any, idx) => {
                                const firstProd = orderDetails._products[0] || {};
                                return (
                                  <div key={idx} className="bg-slate-50 border border-slate-100 rounded-2xl p-6 relative shadow-inner">
                                    <div className="absolute -top-3 left-6">
                                      <Badge className="bg-slate-200 text-slate-700 hover:bg-slate-200 text-[10px] font-black uppercase px-3 py-1">
                                        ORDER: {firstProd.specificOrderNo}
                                      </Badge>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                                      {/* Order Info */}
                                      <div>
                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Delivery Purpose</p>
                                        <p className="text-xs font-bold text-slate-900 leading-none">{orderDetails.deliveryPurpose}</p>
                                      </div>
                                      <div>
                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Start Date / End Date</p>
                                        <p className="text-xs font-bold text-slate-900 leading-none">
                                            {orderDetails.startDate ? new Date(orderDetails.startDate).toLocaleDateString("en-GB") : "—"} / {orderDetails.endDate ? new Date(orderDetails.endDate).toLocaleDateString("en-GB") : "—"}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Transport Type</p>
                                        <p className="text-xs font-bold text-slate-900 leading-none">{orderDetails.transportType}</p>
                                      </div>
                                      <div>
                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Credit Status</p>
                                        <Badge className={cn("text-[10px] font-black px-2 py-0.5", orderDetails.partyCredit === 'Good' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')}>
                                            {orderDetails.partyCredit}
                                        </Badge>
                                      </div>

                                      <div className="md:col-span-4 h-px bg-slate-200 my-1" />

                                      {/* Dispatch Info */}
                                      <div>
                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Truck No</p>
                                        <p className="text-sm font-black text-blue-800">{firstProd.truckNo || "—"}</p>
                                      </div>
                                      <div>
                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Bilty No</p>
                                        <p className="text-xs font-black text-blue-600">{firstProd.biltyNo || firstProd.bilty_no || "—"}</p>
                                      </div>
                                      <div>
                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Invoice No</p>
                                        <p className="text-xs font-black text-green-600">{firstProd.invoiceNo || "—"}</p>
                                      </div>
                                      <div>
                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Invoice Date</p>
                                        <p className="text-xs font-bold text-slate-700">
                                            {firstProd.invoiceDate ? new Date(firstProd.invoiceDate).toLocaleDateString("en-GB") : "—"}
                                        </p>
                                      </div>

                                      <div className="md:col-span-4 h-px bg-slate-200 my-1" />

                                      {/* Security Audit Info */}
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
                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">RST No</p>
                                        <p className="text-xs font-black text-slate-900">#{firstProd.rstNo || "—"}</p>
                                      </div>
                                      <div>
                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Audit Status</p>
                                        <Badge variant="outline" className={cn("text-[9px] font-black", firstProd.check_status === 'OK' ? "text-green-600 border-green-200 bg-green-50" : "text-amber-600 border-amber-200 bg-amber-50")}>
                                          {firstProd.check_status || "—"}
                                        </Badge>
                                      </div>

                                      <div className="md:col-span-4 h-px bg-slate-200 my-1" />

                                      {/* Weightment Info */}
                                      <div>
                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Weight Slip</p>
                                        <p className="text-xs font-bold text-slate-700">{firstProd.weightment_slip_copy || "—"}</p>
                                      </div>
                                      <div>
                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Gross / Tare / Net</p>
                                        <p className="text-xs font-black text-slate-900">{firstProd.grossWeight || "0"} / {firstProd.tareWeight || "0"} / <span className="text-blue-600">{firstProd.netWeight || "0"}</span></p>
                                      </div>
                                      <div>
                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Weight Diff Reason</p>
                                        <p className="text-[10px] font-bold text-red-500 italic">{firstProd.reason_of_difference_in_weight_if_any_speacefic || "—"}</p>
                                      </div>
                                      <div>
                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Transporter Name</p>
                                        <p className="text-xs font-bold text-slate-700 truncate" title={firstProd.transporterName}>{firstProd.transporterName || "—"}</p>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Product Table (Always Visible) */}
                          <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-white">
                            <Table>
                              <TableHeader className="bg-slate-50">
                                <TableRow>
                                  <TableHead className="w-12 text-center h-10">
                                    <Checkbox 
                                      checked={allSelected}
                                      onCheckedChange={(checked) => {
                                        if (checked) {
                                          setSelectedProducts(prev => Array.from(new Set([...prev, ...allProducts.map((p: any) => p._rowKey)])))
                                        } else {
                                          setSelectedProducts(prev => prev.filter(k => !allProducts.some((p: any) => p._rowKey === k)))
                                        }
                                      }}
                                    />
                                  </TableHead>
                                  <TableHead className="text-[10px] uppercase font-black h-10">PRODUCT INFO</TableHead>
                                  <TableHead className="text-[10px] uppercase font-black text-center h-10">INVOICE NO</TableHead>
                                  <TableHead className="text-[10px] uppercase font-black text-center h-10">BILL AMOUNT</TableHead>
                                  <TableHead className="text-[10px] uppercase font-black text-center h-10">ACTUAL QTY</TableHead>
                                  <TableHead className="text-[10px] uppercase font-black text-center h-10">TRUCK NO</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {allProducts.map((product: any) => (
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
                                    <TableCell className="text-center p-2 text-xs font-bold text-green-700">
                                       {product.invoiceNo || "—"}
                                    </TableCell>
                                    <TableCell className="text-center p-2 text-xs font-black">
                                       ₹{product.billAmount || "0"}
                                    </TableCell>
                                    <TableCell className="text-center p-2">
                                      <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700 font-black text-xs px-3">
                                        {product.actualQty || "0"}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="text-center p-2 text-xs font-bold text-slate-700">
                                       {product.truckNo || "—"}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      </div>
                   </div>
                 );
               })}
            </div>
          )}

          {/* Verification Form (Bottom) */}
          <div className="mt-8 space-y-6 border rounded-lg p-6 bg-white shadow-sm">
             <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b pb-2">
                <CheckCircle className="h-4 w-4 text-blue-600" />
                Final Verification Logic
             </h3>
             
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="space-y-2">
                   <Label>Verification Status <span className="text-red-500">*</span></Label>
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
                     className="h-[38px] min-h-[38px]"
                   />
                 </div>
             </div>
          </div>

          <DialogFooter className="mt-8 border-t pt-4 bg-gray-50 -mx-6 -mb-6 px-6 py-4">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isProcessing}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={isProcessing || !checkData.status}
              className="bg-blue-600 hover:bg-blue-700 min-w-[150px]"
            >
              {isProcessing ? "Processing..." : "Complete Verification"}
            </Button>
          </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </WorkflowStageShell>
  )
}