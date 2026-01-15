"use client"

import { Card } from "@/components/ui/card"
import { WorkflowStageShell } from "@/components/workflow/workflow-stage-shell"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useRouter } from "next/navigation"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useToast } from "@/hooks/use-toast"
import { useState, useEffect, useMemo } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Checkbox } from "@/components/ui/checkbox"
import { Settings2, CheckCircle2 } from "lucide-react"
import { saveWorkflowHistory } from "@/lib/storage-utils"


export default function CommitmentReviewPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [isConfirming, setIsConfirming] = useState(false)
  const PAGE_COLUMNS = [
    { id: "orderNo", label: "DO Number" },
    { id: "soNo", label: "DO No." },
    { id: "deliveryPurpose", label: "Order Type (Delivery Purpose)" },
    { id: "startDate", label: "Start Date" },
    { id: "endDate", label: "End Date" },
    { id: "deliveryDate", label: "Delivery Date" },
    { id: "orderType", label: "Order Type" },
    { id: "customerType", label: "Customer Type" },
    { id: "partySoDate", label: "Party DO Date" },
    { id: "customerName", label: "Customer Name" },
    { id: "oilType", label: "Oil Type" },
    { id: "ratePer15Kg", label: "Rate Per 15 kg" },
    { id: "ratePerLtr", label: "Rate Per Ltr." }, // Aggregated
    { id: "productName", label: "Product Name" },
    { id: "uom", label: "UOM" },
    { id: "orderQty", label: "Order Quantity" },
    { id: "altUom", label: "Alt UOM" },
    { id: "altQty", label: "Alt Qty (Kg)" },
    { id: "rate", label: "Rate" },
    { id: "totalWithGst", label: "Total Amount with GST" },
    { id: "transportType", label: "Type of Transporting" },
    { id: "contactPerson", label: "Customer Contact Person Name" },
    { id: "whatsapp", label: "Customer Contact Person Whatsapp No." },
    { id: "address", label: "Customer Address" },
    { id: "paymentTerms", label: "Payment Terms" },
    { id: "advanceTaken", label: "Advance Payment to be Taken" },
    { id: "advanceAmount", label: "Advance Amount" },
    { id: "isBroker", label: "Is this order Through Broker" },
    { id: "brokerName", label: "Broker Name (If Order Through Broker)" },
    { id: "uploadSo", label: "Upload DO." },
    { id: "status", label: "Status" },
  ]

  const [visibleColumns, setVisibleColumns] = useState<string[]>([
    "orderNo",
    "customerName",
    "productName",
    "rate",
    "status",
  ])
  
  // State for list of orders
  const [pendingOrders, setPendingOrders] = useState<any[]>([])
  const [selectedOrder, setSelectedOrder] = useState<any>(null) // For the dialog interaction
  const [sourceOfMaterial, setSourceOfMaterial] = useState<string>("in-stock")

  const [checklistValues, setChecklistValues] = useState<Record<string, string>>({
    rate: "approve",
    sku: "approve",
    credit: "approve",
    dispatch: "approve",
    overall: "approve",
    confirm: "approve",
  })

  const [history, setHistory] = useState<any[]>([])

  useEffect(() => {
    // 1. Load History
    const savedHistory = localStorage.getItem("workflowHistory")
    let historyData = []
    if (savedHistory) {
      historyData = JSON.parse(savedHistory)
      // Filter for both old and new stage names to keep history visible
      const stageHistory = historyData.filter((item: any) => 
          item.stage === "Commitment Review" || item.stage === "Approval Of Order"
      )
      
      // Map history to match Shell expectations (date, remarks)
      // Create a map of Pre-Approval remarks for fallback
      const preApprovalMap = new Map();
      historyData.forEach((h: any) => {
          if (h.stage === "Pre-Approval" && h.orderNo) {
             preApprovalMap.set(h.orderNo, h.data?.overallRemark || h.data?.preApprovalData?.overallRemark);
          }
      });

      const formattedHistory = stageHistory.map((item: any) => {
          let remark = item.remarks;
          if (!remark || remark === "-") {
              remark = preApprovalMap.get(item.orderNo) || "Verified"; 
          }
          return {
            ...item,
            stage: "Approval Of Order", // Force display name update
            date: item.date || (item.timestamp ? new Date(item.timestamp).toLocaleDateString("en-GB") : "-"),
            remarks: remark
          }
      })
      setHistory(formattedHistory)
    }
      
      // LOGIC: Collect all products that reached Pre-Approval Completed
      // And subtract those that reached Approval Of Order Completed
      const ordersInPreApproval = historyData.filter((h: any) => h.stage === "Pre-Approval" && h.status === "Completed");
      const itemsInApproval = historyData.filter((h: any) => (h.stage === "Approval Of Order" || h.stage === "Commitment Review") && (h.status === "Approved" || h.status === "Rejected"));

      const pendingFromHistory: any[] = [];
      
      ordersInPreApproval.forEach((entry: any) => {
          const rawOrder = entry.data?.orderData || entry.data || entry;
          const orderNo = entry.orderNo || entry.doNumber;
          
          // Get all products in this order
          const products = rawOrder.products || rawOrder.preApprovalProducts || [];
          const preApprovalProducts = rawOrder.preApprovalProducts || [];
          
          // Filter products that aren't done yet
          const remainingProducts = products.filter((p: any) => {
              const pName = p.productName || p.oilType;
              return !itemsInApproval.some((h: any) => 
                  (h.orderNo === orderNo) && 
                  (h.data?.orderData?._product?.productName === pName || h.data?.orderData?._product?.oilType === pName)
              );
          });

          const remainingPreApp = preApprovalProducts.filter((p: any) => {
              const pName = p.productName || p.oilType;
              return !itemsInApproval.some((h: any) => 
                  (h.orderNo === orderNo) && 
                  (h.data?.orderData?._product?.productName === pName || h.data?.orderData?._product?.oilType === pName)
              );
          });

          if (remainingProducts.length > 0 || remainingPreApp.length > 0 || (products.length === 0 && preApprovalProducts.length === 0)) {
              const orderData = {
                  ...rawOrder,
                  products: remainingProducts,
                  preApprovalProducts: remainingPreApp,
                  preApprovalData: entry.data
              }
              if (entry.data?.overallRemark) {
                  orderData.preApprovalRemark = entry.data.overallRemark;
              }
              pendingFromHistory.push(orderData);
          }
      });
      
      // Also handle manually added Pending entries
      historyData.forEach((entry: any) => {
          if (entry.stage === "Approval Of Order" && entry.status === "Pending") {
              const exists = pendingFromHistory.some(o => (o.doNumber || o.orderNo) === (entry.doNumber || entry.orderNo));
              if (!exists) pendingFromHistory.push(entry);
          }
      });
      
      // 2. Load Persisted Pending Items (for Direct Regular Orders)
      const savedPending = localStorage.getItem("approvalPendingItems")
      let persistedPending = savedPending ? JSON.parse(savedPending) : []

      // 3. Load New Incoming Data (Regular Order Handoff)
      const savedOrderData = localStorage.getItem("orderData")
      if (savedOrderData) {
        try {
            const data = JSON.parse(savedOrderData)
            // Only add if it's meant for this stage and strictly Pending (Regular Order)
            if (data.stage === "Approval Of Order" && data.status === "Pending") {
                // Check if already processed in history
                const isProcessed = historyData.some(
                    (item: any) => item.stage === "Approval Of Order" && (item.orderNo === (data.doNumber || "DO-XXX"))
                )
                
                if (!isProcessed) {
                     // Check if already in persisted list
                     const exists = persistedPending.some((o: any) => 
                         (o.doNumber || o.orderNo) === (data.doNumber || data.orderNo)
                     )
                     if (!exists) {
                         persistedPending = [data, ...persistedPending]
                         localStorage.setItem("approvalPendingItems", JSON.stringify(persistedPending))
                     }
                }
            }
        } catch(e) {}
      }

      // 4. Merge history pending and direct persisted pending
      const mergedPending = [...pendingFromHistory]
      
      persistedPending.forEach((item: any) => {
          const exists = mergedPending.some(o => (o.doNumber || o.orderNo) === (item.doNumber || item.orderNo))
          if (!exists) {
              mergedPending.push(item)
          }
      })
      
      // Sort by recency
      // mergedPending.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

      setPendingOrders(mergedPending)
  }, [])

  const checkItems = [
    { id: "rate", label: "Rate Right?" },
    { id: "sku", label: "We Deal in SKU?" },
    { id: "credit", label: "Credit OK?" },
    { id: "dispatch", label: "Dispatch Confirmed?" },
    { id: "overall", label: "Overall Status?" },
    { id: "confirm", label: "Customer Confirmation?" },
  ]

  const handleChecklistChange = (itemId: string, value: string) => {
    setChecklistValues((prev) => ({
      ...prev,
      [itemId]: value,
    }))
  }

  const handleConfirmCommitment = async () => {
    if (selectedItems.length === 0) return;
    
    setIsConfirming(true)
    try {
      const hasRejection = Object.values(checklistValues).includes("reject")
      const timestamp = new Date().toISOString()
      
      // Process each selected item individually
      for (const item of selectedItems) {
        const orderIdentifier = item.doNumber || item.soNumber || item.orderNo || "ORD-XXX";
        const productName = item._product?.productName || item._product?.oilType || "Unknown";

        // Create a focused order object with ONLY the approved/rejected product
        const focusedOrderData = {
            ...item,
            products: item.orderType === "regular" ? [item._product] : [],
            preApprovalProducts: item.orderType === "pre-approval" ? [item._product] : (item.preApprovalProducts?.some((p: any) => p.oilType) ? [item._product] : []),
            _product: item._product // keep for reference
        };

        if (hasRejection) {
          const historyEntry = {
            orderNo: orderIdentifier,
            customerName: item.customerName || "Unknown",
            stage: "Approval Of Order",
            status: "Rejected" as const,
            processedBy: "Current User",
            timestamp: timestamp,
            remarks: `Rejected: ${productName}`,
            data: {
              orderData: focusedOrderData,
              checklistResults: checklistValues,
              rejectedAt: timestamp,
            },
            orderType: item.orderType || "regular"
          }
          saveWorkflowHistory(historyEntry)
        } else {
          const finalData = {
            orderData: {
              ...focusedOrderData,
              deliveryData: {
                  deliveryFrom: sourceOfMaterial
              }
            },
            checklistResults: checklistValues,
            confirmedAt: timestamp,
            status: "Approved",
          }

          const historyEntry = {
            orderNo: orderIdentifier,
            customerName: item.customerName || "Unknown",
            stage: "Approval Of Order",
            status: "Approved" as const,
            processedBy: "Current User",
            timestamp: timestamp,
            remarks: `Verified & Approved: ${productName}`,
            data: finalData,
            orderType: item.orderType || "regular"
          }

          saveWorkflowHistory(historyEntry)
          setHistory((prev) => [...prev, historyEntry])
        }
      }

      // Update persisted list by REMOVING only the selected products, not the whole order
      const savedPending = localStorage.getItem("approvalPendingItems")
      if (savedPending) {
         const list = JSON.parse(savedPending)
         
         const updatedList = list.map((o: any) => {
             const oId = o.doNumber || o.orderNo;
             const itemsForThisOrder = selectedItems.filter(item => (item.doNumber || item.orderNo) === oId);
             
             if (itemsForThisOrder.length === 0) return o;
             
             // Use a composite key for matching products to remove
             const processedKeys = new Set(itemsForThisOrder.map(item => 
                 `${item._product?.productName || item._product?.oilType}-${item._product?.uom || '—'}-${item._product?.orderQty || '—'}`
             ));
             
             const remainingProducts = (o.products || []).filter((p: any) => {
                 const pKey = `${p.productName || p.oilType}-${p.uom || '—'}-${p.orderQty || '—'}`;
                 return !processedKeys.has(pKey);
             });
             
             const remainingPreAppProducts = (o.preApprovalProducts || []).filter((p: any) => {
                 const pKey = `${p.productName || p.oilType}-${p.uom || '—'}-${p.orderQty || '—'}`;
                 return !processedKeys.has(pKey);
             });
             
             return {
                 ...o,
                 products: remainingProducts,
                 preApprovalProducts: remainingPreAppProducts
             };
         }).filter((o: any) => {
             // Keep the order if it still has products or if it's a special type
             return (o.products?.length > 0 || o.preApprovalProducts?.length > 0);
         });

         localStorage.setItem("approvalPendingItems", JSON.stringify(updatedList))
         setPendingOrders(updatedList)
      }

      toast({
        title: hasRejection ? "Orders Rejected" : "Commitment Verified",
        description: `${selectedItems.length} items have been processed.`,
        variant: hasRejection ? "destructive" : "default",
      })

      if (pendingOrders.length <= selectedItems.length) {
           setTimeout(() => {
             router.push("/dispatch-material")
           }, 1000)
      }
      setSelectedItems([])
      setSelectedOrder(null)
    } finally {
      setIsConfirming(false)
    }
  }

  const [selectedItems, setSelectedItems] = useState<any[]>([])

  const toggleSelectItem = (item: any) => {
    const key = `${item.doNumber || item.orderNo}-${item._product?.productName || item._product?.oilType || 'no-prod'}`
    const isSelected = selectedItems.some(i => `${i.doNumber || i.orderNo}-${i._product?.productName || i._product?.oilType || 'no-prod'}` === key)
    
    if (isSelected) {
      setSelectedItems(prev => prev.filter(i => `${i.doNumber || i.orderNo}-${i._product?.productName || i._product?.oilType || 'no-prod'}` !== key))
    } else {
      setSelectedItems(prev => [...prev, item])
    }
  }

  const toggleSelectAll = () => {
    if (selectedItems.length === displayRows.length) {
      setSelectedItems([])
    } else {
      setSelectedItems([...displayRows])
    }
  }

  const handleBulkVerifyOpen = (open: boolean) => {
    if (!open) {
      setSelectedOrder(null)
    } else {
      // Pick the first one as representative for the dialog fields, 
      // but the process will apply to all selected items
      if (selectedItems.length > 0) {
        setSelectedOrder(selectedItems[0])
      }
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

  const filteredPendingOrders = pendingOrders.filter(order => {
      let matches = true
      
      // Filter by Party Name
      if (filterValues.partyName && filterValues.partyName !== "all" && order.customerName !== filterValues.partyName) {
          matches = false
      }

      // Filter by Date Range
      // Check for timestamp or date field
      const orderDateStr = order.deliveryData?.date || order.date || order.timestamp
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

      // Filter by Status (Simulating Expiry based on arbitrary logic if no due date, 
      // typically approval is needed ASAP so maybe compare created date vs today)
      // For now, let's use the same logic: "on-time" if recent, "expire" if old (>7 days?)
      // OR better, if the order object has a due date.
      // Let's assume deliveryDate exists as in other stages, or default to checking 'timestamp' vs today.
      
      if (filterValues.status) {
          const targetDateStr = order.deliveryData?.expectedDeliveryDate || order.deliveryDate || order.timestamp
          if (targetDateStr) {
             const targetDate = new Date(targetDateStr)
             const today = new Date()
             today.setHours(0, 0, 0, 0)
             
             if (filterValues.status === "expire") {
                 // If Expected Date is in past, it's expired/overdue? OR if it's "Expire" status.
                 // Let's assume "Expire" means "Overdue"
                 if (targetDate < today) matches = true // keeping 'expire' matches
                 else matches = false
             } else if (filterValues.status === "on-time") {
                 if (targetDate >= today) matches = true
                 else matches = false
             }
          }
      }

      return matches
  })

  // Flatten orders for table display
  const displayRows = useMemo(() => {
    const rows: any[] = []
    filteredPendingOrders.forEach((order) => {
      const isRegular = order.orderType === "regular" || order.stage === "Approval Of Order";
      const hasPreApproval = order.preApprovalProducts?.some((p: any) => p.oilType);

      let products: any[] = [];
      
      if (isRegular) {
        products = order.products || order.data?.products || order.orderData?.products || order.data?.orderData?.products || [];
        if (products.length === 0 && hasPreApproval) {
          products = order.preApprovalProducts;
        }
      } else {
        products = hasPreApproval ? order.preApprovalProducts : (order.products || []);
      }

      if (!products || products.length === 0) {
        // Only push if not already verified in history
        const isVerified = history.some(h => 
            (h.orderNo === (order.doNumber || order.orderNo)) && h._product === null
        );
        if (!isVerified) rows.push({ ...order, _product: null })
      } else {
        products.forEach((prod: any) => {
          // Check if THIS specific product is already verified in history
          const pName = prod.productName || prod.oilType;
          const isVerified = history.some(h => 
            (h.orderNo === (order.doNumber || order.orderNo)) && 
            (h.data?.orderData?._product?.productName === pName || h.data?.orderData?._product?.oilType === pName)
          );

          if (!isVerified) {
            rows.push({ ...order, _product: prod })
          }
        });
      }
    })
    return rows
  }, [filteredPendingOrders, history])

  return (
    <WorkflowStageShell
      title="Stage 3: Approval Of Order"
      description="Six-point verification check before commitment entry."
      pendingCount={displayRows.length}
      historyData={history}
        partyNames={customerNames}
        onFilterChange={setFilterValues}
    >
      <div className="space-y-4">
        <div className="flex justify-end gap-2">
          <Dialog open={selectedOrder !== null} onOpenChange={handleBulkVerifyOpen}>
              <DialogTrigger asChild>
                <Button 
                  disabled={selectedItems.length === 0}
                  className="bg-blue-600 hover:bg-blue-700 shadow-md transition-all active:scale-95"
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Verify Selected ({selectedItems.length})
                </Button>
              </DialogTrigger>
                <DialogContent className="sm:max-w-6xl !max-w-6xl max-h-[95vh] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                <DialogHeader className="border-b pb-4">
                  <DialogTitle className="text-xl font-bold text-slate-900 leading-none">
                    Bulk Approval: {selectedItems.length > 1 ? `${selectedItems.length} Items Selected` : (selectedOrder?.doNumber || "Order Verification")}
                  </DialogTitle>
                  <DialogDescription className="text-slate-500 mt-1.5">Verify order details and complete the six-point check for commitment.</DialogDescription>
                </DialogHeader>

                {/* Selected Items Detail Section */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 shadow-sm mt-4">
                    <div className="space-y-3">
                        <Label className="text-[10px] font-bold uppercase tracking-wider text-blue-600/70 block px-1">Selected Items ({selectedItems.length})</Label>
                        <div className="max-h-[300px] overflow-y-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 pr-2 scrollbar-hide">
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
                </div>

                <div className="py-6 space-y-4">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 px-1 uppercase tracking-tight">
                    <div className="w-1.5 h-4 bg-blue-600 rounded-full" />
                    Six-Point Verification
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {checkItems.map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-4 rounded-xl border border-slate-100 bg-white shadow-sm hover:border-slate-200 transition-colors">
                        <Label className="text-sm font-semibold text-slate-700">{item.label}</Label>
                        <RadioGroup
                          value={checklistValues[item.id]}
                          onValueChange={(value) => handleChecklistChange(item.id, value)}
                          className="flex gap-6"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="approve" id={`${item.id}-ok`} className="text-green-600" />
                            <Label htmlFor={`${item.id}-ok`} className="text-sm font-medium text-green-600 cursor-pointer">
                              Approve
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="reject" id={`${item.id}-no`} className="text-red-600" />
                            <Label htmlFor={`${item.id}-no`} className="text-sm font-medium text-red-600 cursor-pointer">
                              Reject
                            </Label>
                          </div>
                        </RadioGroup>
                      </div>
                    ))}
                  </div>
               </div>
               <DialogFooter className="border-t pt-4 sm:justify-center">
                 <Button
                   onClick={handleConfirmCommitment}
                   disabled={isConfirming}
                   className="min-w-[300px] px-8 h-11 text-base font-bold shadow-lg shadow-blue-100 transition-all hover:scale-[1.01] active:scale-[0.99]"
                   variant={Object.values(checklistValues).includes("reject") ? "destructive" : "default"}
                 >
                   {isConfirming
                     ? "Processing..."
                     : Object.values(checklistValues).includes("reject")
                       ? "Reject & Save to History"
                       : `Approve ${selectedItems.length} Item(s)`}
                 </Button>
               </DialogFooter>
             </DialogContent>
          </Dialog>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="bg-transparent">
                <Settings2 className="mr-2 h-4 w-4" />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[250px] max-h-[400px] overflow-y-auto">
              <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {PAGE_COLUMNS.map((col) => (
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
                <TableHead className="w-[50px] text-center">
                    <Checkbox 
                        checked={displayRows.length > 0 && selectedItems.length === displayRows.length}
                        onCheckedChange={toggleSelectAll}
                    />
                </TableHead>
                {PAGE_COLUMNS.filter((col) => visibleColumns.includes(col.id)).map((col) => (
                  <TableHead key={col.id} className="whitespace-nowrap text-center">
                    {col.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayRows.length > 0 ? (
                displayRows.map((order: any, index: number) => {
                   const p = order._product;
                   
                   const CUSTOMER_MAP: Record<string, string> = {
                     cust1: "Acme Corp",
                     cust2: "Global Industries",
                     cust3: "Zenith Supply",
                   }

                   const row = {
                     orderNo: order.doNumber || order.orderNo || "DO-XXX",
                     deliveryPurpose: order.orderPurpose || "—",
                     customerType: order.customerType || "—",
                     orderType: order.orderType || "—",
                     soNo: order.soNumber || "—",
                     partySoDate: order.soDate || order.partySoDate || "—",
                     customerName: CUSTOMER_MAP[order.customerName] || order.customerName || "—",
                     startDate: order.startDate || "—",
                     endDate: order.endDate || "—",
                     deliveryDate: order.deliveryDate || "—",
                     
                     // Rates & Product Details - Single product from flattened row
                     oilType: p?.oilType || order.oilType || "—",
                     ratePerLtr: p?.ratePerLtr || order.ratePerLtr || "—",
                     ratePer15Kg: p?.rateLtr || order.rateLtr || "—",
                     productName: p?.productName || p?.oilType || "—",
                     uom: p?.uom || "—",
                     orderQty: p?.orderQty !== undefined ? p?.orderQty : "—",
                     altUom: p?.altUom || "—",
                     altQty: p?.altQty !== undefined ? p?.altQty : "—",
                     rate: p?.rate || "—",

                     // Extended Columns
                     totalWithGst: order.totalWithGst || "—",
                     transportType: order.transportType || "—",
                     contactPerson: order.contactPerson || "—",
                     whatsapp: order.whatsappNo || "—",
                     address: order.customerAddress || "—",
                     paymentTerms: order.paymentTerms || "—",
                     advanceTaken: order.advancePaymentTaken || "—",
                     advanceAmount: order.advanceAmount || "—",
                     isBroker: order.isBrokerOrder || "—",
                     brokerName: order.brokerName || "—",
                     uploadSo: "do_document.pdf",
                     
                     status: "Excellent",
                     products: (order.orderType === "regular" && order.products?.length > 0) 
                        ? order.products 
                        : (order.preApprovalProducts?.some((p: any) => p.oilType) 
                            ? order.preApprovalProducts 
                            : (order.products || order.data?.products || order.orderData?.products || [])),
                   }

                   return (
                   <TableRow 
                      key={`${index}-${row.orderNo}-${row.productName}`}
                      className={selectedItems.some(i => `${i.doNumber || i.orderNo}-${i._product?.productName || i._product?.oilType || 'no-prod'}` === `${row.orderNo}-${row.productName}`) ? "bg-blue-50/50" : ""}
                   >
                     <TableCell className="text-center">
                        <Checkbox 
                            checked={selectedItems.some(i => `${i.doNumber || i.orderNo}-${i._product?.productName || i._product?.oilType || 'no-prod'}` === `${row.orderNo}-${row.productName}`)}
                            onCheckedChange={() => toggleSelectItem(order)}
                        />
                     </TableCell>
                      {PAGE_COLUMNS.filter((col) => visibleColumns.includes(col.id)).map((col) => (
                        <TableCell key={col.id} className="whitespace-nowrap text-center">
                          {col.id === "status" ? (
                             <div className="flex justify-center">
                                <Badge className="bg-green-100 text-green-700">Excellent</Badge>
                             </div>
                          ) : row[col.id as keyof typeof row]}
                        </TableCell>
                      ))}
                   </TableRow>
                )})
              ) : (
                  <TableRow>
                      <TableCell colSpan={visibleColumns.length + 2} className="text-center py-4 text-muted-foreground">
                          No orders pending for commitment review
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
