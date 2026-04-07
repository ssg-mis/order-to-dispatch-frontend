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
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ALL_WORKFLOW_COLUMNS as ALL_COLUMNS } from "@/lib/workflow-columns"
import { confirmMaterialReceiptApi, orderApi } from "@/lib/api-service"
import { useAuth } from "@/hooks/use-auth"
import { useQuery } from "@tanstack/react-query"
import { Loader2, RotateCcw, ChevronLeft, ChevronRight, Settings2, Search, CheckCircle, Upload, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"

export default function MaterialReceiptPage() {
  const router = useRouter()
  const { user, isReadOnly } = useAuth()
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending")
  const [pendingPage, setPendingPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const limit = 25;

  const [filterValues, setFilterValues] = useState({
    status: "",
    startDate: "",
    endDate: "",
    partyName: "",
    search: ""
  })
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

  // Pending Receipts Query
  const {
    data: pendingData,
    isLoading: isPendingLoading,
    refetch: refetchPending,
  } = useQuery({
    queryKey: ["pending-material-receipt", filterValues.search, filterValues.partyName, user?.depo_access, pendingPage],
    queryFn: async () => {
      const response = await confirmMaterialReceiptApi.getPending({
        page: pendingPage,
        limit: limit,
        so_no: filterValues.search,
        party_name: filterValues.partyName === "all" ? undefined : filterValues.partyName,
        depo_names: user?.depo_access?.['Material Receipt'] || [],
      });
      return response.success ? response.data : { orders: [], pagination: { total: 0 } };
    },
  });

  const pendingOrders = pendingData?.orders || [];

  // History Query
  const {
    data: historyData,
    isLoading: isHistoryLoading,
    refetch: refetchHistory,
  } = useQuery({
    queryKey: ["material-receipt-history", filterValues.search, filterValues.partyName, user?.depo_access, historyPage],
    queryFn: async () => {
      const response = await confirmMaterialReceiptApi.getHistory({
        page: historyPage,
        limit: limit,
        so_no: filterValues.search,
        party_name: filterValues.partyName === "all" ? undefined : filterValues.partyName,
        depo_names: user?.depo_access?.['Material Receipt'] || [],
      });
      return response.success ? response.data : { orders: [], pagination: { total: 0 } };
    },
    enabled: activeTab === "history",
  });

  const historyOrders = historyData?.orders || [];

  // Reset to page 1 on filter change
  useEffect(() => {
    setPendingPage(1);
    setHistoryPage(1);
  }, [filterValues.search, filterValues.partyName]);

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

  /* Filter Logic for UI */
  const filteredPendingOrders = pendingOrders; // Backend already filtered them

  /* Grouping Logic */
  const displayRows = useMemo(() => {
    const grouped: { [key: string]: any } = {}

    filteredPendingOrders.forEach((order: any) => {
      const invoiceNo = order.invoice_no || "No Invoice"
      const doNumber = order.so_no || order.d_sr_number || "DO/26-27/0001"
      const groupKey = invoiceNo !== "No Invoice" ? invoiceNo : doNumber;

      if (!grouped[groupKey]) {
        grouped[groupKey] = {
          _rowKey: groupKey,
          doNumber: doNumber,
          invoiceNo: invoiceNo,
          customerName: (order.transfer === 'yes' && order.bill_company_name) ? order.bill_company_name : (order.party_name || "—"),
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
          isBroker: order.is_order_through_broker || false,
          brokerName: order.broker_name || "—",
          advanceAmount: order.advance_amount || 0,
          paymentTerms: order.payment_terms || "—",
          partySoDate: order.party_so_date ? new Date(order.party_so_date).toLocaleDateString("en-IN") : "—",
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

      grouped[groupKey]._allProducts.push({
        ...order,
        _rowKey: `${groupKey}-${order.id}`,
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

      grouped[groupKey]._productCount = grouped[groupKey]._allProducts.length
    })

    return Object.values(grouped).map((g: any) => ({
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
    if (selectedItems.length === displayRows.length && displayRows.length > 0) {
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
      setSelectedProducts(targetGroup._allProducts.map((p: any) => p._rowKey))
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
    if (!receiptData.receivedDate) {
      toast({ title: "Validation Error", description: "Received Date is required.", variant: "destructive" })
      return
    }

    const productsToSubmit = selectedGroup._allProducts.filter((p: any) =>
      selectedProducts.includes(p._rowKey)
    )

    if (productsToSubmit.length === 0) {
      toast({ title: "Error", description: "Please select at least one product", variant: "destructive" })
      return
    }

    setIsProcessing(true)
    try {
      const successfulSubmissions: any[] = []
      const failedSubmissions: any[] = []

      for (const product of productsToSubmit) {
        const pDamage = productDamageData[product._rowKey] || {};
        const isItemDamaged = receiptData.hasDamage === "yes" && (pDamage.damageQty || pDamage.damageImage);

        const submitData = {
          material_received_date: receiptData.receivedDate,
          damage_status: isItemDamaged ? "Damaged" : "Delivered",
          received_image_proof: receiptData.receivedProof || null,
          sku: null,
          damage_qty: isItemDamaged ? pDamage.damageQty : null,
          damage_image: isItemDamaged ? pDamage.damageImage : null,
          remarks_3: receiptData.remarks || null,
          bill_amount: product.billAmount ? parseFloat(product.billAmount) : null,
          username: user?.username || null
        };

        const response = await confirmMaterialReceiptApi.submit(product.id, submitData);
        if (response.success) {
          successfulSubmissions.push(product);
        } else {
          failedSubmissions.push({ product, error: response.message });
        }
      }

      if (successfulSubmissions.length > 0) {
        toast({
          title: "Receipt Confirmed",
          description: `Processed ${successfulSubmissions.length} items.`,
          variant: receiptData.hasDamage === "yes" ? "destructive" : "default"
        })
        await refetchPending();
        await refetchHistory();
        setIsDialogOpen(false)
        setSelectedItems([])
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Submit failed", variant: "destructive" })
    } finally {
      setIsProcessing(false)
    }
  }

  const customerNames = Array.from(new Set(pendingOrders.map((order: any) => (order.transfer === 'yes' && order.bill_company_name) ? order.bill_company_name : (order.party_name || "Unknown Customer")))) as string[]

  return (
    <WorkflowStageShell
      partyNames={customerNames}
      title="Stage 12: Confirm Material Receipt"
      description="Confirm material receipt and report any damages."
      pendingCount={pendingData?.pagination?.total || 0}
      historyData={historyOrders.map((order: any) => ({
        ...order,
        date: order.actual_8 ? new Date(order.actual_8).toLocaleDateString("en-GB") : "-",
        orderNo: order.so_no,
        stage: "Material Receipt",
        customerName: (order.transfer === 'yes' && order.bill_company_name) ? order.bill_company_name : order.party_name,
        status: order.damage_status || "Completed",
        remarks: order.damage_status === "Damaged" ? `Damaged: ${order.damage_qty}` : "Received OK",
        rawData: order,
      }))}
      onFilterChange={setFilterValues}
      showStatusFilter={true}
      stageLevel={9}
      onTabChange={setActiveTab}
      isHistoryLoading={isHistoryLoading}
      historyFooter={
        <div className="px-6 py-4 border-t bg-slate-50/50 flex items-center justify-between">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            Showing Page <span className="text-slate-900 mx-1">{historyPage}</span>
            {historyData?.pagination?.total && (
              <> of <span className="text-slate-900 mx-1">{Math.ceil(historyData.pagination.total / limit)}</span></>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
              disabled={historyPage === 1 || isHistoryLoading}
              className="h-8 rounded-lg gap-1 px-3"
            >
              <ChevronLeft className="h-4 w-4" /> Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setHistoryPage(p => p + 1)}
              disabled={isHistoryLoading || (historyPage * limit >= (historyData?.pagination?.total || 0))}
              className="h-8 rounded-lg gap-1 px-3"
            >
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Action Bar */}
        <div className="flex justify-end gap-2">
          <Button
            onClick={handleOpenDialog}
            disabled={selectedItems.length === 0 || isReadOnly}
            className="bg-blue-600 hover:bg-blue-700 font-bold"
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
                  <Checkbox 
                    checked={displayRows.length > 0 && selectedItems.length === displayRows.length} 
                    onCheckedChange={toggleSelectAll} 
                  />
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
              {isPendingLoading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i} className="opacity-40 border-b border-slate-50">
                    <TableCell className="text-center py-4"><div className="h-4 w-4 bg-slate-200 animate-pulse rounded mx-auto" /></TableCell>
                    <TableCell className="text-center py-4"><div className="h-3 w-20 bg-slate-200 animate-pulse rounded-full mx-auto" /></TableCell>
                    <TableCell className="text-center py-4"><div className="h-3 w-24 bg-slate-200 animate-pulse rounded-full mx-auto" /></TableCell>
                    <TableCell className="text-center py-4"><div className="h-4 w-4 bg-slate-200 animate-pulse rounded mx-auto" /></TableCell>
                    <TableCell className="text-center py-4"><div className="h-3 w-40 bg-slate-200 animate-pulse rounded-full mx-auto" /></TableCell>
                    <TableCell className="text-center py-4"><div className="h-3 w-16 bg-slate-200 animate-pulse rounded-full mx-auto" /></TableCell>
                    <TableCell className="text-center py-4"><div className="h-3 w-24 bg-slate-200 animate-pulse rounded-full mx-auto" /></TableCell>
                    <TableCell className="text-center py-4"><div className="h-3 w-24 bg-slate-200 animate-pulse rounded-full mx-auto" /></TableCell>
                    <TableCell className="text-center py-4"><div className="h-3 w-40 bg-slate-200 animate-pulse rounded-full mx-auto" /></TableCell>
                    <TableCell className="text-center py-4"><div className="h-5 w-24 bg-slate-200 animate-pulse rounded-full mx-auto" /></TableCell>
                  </TableRow>
                ))
              ) : displayRows.length > 0 ? (
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
                      <Badge variant="secondary" className="font-bold">{group._productCount} items</Badge>
                    </TableCell>
                    {visibleColumns.includes("invoiceNo") && <TableCell className="text-center text-xs font-medium">{group.invoiceNo}</TableCell>}
                    <TableCell className="text-center">
                      <span className="text-xs font-bold text-slate-700">{group.vehicleNo}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-xs text-slate-600 font-medium truncate max-w-[150px] block" title={group.orderPunchRemarks}>
                        {group.orderPunchRemarks}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className="bg-sky-100 text-sky-700 font-black text-[10px] uppercase">In Transit</Badge>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-muted-foreground font-medium uppercase text-xs tracking-widest">
                    No orders pending for receipt confirmation
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {/* Pagination Footer - Pending */}
          <div className="px-6 py-4 border-t bg-slate-50/50 flex items-center justify-between">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              Showing Page <span className="text-slate-900 mx-1">{pendingPage}</span>
              {pendingData?.pagination?.total && (
                <> of <span className="text-slate-900 mx-1">{Math.ceil(pendingData.pagination.total / limit)}</span></>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPendingPage(p => Math.max(1, p - 1))}
                disabled={pendingPage === 1 || isPendingLoading}
                className="h-8 rounded-lg gap-1 px-3 font-bold"
              >
                <ChevronLeft className="h-4 w-4" /> Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPendingPage(p => p + 1)}
                disabled={isPendingLoading || (pendingPage * limit >= (pendingData?.pagination?.total || 0))}
                className="h-8 rounded-lg gap-1 px-3 font-bold"
              >
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>

        {/* Receipt Confirmation Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-[95vw] w-full max-h-[95vh] overflow-y-auto p-0">
            <div className="p-6">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold text-slate-900">
                  Confirm Receipt - Invoice: {selectedGroup?.invoiceNo} <span className="text-sm font-medium text-slate-500">({selectedGroup?.customerName})</span>
                </DialogTitle>
              </DialogHeader>

              {selectedGroup && (
                <div className="space-y-6 mt-4">
                  {/* Summary & Logistics */}
                  <div className="border rounded-lg p-4 bg-muted/30">
                    <h3 className="text-sm font-semibold mb-3 text-primary uppercase tracking-wider">Logistics Details</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-xs font-medium">
                      <div><Label className="text-[10px] text-muted-foreground uppercase">DO Date</Label><div>{selectedGroup.partySoDate}</div></div>
                      <div><Label className="text-[10px] text-muted-foreground uppercase">Vehicle</Label><div className="font-bold text-blue-600">{selectedGroup.vehicleNo}</div></div>
                      <div><Label className="text-[10px] text-muted-foreground uppercase">Bilty No</Label><div>{selectedGroup.biltyNo}</div></div>
                      <div><Label className="text-[10px] text-muted-foreground uppercase">Transporter</Label><div className="truncate">{selectedGroup.transporterName}</div></div>
                    </div>
                  </div>

                  {/* Product List */}
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader className="bg-slate-50">
                        <TableRow>
                          <TableHead className="w-12">
                            <Checkbox
                              checked={selectedProducts.length === selectedGroup._allProducts.length}
                              onCheckedChange={(checked) => setSelectedProducts(checked ? selectedGroup._allProducts.map((p: any) => p._rowKey) : [])}
                            />
                          </TableHead>
                          <TableHead>Product</TableHead>
                          <TableHead className="text-center">Actual Qty</TableHead>
                          <TableHead className="text-center">Net Wt</TableHead>
                          {receiptData.hasDamage === "yes" && (
                            <>
                              <TableHead className="w-[120px]">Damage Qty</TableHead>
                              <TableHead>Image</TableHead>
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
                                onCheckedChange={(checked) => setSelectedProducts(p => checked ? [...p, product._rowKey] : p.filter(k => k !== product._rowKey))} 
                              />
                            </TableCell>
                            <TableCell className="font-bold text-xs">{product.productName}</TableCell>
                            <TableCell className="text-center font-bold">{product.actualQty}</TableCell>
                            <TableCell className="text-center font-bold">{product.netWeight}</TableCell>
                            {receiptData.hasDamage === "yes" && (
                              <>
                                <TableCell>
                                  <Input 
                                    className="h-8 text-xs font-bold" 
                                    type="number" 
                                    value={productDamageData[product._rowKey]?.damageQty || ""} 
                                    onChange={(e) => setProductDamageData(prev => ({ ...prev, [product._rowKey]: { ...prev[product._rowKey], damageQty: e.target.value } }))} 
                                  />
                                </TableCell>
                                <TableCell>
                                  <label className="cursor-pointer">
                                    <Input 
                                      type="file" 
                                      className="hidden" 
                                      onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'damage', product._rowKey)} 
                                    />
                                    {isUploading === `damage-${product._rowKey}` ? <Loader2 className="h-4 w-4 animate-spin" /> : (productDamageData[product._rowKey]?.damageImage ? <CheckCircle className="h-4 w-4 text-green-500" /> : <Upload className="h-4 w-4 text-slate-400" />)}
                                  </label>
                                </TableCell>
                              </>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Form */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 border rounded-lg bg-white shadow-sm">
                    <div className="space-y-2">
                      <Label className="font-bold">Received Date <span className="text-red-500">*</span></Label>
                      <Input type="date" value={receiptData.receivedDate} onChange={(e) => setReceiptData({ ...receiptData, receivedDate: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                        <Label className="font-bold">Status</Label>
                        <RadioGroup value={receiptData.hasDamage} onValueChange={(val) => setReceiptData({ ...receiptData, hasDamage: val })} className="flex gap-4 h-10 items-center">
                          <div className="flex items-center space-x-2"><RadioGroupItem value="no" id="d-no" /><Label htmlFor="d-no" className="text-green-600 font-bold">No Damage</Label></div>
                          <div className="flex items-center space-x-2"><RadioGroupItem value="yes" id="d-yes" /><Label htmlFor="d-yes" className="text-red-600 font-bold">Has Damage</Label></div>
                        </RadioGroup>
                    </div>
                    <div className="space-y-2">
                        <Label className="font-bold">Proof of Receipt</Label>
                        <div className="border-2 border-dashed rounded-lg p-4 text-center bg-slate-50">
                          <label className="cursor-pointer block">
                            <Input type="file" className="hidden" onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'proof')} />
                            <Upload className="mx-auto h-6 w-6 text-slate-400 mb-2" />
                            <span className="text-xs font-bold text-slate-600 capitalize">
                              {isUploading === 'proof' ? "UPLOADING..." : (receiptData.receivedProof ? `REPLACE: ${receiptData.receivedProofName}` : "Click to Upload Proof")}
                            </span>
                          </label>
                        </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="font-bold">Remarks</Label>
                      <Textarea value={receiptData.remarks} onChange={(e) => setReceiptData({ ...receiptData, remarks: e.target.value })} placeholder="Internal remarks..." className="h-20" />
                    </div>
                  </div>
                </div>
              )}

              <DialogFooter className="mt-8 border-t pt-4">
                <Button variant="ghost" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button 
                  onClick={handleSubmit} 
                  disabled={isProcessing || isReadOnly} 
                  className={`min-w-[150px] font-bold ${receiptData.hasDamage === 'yes' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                >
                  {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                  Confirm Receipt
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </WorkflowStageShell>
  )
}