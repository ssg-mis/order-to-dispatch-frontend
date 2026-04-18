"use client"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"

import { useState, useEffect, useMemo, useRef } from "react"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { WorkflowStageShell } from "@/components/workflow/workflow-stage-shell"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { Checkbox } from "@/components/ui/checkbox"
import { AsyncCombobox } from "@/components/ui/async-combobox"
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Settings2, ChevronDown, ChevronUp } from "lucide-react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { dispatchPlanningApi, customerApi, depotApi } from "@/lib/api-service"
import { cn } from "@/lib/utils"
import { useAuth } from "@/hooks/use-auth"
import { useQuery } from "@tanstack/react-query"
import { Loader2, ChevronLeft, ChevronRight, XCircle } from "lucide-react"

export default function DispatchMaterialPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { isReadOnly, user } = useAuth()
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending")
  const [pendingPage, setPendingPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const limit = 25;

  const [filterValues, setFilterValues] = useState({
    search: "",
    status: "",
    startDate: "",
    endDate: "",
  })
  const [activeDepots, setActiveDepots] = useState<any[]>([])
  const [selectedDepoTab, setSelectedDepoTab] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [selectedGroup, setSelectedGroup] = useState<any>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [dispatchData, setDispatchData] = useState({
    dispatchDate: "",
    dispatchTime: "",
    warehouseLocation: "",
    materialReady: false,
    packagingComplete: false,
    labelsAttached: false,
  })
  const [dispatchDetails, setDispatchDetails] = useState<Record<string, {
    qty: string,
    transportType?: string,
    deliveryFrom?: string,
    transfer?: string,
    transferData?: {
      billTo: { company: string; address: string };
      shipTo: { company: string; address: string };
      freightRate: string;
    }
  }>>({})
  const [expandedOrders, setExpandedOrders] = useState<string[]>([])
  const [revertRemarks, setRevertRemarks] = useState("")

  const [allCustomers, setAllCustomers] = useState<any[]>([])
  const [isTransferPopupOpen, setIsTransferPopupOpen] = useState(false)
  const [currentTransferRowKey, setCurrentTransferRowKey] = useState<string | null>(null)
  const [precloseInputs, setPrecloseInputs] = useState<Record<number, string>>({})
  const [openPrecloseId, setOpenPrecloseId] = useState<number | null>(null)
  const isSavingTransferRef = useRef(false)

  const PAGE_COLUMNS = [
    { id: "partySoDate", label: "DO Date" },
    { id: "orderNo", label: "DO Number" },
    { id: "processId", label: "Process ID" },
    { id: "customerName", label: "Customer Name" },
    { id: "productName", label: "Products Name" },
    { id: "transportType", label: "Type of Transporting" },
    { id: "orderPunchRemarks", label: "Order Punch Remarks" },
    { id: "status", label: "Status" },

    // Requested Options
    { id: "soNo", label: "DO No." },
    { id: "deliveryPurpose", label: "Order Type (Delivery Purpose)" },
    { id: "startDate", label: "Start Date" },
    { id: "endDate", label: "End Date" },
    { id: "deliveryDate", label: "Delivery Date" },
    { id: "orderType", label: "Order Type" },
    { id: "customerType", label: "Customer Type" },
    { id: "oilType", label: "Oil Type" },
    { id: "ratePer15Kg", label: "Rate Per 15 kg" },
    { id: "ratePerLtr", label: "Rate Per Ltr" },
    { id: "rate", label: "Rate" },
    { id: "totalWithGst", label: "Total Amount with GST" },
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
    { id: "revertDispatchRemarks", label: "Revert(Dispatch-Planning) Remarks" },
  ]

  const [visibleColumns, setVisibleColumns] = useState<string[]>([
    "partySoDate",
    "orderNo",
    "processId",
    "customerName",
    "productName",
    "transportType",
    "orderPunchRemarks",
    "revertDispatchRemarks",
    "status",
  ])


  // Pending query with numeric pagination
  const {
    data: pendingData,
    isLoading: isPendingLoading,
    refetch: refetchPending,
  } = useQuery({
    queryKey: ["dispatch-pending", filterValues, user?.depo_access?.['Dispatch Planning'], pendingPage, selectedDepoTab],
    queryFn: async () => {
      const response = await (dispatchPlanningApi.getPending as any)({
        page: pendingPage,
        limit: limit,
        order_no: filterValues.search,
        start_date: filterValues.startDate,
        end_date: filterValues.endDate,
        depo_names: selectedDepoTab ? [selectedDepoTab] : (user?.depo_access?.['Dispatch Planning'] || [])
      });
      return response.success ? response.data : { dispatches: [], pagination: { total: 0 } };
    },
    enabled: !!selectedDepoTab, // wait until depot is selected
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  // History query with numeric pagination
  const {
    data: historyData,
    isLoading: isHistoryLoading,
    refetch: refetchHistory,
  } = useQuery({
    queryKey: ["dispatch-history", filterValues, user?.depo_access?.['Dispatch Planning'], historyPage],
    queryFn: async () => {
      const response = await (dispatchPlanningApi.getHistory as any)({
        page: historyPage,
        limit: limit,
        order_no: filterValues.search,
        start_date: filterValues.startDate,
        end_date: filterValues.endDate,
        depo_names: user?.depo_access ? (user.depo_access['Dispatch Planning'] || []) : undefined
      });
      return response.success ? response.data : { dispatches: [], pagination: { total: 0 } };
    },
    enabled: activeTab === "history",
  });

  const pendingOrders = pendingData?.dispatches || [];
  const historyOrders = historyData?.dispatches || [];

  // Reset to page 1 on filter or depot change
  useEffect(() => {
    setPendingPage(1);
    setHistoryPage(1);
  }, [filterValues, selectedDepoTab]);

  const fetchCustomers = async () => {
    try {
      const response = await customerApi.getAll({ all: 'true' });
      if (response.success) {
        const customerList = response.data.customers || (Array.isArray(response.data) ? response.data : []);
        setAllCustomers(customerList);
      }
    } catch (error) {
      console.error("[DISPATCH] Failed to fetch customers:", error);
    }
  };

  const fetchDepots = async () => {
    try {
      const response = await depotApi.getAll({ all: 'false' });
      if (response.success && response.data?.depots) {
        let depots = response.data.depots;

        // Filter by user permissions
        // Filter by user permissions: if missing from depo_access object, we allow all for backward compatibility/admins.
        // If the key exists but is empty [], we show NOTHING.
        // Filter by user permissions: strict deny-by-default even for admins.
        const allowedDepos = user?.depo_access?.['Dispatch Planning'] || [];
        depots = depots.filter((d: any) => 
          allowedDepos.some(ad => ad.toLowerCase() === d.depot_name.toLowerCase())
        );

        setActiveDepots(depots);
        // Set first active depot as default if nothing is selected or current selected is not in active list
        if (depots.length > 0 && !depots.some((d: any) => d.depot_name === selectedDepoTab)) {
          setSelectedDepoTab(depots[0].depot_name);
        }
      }
    } catch (error) {
      console.error("[DISPATCH] Failed to fetch depots:", error);
    }
  };

  useEffect(() => {
    fetchCustomers();
    fetchDepots();
  }, [user?.depo_access])

  const availableDepos = useMemo(() => {
    return activeDepots.map(d => d.depot_name);
  }, [activeDepots]);

  useEffect(() => {
    if (availableDepos.length > 0 && (!selectedDepoTab || !availableDepos.includes(selectedDepoTab))) {
      setSelectedDepoTab(availableDepos[0]);
    }
  }, [availableDepos, selectedDepoTab]);

  const [selectedItems, setSelectedItems] = useState<any[]>([])
  const [dialogSelectedProducts, setDialogSelectedProducts] = useState<string[]>([])

  const toggleSelectAll = () => {
    if (selectedItems.length === displayRows.length) {
      setSelectedItems([])
    } else {
      setSelectedItems([...displayRows])
    }
  }

  const toggleSelectItem = (item: any) => {
    const key = item._rowKey
    const isSelected = selectedItems.some(i => i._rowKey === key)

    if (isSelected) {
      setSelectedItems(prev => prev.filter(i => i._rowKey !== key))
    } else {
      setSelectedItems(prev => [...prev, item])
    }
  }

  const handleOpenDialog = () => {
    if (selectedItems.length > 0) {
      setSelectedGroup(selectedItems[0])
      // Default: Select ALL products in all selected groups for dispatch
      const allKeys = selectedItems.flatMap(g => g._allProducts || []).map((p: any) => p._rowKey)
      setDialogSelectedProducts(allKeys)
      setIsDialogOpen(true)
    }
  }

  const toggleSelectDialogProduct = (key: string) => {
    if (dialogSelectedProducts.includes(key)) {
      setDialogSelectedProducts(prev => prev.filter(k => k !== key))
    } else {
      setDialogSelectedProducts(prev => [...prev, key])
    }
  }

  // Get all flattened products from selected Groups
  const allProductsFromSelectedGroups = useMemo(() => {
    return selectedItems.flatMap(group => group._allProducts || [])
  }, [selectedItems])

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

  const handleBulkDispatch = async () => {
    setIsProcessing(true)
    try {
      if (selectedItems.length === 0 || dialogSelectedProducts.length === 0) {
        toast({
          title: "No Items Selected",
          description: "Please select items to dispatch",
          variant: "destructive",
        });
        return;
      }

      const successfulDispatches: any[] = []
      const failedDispatches: any[] = []

      const itemsToProcess = allProductsFromSelectedGroups.filter((p: any) => dialogSelectedProducts.includes(p._rowKey))

      // 1. Validation Check: Ensure no quantities are 0
      const itemsWithZeroQty = itemsToProcess.filter(item => {
        const rowKey = item._rowKey;
        const qty = dispatchDetails[rowKey]?.qty !== undefined ? dispatchDetails[rowKey].qty : (item.remainingDispatchQty !== undefined ? item.remainingDispatchQty : item.approvalQty);
        return Number(qty) <= 0;
      });

      if (itemsWithZeroQty.length > 0) {
        toast({
          title: "Submission Blocked",
          description: "Select quantity greater than 0 to dispatch items.",
          variant: "destructive",
        });
        setIsProcessing(false);
        return;
      }

      // Submit each item to backend API
      for (const item of itemsToProcess) {
        const orderId = item.id // Use the order_dispatch table ID from backend
        const rowKey = item._rowKey;

        const deliveryVal = dispatchDetails[rowKey]?.deliveryFrom || "in-stock";
        const dispatchQty = dispatchDetails[rowKey]?.qty !== undefined ? dispatchDetails[rowKey].qty : (item.remainingDispatchQty !== undefined ? item.remainingDispatchQty : item.approvalQty);

        try {
          if (orderId) {
            const tData = dispatchDetails[rowKey]?.transferData;
            const dispatchData = {
              dispatch_from: deliveryVal,
              dispatch_qty: dispatchQty,
              username: user?.username || null,
              transfer: dispatchDetails[rowKey]?.transfer || item.transfer || 'no',
              bill_company_name: tData?.billTo?.company || item.bill_company_name || null,
              bill_address: tData?.billTo?.address || item.bill_address || null,
              ship_company_name: tData?.shipTo?.company || item.ship_company_name || null,
              ship_address: tData?.shipTo?.address || item.ship_address || null,
              freight_rate: tData?.freightRate !== undefined ? tData.freightRate : (item.freight_rate || 0)
            };

            const response = await dispatchPlanningApi.submit(orderId, dispatchData);

            if (response.success) {
              successfulDispatches.push({ item, dsrNumber: response.data?.dsrNumber });
            } else {
              failedDispatches.push({ item, error: response.message || 'Unknown error' });
            }
          }
        } catch (error: any) {
          failedDispatches.push({ item, error: error?.message || error?.toString() || 'Unknown error' });
        }
      }

      // Show results
      if (successfulDispatches.length > 0) {
        toast({
          title: "Dispatches Submitted Successfully",
          description: `${successfulDispatches.length} dispatch(es) submitted.`,
        });

        setSelectedItems([]);
        setDispatchDetails({});
        setDialogSelectedProducts([]);
        setIsDialogOpen(false);

        await refetchPending();
        await refetchHistory();

        setTimeout(() => {
          router.push("/actual-dispatch")
        }, 1500)
      }

      if (failedDispatches.length > 0) {
        toast({
          title: "Some Dispatches Failed",
          description: `${failedDispatches.length} dispatch(es) failed.`,
          variant: "destructive",
        })
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false)
    }
  }

  const handleRevert = async () => {
    if (!revertRemarks.trim()) {
      toast({ title: "Validation Error", description: "Revert remarks are required", variant: "destructive" });
      return;
    }

    setIsProcessing(true);
    try {
      const itemsToRevert = allProductsFromSelectedGroups.filter((p: any) => dialogSelectedProducts.includes(p._rowKey));

      if (itemsToRevert.length === 0) {
        toast({ title: "Error", description: "No products selected to revert", variant: "destructive" });
        setIsProcessing(false);
        return;
      }

      const successfulReverts: any[] = [];
      const failedReverts: any[] = [];

      for (const item of itemsToRevert) {
        const orderId = item.id;
        if (!orderId) continue;

        try {
          const res = await dispatchPlanningApi.revert(orderId, user?.username || 'system', revertRemarks.trim());
          if (res.success) {
            successfulReverts.push(orderId);
          } else {
            failedReverts.push({ orderId, message: res.message });
          }
        } catch (err: any) {
          failedReverts.push({ orderId, message: err.message });
        }
      }

      if (successfulReverts.length > 0) {
        toast({
          title: "Revert Successful",
          description: `${successfulReverts.length} item(s) reverted to Pre-Approval.`,
        });

        setIsDialogOpen(false);
        setSelectedItems([]);
        setDialogSelectedProducts([]);
        setDispatchDetails({});
        setRevertRemarks("");

        await refetchPending();
        await refetchHistory();
      }

      if (failedReverts.length > 0) {
        toast({
          title: "Partial Revert Failure",
          description: `Failed to revert ${failedReverts.length} item(s).`,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "An unexpected error occurred during revert",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePreclose = async (id: number, qty: number) => {
    setIsProcessing(true);
    try {
      const res = await dispatchPlanningApi.preclose(id, { 
        preclose_qty: qty, 
        username: user?.username || 'system' 
      });
      if (res.success) {
        toast({ title: "Success", description: `Successfully preclosed ${qty} items.` });
        setOpenPrecloseId(null);
        
        // Clear local details for this row if any
        setDispatchDetails(prev => {
          const next = { ...prev };
          Object.keys(next).forEach(key => {
            if (key.endsWith(`-${id}`)) delete next[key];
          });
          return next;
        });

        await refetchPending();
        await refetchHistory();
      } else {
        toast({ title: "Error", description: res.message || "Failed to preclose", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "An unexpected error occurred", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const allChecked = dispatchData.materialReady && dispatchData.packagingComplete && dispatchData.labelsAttached


  /* Extract unique customer names (No longer used for filter as requested) */
  // const customerNames = Array.from(new Set(pendingOrders.map(order => order.customer_name || order.customerName || "Unknown")))

  const filteredPendingOrders = pendingOrders.filter((order: any) => {
    // API already handles search and date range
    if (!filterValues.status) return true;

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const targetDateStr = order.deliveryDate || order.timestamp
    if (!targetDateStr) return true;

    const targetDate = new Date(targetDateStr)
    targetDate.setHours(0, 0, 0, 0)

    if (filterValues.status === "expire") {
      return targetDate < today
    } else if (filterValues.status === "on-time") {
      return targetDate >= today
    }
    return true
  })

  const filteredHistory = useMemo(() => {
    return historyOrders.map((order: any) => ({
      ...order,
      rawData: order,
      orderNo: order.dispatchPlanningData?.orderNo || order.order_no || "-",
      customerName: order.customer_name || "-",
      timestamp: order.dispatchPlanningData?.confirmedAt || order.timestamp,
      date: new Date(order.dispatchPlanningData?.confirmedAt || order.timestamp || new Date()).toLocaleDateString("en-GB"),
      stage: "Dispatch Planning",
      status: "Completed",
      remarks: order.dispatchPlanningData?.dispatchDate ? `Date: ${order.dispatchPlanningData.dispatchDate}` : "Dispatch Plannned",
    }))
  }, [historyOrders])

  const displayRows = useMemo(() => {
    const grouped: { [key: string]: any } = {}

    filteredPendingOrders.forEach((order: any) => {
      const orderId = order.order_no || order.orderNo || "DO/26-27/0001"
      // Group by Base DO (e.g. DO/26-27/0001 from DO/26-27/0001A)
      const baseDoMatch = orderId.match(/^(DO[-\/](?:\d{2}-\d{2}\/)?\d+)/i)
      const baseDo = baseDoMatch ? baseDoMatch[1].toUpperCase() : orderId

      // Group by individual DO Number as requested
      const custName = order.customer_name || order.customerName || "Unknown"
      const groupKey = baseDo // Group by DO instead of Customer Name

      if (!grouped[groupKey]) {
        grouped[groupKey] = {
          ...order,
          customerName: order.customer_name || order.customerName || "—",
          transportType: order.type_of_transporting || order.transportType || "—",
          _displayDo: baseDo,
          _rowKey: groupKey,
          _allProducts: [],
          _productCount: 0,
          _ordersMap: {} // Map to store details for each base DO
        }
      }

      const internalOrder = order.data?.orderData || order;
      if (!grouped[groupKey]._ordersMap[baseDo]) {
        grouped[groupKey]._ordersMap[baseDo] = {
          ...order,
          baseDo,
          _products: [],
          // Robust Mapping for Header
          deliveryPurpose: internalOrder.order_type_delivery_purpose || internalOrder.orderPurpose || "—",
          startDate: internalOrder.start_date || internalOrder.startDate || "—",
          endDate: internalOrder.end_date || internalOrder.endDate || "—",
          deliveryDate: internalOrder.delivery_date || internalOrder.deliveryDate || internalOrder.timestamp || "—",
          orderType: internalOrder.order_type || internalOrder.orderType || "—",
          customerType: internalOrder.customer_type || internalOrder.customerType || "—",
          partySoDate: formatDate(internalOrder.party_so_date || internalOrder.soDate),
          totalWithGst: internalOrder.total_amount_with_gst || internalOrder.totalWithGst || "—",
          contactPerson: internalOrder.customer_contact_person_name || internalOrder.contactPerson || "—",
          whatsapp: internalOrder.customer_contact_person_whatsapp_no || internalOrder.whatsappNo || "—",
          address: internalOrder.customer_address || internalOrder.customerAddress || "—",
          paymentTerms: internalOrder.payment_terms || internalOrder.paymentTerms || "—",
          advanceTaken: internalOrder.advance_payment_to_be_taken || internalOrder.advancePaymentTaken || false,
          advanceAmount: internalOrder.advance_amount || internalOrder.advanceAmount || "—",
          isBroker: internalOrder.is_order_through_broker || internalOrder.isBrokerOrder || false,
          isOrderThrough: internalOrder.is_order_through || "Broker",
          brokerName: internalOrder.broker_name || internalOrder.brokerName || "—",
          depoName: internalOrder.depo_name || internalOrder.depoName || "—",
          orderPunchRemarks: internalOrder.order_punch_remarks || internalOrder.orderPunchRemarks || "—",
          custContactName: internalOrder.customer_contact_person_name || internalOrder.contactPerson || "—",
          weDealInSku: internalOrder.we_are_dealing_in_ordered_sku || false,
          creditStatus: internalOrder.party_credit_status || internalOrder.creditStatus || "—",
          dispatchConfirmed: internalOrder.dispatch_date_confirmed || false,
          overallStatus: internalOrder.overall_status_of_order || internalOrder.overallStatus || "—",
          custConfirmation: internalOrder.order_confirmation_with_customer || false,
          revertDispatchRemarks: internalOrder.revert_dispatch_remarks || "—",
        }
      }

      // Add product to the group
      const productWithMeta = {
        ...order,
        _rowKey: `${baseDo}-${order.id}`,
        id: order.id,
        orderNo: order.order_no,
        productName: order.product_name || order._product?.productName || order._product?.oilType,
        oilType: order.oil_type || order._product?.oilType,
        orderQty: order.order_quantity || order._product?.orderQty,
        rate: order.final_rate || order.rate_of_material || order.rate || order._product?.rate,
        approvalQty: order.approval_qty || order.order_quantity,
        remainingDispatchQty: order.remaining_dispatch_qty !== null ? order.remaining_dispatch_qty : (order.approval_qty || order.order_quantity),
      }

      grouped[groupKey]._ordersMap[baseDo]._products.push(productWithMeta)
      grouped[groupKey]._allProducts.push(productWithMeta)
    })

    return Object.values(grouped).map((group: any) => {
      const firstOrderDetails = Object.values(group._ordersMap)[0] as any || {};
      return {
        ...group,
        ...firstOrderDetails, // Flatten all detail fields into the group object
        orderNo: group._displayDo,
        processId: group.processid || group._allProducts[0]?.processid || "—",
        transportType: Array.from(new Set(Object.values(group._ordersMap).map((o: any) => o.transportType))).filter(t => t && t !== "—").join(", ") || "—",
        orderPunchRemarks: Array.from(new Set(Object.values(group._ordersMap).map((o: any) => o.orderPunchRemarks))).filter(Boolean).join("; ") || "—",
        _productCount: group._allProducts.length
      };
    }).filter(group => {
      if (group._productCount <= 0) return false;
      if (!selectedDepoTab) return true;
      return (group.depoName || "").trim().toUpperCase() === selectedDepoTab.trim().toUpperCase();
    })
  }, [filteredPendingOrders, selectedDepoTab])

  const customerNames = Array.from(new Set((pendingOrders as any[]).map(order => (order.transfer === 'yes' && order.bill_company_name) ? order.bill_company_name : (order.party_name || "Unknown Customer")))) as string[]

  return (
    <WorkflowStageShell
      partyNames={customerNames}
      title="Stage 4: Dispatch Planning"
      description="Prepare and Dispatch Plannings for delivery."
      pendingCount={displayRows.length}
      historyData={filteredHistory}
      onFilterChange={setFilterValues}
      showStatusFilter={true}
      stageLevel={3}
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
              className="h-8 rounded-lg gap-1 px-3 font-bold"
            >
              <ChevronLeft className="h-4 w-4" /> Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setHistoryPage(p => p + 1)}
              disabled={isHistoryLoading || (historyPage * limit >= (historyData?.pagination?.total || 0))}
              className="h-8 rounded-lg gap-1 px-3 font-bold"
            >
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex justify-end gap-2">
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

        <Button
          onClick={handleOpenDialog}
          disabled={selectedItems.length === 0}
        >
          {`Dispatch Selected (${selectedItems.length})`}
        </Button>
      </div>

      {activeDepots.length > 0 && (
        <div className="mt-4 mb-2">
          <Tabs value={selectedDepoTab} onValueChange={setSelectedDepoTab} className="w-full">
            <TabsList className="bg-slate-100/50 p-1 h-auto flex-wrap justify-start gap-1 border border-slate-200/60 rounded-xl shadow-sm">
              {activeDepots.map((depo) => (
                <TabsTrigger
                  key={depo.depot_id}
                  value={depo.depot_name}
                  className="px-6 py-2.5 text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm rounded-lg transition-all"
                >
                  {depo.depot_name}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      )}

      <Card className="border-none shadow-sm overflow-hidden overflow-auto max-h-[600px]">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-card shadow-sm">
            <TableRow>
              <TableHead className="w-12 text-center">
                <Checkbox
                  checked={displayRows.length > 0 && selectedItems.length === displayRows.length}
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
            {isPendingLoading && pendingOrders.length === 0 ? (
              [...Array(5)].map((_, i) => (
                <TableRow key={i} className="opacity-40 border-b border-slate-50">
                  <TableCell className="text-center py-4"><div className="h-4 w-4 bg-slate-200 animate-pulse rounded mx-auto" /></TableCell>
                  {PAGE_COLUMNS.filter(col => visibleColumns.includes(col.id)).map(col => (
                    <TableCell key={col.id} className="py-4">
                      <div className={cn(
                        "h-3 bg-slate-200 animate-pulse rounded-full mx-auto",
                        col.id === 'customerName' ? "w-32" : col.id === 'orderNo' ? "w-24" : "w-16"
                      )} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : displayRows.length > 0 ? (
              displayRows.map((row: any) => {
                const isSelected = selectedItems.some(i => i._rowKey === row._rowKey);

                return (
                  <TableRow key={row._rowKey} className={isSelected ? "bg-blue-50/50" : ""}>
                    <TableCell className="text-center">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelectItem(row)}
                      />
                    </TableCell>

                    {PAGE_COLUMNS.filter((col) => visibleColumns.includes(col.id)).map((col) => (
                      <TableCell key={col.id} className="whitespace-nowrap text-center text-xs">
                        {col.id === "status" ? (
                          <div className="flex justify-center flex-col items-center gap-1">
                            <Badge className="bg-orange-100 text-orange-700">Pending</Badge>
                            {row._productCount > 1 && (
                              <span className="text-[10px] text-slate-500 font-medium">({row._productCount} Items)</span>
                            )}
                          </div>
                        ) : col.id === "productName" ? (
                          <div className="flex flex-col items-center">
                            <span className="font-medium text-slate-700">{row._allProducts[0]?.productName}</span>
                            {row._productCount > 1 && (
                              <span className="text-[10px] text-slate-500">+ {row._productCount - 1} more types</span>
                            )}
                          </div>
                        ) : (
                          row[col.id as keyof typeof row] || "—"
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                )
              })
            ) : (
              <TableRow>
                <TableCell colSpan={visibleColumns.length + 1} className="text-center py-8 text-muted-foreground">
                  No orders pending for dispatch
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <div className="px-6 py-4 border-t bg-slate-50/50 flex items-center justify-between">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            Showing Page <span className="text-slate-900 mx-1">{pendingPage}</span>
            {pendingData?.pagination?.totalPages && (
              <> of <span className="text-slate-900 mx-1">{pendingData.pagination.totalPages}</span></>
            )}
            <span className="ml-2 text-slate-300">|</span>
            <span className="ml-2">{pendingData?.pagination?.total || 0} item{(pendingData?.pagination?.total || 0) !== 1 ? 's' : ''} in this depot</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPendingPage(p => Math.max(1, p - 1))}
              disabled={pendingPage === 1 || isPendingLoading}
              className="h-8 rounded-lg gap-1 px-3 font-bold shadow-sm"
            >
              <ChevronLeft className="h-4 w-4" /> Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPendingPage(p => p + 1)}
              disabled={isPendingLoading || pendingPage >= (pendingData?.pagination?.totalPages || 1)}
              className="h-8 rounded-lg gap-1 px-3 font-bold shadow-sm"
            >
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>


      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-6xl !max-w-6xl max-h-[95vh] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="text-xl font-bold text-slate-900 leading-none">
              Dispatch Planning
            </DialogTitle>
            <DialogDescription className="text-slate-500 mt-1.5">
              Review order details and set dispatch quantities for products.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-8 mt-4">
            <div className="space-y-12 mt-6">
              {selectedItems.map((group: any, groupIdx: number) => {
                const custName = group.customerName || group.customer_name || "Unknown";
                const allProducts = group._allProducts || [];

                return (
                  <div key={group._rowKey} className="space-y-6">
                    <h2 className="text-xl font-black text-blue-900 border-b-4 border-blue-100 pb-2 mt-4 uppercase tracking-tight flex items-center justify-between">
                      {custName}
                      <Badge className="bg-blue-600 text-white ml-3 px-3 py-1 font-black">
                        {group._productCount} PRODUCTS
                      </Badge>
                    </h2>

                    {/* Order Details Sections */}
                    {Object.entries(group._ordersMap || {}).map(([baseDo, orderDetails]: [string, any], orderIdx) => {
                      const isExpanded = expandedOrders.includes(baseDo);
                      const toggleExpand = () => {
                        setExpandedOrders(prev => isExpanded ? prev.filter(id => id !== baseDo) : [...prev, baseDo]);
                      };

                      return (
                        <div key={baseDo} className="space-y-4 border-2 border-slate-100 rounded-3xl overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow">
                          <div className="bg-blue-600 px-5 py-3 flex items-center justify-between cursor-pointer" onClick={toggleExpand}>
                            <div className="flex items-center gap-4">
                              <Badge className="bg-white text-blue-800 hover:bg-white px-4 py-1.5 text-base font-black tracking-tight rounded-full shadow-sm">
                                ORDER: {baseDo}
                              </Badge>
                              <div className="flex flex-col">
                                <span className="text-[10px] text-blue-100 font-black uppercase tracking-widest leading-none mb-1">Section {orderIdx + 1}</span>
                                <span className="text-xs text-blue-100 font-bold leading-none">{orderDetails._products?.length || 0} Items Selected</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="text-[11px] text-blue-50 font-bold uppercase tracking-widest mr-2">Click to {isExpanded ? 'Hide' : 'Show'} Details</div>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/20 rounded-full">
                                {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                              </Button>
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="px-5 pb-5 animate-in slide-in-from-top-2 duration-200">
                              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 shadow-inner">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                                  <div>
                                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">Depo Name</p>
                                    <p className="text-sm font-bold text-slate-900 leading-tight">{orderDetails.depoName || "—"}</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">Delivery Purpose</p>
                                    <p className="text-sm font-bold text-slate-900 leading-tight">{orderDetails.deliveryPurpose}</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">Order Type</p>
                                    <p className="text-sm font-bold text-slate-900 leading-tight">{orderDetails.orderType}</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">Dates</p>
                                    <p className="text-xs font-bold text-slate-900">S: {formatDate(orderDetails.startDate)} | E: {formatDate(orderDetails.endDate)}</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">Delivery Date</p>
                                    <p className="text-sm font-bold text-slate-900 leading-tight">{formatDate(orderDetails.deliveryDate)}</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">Transport</p>
                                    <p className="text-sm font-bold text-slate-900 leading-tight">{orderDetails.transportType}</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">Contact Person</p>
                                    <p className="text-sm font-bold text-slate-900 truncate">{orderDetails.custContactName || "—"}</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">WhatsApp No.</p>
                                    <p className="text-sm font-bold text-slate-900 leading-tight">{orderDetails.whatsapp || "—"}</p>
                                  </div>
                                  <div className="col-span-2">
                                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">Address</p>
                                    <p className="text-sm font-bold text-slate-900 truncate" title={orderDetails.address}>{orderDetails.address}</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">Payment Terms</p>
                                    <p className="text-sm font-bold text-slate-900 leading-tight">{orderDetails.paymentTerms}</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">Advance Amount</p>
                                    <p className="text-base font-black text-blue-700 leading-tight">
                                      ₹{orderDetails.advanceAmount || 0} {orderDetails.advanceTaken ? "(REQ)" : "(NO)"}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">Broker</p>
                                    <p className="text-sm font-bold text-slate-900 leading-tight">{orderDetails.isBroker ? orderDetails.brokerName : "No"}</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">Credit Status</p>
                                    <Badge className={cn("text-[10px] font-bold px-2 py-0.5", orderDetails.creditStatus === 'Good' ? 'bg-green-100 text-green-700 hover:bg-green-100' : 'bg-red-100 text-red-700 hover:bg-red-100')}>
                                      {orderDetails.creditStatus}
                                    </Badge>
                                  </div>
                                  <div className="col-span-4 bg-amber-50 p-4 rounded-xl border border-amber-100 flex items-start gap-4 mt-2">
                                    <div className="bg-amber-100 p-2 rounded-lg"><Settings2 className="h-5 w-5 text-amber-600" /></div>
                                    <div>
                                      <p className="text-[11px] text-amber-800 font-black uppercase tracking-widest mb-1 leading-none">Order Punch Remarks</p>
                                      <p className="text-sm font-medium text-slate-700 italic leading-snug">"{orderDetails.orderPunchRemarks || "No special instructions provided."}"</p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    <div className="space-y-4">
                      <div className="flex items-center justify-between border-b pb-2">
                        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                          Consolidated Product List - {custName}
                        </h3>
                      </div>
                      <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-white">
                        <Table>
                          <TableHeader className="bg-slate-50">
                            <TableRow>
                              <TableHead className="w-12 text-center text-[10px] uppercase font-black text-slate-500 tracking-wider">
                                <Checkbox
                                  checked={allProducts.length > 0 && allProducts.every((p: any) => dialogSelectedProducts.includes(p._rowKey))}
                                  onCheckedChange={(checked) => {
                                    const keys = allProducts.map((p: any) => p._rowKey);
                                    if (checked) setDialogSelectedProducts(prev => Array.from(new Set([...prev, ...keys])));
                                    else setDialogSelectedProducts(prev => prev.filter(k => !keys.includes(k)));
                                  }}
                                />
                              </TableHead>
                              <TableHead className="text-[10px] uppercase font-black text-slate-500 tracking-wider">Sub-Order</TableHead>
                              <TableHead className="text-[10px] uppercase font-black text-slate-500 tracking-wider">Product Name</TableHead>
                              <TableHead className="text-[10px] uppercase font-black text-slate-500 tracking-wider text-center">Rate</TableHead>
                              <TableHead className="text-[10px] uppercase font-black text-slate-500 tracking-wider text-center">Approval</TableHead>
                              <TableHead className="w-32 text-[10px] uppercase font-black text-slate-500 tracking-wider">Qty to Dispatch</TableHead>
                              <TableHead className="w-40 text-[10px] uppercase font-black text-slate-500 tracking-wider">Delivery From</TableHead>
                              <TableHead className="w-24 text-[10px] uppercase font-black text-slate-500 tracking-wider">Transfer</TableHead>
                              <TableHead className="text-[10px] uppercase font-black text-slate-500 tracking-wider text-center">Remaining</TableHead>
                              <TableHead className="text-[10px] uppercase font-black text-slate-500 tracking-wider text-center">Status</TableHead>
                              <TableHead className="text-[10px] uppercase font-black text-slate-500 tracking-wider text-center">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {allProducts.map((prod: any) => {
                              const rowKey = prod._rowKey;
                              const maxLimit = prod.remainingDispatchQty !== undefined ? prod.remainingDispatchQty : prod.approvalQty;
                              const currentDispatchQty = dispatchDetails[rowKey]?.qty !== undefined ? dispatchDetails[rowKey].qty : maxLimit;

                              return (
                                <TableRow key={rowKey} className={cn(dialogSelectedProducts.includes(rowKey) ? "bg-blue-50/30" : "")}>
                                  <TableCell className="text-center p-3">
                                    <Checkbox checked={dialogSelectedProducts.includes(rowKey)} onCheckedChange={() => toggleSelectDialogProduct(rowKey)} />
                                  </TableCell>
                                  <TableCell className="text-[10px] font-semibold text-slate-700 p-1">{prod.orderNo || "—"}</TableCell>
                                  <TableCell className="font-medium text-[11px] p-2">{prod.productName || "—"}</TableCell>
                                  <TableCell className="text-[10px] font-bold text-slate-600 p-2 text-center">₹{prod.rate || "—"}</TableCell>
                                  <TableCell className="text-[10px] font-bold text-blue-600 p-2 text-center">{prod.approvalQty || "—"}</TableCell>
                                  <TableCell className="p-2">
                                    <Input type="number" className="h-7 text-[10px] font-bold" value={currentDispatchQty} onChange={(e) => {
                                      let val = Number(e.target.value);
                                      const maxVal = Number(maxLimit);
                                      if (val > maxVal) val = maxVal;
                                      setDispatchDetails((prev) => ({ ...prev, [rowKey]: { ...prev[rowKey], qty: val.toString() } }));
                                    }} />
                                  </TableCell>
                                  <TableCell className="p-2">
                                    <Select value={dispatchDetails[rowKey]?.deliveryFrom || "in-stock"} onValueChange={(val) => setDispatchDetails((prev) => ({ ...prev, [rowKey]: { ...prev[rowKey], deliveryFrom: val } }))}>
                                      <SelectTrigger className="h-7 text-[10px] font-bold"><SelectValue placeholder="Source" /></SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="in-stock" className="text-[10px]">In Stock</SelectItem>
                                        <SelectItem value="production" className="text-[10px]">Production</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </TableCell>
                                  <TableCell className="p-2">
                                    <div className="flex items-center gap-1 justify-center">
                                      <Select
                                        value={dispatchDetails[rowKey]?.transfer || prod.transfer || "no"}
                                        onValueChange={(val) => {
                                          setDispatchDetails((prev) => {
                                            const existing = prev[rowKey] || {};
                                            // Initialize transferData from prod if not already present in state
                                            const transferData = existing.transferData || {
                                              billTo: {
                                                company: prod.bill_company_name || "",
                                                address: prod.bill_address || ""
                                              },
                                              shipTo: {
                                                company: prod.ship_company_name || "",
                                                address: prod.ship_address || ""
                                              },
                                              freightRate: prod.freight_rate?.toString() || ""
                                            };
                                            return {
                                              ...prev,
                                              [rowKey]: { ...existing, transfer: val, transferData }
                                            };
                                          });
                                          if (val === "yes") {
                                            setCurrentTransferRowKey(rowKey);
                                            setIsTransferPopupOpen(true);
                                          }
                                        }}
                                      >
                                        <SelectTrigger className="h-7 text-[10px] font-bold w-20"><SelectValue placeholder="Transfer" /></SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="yes" className="text-[10px]">Yes</SelectItem>
                                          <SelectItem value="no" className="text-[10px]">No</SelectItem>
                                        </SelectContent>
                                      </Select>
                                      {(dispatchDetails[rowKey]?.transfer === "yes" || (!dispatchDetails[rowKey]?.transfer && prod.transfer === "yes")) && (
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-6 w-6 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                          onClick={() => {
                                            setCurrentTransferRowKey(rowKey);
                                            setIsTransferPopupOpen(true);
                                          }}
                                          title="View Transfer Details"
                                        >
                                          <Settings2 className="h-3.5 w-3.5" />
                                        </Button>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-[10px] font-bold text-slate-500 p-2 text-center">{maxLimit}</TableCell>
                                  <TableCell className="p-2 text-center">
                                      <Popover 
                                        open={openPrecloseId === prod.id} 
                                        onOpenChange={(open) => setOpenPrecloseId(open ? prod.id : null)}
                                      >
                                        <PopoverTrigger asChild>
                                          <Button 
                                            variant="outline" 
                                            size="sm" 
                                            className="h-7 text-[10px] font-bold text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 hover:border-red-300"
                                          >
                                            <XCircle className="h-3.5 w-3.5 mr-1" />
                                            Preclose
                                          </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-48 p-3" align="end">
                                          <div className="space-y-3">
                                            <div className="space-y-1">
                                              <Label className="text-[10px] uppercase font-black text-slate-500">Qty to Preclose</Label>
                                              <Input 
                                                type="number" 
                                                placeholder="Enter quantity"
                                                value={precloseInputs[prod.id] !== undefined ? precloseInputs[prod.id] : maxLimit.toString()}
                                                onChange={(e) => setPrecloseInputs(prev => ({ ...prev, [prod.id]: e.target.value }))}
                                                className="h-8 text-[11px] font-bold text-center"
                                              />
                                              <p className="text-[9px] text-slate-400 font-medium italic text-center">Remaining: {maxLimit}</p>
                                            </div>
                                            <div className="flex justify-center pt-1">
                                               <Button 
                                                 size="sm" 
                                                 variant="destructive" 
                                                 className="h-7 w-full text-[10px] font-black uppercase tracking-wider"
                                                 onClick={() => {
                                                    const qty = parseFloat(precloseInputs[prod.id] !== undefined ? precloseInputs[prod.id] : maxLimit.toString());
                                                    if (isNaN(qty) || qty <= 0) {
                                                       toast({ title: "Invalid Quantity", description: "Please enter a valid number greater than 0", variant: "destructive" });
                                                    } else if (qty > maxLimit + 0.0001) {
                                                       toast({ title: "Quantity Exceeded", description: `Cannot preclose more than ${maxLimit}`, variant: "destructive" });
                                                    } else {
                                                       handlePreclose(prod.id, qty);
                                                    }
                                                 }}
                                                 disabled={isProcessing}
                                               >
                                                 {isProcessing ? "Processing..." : "Confirm Preclose"}
                                               </Button>
                                            </div>
                                          </div>
                                        </PopoverContent>
                                      </Popover>
                                   </TableCell>
                                 </TableRow>
                              );
                            })}
                          </TableBody>
                          <tfoot className="bg-slate-100/80 border-t-2 border-slate-200">
                            <TableRow>
                              <TableCell colSpan={3} className="p-3 text-right">
                                <span className="text-[10px] uppercase font-black text-slate-500 tracking-wider">Totals:</span>
                              </TableCell>

                              <TableCell className="p-3 text-center">
                                <Badge variant="secondary" className="bg-blue-100 text-blue-800 font-black px-2 shadow-sm border-blue-200">
                                  {allProducts.reduce((sum: number, p: any) => sum + (parseFloat(p.approvalQty) || 0), 0)}
                                </Badge>
                              </TableCell>
                              <TableCell className="p-3">
                                <Badge variant="secondary" className="bg-green-100 text-green-800 font-black px-2 shadow-sm border-green-200 w-full justify-center">
                                  {allProducts.reduce((sum: number, p: any) => {
                                    const rowKey = p._rowKey;
                                    const maxLimit = p.remainingDispatchQty !== undefined ? p.remainingDispatchQty : p.approvalQty;
                                    const currentDispatchQty = dispatchDetails[rowKey]?.qty !== undefined ? dispatchDetails[rowKey].qty : maxLimit;
                                    return sum + (parseFloat(currentDispatchQty) || 0);
                                  }, 0)}
                                </Badge>
                              </TableCell>
                              <TableCell />
                              <TableCell />
                              <TableCell className="p-3 text-center">
                                <Badge variant="secondary" className="bg-slate-200 text-slate-700 font-black px-2 shadow-sm border-slate-300">
                                  {allProducts.reduce((sum: number, p: any) => {
                                    const maxLimit = p.remainingDispatchQty !== undefined ? p.remainingDispatchQty : p.approvalQty;
                                    return sum + (parseFloat(maxLimit) || 0);
                                  }, 0)}
                                </Badge>
                              </TableCell>
                              <TableCell />
                            </TableRow>
                          </tfoot>
                        </Table>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <DialogFooter className="mt-4 border-t pt-4 px-8 pb-8 flex flex-col gap-4 sm:flex-col w-full">
            <div className="flex items-end gap-3 w-full">
              <div className="flex-1 space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-red-500 tracking-tighter ml-1">Revert Remarks <span className="text-red-500">*</span></Label>
                <Input
                  className="h-10 border-2 border-red-200 rounded-lg font-medium bg-white focus:border-red-400 transition-colors"
                  placeholder="Enter reason for reverting..."
                  value={revertRemarks}
                  onChange={(e) => setRevertRemarks(e.target.value)}
                />
              </div>
              <Button
                variant="destructive"
                onClick={handleRevert}
                disabled={isProcessing || dialogSelectedProducts.length === 0 || isReadOnly || !revertRemarks.trim()}
                className="font-black uppercase tracking-tight whitespace-nowrap"
              >
                {isProcessing ? "Processing..." : `Revert to Pre-Approval (${dialogSelectedProducts.length})`}
              </Button>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleBulkDispatch} disabled={isProcessing || dialogSelectedProducts.length === 0 || isReadOnly}>
                {isProcessing ? "Processing..." : `Dispatch ${dialogSelectedProducts.length} Item(s)`}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer Details Popup */}
      <Dialog open={isTransferPopupOpen} onOpenChange={(open) => {
        if (!open) {
          if (!isSavingTransferRef.current && currentTransferRowKey) {
            setDispatchDetails(prev => ({
              ...prev,
              [currentTransferRowKey]: { ...prev[currentTransferRowKey], transfer: "no" }
            }));
          }
          setIsTransferPopupOpen(false);
          isSavingTransferRef.current = false;
        }
      }}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Transfer Details</DialogTitle>
            <DialogDescription>
              Provide Bill-to and Ship-to details for the material transfer.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-8 py-4">
            {/* Bill To Column */}
            <div className="space-y-4">
              <h3 className="font-bold text-blue-800 border-b pb-1 uppercase text-sm">Bill To</h3>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Company Name <span className="text-red-500">*</span></Label>
                  <AsyncCombobox
                    placeholder="Select Company"
                    searchPlaceholder="Search customers..."
                    value={
                      currentTransferRowKey
                        ? (dispatchDetails[currentTransferRowKey]?.transferData?.billTo?.company ??
                          allProductsFromSelectedGroups.find(p => p._rowKey === currentTransferRowKey)?.bill_company_name ?? "")
                        : ""
                    }
                    fetchOptions={async (search: string, page: number) => {
                      const res = await customerApi.getAll({ search, page, limit: 20 });
                      const customers = res.data.customers || [];
                      return {
                        options: customers.map((c: any) => ({ value: c.customer_name, label: c.customer_name })),
                        hasMore: (customers.length + (page - 1) * 20) < (res.data.pagination?.total || 0)
                      };
                    }}
                    onValueChange={async (val) => {
                      if (!currentTransferRowKey) return;

                      // Fetch full customer details to get the address accurately
                      let autoAddress = "";
                      try {
                        const res = await customerApi.getByName(val);
                        if (res.success && res.data) {
                          const c = res.data;
                          autoAddress = [
                            c.address_line_1,
                            c.address_line_2,
                            c.state,
                            c.pincode
                          ].filter(Boolean).join(", ");
                        }
                      } catch (error) {
                        console.error("[DISPATCH] Failed to fetch bill-to address:", error);
                      }

                      const prevData = dispatchDetails[currentTransferRowKey]?.transferData || {
                        billTo: { company: "", address: "" },
                        shipTo: { company: "", address: "" },
                        freightRate: ""
                      };
                      setDispatchDetails(prev => {
                        const rowKey = currentTransferRowKey!;
                        const rowDetail = prev[rowKey] || { qty: "0" };
                        return {
                          ...prev,
                          [rowKey]: {
                            ...rowDetail,
                            transferData: {
                              ...prevData,
                              billTo: { ...prevData.billTo, company: val, address: autoAddress || prevData.billTo.address }
                            }
                          }
                        };
                      });
                    }}
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Address</Label>
                  <Input
                    placeholder="Enter Address"
                    className="h-9 text-xs font-medium"
                    value={
                      currentTransferRowKey
                        ? (dispatchDetails[currentTransferRowKey]?.transferData?.billTo?.address ||
                          allProductsFromSelectedGroups.find(p => p._rowKey === currentTransferRowKey)?.bill_address || "")
                        : ""
                    }
                    onChange={(e) => {
                      if (!currentTransferRowKey) return;
                      const prevData = dispatchDetails[currentTransferRowKey]?.transferData || {
                        billTo: { company: "", address: "" },
                        shipTo: { company: "", address: "" },
                        freightRate: ""
                      };
                      setDispatchDetails(prev => {
                        const rowKey = currentTransferRowKey!;
                        const rowDetail = prev[rowKey] || { qty: "0" };
                        return {
                          ...prev,
                          [rowKey]: {
                            ...rowDetail,
                            transferData: { ...prevData, billTo: { ...prevData.billTo, address: e.target.value } }
                          }
                        };
                      });
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Ship To Column */}
            <div className="space-y-4">
              <h3 className="font-bold text-green-800 border-b pb-1 uppercase text-sm">Ship To</h3>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Company Name <span className="text-red-500">*</span></Label>
                  <AsyncCombobox
                    placeholder="Select Company"
                    searchPlaceholder="Search customers..."
                    value={
                      currentTransferRowKey
                        ? (dispatchDetails[currentTransferRowKey]?.transferData?.shipTo?.company ||
                          allProductsFromSelectedGroups.find(p => p._rowKey === currentTransferRowKey)?.ship_company_name || "")
                        : ""
                    }
                    fetchOptions={async (search: string, page: number) => {
                      const res = await customerApi.getAll({ search, page, limit: 20 });
                      const customers = res.data.customers || [];
                      return {
                        options: customers.map((c: any) => ({ value: c.customer_name, label: c.customer_name })),
                        hasMore: (customers.length + (page - 1) * 20) < (res.data.pagination?.total || 0)
                      };
                    }}
                    onValueChange={async (val) => {
                      if (!currentTransferRowKey) return;

                      // Fetch full customer details to get the address accurately
                      let autoAddress = "";
                      try {
                        const res = await customerApi.getByName(val);
                        if (res.success && res.data) {
                          const c = res.data;
                          autoAddress = [
                            c.address_line_1,
                            c.address_line_2,
                            c.state,
                            c.pincode
                          ].filter(Boolean).join(", ");
                        }
                      } catch (error) {
                        console.error("[DISPATCH] Failed to fetch ship-to address:", error);
                      }

                      const prevData = dispatchDetails[currentTransferRowKey]?.transferData || {
                        billTo: { company: "", address: "" },
                        shipTo: { company: "", address: "" },
                        freightRate: ""
                      };
                      setDispatchDetails(prev => {
                        const rowKey = currentTransferRowKey!;
                        const rowDetail = prev[rowKey] || { qty: "0" };
                        return {
                          ...prev,
                          [rowKey]: {
                            ...rowDetail,
                            transferData: {
                              ...prevData,
                              shipTo: { ...prevData.shipTo, company: val, address: autoAddress || prevData.shipTo.address }
                            }
                          }
                        };
                      });
                    }}
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Address</Label>
                  <Input
                    placeholder="Enter Address"
                    className="h-9 text-xs font-medium"
                    value={
                      currentTransferRowKey
                        ? (dispatchDetails[currentTransferRowKey]?.transferData?.shipTo?.address ||
                          allProductsFromSelectedGroups.find(p => p._rowKey === currentTransferRowKey)?.ship_address || "")
                        : ""
                    }
                    onChange={(e) => {
                      if (!currentTransferRowKey) return;
                      const prevData = dispatchDetails[currentTransferRowKey]?.transferData || {
                        billTo: { company: "", address: "" },
                        shipTo: { company: "", address: "" },
                        freightRate: ""
                      };
                      setDispatchDetails(prev => {
                        const rowKey = currentTransferRowKey!;
                        const rowDetail = prev[rowKey] || { qty: "0" };
                        return {
                          ...prev,
                          [rowKey]: {
                            ...rowDetail,
                            transferData: { ...prevData, shipTo: { ...prevData.shipTo, address: e.target.value } }
                          }
                        };
                      });
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="px-8 pb-4">
            <div className="space-y-1.5 max-w-xs">
              <Label className="text-xs font-bold">Freight Rate <span className="text-red-500">*</span></Label>
              <Input
                type="number"
                min="0"
                placeholder="0.00"
                className="h-10 text-sm font-bold border-2 focus:border-blue-400"
                value={
                  currentTransferRowKey
                    ? (dispatchDetails[currentTransferRowKey]?.transferData?.freightRate ||
                      allProductsFromSelectedGroups.find(p => p._rowKey === currentTransferRowKey)?.freight_rate?.toString() || "")
                    : ""
                }
                onChange={(e) => {
                  if (!currentTransferRowKey) return;
                  let val = e.target.value;
                  if (Number(val) < 0) val = "0";
                  const prevData = dispatchDetails[currentTransferRowKey]?.transferData || {
                    billTo: { company: "", address: "" },
                    shipTo: { company: "", address: "" },
                    freightRate: ""
                  };
                  setDispatchDetails(prev => {
                    const rowKey = currentTransferRowKey!;
                    const rowDetail = prev[rowKey] || { qty: "0" };
                    return {
                      ...prev,
                      [rowKey]: {
                        ...rowDetail,
                        transferData: { ...prevData, freightRate: val }
                      }
                    };
                  });
                }}
              />
            </div>
          </div>

          <DialogFooter className="mt-6 border-t pt-4">
            <Button variant="outline" onClick={() => {
              if (currentTransferRowKey) {
                setDispatchDetails(prev => ({
                  ...prev,
                  [currentTransferRowKey]: { ...prev[currentTransferRowKey], transfer: "no" }
                }));
              }
              setIsTransferPopupOpen(false);
            }}>Cancel</Button>
            <Button
              onClick={() => {
                // Validation
                const data = currentTransferRowKey ? dispatchDetails[currentTransferRowKey]?.transferData : null;
                if (!data || !data.billTo.company || !data.shipTo.company || data.freightRate === "") {
                  toast({ title: "Validation Error", description: "Companies and Freight Rate (>=0) are mandatory.", variant: "destructive" });
                  return;
                }
                isSavingTransferRef.current = true;
                setIsTransferPopupOpen(false);
              }}
              className="bg-blue-600 hover:bg-blue-700"
            >
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </WorkflowStageShell>
  )
}