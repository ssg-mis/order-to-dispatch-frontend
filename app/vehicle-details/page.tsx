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
import { Settings2, Truck } from "lucide-react"
import { ALL_WORKFLOW_COLUMNS as ALL_COLUMNS } from "@/lib/workflow-columns"
import { Checkbox } from "@/components/ui/checkbox"
import { vehicleDetailsApi } from "@/lib/api-service"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function VehicleDetailsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [pendingOrders, setPendingOrders] = useState<any[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState<string[]>([
    "orderNo",
    "customerName",
    "status",
  ])
  const [vehicleNumber, setVehicleNumber] = useState("")
  const [vehicleData, setVehicleData] = useState({
    checkStatus: "",
    remarks: "",
    fitness: "",
    insurance: "",
    tax_copy: "",
    polution: "",
    permit1: "",
    permit2_out_state: "",
  })

  const [history, setHistory] = useState<any[]>([])
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [selectedGroup, setSelectedGroup] = useState<any>(null)
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])

  // Fetch pending vehicle details from backend
  const fetchPendingVehicleDetails = async () => {
    try {
      console.log('[VEHICLE] Fetching pending vehicle details from API...');
      const response = await vehicleDetailsApi.getPending({ limit: 1000 });
      console.log('[VEHICLE] API Response:', response);
      
      if (response.success && response.data.vehicleDetails) {
        setPendingOrders(response.data.vehicleDetails);
        console.log('[VEHICLE] Loaded', response.data.vehicleDetails.length, 'pending vehicle details');
      }
    } catch (error: any) {
      console.error("[VEHICLE] Failed to fetch pending vehicle details:", error);
      toast({
        title: "Error",
        description: error?.message || "Failed to load pending vehicle details",
        variant: "destructive",
      });
      setPendingOrders([]); // Clear on error - don't use cache
    }
  };

  // Fetch vehicle details history from backend
  const fetchVehicleDetailsHistory = async () => {
    try {
      const response = await vehicleDetailsApi.getHistory({ limit: 1000 });
      
      if (response.success && response.data.vehicleDetails) {
        const mappedHistory = response.data.vehicleDetails.map((record: any) => ({
          orderNo: record.so_no,
          doNumber: record.d_sr_number,
          customerName: record.party_name,
          stage: "Vehicle Details",
          status: "Completed" as const,
          processedBy: "System",
          timestamp: record.actual_2,
          date: record.actual_2 ? new Date(record.actual_2).toLocaleDateString("en-GB") : "-",
          remarks: record.remarks || "-",
        }));
        setHistory(mappedHistory);
      }
    } catch (error: any) {
      console.error("[VEHICLE] Failed to fetch history:", error);
      setHistory([]); // Clear on error - don't use cache
    }
  };

  useEffect(() => {
    fetchPendingVehicleDetails();
    fetchVehicleDetailsHistory();
  }, []);

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
  
  // Group orders by Base DO Number (like Actual Dispatch)
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
             customerName: order.party_name || order.customerName,
             
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
      setVehicleNumber("") // Reset
      setIsDialogOpen(true)
    }
  }

  const handleAssignVehicle = async () => {
    if (!vehicleNumber.trim()) {
      toast({
        title: "Error",
        description: "Vehicle number is required",
        variant: "destructive"
      })
      return
    }
    
    if (!selectedGroup) return
    
    setIsProcessing(true)
    try {
      const successfulSubmissions: any[] = []
      const failedSubmissions: any[] = []

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
      
      for (const product of productsToSubmit) {
        const recordId = product.id;
        
        try {
          if (recordId) {
            const submitData = {
              vehicle_number: vehicleNumber,
              check_status: vehicleData.checkStatus,
              remarks: vehicleData.remarks,
              fitness: vehicleData.fitness || "pending",
              insurance: vehicleData.insurance || "pending",
              tax_copy: vehicleData.tax_copy || "pending",
              polution: vehicleData.polution || "pending",
              permit1: vehicleData.permit1 || "pending",
              permit2_out_state: vehicleData.permit2_out_state || "pending",
            };

            console.log('[VEHICLE] Submitting vehicle details for ID:', recordId, submitData);
            const response = await vehicleDetailsApi.submit(recordId, submitData);
            console.log('[VEHICLE] API Response:', response);
            
            if (response.success) {
              successfulSubmissions.push({ product, response });
            } else {
              failedSubmissions.push({ product, error: response.message || 'Unknown error' });
            }
          } else {
            console.warn('[VEHICLE] Skipping - no record ID found for:', product);
            failedSubmissions.push({ product, error: 'No record ID found' });
          }
        } catch (error: any) {
          console.error('[VEHICLE] Failed to submit vehicle details:', error);
          failedSubmissions.push({ product, error: error?.message || error?.toString() || 'Unknown error' });
        }
      }

      // Show results
      if (successfulSubmissions.length > 0) {
        toast({
          title: "Vehicle Assigned",
          description: `${successfulSubmissions.length} vehicle assignment(s) completed successfully.`,
        });

        // Clear selections and form
        setSelectedItems([]);
        setVehicleNumber("");
        setVehicleData({
          checkStatus: "",
          remarks: "",
          fitness: "",
          insurance: "",
          tax_copy: "",
          polution: "",
          permit1: "",
          permit2_out_state: "",
        });

        // Close dialog
        setIsDialogOpen(false);

        // Refresh data from backend
        await fetchPendingVehicleDetails();
        await fetchVehicleDetailsHistory();

        // Navigate to next stage after delay
        setTimeout(() => {
          router.push("/material-load")
        }, 1500)
      }

      if (failedSubmissions.length > 0) {
        console.error('[VEHICLE] Failed submissions:', failedSubmissions);
        toast({
          title: "Some Assignments Failed",
          description: `${failedSubmissions.length} assignment(s) failed. Check console for details.`,
          variant: "destructive",
        })
      }
    } catch (error: any) {
      console.error('[VEHICLE] Unexpected error:', error);
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
      title="Stage 6: Vehicle Details"
      description="Assign vehicle and driver for delivery."
      pendingCount={displayRows.length}
      historyData={history}
      partyNames={customerNames}
      onFilterChange={setFilterValues}
    >
      <div className="space-y-4">
        <div className="flex justify-end gap-2">
          <Button 
            onClick={handleOpenDialog}
            disabled={selectedItems.length === 0} 
            className="bg-purple-600 hover:bg-purple-700"
          >
            <Truck className="mr-2 h-4 w-4" />
            Assign Vehicle ({selectedItems.length})
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
                   <TableRow key={group._rowKey} className={selectedItems.includes(group._rowKey) ? "bg-purple-50/50" : ""}>
                      <TableCell className="text-center">
                        <Checkbox checked={selectedItems.includes(group._rowKey)} onCheckedChange={() => toggleSelectItem(group._rowKey)} />
                      </TableCell>
                      <TableCell className="text-center text-xs font-medium">{group.doNumber}</TableCell>
                      <TableCell className="text-center text-xs">{group.customerName}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{group._productCount} items</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className="bg-purple-100 text-purple-700">Awaiting Vehicle</Badge>
                      </TableCell>
                   </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No orders pending for vehicle assignment
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* Split-View Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="!max-w-7xl max-h-[95vh] overflow-y-auto w-full">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-900">
              Vehicle Details Assignment - {selectedGroup?.doNumber}
            </DialogTitle>
          </DialogHeader>

          {selectedGroup && (
            <div className="space-y-6">
              {/* Order Details Header */}
              <div className="border rounded-lg p-4 bg-muted/30">
                <h3 className="text-sm font-semibold mb-3 text-primary">Order Details</h3>
                <div className="grid grid-cols-4 gap-4 text-xs">
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
                    <Label className="text-xs text-muted-foreground">Payment Terms</Label>
                    <p className="font-medium">{selectedGroup.paymentTerms}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Oil Type</Label>
                    <p className="font-medium">{selectedGroup.oilType}</p>
                  </div>
                </div>
              </div>

              {/* Product Table */}
              <div className="border rounded-lg">
                <div className="bg-muted/50 px-4 py-2 border-b">
                  <h3 className="text-sm font-semibold text-primary">Products ({selectedProducts.length}/{selectedGroup._productCount} selected)</h3>
                </div>
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
                      <TableHead>Delivery From</TableHead>
                      <TableHead>DSR Number</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedGroup._allProducts.map((product: any) => (
                      <TableRow 
                        key={product._rowKey}
                        className={selectedProducts.includes(product._rowKey) ? "bg-purple-50/30" : ""}
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
                        <TableCell>{product.deliveryFrom}</TableCell>
                        <TableCell>{product.dsrNumber}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Vehicle Assignment Form */}
              <div className="border rounded-lg p-4 space-y-4">
                <h3 className="text-sm font-semibold text-primary">Vehicle Information</h3>
                
                {/* Vehicle Number - NEW REQUIRED FIELD */}
                <div>
                  <Label className="text-sm font-medium">Vehicle Number <span className="text-red-500">*</span></Label>
                  <Input
                    value={vehicleNumber}
                    onChange={(e) => setVehicleNumber(e.target.value)}
                    placeholder="Enter vehicle number (e.g., MH-12-AB-1234)"
                    className="mt-1"
                  />
                </div>

                {/* Vehicle Documents */}
                <div>
                  <h4 className="text-sm font-medium mb-3 text-muted-foreground">Vehicle Documents</h4>
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div className="space-y-1"><Label>Fitness Copy</Label><Input type="file" className="h-8 text-[10px]" /></div>
                    <div className="space-y-1"><Label>Insurance</Label><Input type="file" className="h-8 text-[10px]" /></div>
                    <div className="space-y-1"><Label>Tax Copy</Label><Input type="file" className="h-8 text-[10px]" /></div>
                    <div className="space-y-1"><Label>Pollution Check</Label><Input type="file" className="h-8 text-[10px]" /></div>
                  </div>
                </div>

                {/* Check Status and Remarks */}
                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                  <div className="space-y-2">
                    <Label>Check Status</Label>
                    <Select value={vehicleData.checkStatus} onValueChange={(v) => setVehicleData({...vehicleData, checkStatus: v})}>
                      <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Accept">Accept</SelectItem>
                        <SelectItem value="Reject">Reject</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Remarks</Label>
                    <Input value={vehicleData.remarks} onChange={(e) => setVehicleData({...vehicleData, remarks: e.target.value})} placeholder="Remarks" />
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button 
              onClick={handleAssignVehicle} 
              disabled={!vehicleNumber.trim() || !vehicleData.checkStatus || isProcessing}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {isProcessing ? "Processing..." : "Confirm & Assign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </WorkflowStageShell>
  )
}
