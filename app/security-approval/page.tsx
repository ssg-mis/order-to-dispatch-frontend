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
    "status",
  ])
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [selectedGroup, setSelectedGroup] = useState<any>(null)
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

      // Submit each selected product to backend API
      for (const product of productsToSubmit) {
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

  // Group orders by Base DO Number (similar to Material Load page)
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
             transportType: order.type_of_transporting || order.order_transport_type || "—",
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
          transportType: order.type_of_transporting,
          deliveryFrom: order.dispatch_from || order.deliveryFrom,
          actualQty: order.actual_qty_dispatch,
          rstNo: order.rst_no,
          grossWeight: order.gross_weight,
          tareWeight: order.tare_weight,
          netWeight: order.net_weight,
          transporterName: order.transporter_name,
          reasonForDiff: order.reason_of_difference_in_weight_if_any_speacefic,
          truckNo: order.truck_no,
          vehiclePlateImage: order.vehicle_no_plate_image,
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
          <Button 
            onClick={handleOpenDialog}
            disabled={selectedItems.length === 0} 
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Upload className="mr-2 h-4 w-4" />
            Approve Security ({selectedItems.length})
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
                        <Badge className="bg-amber-100 text-amber-700">Pending Security</Badge>
                      </TableCell>
                   </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No items pending for security approval
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
              Security Approval - {selectedGroup?.doNumber}
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
                    <p className="font-medium">{selectedGroup.deliveryPurpose || "—"}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Order Type</Label>
                    <p className="font-medium">{selectedGroup.orderType || "—"}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Start Date</Label>
                    <p className="font-medium">{selectedGroup.startDate || "—"}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">End Date</Label>
                    <p className="font-medium">{selectedGroup.endDate || "—"}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Delivery Date</Label>
                    <p className="font-medium">{selectedGroup.deliveryDate || "—"}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Transport Type</Label>
                    <p className="font-medium">{selectedGroup.transportType || "—"}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Contact Person</Label>
                    <p className="font-medium">{selectedGroup.contactPerson || "—"}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Contact No.</Label>
                    <p className="font-medium">{selectedGroup.contactWhatsapp || "—"}</p>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs text-muted-foreground">Customer Address</Label>
                    <p className="font-medium">{selectedGroup.customerAddress || "—"}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Total Amount</Label>
                    <p className="font-medium">{selectedGroup.totalAmount || "—"}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Oil Type</Label>
                    <p className="font-medium">{selectedGroup.oilType || "—"}</p>
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

              {/* Security Approval Form */}
              <div className="space-y-6 border rounded-lg p-6 bg-white">
                <div className="bg-white border text-center border-slate-200 rounded-xl p-5 space-y-4 shadow-sm">
                  <h3 className="text-sm font-bold text-slate-800 px-1 flex items-center gap-2 uppercase tracking-tight">
                    <div className="w-1.5 h-4 bg-blue-600 rounded-full" />
                    Document Verification
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                    <div className="space-y-2">
                      <Label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Bilty Number</Label>
                      <Input
                        value={uploadData.biltyNo}
                        onChange={(e) => setUploadData({ ...uploadData, biltyNo: e.target.value })}
                        placeholder="Enter Bilty Number"
                        className="bg-white border-slate-200 h-10"
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
            </div>
          )}

          <DialogFooter className="mt-6">
            <Button 
              onClick={handleBulkSubmit} 
              disabled={isProcessing}
              className="bg-blue-600 hover:bg-blue-700 w-full md:w-auto min-w-[150px]"
            >
              {isProcessing ? "Processing..." : "Complete Bulk Approval"}
            </Button>
          </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </WorkflowStageShell>
  )
}