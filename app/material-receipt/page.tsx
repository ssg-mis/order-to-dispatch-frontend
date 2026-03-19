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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Upload, CheckCircle, Settings2, AlertTriangle } from "lucide-react"
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ALL_WORKFLOW_COLUMNS as ALL_COLUMNS } from "@/lib/workflow-columns"
import { confirmMaterialReceiptApi, orderApi } from "@/lib/api-service"
import { useAuth } from "@/hooks/use-auth"

export default function MaterialReceiptPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { isReadOnly, user } = useAuth()
  const [pendingOrders, setPendingOrders] = useState<any[]>([])
  const [historyOrders, setHistoryOrders] = useState<any[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const formatDate = (dateStr: string) => {
    if (!dateStr) return "—";
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      return date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    } catch (e) {
      return dateStr;
    }
  };

  const [visibleColumns, setVisibleColumns] = useState<string[]>([
    "partySoDate",
    "orderNo",
    "customerName",
    "invoiceNo",
    "status",
  ])

  // Selection & Dialog State
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [selectedGroup, setSelectedGroup] = useState<any>(null)
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  // Receipt Form State
  const [isUploading, setIsUploading] = useState<string | null>(null)
  const [receiptData, setReceiptData] = useState({
    receivedDate: "",
    hasDamage: "no",
    receivedProof: "" as string,
    receivedProofName: "",
    remarks: "",
  })

  // Per-product damage data
  const [productDamageData, setProductDamageData] = useState<Record<string, {
    damageQty: string
    damageImage: string
    damageImageName: string
  }>>({})

  // Fetch Pending
  const fetchPending = async () => {
    try {
      const response = await confirmMaterialReceiptApi.getPending({ limit: 1000 });
      if (response.success && response.data.orders) {
        setPendingOrders(response.data.orders);
      }
    } catch (error) {
      console.error("Failed to fetch pending material receipts:", error);
    }
  }

  // Fetch History
  const fetchHistory = async () => {
    try {
      const response = await confirmMaterialReceiptApi.getHistory({ limit: 1000 });
      if (response.success && response.data.orders) {
        setHistoryOrders(response.data.orders);
      }
    } catch (error) {
      console.error("Failed to fetch history:", error);
    }
  }

  const handleFileUpload = async (file: File, type: 'damage' | 'proof', rowKey?: string) => {
    if (!file) return;

    setIsUploading(rowKey ? `${type}-${rowKey}` : type);
    try {
      const response = await orderApi.uploadFile(file);
      if (response.success) {
        if (type === 'damage' && rowKey) {
          setProductDamageData(prev => ({
            ...prev,
            [rowKey]: {
              ...prev[rowKey],
              damageImage: response.data.url,
              damageImageName: file.name
            }
          }))
        } else if (type === 'proof') {
          setReceiptData(p => ({
            ...p,
            receivedProof: response.data.url,
            receivedProofName: file.name
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
    const orderDateStr = order.timestamp || order.planned_8
    if (orderDateStr) {
      const orderDate = new Date(orderDateStr)
      if (filterValues.startDate) {
        const start = new Date(filterValues.startDate)
        start.setHours(0, 0, 0, 0)
        if (orderDate < start) matches = false
      }
      if (filterValues.endDate) {
        const end = new Date(filterValues.endDate)
        end.setHours(23, 59, 59, 999)
        if (orderDate > end) matches = false
      }
    }

    return matches
  })

  /* Grouping Logic */
  const displayRows = useMemo(() => {
    const grouped: { [key: string]: any } = {}

    filteredPendingOrders.forEach((order: any) => {
      // Group by Invoice Number
      const invoiceNo = order.invoice_no || "No Invoice"
      const doNumber = order.so_no || order.d_sr_number || "DO-XXX"

      if (!grouped[invoiceNo]) {
        grouped[invoiceNo] = {
          _rowKey: invoiceNo,
          doNumber: doNumber,
          invoiceNo: invoiceNo,
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
          invoiceDate: order.invoice_date ? new Date(order.invoice_date).toLocaleDateString("en-IN") : "—",
          biltyNo: order.bilty_no || "—",
          rstNo: order.rst_no || "—",
          weightmentSlip: order.weightment_slip_copy || null,
          grossWeight: order.gross_weight || "—",
          tareWeight: order.tare_weight || "—",
          netWeight: order.net_weight || "—",
          weightDiff: order.weight_diff || "—",
          extraWeight: order.extra_weight || "—",
          transporterName: order.transporter_name || "—",
          truckNo: order.truck_no || "—",
          diffReason: order.reason_of_difference_in_weight_if_any_speacefic || "—",

          _allProducts: [],
          _productCount: 0
        }
      }

      const rate = parseFloat(order.rate_of_material) || 0;
      const nosPerMainUom = parseFloat(order.nos_per_main_uom) || 1;
      const actualQty = parseFloat(order.actual_qty_dispatch) || 0;
      const computedBillAmount = rate && nosPerMainUom && actualQty
        ? (rate * nosPerMainUom * actualQty).toFixed(2)
        : null;

      grouped[invoiceNo]._allProducts.push({
        ...order,
        _rowKey: `${invoiceNo}-${order.id}`,
        id: order.id,
        specificOrderNo: order.so_no,
        productName: order.product_name,
        invoiceNo: order.invoice_no,
        billAmount: computedBillAmount,
        actualQty: order.actual_qty_dispatch,
        truckNo: order.truck_no,
        netWeight: order.net_weight,
        processid: order.processid || null
      })

      grouped[invoiceNo]._productCount = grouped[invoiceNo]._allProducts.length
    })

    return Object.values(grouped).map(g => ({
      ...g,
      partySoDate: formatDate(g._allProducts[0]?.party_so_date),
      processId: g._allProducts[0]?.processid || "—",
      vehicleNo: (g._allProducts[0]?.truckNo || "—").toUpperCase(),
      orderPunchRemarks: g._allProducts[0]?.order_punch_remarks || "—"
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
      setReceiptData({
        receivedDate: "",
        hasDamage: "no",
        receivedProof: "",
        receivedProofName: "",
        remarks: "",
      })
      setProductDamageData({})

      setIsDialogOpen(true)
    }
  }

  const handleSubmit = async () => {
    if (!selectedGroup) return

    // Validation
    if (!receiptData.receivedDate) {
      toast({ title: "Validation Error", description: "Received Date is required.", variant: "destructive" })
      return
    }

    const productsToSubmit = selectedGroup._allProducts.filter((p: any) =>
      selectedProducts.includes(p._rowKey)
    )

    if (receiptData.hasDamage === "yes") {
      const hasMissingDetails = productsToSubmit.some((p: any) => {
        const d = productDamageData[p._rowKey];
        return false;
      });
    }

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
        const pDamage = productDamageData[product._rowKey] || {};
        const isItemDamaged = receiptData.hasDamage === "yes" && (pDamage.damageQty || pDamage.damageImage); // Simple heuristic

        const submitData = {
          material_received_date: receiptData.receivedDate,
          damage_status: isItemDamaged ? "Damaged" : "Delivered",
          received_image_proof: receiptData.receivedProof || null,
          sku: null,
          damage_qty: isItemDamaged ? pDamage.damageQty : null,
          damage_image: isItemDamaged ? pDamage.damageImage : null,
          remarks_3: receiptData.remarks || null,
          bill_amount: product.billAmount ? parseFloat(product.billAmount) : null,
          username: user?.username || null // Add username for tracking
        };

        try {
          console.log(`[Material-Receipt] Submitting for ID ${product.id}`, submitData);
          const response = await confirmMaterialReceiptApi.submit(product.id, submitData);

          if (response.success) {
            successfulSubmissions.push(product);
          } else {
            failedSubmissions.push({ product, error: response.message });
          }
        } catch (err: any) {
          console.error(`[Material-Receipt] Failed for ID ${product.id}`, err);
          failedSubmissions.push({ product, error: err.message });
        }
      }

      if (successfulSubmissions.length > 0) {
        toast({
          title: "Receipt Confirmed",
          description: `Successfully processed ${successfulSubmissions.length} items.`,
          variant: receiptData.hasDamage === "yes" ? "destructive" : "default" // Show destructive style if damage reported
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
      title="Stage 12: Confirm Material Receipt"
      description="Confirm material receipt and report any damages."
      pendingCount={displayRows.length}
      historyData={historyOrders.map((order) => ({
        date: order.actual_8 ? new Date(order.actual_8).toLocaleDateString("en-GB") : "-",
        stage: "Material Receipt",
        status: order.damage_status || "Completed",
        remarks: order.damage_status === "Damaged" ? `Damaged: ${order.damage_qty}` : "Received OK",
      }))}
      partyNames={customerNames}
      onFilterChange={setFilterValues}
      remarksColName="Condition"
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
            Confirm Receipt ({selectedItems.length})
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
                <TableHead className="whitespace-nowrap text-center">DO Date</TableHead>
                <TableHead className="whitespace-nowrap text-center">DO Number</TableHead>
                <TableHead className="whitespace-nowrap text-center">Process ID</TableHead>
                <TableHead className="whitespace-nowrap text-center">Customer Name</TableHead>
                <TableHead className="whitespace-nowrap text-center">Products</TableHead>
                {visibleColumns.includes("invoiceNo") && <TableHead className="whitespace-nowrap text-center">Invoice No.</TableHead>}
                <TableHead className="whitespace-nowrap text-center">Vehicle No.</TableHead>
                <TableHead className="whitespace-nowrap text-center">Order Punch Remarks</TableHead>
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
                    <TableCell className="text-center text-xs font-medium">{group.partySoDate}</TableCell>
                    <TableCell className="text-center text-xs font-medium">
                      {group.doNumber.replace(/[A-Za-z]+$/, '')}
                    </TableCell>
                    <TableCell className="text-center text-xs font-medium">{group.processId}</TableCell>
                    <TableCell className="text-center text-xs">{group.customerName}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{group._productCount} items</Badge>
                    </TableCell>
                    {visibleColumns.includes("invoiceNo") && <TableCell className="text-center text-xs font-medium">{group.invoiceNo}</TableCell>}
                    <TableCell className="text-center">
                      <span className="text-xs font-bold text-slate-700">{group.vehicleNo}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-xs text-slate-600 font-medium">{group.orderPunchRemarks}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className="bg-sky-100 text-sky-700">In Transit</Badge>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    No orders pending for receipt confirmation
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
                Confirm Receipt - Invoice: {selectedGroup?.invoiceNo} <span className="text-sm font-medium text-slate-500">({selectedGroup?.customerName})</span>
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
                      {selectedGroup.weightmentSlip ? (
                        <a href={selectedGroup.weightmentSlip} target="_blank" rel="noopener noreferrer" className="block text-blue-600 hover:text-blue-800 underline font-black">
                          #{selectedGroup.rstNo || "—"}
                        </a>
                      ) : (
                        <p className="font-medium">#{selectedGroup.rstNo || "—"}</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Gross / Tare / Net</Label>
                      <p className="font-medium text-slate-900 leading-tight">
                        {selectedGroup.grossWeight || "0"} / {selectedGroup.tareWeight || "0"} / <span className="text-blue-600 font-black">{selectedGroup.netWeight || "0"}</span>
                      </p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Weight Diff</Label>
                      <p className="font-black text-amber-600">{selectedGroup.weightDiff || "0"}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Extra Weight</Label>
                      <p className="font-black text-purple-600">{selectedGroup.extraWeight || "0"}</p>
                    </div>
                    {selectedGroup.diffReason && selectedGroup.diffReason !== "—" && (
                      <div className="col-span-1">
                        <Label className="text-xs text-muted-foreground">Diff Reason</Label>
                        <p className="font-medium text-red-500 italic">{selectedGroup.diffReason}</p>
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
                          <TableHead>Invoice No</TableHead>
                          <TableHead>Bill Amt</TableHead>
                          <TableHead>Actual Qty</TableHead>
                          <TableHead>Truck No</TableHead>
                          <TableHead>Net Wt</TableHead>
                          {receiptData.hasDamage === "yes" && (
                            <>
                              <TableHead className="w-[100px]">Damage Qty</TableHead>
                              <TableHead className="w-[150px]">Damage Image</TableHead>
                            </>
                          )}
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
                            <TableCell className="font-medium text-blue-700">{product.invoiceNo || "—"}</TableCell>
                            <TableCell>{product.billAmount || "0.00"}</TableCell>
                            <TableCell>{product.actualQty || "0"}</TableCell>
                            <TableCell>{(product.truckNo || "—").toUpperCase()}</TableCell>
                            <TableCell className="font-semibold">{product.netWeight || "0"}</TableCell>
                            {receiptData.hasDamage === "yes" && (
                              <>
                                <TableCell>
                                  <Input
                                    className="h-8 text-xs w-full"
                                    type="number"
                                    placeholder="Qty"
                                    value={productDamageData[product._rowKey]?.damageQty || ""}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setProductDamageData(prev => ({
                                        ...prev,
                                        [product._rowKey]: { ...prev[product._rowKey], damageQty: val }
                                      }))
                                    }}
                                  />
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <Input
                                      type="file"
                                      accept="image/*"
                                      id={`damage-upload-${product._rowKey}`}
                                      onChange={(e) => {
                                        if (e.target.files?.[0]) {
                                          handleFileUpload(e.target.files[0], 'damage', product._rowKey)
                                        }
                                      }}
                                      className="hidden"
                                    />
                                    <label htmlFor={`damage-upload-${product._rowKey}`} className="cursor-pointer">
                                      {isUploading === `damage-${product._rowKey}` ? (
                                        <span className="text-[10px] text-blue-500 font-bold animate-pulse">UPLOADING...</span>
                                      ) : productDamageData[product._rowKey]?.damageImage ? (
                                        <div className="flex items-center gap-1">
                                          <CheckCircle className="h-4 w-4 text-green-500" />
                                          <span className="text-[10px] text-green-700 font-bold max-w-[80px] truncate" title={productDamageData[product._rowKey]?.damageImageName}>
                                            {productDamageData[product._rowKey]?.damageImageName}
                                          </span>
                                        </div>
                                      ) : (
                                        <Upload className="h-4 w-4 text-red-400 hover:text-red-600" />
                                      )}
                                    </label>
                                  </div>
                                </TableCell>
                              </>
                            )}
                          </TableRow>
                        ))}

                        {/* Summary Footer Row */}
                        <TableRow className="bg-slate-50 font-black h-12 border-t-2 border-slate-200">
                          <TableCell />
                          <TableCell colSpan={2} className="text-[10px] uppercase font-black text-slate-900">Total</TableCell>
                          <TableCell />
                          <TableCell className="text-xs text-blue-700 font-black">
                            ₹{selectedGroup._allProducts.reduce((sum: number, p: any) => sum + (parseFloat(p.billAmount) || 0), 0).toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <Badge className="bg-blue-600 text-white font-black text-xs px-3">
                              {selectedGroup._allProducts.reduce((sum: number, p: any) => sum + (parseFloat(p.actualQty) || 0), 0)}
                            </Badge>
                          </TableCell>
                          <TableCell />
                          <TableCell className="text-xs font-black">
                            {selectedGroup._allProducts.reduce((sum: number, p: any) => sum + (parseFloat(p.netWeight) || 0), 0)}
                          </TableCell>
                          {receiptData.hasDamage === "yes" && <TableCell colSpan={2} />}
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Receipt Form (Bottom) */}
                <div className="space-y-6 border rounded-lg p-6 bg-white shadow-sm">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b pb-2">
                    <CheckCircle className="h-4 w-4 text-blue-600" />
                    Receipt Details
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label>Material Received Date <span className="text-red-500">*</span></Label>
                      <Input
                        type="date"
                        value={receiptData.receivedDate}
                        onChange={(e) => setReceiptData({ ...receiptData, receivedDate: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Damage Status</Label>
                      <RadioGroup
                        value={receiptData.hasDamage}
                        onValueChange={(value) => setReceiptData({ ...receiptData, hasDamage: value })}
                        className="flex gap-4"
                      >
                        <div className="flex items-center space-x-2 border rounded p-2 hover:bg-slate-50">
                          <RadioGroupItem value="no" id="no-damage" />
                          <Label htmlFor="no-damage" className="text-green-600 cursor-pointer text-sm font-medium">No Damage</Label>
                        </div>
                        <div className="flex items-center space-x-2 border rounded p-2 hover:bg-slate-50">
                          <RadioGroupItem value="yes" id="yes-damage" />
                          <Label htmlFor="yes-damage" className="text-red-600 cursor-pointer text-sm font-medium flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            Has Damage
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>

                    {/* Row-level damage inputs displayed in table above when "Has Damage" is Yes */}

                    <div className="space-y-2">
                      <Label>Received Image (Proof)</Label>
                      <div className="border-2 border-dashed rounded-lg p-4 text-center hover:bg-slate-50 transition-colors bg-blue-50/20">
                        <Input
                          type="file"
                          accept="image/*,.pdf"
                          onChange={(e) => {
                            if (e.target.files?.[0]) {
                              handleFileUpload(e.target.files[0], 'proof')
                            }
                          }}
                          className="hidden"
                          id="proof-upload"
                        />
                        <label htmlFor="proof-upload" className="cursor-pointer block">
                          <Upload className="h-6 w-6 mx-auto mb-1 text-blue-600" />
                          <span className="text-xs font-bold text-slate-700 uppercase tracking-tight block">
                            {isUploading === 'proof' ? "UPLOADING..." : (receiptData.receivedProof ? `REPLACE: ${receiptData.receivedProofName}` : "Click to upload Proof")}
                          </span>
                        </label>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Remarks</Label>
                      <Textarea
                        value={receiptData.remarks}
                        onChange={(e) => setReceiptData({ ...receiptData, remarks: e.target.value })}
                        placeholder="Enter remarks..."
                        className="h-[80px]"
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
                disabled={isProcessing || isReadOnly}
                className={`min-w-37.5 ${receiptData.hasDamage === "yes" ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"}`}
                title={isReadOnly ? "View Only Access" : "Confirm Receipt"}
              >
                {isProcessing ? "Processing..." : "Confirm Receipt"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </WorkflowStageShell>
  )
}