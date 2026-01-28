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
import { Upload, Settings2, FileText } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ALL_WORKFLOW_COLUMNS as ALL_COLUMNS } from "@/lib/workflow-columns"
import { makeInvoiceApi } from "@/lib/api-service"

export default function MakeInvoicePage() {
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
  
  // Form State
  const [invoiceType, setInvoiceType] = useState<"independent" | "common" | "">("")
  const [invoiceData, setInvoiceData] = useState({
    invoiceNo: "",
    invoiceDate: new Date().toISOString().split('T')[0], // Default to today
    qty: "",
    billAmount: "",
    invoiceFile: null as File | null,
  })

  // Fetch pending invoices
  const fetchPendingInvoices = async () => {
    try {
      const response = await makeInvoiceApi.getPending({ limit: 1000 });
      if (response.success && response.data.invoices) {
        setPendingOrders(response.data.invoices);
      }
    } catch (error: any) {
      console.error("Failed to fetch pending invoices:", error);
      toast({
        title: "Error",
        description: "Failed to load pending invoices",
        variant: "destructive",
      });
    }
  };

  // Fetch history
  const fetchInvoiceHistory = async () => {
    try {
      const response = await makeInvoiceApi.getHistory({ limit: 1000 });
      if (response.success && response.data.invoices) {
        setHistoryOrders(response.data.invoices);
      }
    } catch (error: any) {
      console.error("Failed to fetch invoice history:", error);
    }
  };

  useEffect(() => {
    fetchPendingInvoices();
    fetchInvoiceHistory();
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

  /* Grouping Logic */
  const displayRows = useMemo(() => {
    const grouped: { [key: string]: any } = {}

    filteredPendingOrders.forEach((order: any) => {
       // Prioritize SO Number (DO Number) for grouping as requested
       const doNumber = order.so_no || order.d_sr_number || "DO-XXX"
       
       // Group by Base DO (e.g. DO-022 from DO-022A)
       const baseDoMatch = doNumber.match(/^(DO-\d+)/i)
       const baseDo = baseDoMatch ? baseDoMatch[1] : doNumber

       if (!grouped[baseDo]) {
          grouped[baseDo] = {
             _rowKey: baseDo,
             doNumber: baseDo, // Base DO
             customerName: order.party_name || "—",
             
             // Order Details from the FIRST item in the group (assuming they share order details)
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
             oilType: order.oil_type || "—",
             
             _allProducts: [],
             _productCount: 0
          }
       }
       
       // Add product to group
       grouped[baseDo]._allProducts.push({
          ...order,
          _rowKey: `${baseDo}-${order.id}`, // Unique key for product row
          id: order.id,
          specificOrderNo: order.so_no,
          productName: order.product_name,
          actualQty: order.actual_qty_dispatch || order.actual_5, // Assuming actual dispatch qty
          truckNo: order.truck_no,
          rstNo: order.rst_no,
          grossWeight: order.gross_weight,
          tareWeight: order.tare_weight,
          netWeight: order.net_weight,
          transporterName: order.transporter_name,
          driverName: order.driver_name, // if avail
       })
       
       grouped[baseDo]._productCount = grouped[baseDo]._allProducts.length
    })

    return Object.values(grouped)
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
      setInvoiceData({
        invoiceNo: "",
        invoiceDate: new Date().toISOString().split('T')[0],
        qty: "",
        billAmount: "",
        invoiceFile: null,
      })
      setInvoiceType("")
      
      setIsDialogOpen(true)
    }
  }

  const handleSubmit = async () => {
    if (!selectedGroup || !invoiceType || !invoiceData.invoiceNo) {
        toast({
            title: "Validation Error",
            description: "Please fill all required invoice details.",
            variant: "destructive"
        })
        return
    }

    // Filter selected products
    const productsToSubmit = selectedGroup._allProducts.filter((p: any) => 
      selectedProducts.includes(p._rowKey)
    )
    
    if (productsToSubmit.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one product to invoice",
        variant: "destructive"
      })
      return
    }

    setIsProcessing(true)
    try {
      const successfulSubmissions: any[] = []
      const failedSubmissions: any[] = []

      // Submit each selected product
      for (const product of productsToSubmit) {
        const submitData = {
            bill_type: invoiceType,
            invoice_no: invoiceData.invoiceNo,
            invoice_date: invoiceType === 'independent' ? invoiceData.invoiceDate : null,
            qty: invoiceData.qty || null,
            bill_amount: invoiceType === 'independent' ? invoiceData.billAmount : null,
            invoice_copy: invoiceData.invoiceFile ? invoiceData.invoiceFile.name : null,
        };

        try {
            console.log(`[INVOICE] Submitting for ID ${product.id}`, submitData);
            const response = await makeInvoiceApi.submit(product.id, submitData);
            
            if (response.success) {
                successfulSubmissions.push(product);
            } else {
                failedSubmissions.push({ product, error: response.message });
            }
        } catch (err: any) {
            console.error(`[INVOICE] Failed for ID ${product.id}`, err);
            failedSubmissions.push({ product, error: err.message });
        }
      }

      // Handle results
      if (successfulSubmissions.length > 0) {
        toast({
          title: "Invoices Created",
          description: `Successfully created invoice for ${successfulSubmissions.length} items.`,
        })

        // Refresh Data
        await fetchPendingInvoices();
        await fetchInvoiceHistory();
        
        setIsDialogOpen(false)
        setSelectedItems([]) // Clear root selection
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
        description: "An unexpected error occurred during submission.",
        variant: "destructive",
      })
    } finally {
      setIsProcessing(false)
    }
  }

  // Use unique customer names for filter
  const customerNames = Array.from(new Set(pendingOrders.map(order => order.party_name || "Unknown")))

  return (
    <WorkflowStageShell
      title="Stage 9: Make Invoice (Proforma)"
      description="Create proforma invoice grouped by DO Number."
      pendingCount={displayRows.length} // Count groups
      historyData={historyOrders.map((order) => ({
        date: order.actual_5 ? new Date(order.actual_5).toLocaleDateString("en-GB") : "-",
        stage: "Make Invoice",
        status: "Completed",
        remarks: order.invoice_no || "Generated",
      }))}
      partyNames={customerNames}
      onFilterChange={setFilterValues}
      remarksColName="Invoice No"
    >
      <div className="space-y-4">
        {/* Action Bar */}
        <div className="flex justify-end gap-2">
           <Button 
            onClick={handleOpenDialog}
            disabled={selectedItems.length === 0} 
            className="bg-blue-600 hover:bg-blue-700"
          >
            <FileText className="mr-2 h-4 w-4" />
            Create Invoice ({selectedItems.length})
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
                        <Badge className="bg-cyan-100 text-cyan-700">Pending Invoice</Badge>
                      </TableCell>
                   </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No orders pending for invoice creation
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
            <DialogTitle className="text-xl font-bold text-slate-900">
              Create Invoice - {selectedGroup?.doNumber}
            </DialogTitle>
          </DialogHeader>

          {selectedGroup && (
            <div className="space-y-6 mt-4">
              {/* Order Details Top Section */}
              <div className="border rounded-lg p-4 bg-muted/30">
                <h3 className="text-sm font-semibold mb-3 text-primary">Order Details</h3>
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
                   <div>
                    <Label className="text-xs text-muted-foreground">Total Amount</Label>
                    <p className="font-medium">{selectedGroup.totalAmount}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Oil Type</Label>
                    <p className="font-medium">{selectedGroup.oilType}</p>
                  </div>
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
                      <TableHead>Actual Qty</TableHead>
                      <TableHead>Truck No</TableHead>
                      <TableHead>RST No</TableHead>
                      <TableHead>Gross Wt</TableHead>
                      <TableHead>Tare Wt</TableHead>
                      <TableHead>Net Wt</TableHead>
                      <TableHead>Transporter</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedGroup._allProducts.map((product: any) => (
                      <TableRow key={product._rowKey} className={selectedProducts.includes(product._rowKey) ? "bg-blue-50/30" : ""}>
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
                        <TableCell className="font-medium text-xs">{product.specificOrderNo || "—"}</TableCell>
                        <TableCell className="font-medium">{product.productName}</TableCell>
                        <TableCell>{product.actualQty || "—"}</TableCell>
                        <TableCell>{product.truckNo || "—"}</TableCell>
                        <TableCell>{product.rstNo || "—"}</TableCell>
                        <TableCell>{product.grossWeight || "—"}</TableCell>
                        <TableCell>{product.tareWeight || "—"}</TableCell>
                        <TableCell className="font-semibold text-blue-600">{product.netWeight || "—"}</TableCell>
                        <TableCell className="text-xs">{product.transporterName || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              </div>

              {/* Invoice Form (Bottom) */}
              <div className="space-y-6 border rounded-lg p-6 bg-white shadow-sm">
                 <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b pb-2">
                    <FileText className="h-4 w-4 text-blue-600" />
                    Invoice Details
                 </h3>
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                     <div className="space-y-2">
                         <Label>Bill Type <span className="text-red-500">*</span></Label>
                         <Select value={invoiceType} onValueChange={(val: any) => setInvoiceType(val)}>
                           <SelectTrigger>
                             <SelectValue placeholder="Select Type" />
                           </SelectTrigger>
                           <SelectContent>
                             <SelectItem value="independent">Independent</SelectItem>
                             <SelectItem value="common">Common</SelectItem>
                           </SelectContent>
                         </Select>
                     </div>

                     <div className="space-y-2">
                       <Label>Invoice Number <span className="text-red-500">*</span></Label>
                       <Input
                         value={invoiceData.invoiceNo}
                         onChange={(e) => setInvoiceData({ ...invoiceData, invoiceNo: e.target.value })}
                         placeholder="Enter Invoice No"
                       />
                     </div>

                     <div className="space-y-2">
                       <Label>Upload Invoice Copy</Label>
                       <div className="flex items-center gap-2">
                         <Input
                           type="file"
                           accept=".pdf,.jpg,.png"
                           onChange={(e) => {
                             if (e.target.files?.[0]) {
                               setInvoiceData({ ...invoiceData, invoiceFile: e.target.files[0] })
                             }
                           }}
                           className="cursor-pointer file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100"
                         />
                       </div>
                     </div>

                     {invoiceType === "independent" && (
                       <>
                        <div className="space-y-2">
                            <Label>Invoice Date</Label>
                            <Input 
                                type="date" 
                                value={invoiceData.invoiceDate} 
                                onChange={(e) => setInvoiceData({...invoiceData, invoiceDate: e.target.value})} 
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Bill Amount</Label>
                            <Input
                                type="number" 
                                value={invoiceData.billAmount} 
                                onChange={(e) => setInvoiceData({...invoiceData, billAmount: e.target.value })} 
                                placeholder="0.00"
                            />
                        </div>
                       </>
                     )}
                     
                     <div className="space-y-2">
                       <Label>Qty</Label>
                       <Input
                         type="number"
                         value={invoiceData.qty}
                         onChange={(e) => setInvoiceData({ ...invoiceData, qty: e.target.value })}
                         placeholder="Quantity"
                       />
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
              disabled={isProcessing || !invoiceType || !invoiceData.invoiceNo}
              className="bg-blue-600 hover:bg-blue-700 min-w-[150px]"
            >
              {isProcessing ? "Processing..." : "Generate Invoice"}
            </Button>
          </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </WorkflowStageShell>
  )
}