"use client"

import { useEffect, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { WorkflowStageShell } from "@/components/workflow/workflow-stage-shell"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/hooks/use-toast"
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
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Settings2 } from "lucide-react"
import { ALL_WORKFLOW_COLUMNS as ALL_COLUMNS } from "@/lib/workflow-columns"

export default function MaterialLoadPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [pendingOrders, setPendingOrders] = useState<any[]>([])
  const [historyOrders, setHistoryOrders] = useState<any[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState<string[]>([
    "orderNo",
    "customerName",
    "productName",
    "status",
  ])
  const [selectedItems, setSelectedItems] = useState<any[]>([])
  const [loadData, setLoadData] = useState({
    actualQty: "",
    weightmentSlip: "",
    rstNo: "",
    grossWeight: "",
    tareWeight: "",
    netWeight: "",
    totalWeight: "",
    grossWeightPacking: "",
    netWeightPacking: "",
    otherItemWeight: "",
    dharamkataWeight: "",
    differanceWeight: "",
    transporterName: "",
    reason: "",
    truckNo: "",
    vehicleNoPlateImage: "",
  })

  useEffect(() => {
    const savedHistory = localStorage.getItem("workflowHistory")
    if (savedHistory) {
      const history = JSON.parse(savedHistory)
      
      const completed = history.filter(
        (item: any) => item.stage === "Material Load" && item.status === "Completed"
      )
      setHistoryOrders(completed)

      const pending = history.filter(
        (item: any) => item.stage === "Vehicle Details" && item.status === "Completed"
      )
      setPendingOrders(pending)
    }
  }, [])



  useEffect(() => {
    const netPacking = parseFloat(loadData.netWeightPacking) || 0
    const otherPacking = parseFloat(loadData.otherItemWeight) || 0
    const grossPacking = netPacking + otherPacking
    
    setLoadData(prev => ({
      ...prev,
      grossWeightPacking: (loadData.netWeightPacking || loadData.otherItemWeight) ? grossPacking.toFixed(2) : ""
    }))
  }, [loadData.netWeightPacking, loadData.otherItemWeight])

  useEffect(() => {
    const dharamWeight = parseFloat(loadData.dharamkataWeight) || 0
    const grossPacking = parseFloat(loadData.grossWeightPacking) || 0
    const diff = dharamWeight - grossPacking
    
    setLoadData(prev => ({
      ...prev,
      differanceWeight: (loadData.dharamkataWeight || loadData.grossWeightPacking) ? diff.toFixed(2) : ""
    }))
  }, [loadData.dharamkataWeight, loadData.grossWeightPacking])

  const handleSubmit = async (item: any) => {
    setIsProcessing(true)
    try {
      const updatedOrder = {
        ...item,
        stage: "Material Load",
        status: "Completed",
        _product: item._product,
        loadData: {
          ...loadData,
          completedAt: new Date().toISOString(),
        },
        data: {
          ...(item.data || {}),
          orderData: {
            ...(item.data?.orderData || item),
            products: item.orderType === "regular" ? [item._product] : [],
            preApprovalProducts: item.orderType !== "regular" ? [item._product] : []
          }
        }
      }

      const savedHistory = localStorage.getItem("workflowHistory")
      const history = savedHistory ? JSON.parse(savedHistory) : []
      history.push(updatedOrder)
      localStorage.setItem("workflowHistory", JSON.stringify(history))

      // Update local state immediately
      setPendingOrders(prev => prev.filter(o => (o.doNumber || o.orderNo) !== (item.doNumber || item.orderNo)))
      setHistoryOrders((prev) => [...prev, updatedOrder])

      toast({
        title: "Material Loaded",
        description: "Order moved to Security Approval stage.",
      })

      setTimeout(() => {
        router.push("/security-approval")
      }, 1500)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleBulkSubmit = async () => {
    setIsProcessing(true)
    try {
      const updatedEntries = selectedItems.map((item) => ({
        ...item,
        stage: "Material Load",
        status: "Completed",
        _product: item._product,
        loadData: {
          ...loadData,
          completedAt: new Date().toISOString(),
        },
        data: {
          ...(item.data || {}),
          orderData: {
            ...(item.data?.orderData || item),
            products: item.orderType === "regular" ? [item._product] : [],
            preApprovalProducts: item.orderType !== "regular" ? [item._product] : []
          }
        }
      }))

      const savedHistory = localStorage.getItem("workflowHistory")
      const history = savedHistory ? JSON.parse(savedHistory) : []
      history.push(...updatedEntries)
      localStorage.setItem("workflowHistory", JSON.stringify(history))

      // Update local state
      setHistoryOrders((prev) => [...prev, ...updatedEntries])
      setSelectedItems([])

      toast({
        title: "Bulk Material Loaded",
        description: `${updatedEntries.length} items processed and moved to Security Approval.`,
      })

      setTimeout(() => {
        router.push("/security-approval")
      }, 1500)
    } finally {
      setIsProcessing(false)
    }
  }

  /* Extract unique customer names */
  const customerNames = Array.from(new Set(pendingOrders.map(order => order.customerName || "Unknown")))

  const [filterValues, setFilterValues] = useState({
      status: "",
      startDate: "",
      endDate: "",
      partyName: ""
  })

  // Selection Logic
  const toggleSelectItem = (item: any) => {
    const itemKey = `${item.doNumber || item.orderNo}-${item._product?.productName || item._product?.oilType || 'no-prod'}`;
    setSelectedItems((prev) =>
      prev.some((i) => `${i.doNumber || i.orderNo}-${i._product?.productName || i._product?.oilType || 'no-prod'}` === itemKey)
        ? prev.filter((i) => `${i.doNumber || i.orderNo}-${i._product?.productName || i._product?.oilType || 'no-prod'}` !== itemKey)
        : [...prev, item]
    )
  }

  const toggleSelectAll = () => {
    if (selectedItems.length === displayRows.length && displayRows.length > 0) {
      setSelectedItems([])
    } else {
      setSelectedItems(displayRows)
    }
  }

  const filteredPendingOrders = pendingOrders.filter(order => {
      let matches = true
      
      // Filter by Party Name
      if (filterValues.partyName && filterValues.partyName !== "all" && order.customerName !== filterValues.partyName) {
          matches = false
      }

      // Filter by Date Range
      const orderDateStr = order.loadData?.completedAt || order.vehicleData?.assignedAt || order.timestamp
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

  // Flatten orders for table display - each product/oil type is a row
  const displayRows = useMemo(() => {
    const rows: any[] = []
    filteredPendingOrders.forEach((order) => {
       const internalOrder = order.data?.orderData || order;
       const products = (internalOrder.preApprovalProducts?.length > 0)
         ? internalOrder.preApprovalProducts
         : ((internalOrder.products?.length > 0)
           ? internalOrder.products
           : (internalOrder.orderData?.products || []));

       if (!products || products.length === 0) {
         // Check if this "null product" entry exists in history
         const isDone = historyOrders.some(h => 
           (h.orderNo === (order.doNumber || order.orderNo)) && h._product === null
         );
         if (!isDone) rows.push({ ...order, _product: null })
       } else {
         products.forEach((prod: any) => {
           // Track by product name/type
           const pName = prod.productName || prod.oilType;
           const isDone = historyOrders.some(h => 
             (h.orderNo === (order.doNumber || order.orderNo)) && 
             (h.data?.orderData?._product?.productName === pName || h.data?.orderData?._product?.oilType === pName)
           );

           if (!isDone) {
             rows.push({ ...order, _product: prod })
           }
         });
       }
    })
    return rows
  }, [filteredPendingOrders, historyOrders])

  return (
    <WorkflowStageShell
      title="Stage 7: Material Load"
      description="Record material loading details and weights."
      pendingCount={displayRows.length}
      historyData={historyOrders.map((order) => ({
        date: new Date(order.loadData?.completedAt || new Date()).toLocaleDateString("en-GB"),
        stage: "Material Load",
        status: "Completed",
        remarks: `NET: ${order.loadData?.netWeight}kg`,
      }))}
      partyNames={customerNames}
      onFilterChange={setFilterValues}
      remarksColName="Weight Details"
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

          <Dialog>
             <DialogTrigger asChild>
               <Button
                 disabled={selectedItems.length === 0 || isProcessing}
                 className="bg-blue-600 hover:bg-blue-700 font-bold shadow-md transform active:scale-95 transition-all"
               >
                 Load Material ({selectedItems.length})
               </Button>
             </DialogTrigger>
             <DialogContent className="sm:max-w-6xl !max-w-6xl max-h-[95vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="text-xl font-bold text-slate-900 leading-none">Bulk Material Load ({selectedItems.length} Items)</DialogTitle>
                  <DialogDescription className="text-slate-500 mt-1.5">Enter common loading details for all selected items.</DialogDescription>
                </DialogHeader>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 shadow-sm mt-4">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-blue-600/70 block px-1 mb-3">Selected Items ({selectedItems.length})</Label>
                    <div className="max-h-[200px] overflow-y-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 pr-2 scrollbar-hide">
                        {selectedItems.map((item, idx) => (
                            <div key={idx} className="bg-white p-3 border border-slate-200 rounded-xl shadow-sm flex flex-col gap-1.5 relative overflow-hidden group hover:border-blue-200 transition-all">
                                <div className="absolute top-0 right-0 py-0.5 px-2 bg-slate-50 border-l border-b border-slate-100 rounded-bl-lg">
                                   <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">{item.orderType || "—"}</span>
                                </div>
                                <div className="flex flex-col">
                                   <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider leading-none mb-1">DO-No: {item.doNumber || item.orderNo}</span>
                                   <h4 className="text-xs font-bold text-slate-800 leading-tight truncate pr-16">{item.customerName || "—"}</h4>
                                </div>
                                <div className="pt-2 border-t border-slate-50 mt-0.5">
                                   <div className="flex items-center gap-1.5">
                                      <div className="w-1 h-1 rounded-full bg-blue-500" />
                                      <span className="text-xs font-bold text-blue-600 truncate">
                                        {item._product?.productName || item._product?.oilType || "—"}
                                      </span>
                                   </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="py-6 space-y-8">
                  <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-sm">
                    <h3 className="text-sm font-bold text-slate-800 px-1 flex items-center gap-2 uppercase tracking-tight">
                      <div className="w-1.5 h-4 bg-blue-600 rounded-full" />
                      General Details
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-2">
                        <Label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Actual Qty (Total)</Label>
                        <Input
                          type="number"
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
                        <Label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Tare Weight</Label>
                        <Input
                          type="number"
                          value={loadData.tareWeight || ""}
                          onChange={(e) => setLoadData(prev => ({ ...prev, tareWeight: e.target.value }))}
                          placeholder="Tare"
                          className="bg-white border-slate-200 h-10"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Total Weight</Label>
                        <Input
                          type="number"
                          value={loadData.totalWeight || ""}
                          onChange={(e) => setLoadData(prev => ({ ...prev, totalWeight: e.target.value }))}
                          placeholder="Total"
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
                              type="number"
                              value={loadData.netWeightPacking || ""}
                              onChange={(e) => setLoadData(prev => ({ ...prev, netWeightPacking: e.target.value }))}
                              placeholder="Net"
                              className="bg-white border-indigo-200 h-10"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[10px] uppercase font-bold text-indigo-600 tracking-wider">Other Items</Label>
                            <Input
                              type="number"
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
                            type="number"
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
                               type="number"
                               value={loadData.dharamkataWeight || ""}
                               onChange={(e) => setLoadData(prev => ({ ...prev, dharamkataWeight: e.target.value }))}
                               placeholder="Weight"
                               className="bg-white border-amber-200 h-10"
                             />
                           </div>
                           <div className="space-y-2">
                             <Label className="text-[10px] uppercase font-bold text-amber-600 tracking-wider">Difference</Label>
                             <Input
                               type="number"
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

                  {/* Verification Artifacts Section - PRESERVED */}
                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 shadow-sm">
                    <h3 className="text-sm font-bold text-slate-800 mb-4 px-1 flex items-center gap-2">
                      <div className="w-1 h-4 bg-slate-600 rounded-full" />
                      Verification Artifacts
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
                    </div>
                  </div>
                </div>

                <DialogFooter>
                   <Button variant="outline" onClick={() => (document.querySelector('[data-state="open"] button[aria-label="Close"]') as HTMLElement)?.click()}>
                     Cancel
                   </Button>
                   <Button onClick={handleBulkSubmit} disabled={isProcessing} className="bg-blue-600 hover:bg-blue-700 lg:min-w-[200px]">
                     {isProcessing ? "Processing..." : "Complete Bulk Load"}
                   </Button>
                </DialogFooter>
             </DialogContent>
          </Dialog>
        </div>

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
                {ALL_COLUMNS.filter((col) => visibleColumns.includes(col.id)).map((col) => (
                  <TableHead key={col.id} className="whitespace-nowrap text-center">
                    {col.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayRows.length > 0 ? (
                displayRows.map((item: any, index: number) => {
                   const order = item;
                   const p = order._product;
                   const rowKey = `${order.doNumber || order.orderNo}-${p?.productName || p?.oilType || 'no-prod'}`;
                   
                   const prodName = p?.productName || p?.oilType || "—";
                   const rateLtr = p?.ratePerLtr || p?.rateLtr || order.ratePerLtr || "—";
                   const rate15Kg = p?.ratePer15Kg || p?.rateLtr || order.rateLtr || "—";
                   const oilType = p?.oilType || order.oilType || "—";

                   const row: any = {
                     orderNo: order.doNumber || order.orderNo || "DO-XXX",
                     deliveryPurpose: order.orderPurpose || "—",
                     customerType: order.customerType || "—",
                     orderType: order.orderType || "—",
                     soNo: order.soNumber || "—",
                     partySoDate: order.soDate || order.partySoDate || "—",
                     customerName: order.customerName || "—",
                     itemConfirm: order.itemConfirm || "—",
                     productName: prodName,
                     uom: p?.uom || "—",
                     orderQty: p?.orderQty || p?.approvalQty || "—",
                     altUom: p?.altUom || "—",
                     altQty: p?.altQty || "—",
                     oilType: oilType,
                     ratePerLtr: rateLtr,
                     ratePer15Kg: rate15Kg,
                     rateOfMaterial: order.rateMaterial || "—",
                     totalWithGst: order.totalWithGst || "—",
                     transportType: order.dispatchData?.transportType || "—",
                     uploadSo: "so_document.pdf",
                     contactPerson: order.contactPerson || "—",
                     whatsapp: order.whatsappNo || "—",
                     address: order.customerAddress || "—",
                     paymentTerms: order.paymentTerms || "—",
                     advanceTaken: order.advancePaymentTaken || "—",
                     advanceAmount: order.advanceAmount || "—",
                     isBroker: order.isBrokerOrder || "—",
                     brokerName: order.brokerName || "—",
                     deliveryDate: order.deliveryDate || "—",
                     qtyToDispatch: order.dispatchData?.qtyToDispatch || "—",
                     deliveryFrom: order.deliveryData?.deliveryFrom || "—",
                     status: "Ready to Load",
                   }

                   const isSelected = selectedItems.some(i => `${i.doNumber || i.orderNo}-${i._product?.productName || i._product?.oilType || 'no-prod'}` === rowKey);

                   return (
                   <TableRow key={`${index}-${rowKey}`} className={isSelected ? "bg-blue-50/50" : ""}>
                     <TableCell className="text-center">
                        <Checkbox 
                          checked={isSelected}
                          onCheckedChange={() => toggleSelectItem(item)}
                        />
                     </TableCell>
                     {ALL_COLUMNS.filter((col) => visibleColumns.includes(col.id)).map((col) => (
                       <TableCell key={col.id} className="whitespace-nowrap text-center">
                         {col.id === "status" ? (
                            <div className="flex justify-center">
                               <Badge className="bg-indigo-100 text-indigo-700">Ready to Load</Badge>
                            </div>
                         ) : row[col.id as keyof typeof row] || "—"}
                       </TableCell>
                     ))}
                   </TableRow>
                   )
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={visibleColumns.length + 1} className="text-center py-8 text-muted-foreground">
                    No items pending for material loading
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
           </Table>
         </Card>
       </div>
     </WorkflowStageShell>
   )
 }