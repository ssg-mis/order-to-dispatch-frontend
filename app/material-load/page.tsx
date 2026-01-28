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
import { Settings2, Truck, Weight } from "lucide-react"
import { ALL_WORKFLOW_COLUMNS as ALL_COLUMNS } from "@/lib/workflow-columns"
import { Checkbox } from "@/components/ui/checkbox"
import { materialLoadApi } from "@/lib/api-service"

export default function MaterialLoadPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [pendingOrders, setPendingOrders] = useState<any[]>([])
  const [historyOrders, setHistoryOrders] = useState<any[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState<string[]>([
    "orderNo",
    "customerName",
    "status",
  ])
  
  const [loadData, setLoadData] = useState({
    actualQty: "",
    weightmentSlip: "",
    rstNo: "",
    grossWeight: "",
    tareWeight: "",
    netWeight: "",
    grossWeightPacking: "",
    netWeightPacking: "",
    otherItemWeight: "",
    dharamkataWeight: "",
    differanceWeight: "",
    transporterName: "",
    reason: "",
    truckNo: "",
    vehicleNoPlateImage: "",
    checkStatus: "",
    remarks: "",
  })

  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [selectedGroup, setSelectedGroup] = useState<any>(null)
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])

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

  // Group orders by Base DO Number
  const displayRows = useMemo(() => {
    const grouped: { [key: string]: any } = {}

    filteredPendingOrders.forEach((order: any) => {
       const doNumber = order.so_no || order.soNo || "DO-XXX"
       // Group by Base DO (e.g. DO-022 from DO-022A)
       const baseDoMatch = doNumber.match(/^(DO-\d+)/i)
       const baseDo = baseDoMatch ? baseDoMatch[1] : doNumber

       if (!grouped[baseDo]) {
          grouped[baseDo] = {
             ...order,
             _rowKey: baseDo,
             orderNo: baseDo,
             doNumber: baseDo,
             customerName: order.party_name || order.partyName,
             
             // Map all order details from JOIN
             deliveryPurpose: order.order_type_delivery_purpose || "—",
             orderType: order.order_type || "—",
             startDate: order.start_date ? new Date(order.start_date).toLocaleDateString("en-IN") : "—",
             endDate: order.end_date ? new Date(order.end_date).toLocaleDateString("en-IN") : "—",
             deliveryDate: order.delivery_date ? new Date(order.delivery_date).toLocaleDateString("en-IN") : "—",
             customerType: order.customer_type || "—",
             partySoDate: order.party_so_date ? new Date(order.party_so_date).toLocaleDateString("en-IN") : "—",
             oilType: order.oil_type || "—",
             ratePer15kg: order.rate_per_15kg || "—",
             ratePerLtr: order.rate_per_ltr || "—",
             rateOfMaterial: order.rate_of_material || "—",
             totalAmount: order.total_amount_with_gst || "—",
             transportType: order.type_of_transporting || "—",
             contactPerson: order.customer_contact_person_name || "—",
             contactWhatsapp: order.customer_contact_person_whatsapp_no || "—",
             customerAddress: order.customer_address || "—",
             paymentTerms: order.payment_terms || "—",
             advancePayment: order.advance_payment_to_be_taken || "—",
             advanceAmount: order.advance_amount || "—",
             isBroker: order.is_order_through_broker || "—",
             brokerName: order.broker_name || "—",
             skuName: order.sku_name || "—",
             approvalQty: order.approval_qty || "—",
             
             _allProducts: [],
             _productCount: 0
          }
       }
       
       // Add product to group
       grouped[baseDo]._allProducts.push({
          ...order,
          _rowKey: `${baseDo}-${order.d_sr_number || order.id}`,
          id: order.id, // Keep DB ID for submission
          specificOrderNo: doNumber, // Store specific DO (e.g. DO-022A)
          productName: order.product_name || order.productName,
          qtyToDispatch: order.qty_to_be_dispatched || order.qtyToDispatch,
          actualQtyDispatch: order.actual_qty_dispatch, // Map the field
          deliveryFrom: order.dispatch_from || order.deliveryFrom,
          dsrNumber: order.d_sr_number
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
    
    const targetGroup = displayRows.find(r => r._rowKey === selectedItems[0])
    if (targetGroup) {
      setSelectedGroup(targetGroup)
      setSelectedProducts(targetGroup._allProducts.map((p: any) => p._rowKey)) // Select all by default
      setLoadData({
        actualQty: "",
        weightmentSlip: "",
        rstNo: "",
        grossWeight: "",
        tareWeight: "",
        netWeight: "",
        grossWeightPacking: "",
        netWeightPacking: "",
        otherItemWeight: "",
        dharamkataWeight: "",
        differanceWeight: "",
        transporterName: "",
        reason: "",
        truckNo: "",
        vehicleNoPlateImage: "",
        checkStatus: "",
        remarks: "",
      })
      setIsDialogOpen(true)
    }
  }

  const handleBulkSubmit = async () => {
    if (!selectedGroup) return
    
    // Submit only selected products
    const productsToSubmit = selectedGroup._allProducts.filter((p: any) => 
      selectedProducts.includes(p._rowKey)
    )
    
    if (productsToSubmit.length === 0) {
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

      // Submit each item to backend API
      for (const product of productsToSubmit) {
        const recordId = product.id;
        
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
              check_status: loadData.checkStatus || null,
              remarks: loadData.remarks || null,
            };

            console.log('[MATERIAL LOAD] Submitting material load for ID:', recordId, submitData);
            const response = await materialLoadApi.submit(recordId, submitData);
            console.log('[MATERIAL LOAD] API Response:', response);
            
            if (response.success) {
              successfulSubmissions.push({ product, response });
            } else {
              failedSubmissions.push({ product, error: response.message || 'Unknown error' });
            }
          } else {
            console.warn('[MATERIAL LOAD] Skipping - no record ID found for:', product);
            failedSubmissions.push({ product, error: 'No record ID found' });
          }
        } catch (error: any) {
          console.error('[MATERIAL LOAD] Failed to submit material load:', error);
          failedSubmissions.push({ product, error: error?.message || error?.toString() || 'Unknown error' });
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
        setIsDialogOpen(false);

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
          <Button 
            onClick={handleOpenDialog}
            disabled={selectedItems.length === 0} 
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Weight className="mr-2 h-4 w-4" />
            Load Material ({selectedItems.length})
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
                        <Badge className="bg-blue-100 text-blue-700">Ready to Load</Badge>
                      </TableCell>
                   </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No items pending for material loading
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
              Bulk Material Load - {selectedGroup?.doNumber}
            </DialogTitle>
          </DialogHeader>

          {selectedGroup && (
            <div className="space-y-6 mt-4">
              {/* Order Details Header */}
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
                    <Label className="text-xs text-muted-foreground">Contact No.</Label>
                    <p className="font-medium">{selectedGroup.contactWhatsapp}</p>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs text-muted-foreground">Customer Address</Label>
                    <p className="font-medium">{selectedGroup.customerAddress}</p>
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

              {/* Product Table */}
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
                          checked={selectedProducts.length === selectedGroup._allProducts.length}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedProducts(selectedGroup._allProducts.map((p: any) => p._rowKey))
                            } else {
                              setSelectedProducts([])
                            }
                          }}
                        />
                      </TableHead>
                      <TableHead>Order No.</TableHead>
                      <TableHead>Product Name</TableHead>
                      <TableHead>Planned Qty</TableHead>
                      <TableHead>Actual Qty</TableHead>
                      <TableHead>Delivery From</TableHead>
                      <TableHead>DSR Number</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedGroup._allProducts.map((product: any) => (
                      <TableRow 
                        key={product._rowKey}
                        className={selectedProducts.includes(product._rowKey) ? "bg-blue-50/30" : ""}
                      >
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
                        <TableCell className="font-medium text-xs">{product.specificOrderNo}</TableCell>
                        <TableCell className="font-medium">{product.productName}</TableCell>
                        <TableCell>{product.qtyToDispatch}</TableCell>
                        <TableCell>{product.actualQtyDispatch || "—"}</TableCell>
                        <TableCell>{product.deliveryFrom}</TableCell>
                        <TableCell>{product.dsrNumber}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              </div>

              {/* Material Load Form */}
              <div className="space-y-6 border rounded-lg p-6 bg-white">
                <div className="bg-white border text-center border-slate-200 rounded-xl p-5 space-y-4 shadow-sm">
                    <h3 className="text-sm font-bold text-slate-800 px-1 flex items-center gap-2 uppercase tracking-tight">
                      <div className="w-1.5 h-4 bg-blue-600 rounded-full" />
                      General Details
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
                      <div className="space-y-2">
                        <Label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Actual Qty (Total)</Label>
                        <Input
                          type="number" step="0.01"
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
                          type="number" step="0.01"
                          value={loadData.grossWeight || ""}
                          onChange={(e) => setLoadData(prev => ({ ...prev, grossWeight: e.target.value }))}
                          placeholder="Gross"
                          className="bg-white border-slate-200 h-10"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Tare Weight</Label>
                        <Input
                          type="number" step="0.01"
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
                              type="number" step="0.01"
                              value={loadData.netWeightPacking || ""}
                              onChange={(e) => setLoadData(prev => ({ ...prev, netWeightPacking: e.target.value }))}
                              placeholder="Net"
                              className="bg-white border-indigo-200 h-10"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[10px] uppercase font-bold text-indigo-600 tracking-wider">Other Items</Label>
                            <Input
                              type="number" step="0.01"
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
                            type="number" step="0.01"
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
                               type="number" step="0.01"
                               value={loadData.dharamkataWeight || ""}
                               onChange={(e) => setLoadData(prev => ({ ...prev, dharamkataWeight: e.target.value }))}
                               placeholder="Weight"
                               className="bg-white border-amber-200 h-10"
                             />
                           </div>
                           <div className="space-y-2">
                             <Label className="text-[10px] uppercase font-bold text-amber-600 tracking-wider">Difference</Label>
                             <Input
                               type="number" step="0.01"
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

                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 shadow-sm">
                    <h3 className="text-sm font-bold text-slate-800 mb-4 px-1 flex items-center gap-2">
                      <div className="w-1 h-4 bg-slate-600 rounded-full" />
                      Verification Artifacts & Status
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
                      <div className="space-y-2">
                        <Label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Check Status</Label>
                        <Select value={loadData.checkStatus} onValueChange={(v) => setLoadData(prev => ({...prev, checkStatus: v}))}>
                            <SelectTrigger className="bg-white"><SelectValue placeholder="Status" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Accept">Accept</SelectItem>
                                <SelectItem value="Reject">Reject</SelectItem>
                            </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Remarks</Label>
                        <Input 
                          value={loadData.remarks} 
                          onChange={(e) => setLoadData(prev => ({...prev, remarks: e.target.value}))}
                          placeholder="Enter remarks..."
                          className="bg-white border-slate-200 h-10"
                        />
                      </div>
                    </div>
                  </div>
              </div>
            </div>
          )}

          <DialogFooter className="mt-6">
            <Button 
              onClick={handleBulkSubmit} 
              disabled={isProcessing}
              className="bg-blue-600 hover:bg-blue-700 w-full md:w-auto min-w-[150px]"
            >
              {isProcessing ? "Processing..." : "Complete Bulk Load"}
            </Button>
          </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </WorkflowStageShell>
  )
}