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
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Settings2 } from "lucide-react"
import { actualDispatchApi } from "@/lib/api-service"

export default function ActualDispatchPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [pendingOrders, setPendingOrders] = useState<any[]>([])
  const [historyOrders, setHistoryOrders] = useState<any[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [selectedOrders, setSelectedOrders] = useState<string[]>([])
  const PAGE_COLUMNS = [
    { id: "orderNo", label: "DO Number" },
    { id: "customerName", label: "Customer Name" },
    { id: "qtyToDispatch", label: "Qty to Dispatch" },
    { id: "deliveryFrom", label: "Delivery From" },
    { id: "status", label: "Status" },

    // Requested Options
    { id: "soNo", label: "DO No." },
    { id: "deliveryPurpose", label: "Order Type (Delivery Purpose)" },
    { id: "startDate", label: "Start Date" },
    { id: "endDate", label: "End Date" },
    { id: "deliveryDate", label: "Delivery Date" },
    { id: "orderType", label: "Order Type" },
    { id: "customerType", label: "Customer Type" },
    { id: "partySoDate", label: "Party DO Date" },
    { id: "oilType", label: "Oil Type" },
    { id: "ratePer15Kg", label: "Rate Per 15 kg" }, 
    { id: "ratePerLtr", label: "Rate Per Ltr." }, // Aggregated
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
    { id: "uploadSo", label: "Upload DO" },
    { id: "skuName", label: "SKU Name" },
    { id: "approvalQty", label: "Approval Qty" },
    { id: "skuRates", label: "Take Required Rates of Each Item" },
    { id: "remark", label: "Remark" },
    { id: "rateRightly", label: "Rate Rightly" },
    { id: "dealingInOrder", label: "We Are Dealing in Order" },
    { id: "partyCredit", label: "Party Credit" },
    { id: "dispatchConfirmed", label: "Dispatch Date is Confirmed" },
    { id: "overallStatus", label: "Overall Status of Order" },
    { id: "orderConfirmation", label: "Order Confirmation with Customer" },
    { id: "qtytobedispatched", label: "Qty to be Dispatched" },
    { id: "dispatchfrom", label: "Dispatch from"}
  ]

  const [visibleColumns, setVisibleColumns] = useState<string[]>([
    "orderNo",
    "customerName",
    "qtyToDispatch",
    "deliveryFrom",
    "status",
  ])

  // Fetch data from backend API
  const fetchPendingDispatches = async () => {
    try {
      console.log('[ACTUAL DISPATCH] Fetching pending from API...');
      const response = await actualDispatchApi.getPending({ limit: 1000 });
      console.log('[ACTUAL DISPATCH] API Response:', response);
      
      if (response.success && response.data.dispatches) {
        setPendingOrders(response.data.dispatches);
        console.log('[ACTUAL DISPATCH] Loaded', response.data.dispatches.length, 'pending dispatches');
      }
    } catch (error: any) {
      console.error("[ACTUAL DISPATCH] Failed to fetch pending:", error);
      toast({
        title: "Error",
        description: error?.message || "Failed to load pending dispatches",
        variant: "destructive",
      });
    }
  };

  const fetchDispatchHistory = async () => {
    try {
      const response = await actualDispatchApi.getHistory({ limit: 1000 });
      
      if (response.success && response.data.dispatches) {
        setHistoryOrders(response.data.dispatches);
      }
    } catch (error: any) {
      console.error("[ACTUAL DISPATCH] Failed to fetch history:", error);
    }
  };

  useEffect(() => {
    fetchPendingDispatches();
    fetchDispatchHistory();
  }, [])

  const toggleSelectAll = () => {
    if (selectedOrders.length === displayRows.length) {
      setSelectedOrders([])
    } else {
      setSelectedOrders(displayRows.map((row) => `${row.doNumber || row.orderNo}-${row._product?.id || row._product?.productName || row._product?.oilType || 'no-id'}`))
    }
  }

  const toggleSelectOrder = (rowKey: string) => {
    if (!rowKey) return
    if (selectedOrders.includes(rowKey)) {
      setSelectedOrders(selectedOrders.filter((id) => id !== rowKey))
    } else {
      setSelectedOrders([...selectedOrders, rowKey])
    }
  }

  const handleBulkConfirm = async () => {
    setIsProcessing(true)
    try {
      const itemsToDispatch = displayRows.filter((row) =>
        selectedOrders.includes(`${row.doNumber || row.orderNo}-${row._product?.id || row._product?.productName || row._product?.oilType || 'no-id'}`)
      )

      if (itemsToDispatch.length === 0) {
        toast({
          title: "No Items Selected",
          description: "Please select items to confirm",
          variant: "destructive",
        });
        return;
      }

      const successfulDispatches: any[] = []
      const failedDispatches: any[] = []

      // Submit each item to backend API
      for (const item of itemsToDispatch) {
        const dsrNumber = item.d_sr_number; // DSR number from lift_receiving_confirmation

        try {
          if (dsrNumber) {
            const dispatchData = {
              product_name_1: item.product_name,
              actual_qty_dispatch: item.qty_to_be_dispatched,
            };

            console.log('[ACTUAL DISPATCH] Submitting for DSR:', dsrNumber, dispatchData);
            const response = await actualDispatchApi.submit(dsrNumber, dispatchData);
            console.log('[ACTUAL DISPATCH] API Response:', response);
            
            if (response.success) {
              successfulDispatches.push({ item, dsrNumber });
            } else {
              failedDispatches.push({ item, error: response.message || 'Unknown error' });
            }
          } else {
            console.warn('[ACTUAL DISPATCH] Skipping - no DSR number found for:', item);
            failedDispatches.push({ item, error: 'No DSR number found' });
          }
        } catch (error: any) {
          console.error('[ACTUAL DISPATCH] Failed to submit:', error);
          failedDispatches.push({ item, error: error?.message || error?.toString() || 'Unknown error' });
        }
      }

      // Show results
      if (successfulDispatches.length > 0) {
        toast({
          title: "Dispatch Confirmed",
          description: `${successfulDispatches.length} dispatch(es) confirmed successfully.`,
        });

        // Clear selections
        setSelectedOrders([]);

        // Refresh data from backend
        await fetchPendingDispatches();
        await fetchDispatchHistory();

        // Navigate to vehicle details
        setTimeout(() => {
          router.push("/vehicle-details")
        }, 1500)
      }

      if (failedDispatches.length > 0) {
        console.error('[ACTUAL DISPATCH] Failed dispatches:', failedDispatches);
        toast({
          title: "Some Dispatches Failed",
          description: `${failedDispatches.length} dispatch(es) failed. Check console for details.`,
          variant: "destructive",
        })
      }
    } catch (error: any) {
      console.error('[ACTUAL DISPATCH] Unexpected error:', error);
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
      const orderDateStr = order.actualDispatchData?.confirmedAt || order.dispatchData?.dispatchDate || order.dispatchData?.dispatchedAt || order.timestamp
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

  // Map backend data to display format
  const displayRows = useMemo(() => {
    return filteredPendingOrders.map((order: any) => ({
      ...order,
      doNumber: order.so_no,
      orderNo: order.so_no,
      customerName: order.party_name,
      qtyToDispatch: order.qty_to_be_dispatched,
      deliveryFrom: order.dispatch_from,
      transportType: order.type_of_transporting,
      _product: {
        id: order.d_sr_number,
        productName: order.product_name,
      },
    }))
  }, [filteredPendingOrders])

  return (
    <WorkflowStageShell
      title="Stage 5: Actual Dispatch"
      description="Confirm actual dispatch details before vehicle assignment."
      pendingCount={displayRows.length}
      historyData={historyOrders.map((order) => ({
        date: new Date(order.actualDispatchData?.confirmedAt || order.timestamp || new Date()).toLocaleDateString("en-GB"),
        stage: "Actual Dispatch",
        status: "Completed",
        remarks: "Dispatch Confirmed",
      }))}
      partyNames={customerNames}
      onFilterChange={setFilterValues}
      remarksColName="Confirmation"
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
          <Button
            onClick={handleBulkConfirm}
            disabled={selectedOrders.length === 0 || isProcessing}
          >
            {isProcessing ? "Processing..." : `Confirm Dispatch (${selectedOrders.length})`}
          </Button>
        </div>

        <Card className="border-none shadow-sm overflow-auto max-h-[600px]">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-card shadow-sm">
              <TableRow>
                <TableHead className="w-12 text-center">
                  <Checkbox
                    checked={displayRows.length > 0 && selectedOrders.length === displayRows.length}
                    onCheckedChange={toggleSelectAll}
                    aria-label="Select all"
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
                displayRows.map((item, index) => {
                     const order = item;
                     const p = order._product;
                     const rowKey = `${order.doNumber || order.orderNo}-${p?.id || p?.productName || p?.oilType || 'no-id'}`;

                     // Robust data fetching
                     const internalOrder = order.data?.orderData || order;
                     const deliveryFromVal = order.data?.orderData?.deliveryData?.deliveryFrom || order.dispatchData?.deliveryFrom || order.deliveryFrom || "—";
                     const qtyVal = order.qtyToDispatch || order.dispatchData?.qtyToDispatch || order.qtytobedispatched || "—";
                     
                     const preApproval = order.data?.preApprovalData || {};
                     const productRates = preApproval.productRates || {};
                     const checklist = order.data?.checklistResults || {};

                     const prodName = p?.productName || p?.oilType || "—";
                     const rateLtr = p?.ratePerLtr || p?.rateLtr || internalOrder.ratePerLtr || "—";
                     const rate15Kg = p?.ratePer15Kg || p?.rateLtr || internalOrder.rateLtr || "—";
                     const oilType = p?.oilType || internalOrder.oilType || "—";
                     
                     // SKU/Rates
                     const skuName = productRates[p?.id]?.skuName || "—";
                     const approvalQty = productRates[p?.id]?.approvalQty || "—";
                     const reqRate = productRates[p?.id]?.rate || "—";
                     
                     const deliveryFromDisplay = deliveryFromVal === "in-stock" ? "In Stock" : deliveryFromVal === "production" ? "Production" : deliveryFromVal;

                     const row = {
                       orderNo: order.doNumber || order.orderNo || "DO-XXX",
                       customerName: order.customerName || "—",
                       qtyToDispatch: qtyVal,
                       deliveryFrom: deliveryFromDisplay,
                       rate: p?.rate || "—",
                       status: "Pending Confirmation",

                       soNo: order.soNumber || "—",
                       deliveryPurpose: order.orderPurpose || "—",
                       customerType: order.customerType || "—",
                       orderType: order.orderType || "—",
                       partySoDate: order.soDate || "—",
                       startDate: order.startDate || "—",
                       endDate: order.endDate || "—",
                       deliveryDate: order.deliveryDate || "—",
                       oilType: oilType,
                       ratePerLtr: rateLtr,
                       ratePer15Kg: rate15Kg,
                       totalWithGst: order.totalWithGst || "—",
                       transportType: order.transportType || order.dispatchData?.transportType || "—",
                       contactPerson: order.contactPerson || "—",
                       whatsapp: order.whatsappNo || "—",
                       address: order.customerAddress || "—",
                       paymentTerms: order.paymentTerms || "—",
                       advanceTaken: order.advancePaymentTaken || "—",
                       advanceAmount: order.advanceAmount || "—",
                       isBroker: order.isBrokerOrder || "—",
                       brokerName: order.brokerName || "—",
                       uploadSo: "do_document.pdf",
                       skuName: skuName,
                       approvalQty: approvalQty,
                       skuRates: reqRate,
                       remark: order.remarks || order.preApprovalRemark || preApproval.overallRemark || "—",
                       rateRightly: checklist.rate || "—",
                       dealingInOrder: checklist.sku || "—",
                       partyCredit: checklist.credit || "—",
                       dispatchConfirmed: checklist.dispatch || "—",
                       overallStatus: checklist.overall || "—",
                       orderConfirmation: checklist.confirm || "—",
                       qtytobedispatched: qtyVal,
                       dispatchfrom: deliveryFromDisplay,
                     }

                    return (
                      <TableRow key={rowKey} className={selectedOrders.includes(rowKey) ? "bg-blue-50/50" : ""}>
                        <TableCell className="text-center">
                          <Checkbox
                            checked={selectedOrders.includes(rowKey)}
                            onCheckedChange={() => toggleSelectOrder(rowKey)}
                            aria-label={`Select item ${rowKey}`}
                          />
                        </TableCell>
                        {PAGE_COLUMNS.filter((col) => visibleColumns.includes(col.id)).map((col) => (
                          <TableCell key={col.id} className="whitespace-nowrap text-center">
                             {col.id === "status" ? (
                                <div className="flex justify-center">
                                  <Badge className="bg-blue-100 text-blue-700">Ready for Dispatch</Badge>
                                </div>
                             ) : (
                                row[col.id as keyof typeof row]
                             )}
                          </TableCell>
                        ))}
                      </TableRow>
                    )
                 })
              ) : (
                <TableRow>
                  <TableCell colSpan={visibleColumns.length + 1} className="text-center py-8 text-muted-foreground">
                    No orders pending for actual dispatch
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
