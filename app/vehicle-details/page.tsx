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

export default function VehicleDetailsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [pendingOrders, setPendingOrders] = useState<any[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState<string[]>([
    "orderNo",
    "customerName",
    "status",
  ])
  const [vehicleData, setVehicleData] = useState({
    checkStatus: "",
    remarks: "",
  })

  const [history, setHistory] = useState<any[]>([])
  const [selectedItems, setSelectedItems] = useState<any[]>([])

  useEffect(() => {
    const savedHistory = localStorage.getItem("workflowHistory")
    if (savedHistory) {
      const historyData = JSON.parse(savedHistory)
      
      const completed = historyData.filter(
        (item: any) => item.stage === "Vehicle Details" && item.status === "Completed"
      )

      const pending = historyData.filter(
        (item: any) => item.stage === "Actual Dispatch" && item.status === "Completed"
      )
      setPendingOrders(pending)

      const stageHistory = historyData
        .filter((item: any) => item.stage === "Vehicle Details")
        .map((item: any) => ({
           ...item,
           date: item.date || (item.timestamp ? new Date(item.timestamp).toLocaleDateString("en-GB") : "-"),
           remarks: item.remarks || item.vehicleData?.remarks || "-"
        }))
      setHistory(stageHistory)
    }
  }, [])

  /* Filter logic */
  const [filterValues, setFilterValues] = useState({
      status: "",
      startDate: "",
      endDate: "",
      partyName: ""
  })

  const filteredPendingOrders = pendingOrders.filter(order => {
      let matches = true
      if (filterValues.partyName && filterValues.partyName !== "all" && order.customerName !== filterValues.partyName) matches = false
      const orderDateStr = order.actualDispatchData?.confirmedAt || order.timestamp
      if (orderDateStr) {
          const orderDate = new Date(orderDateStr)
          if (filterValues.startDate && orderDate < new Date(filterValues.startDate)) matches = false
          if (filterValues.endDate && orderDate > new Date(filterValues.endDate)) matches = false
      }
      return matches
  })
  // Flatten orders for table display
  const displayRows = useMemo(() => {
    const rows: any[] = []
    const processed = new Set<string>();

    filteredPendingOrders.forEach((order) => {
      const internalOrder = order.data?.orderData || order;
      const orderId = order.doNumber || order.orderNo;
      
      if (order.data?.productInfo) {
          const p = order.data.productInfo;
          const pName = p.productName || p.oilType;
          const pId = p.id || pName || 'no-id';
          const pk = `${orderId}-${pId}`;

          if (processed.has(pk)) return;

          // Check if THIS specific product is already in history
          const isDone = history.some(h => 
            (h.orderNo === orderId) && 
            (h.data?.orderData?._product?.productName === pName || h.data?.orderData?._product?.oilType === pName)
          );
          if (!isDone) {
            rows.push({ ...order, _product: p });
            processed.add(pk);
          }
          return;
      }

      let products = internalOrder.products || [];
      const preAppProducts = internalOrder.preApprovalProducts || [];
      const allProds = products.length > 0 ? products : preAppProducts;

      if (!allProds || allProds.length === 0) {
        const pk = `${orderId}-null`;
        if (processed.has(pk)) return;

        const isDone = history.some(h => 
            (h.orderNo === orderId) && h._product === null
        );
        if (!isDone) {
          rows.push({ ...order, _product: null });
          processed.add(pk);
        }
      } else {
        allProds.forEach((prod: any) => {
          const pName = prod.productName || prod.oilType;
          const pId = prod.id || pName || 'no-id';
          const pk = `${orderId}-${pId}`;

          if (processed.has(pk)) return;

          const isDone = history.some(h => 
            (h.orderNo === orderId) && 
            (h.data?.orderData?._product?.productName === pName || h.data?.orderData?._product?.oilType === pName)
          );

          if (!isDone) {
            rows.push({ ...order, _product: prod });
            processed.add(pk);
          }
        });
      }
    })
    return rows
  }, [filteredPendingOrders, history])

  const toggleSelectItem = (item: any) => {
    const key = `${item.doNumber || item.orderNo}-${item._product?.id || item._product?.productName || 'no-id'}`
    const isSelected = selectedItems.some(i => `${i.doNumber || i.orderNo}-${i._product?.id || i._product?.productName || 'no-id'}` === key)
    
    if (isSelected) {
      setSelectedItems(prev => prev.filter(i => `${i.doNumber || i.orderNo}-${i._product?.id || i._product?.productName || 'no-id'}` !== key))
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

  const handleAssignVehicle = async () => {
    if (selectedItems.length === 0) return
    setIsProcessing(true)
    try {
      const savedHistory = localStorage.getItem("workflowHistory")
      const historyList = savedHistory ? JSON.parse(savedHistory) : []

      selectedItems.forEach((item) => {
        const historyEntry = {
          ...item,
          orderNo: item.orderNo || item.doNumber || "DO-XXX",
          stage: "Vehicle Details",
          status: "Completed",
          processedBy: "Current User",
          timestamp: new Date().toISOString(),
          date: new Date().toLocaleDateString("en-GB"),
          remarks: vehicleData.remarks || "-",
          vehicleData: { ...vehicleData, assignedAt: new Date().toISOString() },
          data: {
              ...(item.data || {}),
              orderData: {
                  ...(item.data?.orderData || item),
                  products: item.orderType === "regular" ? [item._product] : [],
                  preApprovalProducts: item.orderType !== "regular" ? [item._product] : []
              }
          }
        }
        historyList.push(historyEntry)
      })

      localStorage.setItem("workflowHistory", JSON.stringify(historyList))
      
      toast({
        title: "Vehicle Assigned",
        description: `${selectedItems.length} items moved to Material Load stage.`,
      })

      setTimeout(() => {
        router.push("/material-load")
      }, 1500)
    } finally {
      setIsProcessing(false)
    }
  }

  /* Extract unique customer names */
  const customerNames = Array.from(new Set(pendingOrders.map(order => order.customerName || "Unknown")))

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
          <Dialog>
            <DialogTrigger asChild>
                <Button disabled={selectedItems.length === 0} className="bg-purple-600 hover:bg-purple-700">
                    <Truck className="mr-2 h-4 w-4" />
                    Assign Vehicle ({selectedItems.length})
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold text-slate-900 leading-none">Vehicle Details Assignment ({selectedItems.length} items)</DialogTitle>
                </DialogHeader>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 shadow-sm mt-4">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-blue-600/70 block px-1 mb-3">Selected Items ({selectedItems.length})</Label>
                    <div className="max-h-[180px] overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-3 pr-2 scrollbar-hide">
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
                <div className="space-y-4 py-4">
                    <div className="">
                    <h4 className="text-sm font-medium mb-4 text-muted-foreground">Vehicle Documents</h4>
                    <div className="grid grid-cols-2 gap-4 text-xs">
                        <div className="space-y-1"><Label>Fitness Copy</Label><Input type="file" className="h-8 text-[10px]" /></div>
                        <div className="space-y-1"><Label>Insurance</Label><Input type="file" className="h-8 text-[10px]" /></div>
                        <div className="space-y-1"><Label>Tax Copy</Label><Input type="file" className="h-8 text-[10px]" /></div>
                        <div className="space-y-1"><Label>Pollution Check</Label><Input type="file" className="h-8 text-[10px]" /></div>
                    </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 border-t pt-4">
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
                <DialogFooter>
                    <Button onClick={handleAssignVehicle} disabled={!vehicleData.checkStatus || isProcessing}>
                        {isProcessing ? "Processing..." : "Confirm & Assign"}
                    </Button>
                </DialogFooter>
            </DialogContent>
          </Dialog>

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
                {ALL_COLUMNS.filter((col) => visibleColumns.includes(col.id)).map((col) => (
                  <TableHead key={col.id} className="whitespace-nowrap text-center">
                    {col.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayRows.length > 0 ? (
                displayRows.map((item, index) => {
                    const order = item;
                    const p = order._product;
                    const rowKey = `${order.doNumber || order.orderNo}-${p?.id || p?.productName || 'no-id'}`;
                    
                    const prodName = p?.productName || p?.oilType || "—";
                    const rateLtr = p?.ratePerLtr || p?.rateLtr || order.ratePerLtr || "—";
                    const rate15Kg = p?.ratePer15Kg || p?.rateLtr || order.rateLtr || "—";
                    const oilType = p?.oilType || order.oilType || "—";

                    const row = {
                      orderNo: order.doNumber || order.orderNo || "DO-XXX",
                      customerName: order.customerName || "—",
                      productName: prodName,
                      oilType: oilType,
                      ratePerLtr: rateLtr,
                      ratePer15Kg: rate15Kg,
                      rate: p?.rate || "—",
                      transportType: order.dispatchData?.transportType || "—",
                      deliveryDate: order.deliveryDate || "—",
                      qtyToDispatch: order.dispatchData?.qtyToDispatch || "—",
                      deliveryFrom: order.deliveryData?.deliveryFrom || "—",
                      status: "Awaiting Vehicle",
                    }

                   return (
                   <TableRow key={rowKey} className={selectedItems.some(i => `${i.doNumber || i.orderNo}-${i._product?.id || i._product?.productName || 'no-id'}` === rowKey) ? "bg-purple-50/50" : ""}>
                      <TableCell className="text-center">
                        <Checkbox checked={selectedItems.some(i => `${i.doNumber || i.orderNo}-${i._product?.id || i._product?.productName || 'no-id'}` === rowKey)} onCheckedChange={() => toggleSelectItem(item)} />
                      </TableCell>
                      {ALL_COLUMNS.filter((col) => visibleColumns.includes(col.id)).map((col) => (
                        <TableCell key={col.id} className="whitespace-nowrap text-center text-xs">
                          {col.id === "status" ? (
                             <div className="flex justify-center">
                                <Badge className="bg-purple-100 text-purple-700">Awaiting Vehicle</Badge>
                             </div>
                          ) : (row as any)[col.id] || "—"}
                        </TableCell>
                      ))}
                   </TableRow>
                   )
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={visibleColumns.length + 1} className="text-center py-8 text-muted-foreground">
                    No orders pending for vehicle assignment
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
