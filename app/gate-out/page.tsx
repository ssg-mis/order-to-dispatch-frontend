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
import { Upload, CheckCircle, Settings2, ChevronUp, ChevronDown, CheckSquare } from "lucide-react"
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ALL_WORKFLOW_COLUMNS as ALL_COLUMNS } from "@/lib/workflow-columns"
import { gateOutApi, orderApi } from "@/lib/api-service"
import { cn } from "@/lib/utils"

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

  // Selection & Dialog State
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [selectedGroups, setSelectedGroups] = useState<any[]>([]) // Changed to array for multi-group support
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [expandedOrders, setExpandedOrders] = useState<string[]>([]) // State to manage expanded sections

  // Gate Out Form State
  const [isUploading, setIsUploading] = useState<string | null>(null)
  const [gateOutData, setGateOutData] = useState({
    gatePassFile: "" as string,
    gatePassFileName: "",
    vehicleLoadedImage: "" as string,
    vehicleLoadedImageName: "",
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

  const handleFileUpload = async (file: File, type: 'gatePass' | 'vehicleImage') => {
    if (!file) return;
    
    setIsUploading(type);
    try {
      const response = await orderApi.uploadFile(file);
      if (response.success) {
        if (type === 'gatePass') {
          setGateOutData(p => ({
            ...p,
            gatePassFile: response.data.url,
            gatePassFileName: file.name
          }));
        } else {
          setGateOutData(p => ({
            ...p,
            vehicleLoadedImage: response.data.url,
            vehicleLoadedImageName: file.name
          }));
        }
        toast({
          title: "Upload Successful",
          description: `${file.name} uploaded successfully.`
        });
      }
    } catch (error: any) {
      console.error("Upload failed:", error);
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload file to S3",
        variant: "destructive",
      });
    } finally {
      setIsUploading(null);
    }
  };

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
      const orderDateStr = order.timestamp || order.planned_7
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
           customerAddress: order.customer_address || "—",
           paymentTerms: order.payment_terms || "—",
           advanceAmount: order.advance_amount || 0,
           isBroker: order.is_order_through_broker || false,
           brokerName: order.broker_name || "—",
           partyCredit: order.party_credit_status || "Good",
           totalAmount: order.total_amount_with_gst || "—",
           oilType: order.oil_type || "—"
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
          actualQty: order.actual_qty_dispatch,
          truckNo: order.truck_no,
          rstNo: order.rst_no,
          grossWeight: order.gross_weight,
          tareWeight: order.tare_weight,
          netWeight: order.net_weight,
          transporterName: order.transporter_name,
          fitness: order.fitness,
          insurance: order.insurance,
          polution: order.polution,
          tax_copy: order.tax_copy,
          permit1: order.permit1,
          permit2_out_state: order.permit2_out_state,
          check_status: order.check_status,
          remarks: order.remarks,
          weightment_slip_copy: order.weightment_slip_copy,
          reasonForDiff: order.reason_of_difference_in_weight_if_any_speacefic,
          bilty_no: order.bilty_no
       }
       
       group._ordersMap[orderKey]._products.push(product)
       group._allProducts.push(product)
       group._productCount = group._allProducts.length
    })

    // Finalize DO numbers string
    const result = Object.values(grouped).map((g: any) => ({
      ...g,
      doNumber: Array.from(g.doNumberList).join(", ")
    }))

    return result
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
      setGateOutData({ 
        gatePassFile: "", 
        gatePassFileName: "",
        vehicleLoadedImage: "",
        vehicleLoadedImageName: "" 
      })
      setExpandedOrders([]) // Reset expanded state
      
      setIsDialogOpen(true)
    }
  }

  const handleSubmit = async () => {
    if (selectedGroups.length === 0) return

    // Flatten all selected products from all selected groups
    const productsToSubmit = selectedGroups.flatMap(group => 
      group._allProducts.filter((p: any) => selectedProducts.includes(p._rowKey))
    )
    
    if (productsToSubmit.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one product",
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
            gate_pass: gateOutData.gatePassFile || "",
            vehicle_image: gateOutData.vehicleLoadedImage || "",
        };

        try {
            console.log(`[GATE-OUT] Submitting for ID ${product.id}`, submitData);
            const response = await gateOutApi.submit(product.id, submitData);
            
            if (response.success) {
                successfulSubmissions.push(product);
            } else {
                failedSubmissions.push({ product, error: response.message });
            }
        } catch (err: any) {
             console.error(`[GATE-OUT] Failed for ID ${product.id}`, err);
             failedSubmissions.push({ product, error: err.message });
        }
      }

      if (successfulSubmissions.length > 0) {
        toast({
          title: "Gate Out Completed",
          description: `Successfully processed ${successfulSubmissions.length} items.`,
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
      title="Stage 11: Gate Out"
      description="Record gate out details and upload gate pass grouped by Customer."
      pendingCount={displayRows.length}
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
        {/* Action Bar */}
        <div className="flex justify-end gap-2">
           <Button 
            onClick={handleOpenDialog}
            disabled={selectedItems.length === 0} 
            className="bg-blue-600 hover:bg-blue-700"
          >
            <CheckCircle className="mr-2 h-4 w-4" />
            Complete Gate Out ({selectedItems.length})
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
                      <TableCell className="text-center text-xs">{group.customerName}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{group._productCount} items</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                         <Badge className="bg-rose-100 text-rose-700">Ready for Gate Out</Badge>
                      </TableCell>
                   </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No orders pending for gate out
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
              Complete Gate Out - {selectedGroups.length > 1 ? `${selectedGroups.length} Parties Selected` : selectedGroups[0]?.customerName}
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
                                DISPATCH & AUDIT DATA
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
                               {isExpanded ? 'HIDE DETAILS ▲' : 'SHOW DETAILS ▼'}
                             </div>
                           </div>
                        </div>

                        <div className="px-5 pb-5 space-y-4">
                          {/* Consolidated Collapsible Details Bar */}
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
                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Audit Status</p>
                                        <Badge variant="outline" className={cn("text-[9px] font-black", firstProd.check_status === 'OK' ? "text-green-600 border-green-200 bg-green-50" : "text-amber-600 border-amber-200 bg-amber-50")}>
                                          {firstProd.check_status || "—"}
                                        </Badge>
                                      </div>

                                      <div className="md:col-span-4 h-px bg-slate-200 my-1" />

                                      {/* Weightment Info */}
                                      <div>
                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">RST No</p>
                                        <p className="text-xs font-black text-slate-900">#{firstProd.rstNo || "—"}</p>
                                      </div>
                                      <div>
                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Gross / Tare / Net</p>
                                        <p className="text-xs font-black text-slate-900">{firstProd.grossWeight || "0"} / {firstProd.tareWeight || "0"} / <span className="text-blue-600">{firstProd.netWeight || "0"}</span></p>
                                      </div>
                                      <div>
                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Weight Diff Reason</p>
                                        <p className="text-[10px] font-bold text-red-500 italic">{firstProd.reasonForDiff || "—"}</p>
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

          {/* Gate Out Form (Bottom) */}
          <div className="mt-8 space-y-6 border rounded-lg p-6 bg-white shadow-sm">
             <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b pb-2">
                <CheckCircle className="h-4 w-4 text-blue-600" />
                Gate Pass & Evidence
             </h3>
             
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="space-y-2">
                   <Label>Upload Gate Pass</Label>
                   <div className="border-2 border-dashed rounded-lg p-4 text-center hover:bg-slate-50 transition-colors bg-blue-50/20">
                     <Input
                       type="file"
                       accept="image/*,.pdf"
                       onChange={(e) => {
                         if (e.target.files?.[0]) {
                           handleFileUpload(e.target.files[0], 'gatePass')
                         }
                       }}
                       className="hidden"
                       id="gatepass-upload"
                     />
                     <label htmlFor="gatepass-upload" className="cursor-pointer block">
                       <Upload className="h-6 w-6 mx-auto mb-2 text-blue-600" />
                       <p className="text-xs font-bold text-slate-700 uppercase tracking-tight">
                         {isUploading === 'gatePass' ? "UPLOADING..." : (gateOutData.gatePassFile ? `REPLACE: ${gateOutData.gatePassFileName}` : "Click to upload gate pass")}
                       </p>
                     </label>
                   </div>
                 </div>
 
                 <div className="space-y-2">
                   <Label>Upload Vehicle Loaded Image</Label>
                   <div className="border-2 border-dashed rounded-lg p-4 text-center hover:bg-slate-50 transition-colors bg-violet-50/20">
                     <Input
                       type="file"
                       accept="image/*"
                       onChange={(e) => {
                         if (e.target.files?.[0]) {
                           handleFileUpload(e.target.files[0], 'vehicleImage')
                         }
                       }}
                       className="hidden"
                       id="vehicle-loaded-upload"
                     />
                     <label htmlFor="vehicle-loaded-upload" className="cursor-pointer block">
                       <Upload className="h-6 w-6 mx-auto mb-2 text-violet-600" />
                       <p className="text-xs font-bold text-slate-700 uppercase tracking-tight">
                         {isUploading === 'vehicleImage' ? "UPLOADING..." : (gateOutData.vehicleLoadedImage ? `REPLACE: ${gateOutData.vehicleLoadedImageName}` : "Click to upload vehicle image")}
                       </p>
                     </label>
                   </div>
                 </div>
             </div>
          </div>

          <DialogFooter className="mt-8 border-t pt-4 bg-gray-50 -mx-6 -mb-6 px-6 py-4">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isProcessing}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={isProcessing}
              className="bg-blue-600 hover:bg-blue-700 min-w-37.5"
            >
              {isProcessing ? "Processing..." : "Complete Gate Out"}
            </Button>
          </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </WorkflowStageShell>
  )
}