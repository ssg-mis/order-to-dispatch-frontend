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
import { Upload, CheckCircle, Settings2, FileText, IndianRupee } from "lucide-react"
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ALL_WORKFLOW_COLUMNS as ALL_COLUMNS } from "@/lib/workflow-columns"
import { damageAdjustmentApi, orderApi } from "@/lib/api-service"

export default function DamageAdjustmentPage() {
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
  const [selectedGroup, setSelectedGroup] = useState<any>(null)
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  // Adjustment Form State
  const [isUploading, setIsUploading] = useState<boolean>(false)
  const [adjustmentData, setAdjustmentData] = useState({
    creditNoteDate: "",
    creditNoteNo: "",
    creditNoteQty: "",
    creditNoteAmount: "",
    netBalance: "",
    creditNoteCopy: "" as string,
    creditNoteCopyName: "",
  })

  // Fetch Pending
  const fetchPending = async () => {
    try {
      const response = await damageAdjustmentApi.getPending({ limit: 1000 });
      if (response.success && response.data.orders) {
        setPendingOrders(response.data.orders);
      }
    } catch (error) {
      console.error("Failed to fetch pending damage adjustments:", error);
    }
  }

  // Fetch History
  const fetchHistory = async () => {
    try {
        const response = await damageAdjustmentApi.getHistory({ limit: 1000 });
        if (response.success && response.data.orders) {
          setHistoryOrders(response.data.orders);
        }
    } catch (error) {
        console.error("Failed to fetch history:", error);
    }
  }

  const handleFileUpload = async (file: File) => {
    if (!file) return;
    
    setIsUploading(true);
    try {
      const response = await orderApi.uploadFile(file);
      if (response.success) {
        setAdjustmentData(p => ({
          ...p,
          creditNoteCopy: response.data.url,
          creditNoteCopyName: file.name
        }));
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
      setIsUploading(false);
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
      const orderDateStr = order.timestamp || order.planned_9
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
       // Prioritize SO Number (DO Number) for grouping
       const doNumber = order.so_no || order.d_sr_number || "DO-XXX"
       
       // Group by Base DO (e.g. DO-022 from DO-022A)
       const baseDoMatch = doNumber.match(/^(DO-\d+)/i)
       const baseDo = baseDoMatch ? baseDoMatch[1] : doNumber

       if (!grouped[baseDo]) {
          grouped[baseDo] = {
             _rowKey: baseDo,
             doNumber: baseDo,
             customerName: order.party_name || "—",
             
             // Order Details from JOIN
             deliveryPurpose: order.order_type_delivery_purpose || "—",
             orderType: order.order_type || "—",
             startDate: order.start_date ? new Date(order.start_date).toLocaleDateString("en-IN") : "—",
             endDate: order.end_date ? new Date(order.end_date).toLocaleDateString("en-IN") : "—",
             deliveryDate: order.delivery_date ? new Date(order.delivery_date).toLocaleDateString("en-IN") : "—",
             transportType: order.type_of_transporting || "—",
             contactPerson: order.customer_contact_person_name || "—",
             contactWhatsapp: order.customer_contact_person_whatsapp_no || "—",
             customerAddress: order.customer_address || "—",
             totalAmount: order.total_amount_with_gst || "—",

             // Additional Details for Header (as requested)
             invoiceNo: order.invoice_no || "—",
             invoiceDate: order.invoice_date ? new Date(order.invoice_date).toLocaleDateString("en-IN") : "—",
             biltyNo: order.bilty_no || "—",
             rstNo: order.rst_no || "—",
             grossWeight: order.gross_weight || "—",
             tareWeight: order.tare_weight || "—",
             netWeight: order.net_weight || "—",
             transporterName: order.transporter_name || "—",
             truckNo: order.truck_no || "—",
             diffReason: order.reason_of_difference_in_weight_if_any_speacefic || "—",
             
             _allProducts: [],
             _productCount: 0
          }
       }
       
       grouped[baseDo]._allProducts.push({
          ...order,
          _rowKey: `${baseDo}-${order.id}`,
          id: order.id,
          specificOrderNo: order.so_no,
          productName: order.product_name,
          invoiceNo: order.invoice_no,
          billAmount: order.bill_amount,
          actualQty: order.actual_qty_dispatch,
          truckNo: order.truck_no,
          netWeight: order.net_weight,

          // Damage Info
          damageQty: order.damage_qty,
          damageStatus: order.damage_status,
          damageSku: order.sku,
          damageImage: order.damage_image,
          processid: order.processid || null
       })
       
       grouped[baseDo]._productCount = grouped[baseDo]._allProducts.length
    })

    return Object.values(grouped).map(g => ({
      ...g,
      processId: g._allProducts[0]?.processid || "—"
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
    
    // Open for the first selected group
    const targetGroup = displayRows.find(r => r._rowKey === selectedItems[0])
    if (targetGroup) {
      setSelectedGroup(targetGroup)
      setSelectedProducts(targetGroup._allProducts.map((p: any) => p._rowKey)) // Select all by default
      
      // Reset form
      setAdjustmentData({
        creditNoteDate: "",
        creditNoteNo: "",
        creditNoteQty: "",
        creditNoteAmount: "",
        netBalance: "",
        creditNoteCopy: "",
        creditNoteCopyName: "",
      })
      
      setIsDialogOpen(true)
    }
  }

  const handleSubmit = async () => {
    if (!selectedGroup) return
    
    // Validation: Require Credit Note Details generally, though backend might allow slightly less.
    // Let's enforce basic credit note details if quantities are involved.
    if (!adjustmentData.creditNoteDate || !adjustmentData.creditNoteNo) {
        toast({ title: "Validation Error", description: "Credit Note details are required.", variant: "destructive" })
        return
    }

    // Numeric Validation
    const isInvalidNumber = (val: string) => val !== "" && isNaN(Number(val))
    if (isInvalidNumber(adjustmentData.creditNoteQty) || 
        isInvalidNumber(adjustmentData.creditNoteAmount) || 
        isInvalidNumber(adjustmentData.netBalance)) {
        toast({ title: "Validation Error", description: "Please enter valid numbers for Qty, Amount, and Balance.", variant: "destructive" })
        return
    }

    const productsToSubmit = selectedGroup._allProducts.filter((p: any) => 
      selectedProducts.includes(p._rowKey)
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
            credit_note_date: adjustmentData.creditNoteDate,
            credit_note_no: adjustmentData.creditNoteNo,
            credit_note_qty: adjustmentData.creditNoteQty || 0,
            credit_note_amount: adjustmentData.creditNoteAmount || 0,
            net_banalce: adjustmentData.netBalance || 0,
            status_2: "Completed",
            credit_note_copy: adjustmentData.creditNoteCopy || null
        };

        try {
            console.log(`[Damage-Adjustment] Submitting for ID ${product.id}`, submitData);
            const response = await damageAdjustmentApi.submit(product.id, submitData);
            
            if (response.success) {
                successfulSubmissions.push(product);
            } else {
                failedSubmissions.push({ product, error: response.message });
            }
        } catch (err: any) {
             console.error(`[Damage-Adjustment] Failed for ID ${product.id}`, err);
             failedSubmissions.push({ product, error: err.message });
        }
      }

      if (successfulSubmissions.length > 0) {
        toast({
          title: "Adjustment Processed",
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

  const customerNames = Array.from(new Set(pendingOrders.map(order => order.party_name || "Unknown")))

  return (
    <WorkflowStageShell
      title="Stage 13: Damage Adjustment"
      description="Process credit notes and adjustments for damaged goods."
      pendingCount={displayRows.length}
      historyData={historyOrders.map((order) => ({
        date: order.actual_9 ? new Date(order.actual_9).toLocaleDateString("en-GB") : "-",
        stage: "Damage Adjustment",
        status: order.status_2 || "Completed",
        remarks: order.credit_note_no ? `CN: ${order.credit_note_no}` : "-",
      }))}
      partyNames={customerNames}
      onFilterChange={setFilterValues}
      remarksColName="Adjustment"
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
            Process Adjustment ({selectedItems.length})
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
                <TableHead className="whitespace-nowrap text-center">Damage Info</TableHead>
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
                         {/* Show summary of damage if available in first product or count */}
                         <div className="text-xs text-red-600 font-medium">
                            {group._allProducts.filter((p:any) => p.damageStatus === "Damaged").length} damaged items
                         </div>
                      </TableCell>
                      <TableCell className="text-center">
                         <Badge className="bg-red-100 text-red-700">Pending Adjustment</Badge>
                      </TableCell>
                   </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No pending damage adjustments
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </div>

       {/* Split-View Dialog */}
       <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-[95vw]! w-full max-h-[95vh] overflow-y-auto p-0">
          <div className="p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-900">
              Damage Adjustment - {selectedGroup?.doNumber}
            </DialogTitle>
          </DialogHeader>

          {selectedGroup && (
            <div className="space-y-6 mt-4">
              {/* Order Details Top Section */}
              <div className="border rounded-lg p-4 bg-muted/30">
                <h3 className="text-sm font-semibold mb-3 text-primary">Order & Logistics Details</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4 text-xs">
                  <div>
                    <Label className="text-xs text-muted-foreground">Delivery Purpose</Label>
                    <p className="font-medium">{selectedGroup.deliveryPurpose}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Order Type</Label>
                    <p className="font-medium">{selectedGroup.orderType}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Start Date</Label>
                    <p className="font-medium">{selectedGroup.startDate}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">End Date</Label>
                    <p className="font-medium">{selectedGroup.endDate}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Delivery Date</Label>
                    <p className="font-medium">{selectedGroup.deliveryDate}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Transport Type</Label>
                    <p className="font-medium">{selectedGroup.transportType}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Contact Person</Label>
                    <p className="font-medium">{selectedGroup.contactPerson}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Customer Address</Label>
                    <p className="font-medium truncate" title={selectedGroup.customerAddress}>{selectedGroup.customerAddress}</p>
                  </div>
                  
                  {/* Additional invoice/weight details */}
                  <div>
                    <Label className="text-xs text-muted-foreground">Invoice No</Label>
                    <p className="font-medium text-blue-600">{selectedGroup.invoiceNo}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Invoice Date</Label>
                    <p className="font-medium">{selectedGroup.invoiceDate}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Bilty No</Label>
                    <p className="font-medium">{selectedGroup.biltyNo}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Truck No</Label>
                    <p className="font-medium">{selectedGroup.truckNo}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Transporter</Label>
                    <p className="font-medium truncate" title={selectedGroup.transporterName}>{selectedGroup.transporterName}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">RST No</Label>
                    <p className="font-medium">{selectedGroup.rstNo}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Gross Wt</Label>
                    <p className="font-medium">{selectedGroup.grossWeight}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Tare Wt</Label>
                    <p className="font-medium">{selectedGroup.tareWeight}</p>
                  </div>
                   <div>
                    <Label className="text-xs text-muted-foreground">Net Wt</Label>
                    <p className="font-medium">{selectedGroup.netWeight}</p>
                  </div>
                   {selectedGroup.diffReason && selectedGroup.diffReason !== "—" && (
                    <div className="col-span-2">
                        <Label className="text-xs text-muted-foreground">Diff Reason</Label>
                        <p className="font-medium text-amber-600">{selectedGroup.diffReason}</p>
                    </div>
                   )}
                </div>
              </div>

              {/* Product List Table (Middle) */}
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-muted/50 px-4 py-2 border-b">
                  <h3 className="text-sm font-semibold text-primary">Products ({selectedProducts.length}/{selectedGroup._productCount} selected)</h3>
                </div>
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox 
                          checked={selectedProducts.length === selectedGroup._allProducts.length && selectedGroup._allProducts.length > 0}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedProducts(selectedGroup._allProducts.map((p: any) => p._rowKey))
                            } else {
                              setSelectedProducts([])
                            }
                          }}
                        />
                      </TableHead>
                      <TableHead>Order No</TableHead>
                      <TableHead>Product Name</TableHead>
                      <TableHead>Inv Qty</TableHead>
                      <TableHead>Damage Qty</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedGroup._allProducts.map((product: any) => (
                      <TableRow key={product._rowKey} className={selectedProducts.includes(product._rowKey) ? "bg-red-50/20" : ""}>
                        <TableCell>
                          <Checkbox 
                            checked={selectedProducts.includes(product._rowKey)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedProducts(prev => [...prev, product._rowKey])
                              } else {
                                setSelectedProducts(prev => prev.filter(k => k !== product._rowKey))
                              }
                            }}
                          />
                        </TableCell>
                        <TableCell className="font-medium text-xs text-slate-500">{product.specificOrderNo || "—"}</TableCell>
                        <TableCell className="font-medium">{product.productName}</TableCell>
                        <TableCell>{product.actualQty || "—"}</TableCell>
                        <TableCell className="font-bold text-red-600">{product.damageQty || 0}</TableCell>
                        <TableCell>
                             <Badge variant="outline" className="border-red-200 text-red-700 bg-red-50">
                                {product.damageStatus || "Pending"}
                             </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              </div>

              {/* Adjustment Form (Bottom) */}
              <div className="space-y-6 border rounded-lg p-6 bg-white shadow-sm">
                 <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b pb-2">
                    <FileText className="h-4 w-4 text-blue-600" />
                    Credit Note & Adjustment Details
                 </h3>
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                     <div className="space-y-2">
                       <Label>Credit Note Date <span className="text-red-500">*</span></Label>
                       <Input
                         type="date"
                         value={adjustmentData.creditNoteDate}
                         onChange={(e) => setAdjustmentData({ ...adjustmentData, creditNoteDate: e.target.value })}
                       />
                     </div>
                     
                     <div className="space-y-2">
                       <Label>Credit Note No <span className="text-red-500">*</span></Label>
                       <Input
                         value={adjustmentData.creditNoteNo}
                         onChange={(e) => setAdjustmentData({ ...adjustmentData, creditNoteNo: e.target.value })}
                         placeholder="e.g. CN-2023-001"
                       />
                     </div>

                     <div className="space-y-2">
                       <Label>Credit Note Qty</Label>
                       <Input
                         type="number"
                         value={adjustmentData.creditNoteQty}
                         onChange={(e) => setAdjustmentData({ ...adjustmentData, creditNoteQty: e.target.value })}
                         placeholder="Qty adjusted"
                       />
                     </div>

                     <div className="space-y-2">
                       <Label className="flex items-center gap-1"><IndianRupee className="h-3 w-3" /> Credit Note Amount</Label>
                       <Input
                         type="number"
                         value={adjustmentData.creditNoteAmount}
                         onChange={(e) => setAdjustmentData({ ...adjustmentData, creditNoteAmount: e.target.value })}
                         placeholder="Amount in ₹"
                       />
                     </div>

                     <div className="space-y-2">
                        <Label>Net Balance</Label>
                        <Input
                          type="number"
                          value={adjustmentData.netBalance}
                          onChange={(e) => setAdjustmentData({ ...adjustmentData, netBalance: e.target.value })}
                          placeholder="Final balance"
                        />
                     </div>

                     <div className="space-y-2">
                       <Label>Upload CN Copy</Label>
                        <div className="border-2 border-dashed rounded-lg p-3 text-center hover:bg-slate-50 transition-colors bg-blue-50/20">
                          <Input
                            type="file"
                            accept="image/*,.pdf"
                            onChange={(e) => {
                              if (e.target.files?.[0]) {
                                handleFileUpload(e.target.files[0])
                              }
                            }}
                            className="hidden"
                            id="cn-upload"
                          />
                          <label htmlFor="cn-upload" className="cursor-pointer block">
                            <Upload className="h-5 w-5 mx-auto mb-1 text-blue-600" />
                            <p className="text-xs font-bold text-slate-700 uppercase tracking-tight block">
                              {isUploading ? "UPLOADING..." : (adjustmentData.creditNoteCopyName ? `REPLACE: ${adjustmentData.creditNoteCopyName}` : "Upload Copy")}
                            </p>
                          </label>
                        </div>
                     </div>
                 </div>
              </div>
            </div>
          )}

          <DialogFooter className="mt-8 border-t pt-4 bg-gray-50 -mx-6 -mb-6 px-6 py-4">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isProcessing}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={isProcessing}
              className="bg-blue-600 hover:bg-blue-700 min-w-37.5"
            >
              {isProcessing ? "Processing..." : "Complete Adjustment"}
            </Button>
          </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </WorkflowStageShell>
  )
}
