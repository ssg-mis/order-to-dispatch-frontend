"use client"

import { useEffect, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { WorkflowStageShell } from "@/components/workflow/workflow-stage-shell"
import { cn } from "@/lib/utils"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { Checkbox } from "@/components/ui/checkbox"
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Settings2, ChevronDown, ChevronUp, Truck, Weight } from "lucide-react"
import { actualDispatchApi, vehicleDetailsApi, materialLoadApi, skuApi } from "@/lib/api-service"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export default function ActualDispatchPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [pendingOrders, setPendingOrders] = useState<any[]>([])
  const [historyOrders, setHistoryOrders] = useState<any[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [selectedOrders, setSelectedOrders] = useState<string[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [confirmDetails, setConfirmDetails] = useState<Record<string, { qty: string }>>({})
  const [expandedOrders, setExpandedOrders] = useState<string[]>([])
  const [skus, setSkus] = useState<any[]>([])
  
  // Consolidated State for Stages 6 & 7
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
    extraWeight: "0",
  })
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

  // Fetch SKU details for weight calculations
  const fetchSkus = async () => {
    try {
      console.log('[ACTUAL DISPATCH] Fetching SKUs for weight calculation...')
      const response = await skuApi.getAll()
      console.log('[ACTUAL DISPATCH] SKU API Response:', response)
      
      if (response.success && response.data) {
        // Backend returns array directly in response.data, not response.data.skus
        const skuArray = Array.isArray(response.data) ? response.data : []
        console.log(`[ACTUAL DISPATCH] Loaded ${skuArray.length} SKUs`)
        console.log('[ACTUAL DISPATCH] First 3 SKUs:', skuArray.slice(0, 3))
        setSkus(skuArray)
      } else {
        console.error('[ACTUAL DISPATCH] SKU API returned no data:', response)
      }
    } catch (error: any) {
      console.error("[ACTUAL DISPATCH] Failed to fetch SKUs:", error)
    }
  }

  useEffect(() => {
    fetchPendingDispatches()
    fetchDispatchHistory()
    fetchSkus()
  }, [])

  // Auto-calculate packing weights (Stage 7 Logic)
  useEffect(() => {
    const netPacking = parseFloat(loadData.netWeightPacking) || 0
    const otherPacking = parseFloat(loadData.otherItemWeight) || 0
    const grossPacking = netPacking + otherPacking
    
    setLoadData(prev => ({
      ...prev,
      grossWeightPacking: (loadData.netWeightPacking || loadData.otherItemWeight) ? grossPacking.toFixed(2) : ""
    }))
  }, [loadData.netWeightPacking, loadData.otherItemWeight])

  // Auto-calculate difference (Stage 7 Logic)
  useEffect(() => {
    const dharamWeight = parseFloat(loadData.dharamkataWeight) || 0
    const grossPacking = parseFloat(loadData.grossWeightPacking) || 0
    const diff = dharamWeight - grossPacking
    
    setLoadData(prev => ({
      ...prev,
      differanceWeight: (loadData.dharamkataWeight || loadData.grossWeightPacking) ? diff.toFixed(2) : ""
    }))
  }, [loadData.dharamkataWeight, loadData.grossWeightPacking])

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

  // Map backend data to display format with Grouping by Customer
  const displayRows = useMemo(() => {
    const grouped: { [key: string]: any } = {}

    filteredPendingOrders.forEach((order: any) => {
       const custName = order.party_name || order.customerName || "Unknown"
       const doNumber = order.so_no || order.soNo || "DO-XXX"
       const baseDoMatch = doNumber.match(/^(DO-\d+)/i)
       const baseDo = baseDoMatch ? baseDoMatch[1] : doNumber

       if (!grouped[custName]) {
          grouped[custName] = {
             customerName: custName,
             _rowKey: custName,
             _allProducts: [],
             _productCount: 0,
             _ordersMap: {},
             _allBaseDos: new Set()
          }
       }
       
       grouped[custName]._allBaseDos.add(baseDo)

       if (!grouped[custName]._ordersMap[baseDo]) {
          const internalOrder = order.data?.orderData || order;
          const checklist = order.data?.checklistResults || {};
          
          grouped[custName]._ordersMap[baseDo] = {
             ...order,
             baseDo,
             _products: [],
             // Detailed Fields (Robust Mapping)
             deliveryPurpose: internalOrder.order_type_delivery_purpose || internalOrder.orderPurpose || "—",
             startDate: internalOrder.start_date || internalOrder.startDate || "—",
             endDate: internalOrder.end_date || internalOrder.endDate || "—",
             deliveryDate: internalOrder.delivery_date || internalOrder.deliveryDate || internalOrder.timestamp || "—",
             orderType: internalOrder.order_type || internalOrder.orderType || "—",
             customerType: internalOrder.customer_type || internalOrder.customerType || "—",
             partySoDate: internalOrder.party_so_date || internalOrder.partySoDate || "—",
             totalWithGst: internalOrder.total_amount_with_gst || internalOrder.totalWithGst || "—",
             transportType: internalOrder.type_of_transporting || internalOrder.transportType || "—",
             contactPerson: internalOrder.customer_contact_person_name || internalOrder.contactPerson || "—",
             whatsapp: internalOrder.customer_contact_person_whatsapp_no || internalOrder.whatsapp || "—",
             address: internalOrder.customer_address || internalOrder.address || "—",
             paymentTerms: internalOrder.payment_terms || internalOrder.paymentTerms || "—",
             advanceTaken: internalOrder.advance_payment_to_be_taken || internalOrder.advanceTaken || false,
             advanceAmount: internalOrder.advance_amount || internalOrder.advanceAmount || "—",
             isBroker: internalOrder.is_order_through_broker || internalOrder.isBroker || false,
             brokerName: internalOrder.broker_name || internalOrder.brokerName || "—",
             depoName: internalOrder.depo_name || internalOrder.depoName || "—",
             orderPunchRemarks: internalOrder.order_punch_remarks || internalOrder.orderPunchRemarks || "—",
             rateRightly: internalOrder.rate_is_rightly_as_per_current_market_rate || checklist.rate || "—",
             dealingInOrder: internalOrder.we_are_dealing_in_ordered_sku || checklist.sku || "—",
             partyCredit: internalOrder.party_credit_status || checklist.credit || "—",
             dispatchConfirmed: internalOrder.dispatch_date_confirmed || checklist.dispatch || "—",
             overallStatus: internalOrder.overall_status_of_order || checklist.overall || "—",
             orderConfirmation: internalOrder.order_confirmation_with_customer || checklist.confirm || "—",
          }
       }
       
       // Add individual product to the group
       const productQty = parseFloat(order.qty_to_be_dispatched || order.qtyToDispatch || 0);
       const productMeta = {
          ...order,
          _rowKey: `${custName}-${baseDo}-${order.d_sr_number || order.id}`,
          orderNo: order.so_no || order.soNo,
          productName: order.product_name || order.productName,
          qtyToDispatch: order.qty_to_be_dispatched || order.qtyToDispatch,
          deliveryFrom: order.dispatch_from || order.deliveryFrom,
          dsrNumber: order.d_sr_number
       }
       
       grouped[custName]._ordersMap[baseDo]._products.push(productMeta)
       grouped[custName]._allProducts.push(productMeta)
    })

    return Object.values(grouped).map((group: any) => ({
       ...group,
       orderNo: Array.from(group._allBaseDos).join(", "),
       qtyToDispatch: group._allProducts.reduce((sum: number, p: any) => sum + parseFloat(p.qtyToDispatch || 0), 0),
       _productCount: group._allProducts.length
    }))
  }, [filteredPendingOrders])

  const toggleSelectAll = () => {
    if (selectedOrders.length === displayRows.length) {
      setSelectedOrders([])
    } else {
      setSelectedOrders(displayRows.map((row) => row._rowKey))
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

  // State for popup selection
  const [selectedGroups, setSelectedGroups] = useState<any[]>([])
  const [dialogSelectedProducts, setDialogSelectedProducts] = useState<string[]>([])

  const handleOpenDialog = (group?: any) => {
      const targetGroups = group ? [group] : displayRows.filter(r => selectedOrders.includes(r._rowKey));
      
      if (targetGroups.length > 0) {
          setSelectedGroups(targetGroups)
          // Default: Select ALL products in all selected groups
          const allKeys = targetGroups.flatMap(g => g._allProducts.map((p: any) => p._rowKey));
          setDialogSelectedProducts(allKeys)
          
          // Pre-fill confirmation details
          const newDetails: Record<string, { qty: string }> = {};
          targetGroups.forEach(g => {
            g._allProducts.forEach((prod: any) => {
               newDetails[prod._rowKey] = {
                  qty: String(prod.qtyToDispatch)
               };
            });
          });
          setConfirmDetails(newDetails);
          
          setIsDialogOpen(true)
          
          // Reset consolidated forms
          setVehicleNumber("")
          setVehicleData({
            checkStatus: "",
            remarks: "",
            fitness: "",
            insurance: "",
            tax_copy: "",
            polution: "",
            permit1: "",
            permit2_out_state: "",
          })
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
            extraWeight: "0",
          })
      }
  }

  // Helper function to get SKU weight by matching product name
  const getSkuWeight = (productName: string): number => {
    if (!productName || skus.length === 0) {
      console.warn(`[WEIGHT] Cannot get weight: productName="${productName}", skus.length=${skus.length}`)
      return 0
    }
    
    // Try 1: Exact match (case-insensitive)
    let matchedSku = skus.find(sku => 
      sku.sku_name?.toUpperCase() === productName.toUpperCase()
    )
    
    if (matchedSku) {
      console.log(`[WEIGHT] ✓ Exact match: "${productName}" -> "${matchedSku.sku_name}" = ${matchedSku.sku_weight} kg`)
      return matchedSku?.sku_weight ? parseFloat(matchedSku.sku_weight) : 0
    }
    
    // Try 2: Normalized match (KGS->KG, LTRS->LTR)
    const normalizeSkuName = (name: string) => {
      return name
        .toUpperCase()
        .replace(/KGS/g, 'KG')
        .replace(/LTRS/g, 'LTR')
        .replace(/\s+/g, ' ')
        .trim()
    }
    
    const normalizedProductName = normalizeSkuName(productName)
    matchedSku = skus.find(sku => 
      normalizeSkuName(sku.sku_name || '') === normalizedProductName
    )
    
    if (matchedSku) {
      console.log(`[WEIGHT] ✓ Normalized match: "${productName}" -> "${matchedSku.sku_name}" = ${matchedSku.sku_weight} kg`)
      return matchedSku?.sku_weight ? parseFloat(matchedSku.sku_weight) : 0
    }
    
    // Try 3: Fuzzy partial match
    matchedSku = skus.find(sku => {
      const normalizedSkuName = normalizeSkuName(sku.sku_name || '')
      return normalizedSkuName.includes(normalizedProductName) || 
             normalizedProductName.includes(normalizedSkuName)
    })
    
    if (matchedSku) {
      console.log(`[WEIGHT] ✓ Fuzzy match: "${productName}" -> "${matchedSku.sku_name}" = ${matchedSku.sku_weight} kg`)
      return matchedSku?.sku_weight ? parseFloat(matchedSku.sku_weight) : 0
    }
    
    // No match found
    console.error(`[WEIGHT] ✗ No match for "${productName}"`)
    console.log('[WEIGHT] Available SKUs:', skus.map(s => s.sku_name).slice(0, 10))
    return 0
  }

  // Calculate individual weight (qty × sku_weight)
  const calculateWeight = (productName: string, qty: string | number): number => {
    const skuWeight = getSkuWeight(productName)
    const quantity = typeof qty === 'string' ? parseFloat(qty) || 0 : qty
    return skuWeight * quantity
  }

  const toggleSelectDialogProduct = (key: string) => {
     if (dialogSelectedProducts.includes(key)) {
         setDialogSelectedProducts(prev => prev.filter(k => k !== key))
     } else {
         setDialogSelectedProducts(prev => [...prev, key])
     }
  }

  const performDispatchConfirmation = async () => {
    if (!vehicleNumber.trim()) {
      toast({ title: "Error", description: "Vehicle number is required", variant: "destructive" });
      return;
    }
    if (!vehicleData.checkStatus || !loadData.checkStatus) {
      toast({ title: "Error", description: "Please complete both Vehicle and Material Load status checks", variant: "destructive" });
      return;
    }

    setIsProcessing(true)
    try {
      if (selectedGroups.length === 0 || dialogSelectedProducts.length === 0) {
        setIsDialogOpen(false);
        return;
      }

      const successfulDispatches: any[] = []
      const failedDispatches: any[] = []
      
      const itemsToProcess = selectedGroups.flatMap(g => 
        g._allProducts.filter((p: any) => dialogSelectedProducts.includes(p._rowKey))
      )

      // Submit each item as a single consolidated request
      for (const item of itemsToProcess) {
        const dsrNumber = item.d_sr_number || item.dsrNumber; 
        const rowKey = item._rowKey;
        const confirmedQty = confirmDetails[rowKey]?.qty || item.qtyToDispatch;

        try {
          console.log('[CONSOLIDATED SUBMIT] for DSR:', dsrNumber);
          
          // Combine ALL fields into one request
          const res = await actualDispatchApi.submit(dsrNumber, {
            // Stage 5 fields
            product_name_1: item.productName || item.product_name,
            actual_qty_dispatch: confirmedQty || item.qtyToDispatch,
            
            // Stage 6 fields
            vehicle_number: vehicleNumber,
            check_status: vehicleData.checkStatus,
            remarks: vehicleData.remarks,
            fitness: vehicleData.fitness || "pending", 
            insurance: vehicleData.insurance || "pending",
            tax_copy: vehicleData.tax_copy || "pending",
            polution: vehicleData.polution || "pending",
            permit1: vehicleData.permit1 || "pending",
            permit2_out_state: vehicleData.permit2_out_state || "pending",
            
            // Stage 7 fields
            actual_qty: parseFloat(loadData.actualQty) || parseFloat(confirmedQty),
            weightment_slip_copy: loadData.weightmentSlip || "pending",
            rst_no: loadData.rstNo,
            gross_weight: parseFloat(loadData.grossWeight),
            tare_weight: parseFloat(loadData.tareWeight),
            net_weight: parseFloat(loadData.grossWeightPacking) || null,
            transporter_name: loadData.transporterName,
            reason_of_difference_in_weight_if_any_speacefic: loadData.reason,
            truck_no: loadData.truckNo || vehicleNumber,
            vehicle_no_plate_image: loadData.vehicleNoPlateImage || "pending",
            extra_weight: parseFloat(loadData.extraWeight) || 0
          });
          
          if (!res.success) throw new Error(res.message);

          successfulDispatches.push({ item, dsrNumber });
        } catch (error: any) {
          console.error('[SUBMISSION ERROR]', error);
          failedDispatches.push({ item, error: error?.message || 'Unknown error' });
        }
      }

      // Show results
      if (successfulDispatches.length > 0) {
        toast({
          title: "Dispatch, Vehicle & Load Confirmed",
          description: `${successfulDispatches.length} item(s) processed through all stages successfully.`,
        });

        setSelectedOrders([]);
        setIsDialogOpen(false); 
        setConfirmDetails({});
        setSelectedGroups([]);
        setDialogSelectedProducts([]);

        await fetchPendingDispatches();
        await fetchDispatchHistory();

        setTimeout(() => {
          router.push("/security-approval")
        }, 1500)
      }

      if (failedDispatches.length > 0) {
        toast({
          title: "Partial Success",
          description: `${failedDispatches.length} item(s) failed during one of the stages.`,
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
            onClick={() => handleOpenDialog()}
            disabled={selectedOrders.length === 0}
          >
             Confirm Dispatch ({selectedOrders.length})
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
                  />
                </TableHead>
                {PAGE_COLUMNS.filter((col) => visibleColumns.includes(col.id)).map((col) => (
                  <TableHead key={col.id} className="whitespace-nowrap text-center">
                    {col.label}
                  </TableHead>
                ))}
                <TableHead className="text-center">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayRows.length > 0 ? (
                displayRows.map((row) => {
                     const rowKey = row._rowKey;
                     return (
                       <TableRow key={rowKey} className={selectedOrders.includes(rowKey) ? "bg-blue-50/50" : ""}>
                         <TableCell className="text-center">
                           <Checkbox
                             checked={selectedOrders.includes(rowKey)}
                             onCheckedChange={() => toggleSelectOrder(rowKey)}
                           />
                         </TableCell>
                         {PAGE_COLUMNS.filter((col) => visibleColumns.includes(col.id)).map((col) => (
                           <TableCell key={col.id} className="whitespace-nowrap text-center">
                              {col.id === "status" ? (
                                 <div className="flex justify-center flex-col items-center gap-1">
                                   <Badge className="bg-blue-100 text-blue-700">Ready for Dispatch</Badge>
                                   {row._productCount > 1 && (
                                       <span className="text-[10px] text-slate-500 font-medium">({row._productCount} Items)</span>
                                   )}
                                 </div>
                              ) : col.id === "qtyToDispatch" ? (
                                  <div className="flex flex-col items-center">
                                      <span>{row.qtyToDispatch}</span>
                                      {row._productCount > 1 && <span className="text-[10px] text-slate-500">(Total)</span>}
                                  </div>
                              ) : (
                                 row[col.id as keyof typeof row]
                              )}
                           </TableCell>
                         ))}
                         <TableCell>
                             <Button variant="ghost" size="sm" onClick={() => {
                                 setSelectedOrders([rowKey])
                                 handleOpenDialog(row)
                             }}>
                                 <Settings2 className="w-4 h-4 text-slate-400 hover:text-blue-600" />
                             </Button>
                         </TableCell>
                       </TableRow>
                     )
                  })
               ) : (
                 <TableRow>
                   <TableCell colSpan={visibleColumns.length + 2} className="text-center py-8 text-muted-foreground">
                     No orders pending for actual dispatch
                   </TableCell>
                 </TableRow>
               )}
            </TableBody>
          </Table>
        </Card>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[95vw] max-w-[95vw]! max-h-[95vh] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] p-0">
          <div className="p-8">
          <DialogHeader className="border-b pb-6 mb-6">
            <DialogTitle className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
              <Truck className="h-7 w-7 text-blue-600" />
              Actual Dispatch Confirmation - {selectedGroups.length > 1 ? `${selectedGroups.length} Customer Groups` : selectedGroups[0]?.customerName}
            </DialogTitle>
            <DialogDescription className="text-slate-500 font-medium text-base mt-2">
              Review and confirm dispatch quantities for selected customers.
            </DialogDescription>
          </DialogHeader>
          
          {selectedGroups.length > 0 && (
             <div className="space-y-12 mt-6">
                {/* 1. Multi-Customer Interleaved Details */}
                {selectedGroups.map((group, groupIdx) => (
                  <div key={group._rowKey} className="space-y-6">
                    <h2 className="text-xl font-black text-blue-900 border-b-4 border-blue-100 pb-2 mt-4 uppercase tracking-tight flex items-center justify-between">
                      {group.customerName}
                      <Badge className="bg-blue-600 text-white ml-3 px-3 py-1 font-black">
                        {group._productCount} PRODUCTS
                      </Badge>
                    </h2>

                    {Object.entries(group._ordersMap).map(([baseDo, orderDetails]: [string, any], orderIdx) => {
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
                                 <span className="text-[10px] text-blue-100 font-black uppercase tracking-widest leading-none mb-1">Customer Group {groupIdx + 1} | Section {orderIdx + 1}</span>
                                 <span className="text-xs text-blue-100 font-bold leading-none">{orderDetails._products.length} Items Selected</span>
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
                                     <p className="text-sm font-bold text-slate-900 leading-tight">S: {formatDate(orderDetails.startDate)} | E: {formatDate(orderDetails.endDate)}</p>
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
                                    <p className="text-sm font-bold text-slate-900 truncate">{orderDetails.contactPerson || "—"}</p>
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
                                    <p className="text-base font-black text-blue-700 leading-tight">₹{orderDetails.advanceAmount || 0} {orderDetails.advanceTaken ? "(REQ)" : "(NO)"}</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">Broker</p>
                                    <p className="text-sm font-bold text-slate-900 leading-tight">{orderDetails.isBroker ? orderDetails.brokerName : "No"}</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">Credit Status</p>
                                    <Badge className={cn("text-[10px] font-bold px-2 py-0.5", orderDetails.partyCredit === 'Good' ? 'bg-green-100 text-green-700 hover:bg-green-100' : 'bg-red-100 text-red-700 hover:bg-red-100')}>
                                        {orderDetails.partyCredit}
                                    </Badge>
                                  </div>
                                  <div className="col-span-4 bg-amber-50 p-4 rounded-xl border border-amber-100 flex items-start gap-4 mt-2">
                                    <div className="bg-amber-100 p-2 rounded-lg"><Settings2 className="h-5 w-5 text-amber-600" /></div>
                                    <div>
                                      <p className="text-[11px] text-amber-800 font-black uppercase tracking-widest mb-1 leading-none">Order Punch Remarks</p>
                                      <p className="text-sm font-medium text-slate-700 italic leading-snug">"{orderDetails.orderPunchRemarks || "No special instructions provided."}"</p>
                                    </div>
                                  </div>
                                  
                                  <div className="col-span-full grid grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-slate-200 mt-2">
                                     <div className="flex items-center gap-2">
                                         <div className={cn("w-2 h-2 rounded-full", orderDetails.weDealInSku ? 'bg-green-500' : 'bg-red-500')} />
                                         <span className="text-[10px] text-slate-600 font-bold uppercase tracking-tighter">We Deal SKU?</span>
                                     </div>
                                      <div className="flex items-center gap-2">
                                         <div className={cn("w-2 h-2 rounded-full", orderDetails.dispatchConfirmed ? 'bg-green-500' : 'bg-red-500')} />
                                         <span className="text-[10px] text-slate-600 font-bold uppercase tracking-tighter">Dispatch Confirmed?</span>
                                     </div>
                                      <div className="flex items-center gap-2">
                                         <div className={cn("w-2 h-2 rounded-full", orderDetails.overallStatus === 'Approved' ? 'bg-green-500' : 'bg-red-500')} />
                                         <span className="text-[10px] text-slate-600 font-bold uppercase tracking-tighter">Status: {orderDetails.overallStatus}</span>
                                     </div>
                                     <div className="flex items-center gap-2">
                                         <div className={cn("w-2 h-2 rounded-full", orderDetails.orderConfirmation ? 'bg-green-500' : 'bg-red-500')} />
                                         <span className="text-[10px] text-slate-600 font-bold uppercase tracking-tighter">Cust. Confirmed?</span>
                                     </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}

                {/* 2. Consolidated Product Table */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b-2 border-slate-100 pb-4">
                    <h3 className="text-xl font-black text-slate-800 flex items-center gap-2 uppercase tracking-tight">
                      Consolidated Product List
                      <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 text-sm px-3">{selectedGroups.reduce((s, g) => s + g._allProducts.length, 0)} Items</Badge>
                    </h3>
                  </div>

                  <div className="border border-slate-200 rounded-3xl overflow-hidden shadow-sm bg-white">
                    <Table>
                        <TableHeader className="bg-slate-50 sticky top-0 z-10">
                            <TableRow>
                                <TableHead className="w-[50px] text-center text-[10px] uppercase font-black text-slate-500 tracking-wider">
                                    <Checkbox 
                                        checked={dialogSelectedProducts.length > 0 && dialogSelectedProducts.length === selectedGroups.reduce((s, g) => s + g._allProducts.length, 0)}
                                        onCheckedChange={(checked) => {
                                            if (checked) {
                                                const allKeys = selectedGroups.flatMap(g => g._allProducts.map((p: any) => p._rowKey));
                                                setDialogSelectedProducts(allKeys)
                                            } else {
                                                setDialogSelectedProducts([])
                                            }
                                        }}
                                    />
                                </TableHead>
                                <TableHead className="text-[10px] uppercase font-black text-slate-500 tracking-wider">CUSTOMER / DO</TableHead>
                                <TableHead className="text-[10px] uppercase font-black text-slate-500 tracking-wider">PRODUCT NAME</TableHead>
                                <TableHead className="text-[10px] uppercase font-black text-slate-500 tracking-wider text-center">PLANNED QTY</TableHead>
                                <TableHead className="text-[10px] uppercase font-black text-slate-500 tracking-wider">DELIVERY FROM</TableHead>
                                <TableHead className="w-[180px] text-[10px] uppercase font-black text-slate-500 tracking-wider">ACTUAL QTY DISPATCHED</TableHead>
                                <TableHead className="w-[120px] text-[10px] uppercase font-black text-slate-500 tracking-wider text-center">WEIGHT (KG)</TableHead>
                                <TableHead className="text-[10px] uppercase font-black text-slate-500 tracking-wider text-center">STATUS</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {selectedGroups.flatMap(group => group._allProducts).map((prod: any) => {
                                const rowKey = prod._rowKey;
                                return (
                                <TableRow key={rowKey} className={cn(dialogSelectedProducts.includes(rowKey) ? "bg-blue-50/30" : "")}>
                                    <TableCell className="text-center p-3">
                                        <Checkbox 
                                            checked={dialogSelectedProducts.includes(rowKey)}
                                            onCheckedChange={() => toggleSelectDialogProduct(rowKey)}
                                        />
                                    </TableCell>
                                    <TableCell className="p-3">
                                        <div className="flex flex-col">
                                            <span className="text-[9px] font-black text-blue-600 uppercase leading-none mb-1">{prod.customerName}</span>
                                            <span className="text-[10px] font-bold text-slate-700">{prod.orderNo || "—"}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="font-bold text-[11px] p-3 text-slate-900">{prod.productName || "—"}</TableCell>
                                    <TableCell className="text-[11px] font-black p-3 text-center text-blue-700">{prod.qtyToDispatch}</TableCell>
                                    <TableCell className="text-[10px] font-black p-3 uppercase text-slate-400 tracking-tighter">{prod.deliveryFrom}</TableCell>
                                    <TableCell className="p-3">
                                        <Input
                                            type="number"
                                            readOnly
                                            className="h-10 text-xs font-black border-2 border-slate-200 rounded-xl bg-slate-50 cursor-not-allowed focus:ring-0 transition-colors shadow-sm"
                                            placeholder="Actual Qty"
                                            value={confirmDetails[rowKey]?.qty || ""}
                                            onChange={(e) =>
                                              setConfirmDetails((prev) => ({
                                                ...prev,
                                                [rowKey]: {
                                                   ...prev[rowKey],
                                                   qty: e.target.value
                                                }
                                              }))
                                            }
                                        />
                                    </TableCell>
                                    <TableCell className="p-3 text-center">
                                        <div className="font-black text-sm text-purple-700">
                                            {calculateWeight(prod.productName, confirmDetails[rowKey]?.qty || prod.qtyToDispatch).toFixed(2)} kg
                                        </div>
                                    </TableCell>
                                    <TableCell className="p-3 text-center">
                                        <Badge variant="outline" className="text-[9px] bg-orange-50 text-orange-700 border-orange-200 uppercase font-black px-2 py-0.5">Pending</Badge>
                                    </TableCell>
                                </TableRow>
                            )})}
                            {/* Total Weight Row */}
                            <TableRow className="bg-purple-50 border-t-2 border-purple-200">
                                <TableCell colSpan={6} className="text-right p-4 font-black text-sm uppercase text-purple-900 tracking-wider">
                                    Total Weight:
                                </TableCell>
                                <TableCell className="p-4 text-center">
                                    <div className="font-black text-lg text-purple-700">
                                        {selectedGroups.flatMap(g => g._allProducts)
                                            .reduce((total, prod) => {
                                                const rowKey = prod._rowKey
                                                return total + calculateWeight(prod.productName, confirmDetails[rowKey]?.qty || prod.qtyToDispatch)
                                            }, 0).toFixed(2)} kg
                                    </div>
                                </TableCell>
                                <TableCell colSpan={1} />
                            </TableRow>
                        </TableBody>
                    </Table>
                  </div>
                </div>

                {/* 3. Consolidated Vehicle & Load Forms */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-8 border-t-4 border-slate-100">
                   {/* Column A: Vehicle Information */}
                   <div className="space-y-6">
                      <div className="bg-purple-600 px-6 py-4 rounded-3xl flex items-center justify-between shadow-lg">
                         <div className="flex items-center gap-3">
                            <Truck className="h-6 w-6 text-white" />
                            <h3 className="text-xl font-black text-white uppercase tracking-tighter italic">Vehicle Setup</h3>
                         </div>
                         <Badge className="bg-white text-purple-700 font-black">STAGE 6</Badge>
                      </div>

                      <div className="bg-slate-50 border-2 border-slate-200 rounded-3xl p-6 space-y-6 shadow-md transition-all hover:shadow-lg">
                         <div className="space-y-4">
                            <div className="space-y-1.5">
                               <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Vehicle Registration Number</Label>
                               <Input 
                                 placeholder="e.g. MH-12-AB-1234" 
                                 className="h-12 border-2 border-slate-200 rounded-xl px-4 font-black text-lg focus:border-purple-500 transition-colors uppercase bg-white"
                                 value={vehicleNumber}
                                 onChange={(e) => setVehicleNumber(e.target.value)}
                               />
                            </div>
                         </div>

                         <div className="pt-4 border-t border-slate-200">
                            <p className="text-[10px] font-black uppercase text-slate-400 mb-3 tracking-widest leading-none">Digital Documents (STAGE 6)</p>
                            <div className="grid grid-cols-2 gap-3">
                               <div className="bg-white border border-dashed border-slate-300 rounded-xl p-2.5 flex items-center justify-between group cursor-pointer hover:border-purple-400 transition-colors">
                                  <span className="text-[10px] font-black text-slate-500 group-hover:text-purple-600 transition-colors uppercase">Fitness</span>
                                  <Input type="file" className="hidden" id="fitness-doc" />
                                  <Label htmlFor="fitness-doc" className="bg-slate-100 text-[9px] font-black px-2.5 py-1 rounded-lg text-slate-600 group-hover:bg-purple-600 group-hover:text-white transition-all cursor-pointer">UPLOAD</Label>
                               </div>
                               <div className="bg-white border border-dashed border-slate-300 rounded-xl p-2.5 flex items-center justify-between group cursor-pointer hover:border-purple-400 transition-colors">
                                  <span className="text-[10px] font-black text-slate-500 group-hover:text-purple-600 transition-colors uppercase">Insurance</span>
                                  <Input type="file" className="hidden" id="ins-doc" />
                                  <Label htmlFor="ins-doc" className="bg-slate-100 text-[9px] font-black px-2.5 py-1 rounded-lg text-slate-600 group-hover:bg-purple-600 group-hover:text-white transition-all cursor-pointer">UPLOAD</Label>
                               </div>
                               <div className="bg-white border border-dashed border-slate-300 rounded-xl p-2.5 flex items-center justify-between group cursor-pointer hover:border-purple-400 transition-colors">
                                  <span className="text-[10px] font-black text-slate-500 group-hover:text-purple-600 transition-colors uppercase">Tax Copy</span>
                                  <Input type="file" className="hidden" id="tax-doc" />
                                  <Label htmlFor="tax-doc" className="bg-slate-100 text-[9px] font-black px-2.5 py-1 rounded-lg text-slate-600 group-hover:bg-purple-600 group-hover:text-white transition-all cursor-pointer">UPLOAD</Label>
                               </div>
                               <div className="bg-white border border-dashed border-slate-300 rounded-xl p-2.5 flex items-center justify-between group cursor-pointer hover:border-purple-400 transition-colors">
                                  <span className="text-[10px] font-black text-slate-500 group-hover:text-purple-600 transition-colors uppercase">Pollution</span>
                                  <Input type="file" className="hidden" id="poll-doc" />
                                  <Label htmlFor="poll-doc" className="bg-slate-100 text-[9px] font-black px-2.5 py-1 rounded-lg text-slate-600 group-hover:bg-purple-600 group-hover:text-white transition-all cursor-pointer">UPLOAD</Label>
                               </div>
                               <div className="bg-white border border-dashed border-slate-300 rounded-xl p-2.5 flex items-center justify-between group cursor-pointer hover:border-purple-400 transition-colors">
                                  <span className="text-[10px] font-black text-slate-500 group-hover:text-purple-600 transition-colors uppercase">Permit 1</span>
                                  <Input type="file" className="hidden" id="permit1-doc" />
                                  <Label htmlFor="permit1-doc" className="bg-slate-100 text-[9px] font-black px-2.5 py-1 rounded-lg text-slate-600 group-hover:bg-purple-600 group-hover:text-white transition-all cursor-pointer">UPLOAD</Label>
                               </div>
                               <div className="bg-white border border-dashed border-slate-300 rounded-xl p-2.5 flex items-center justify-between group cursor-pointer hover:border-purple-400 transition-colors">
                                  <span className="text-[10px] font-black text-slate-500 group-hover:text-purple-600 transition-colors uppercase">Permit 2</span>
                                  <Input type="file" className="hidden" id="permit2-doc" />
                                  <Label htmlFor="permit2-doc" className="bg-slate-100 text-[9px] font-black px-2.5 py-1 rounded-lg text-slate-600 group-hover:bg-purple-600 group-hover:text-white transition-all cursor-pointer">UPLOAD</Label>
                               </div>
                            </div>
                         </div>

                         <div className="pt-4 border-t border-slate-200 grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                               <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Check Status</Label>
                               <Select value={vehicleData.checkStatus} onValueChange={(v) => setVehicleData(p => ({...p, checkStatus: v}))}>
                                  <SelectTrigger className="h-12 border-2 border-slate-200 rounded-xl font-bold bg-white focus:ring-2 focus:ring-purple-500">
                                     <SelectValue placeholder="Status" />
                                  </SelectTrigger>
                                  <SelectContent>
                                     <SelectItem value="Accept">Accept</SelectItem>
                                     <SelectItem value="Reject">Reject</SelectItem>
                                  </SelectContent>
                               </Select>
                            </div>
                            <div className="space-y-1.5">
                               <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Remarks</Label>
                               <Input 
                                 placeholder="Add notes..." 
                                 className="h-12 border-2 border-slate-200 rounded-xl bg-white font-medium focus:border-purple-500 transition-colors"
                                 value={vehicleData.remarks}
                                 onChange={(e) => setVehicleData(p => ({...p, remarks: e.target.value}))}
                               />
                            </div>
                         </div>
                      </div>
                   </div>

                   {/* Column B: Material Load Details */}
                   <div className="space-y-6">
                      <div className="bg-blue-800 px-6 py-4 rounded-3xl flex items-center justify-between shadow-lg">
                         <div className="flex items-center gap-3">
                            <Weight className="h-6 w-6 text-white" />
                            <h3 className="text-xl font-black text-white uppercase tracking-tighter italic">Weightment Audit</h3>
                         </div>
                         <Badge className="bg-white text-blue-800 font-black">STAGE 7</Badge>
                      </div>

                      <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 space-y-5 shadow-md overflow-hidden relative group hover:shadow-lg transition-all">
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                             <div className="space-y-1.5">
                                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-tighter ml-1">Actual Qty</Label>
                                <Input type="number" step="0.01" className="h-10 border-2 border-slate-200 rounded-lg font-bold bg-white focus:border-blue-500 transition-colors" 
                                  value={loadData.actualQty} onChange={(e) => setLoadData(p => ({...p, actualQty: e.target.value}))} />
                             </div>
                             <div className="space-y-1.5">
                                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-tighter ml-1">RST No</Label>
                                <Input className="h-10 border-slate-200 rounded-lg font-bold"
                                  value={loadData.rstNo} onChange={(e) => setLoadData(p => ({...p, rstNo: e.target.value}))} />
                             </div>
                             <div className="space-y-1.5">
                                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-tighter ml-1">Truck No</Label>
                                <Input className="h-10 border-slate-200 rounded-lg font-bold bg-slate-50 font-mono uppercase" value={loadData.truckNo || vehicleNumber} readOnly />
                             </div>
                          </div>

                          <div className="grid grid-cols-2 @md:grid-cols-3 gap-4">
                             <div className="space-y-1.5">
                                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-tighter ml-1">Gross Wt</Label>
                                <Input type="number" step="0.01" className="h-10 border-slate-200 rounded-lg font-bold text-red-600"
                                  value={loadData.grossWeight} onChange={(e) => setLoadData(p => ({...p, grossWeight: e.target.value}))} />
                             </div>
                             <div className="space-y-1.5">
                                <Label className="text-[10px] font-black uppercase text-slate-500 tracking-tighter ml-1">Tare Wt</Label>
                                <Input type="number" step="0.01" className="h-10 border-slate-200 rounded-lg font-bold"
                                  value={loadData.tareWeight} onChange={(e) => setLoadData(p => ({...p, tareWeight: e.target.value}))} />
                             </div>
                              <div className="space-y-1.5">
                                 <Label className="text-[10px] font-black uppercase text-slate-500 tracking-tighter ml-1">Dharamkata</Label>
                                 <Input type="number" step="0.01" className="h-10 border-2 border-slate-200 rounded-lg font-bold bg-amber-50"
                                   value={loadData.dharamkataWeight} onChange={(e) => setLoadData(p => ({...p, dharamkataWeight: e.target.value}))} />
                              </div>
                              <div className="space-y-1.5">
                                 <Label className="text-[10px] font-black uppercase text-slate-500 tracking-tighter ml-1">Extra Weight</Label>
                                 <Input type="number" step="0.001" className="h-10 border-2 border-slate-200 rounded-lg font-bold bg-white focus:border-blue-500 transition-colors"
                                   placeholder="0.000"
                                   value={loadData.extraWeight} onChange={(e) => setLoadData(p => ({...p, extraWeight: e.target.value}))} />
                              </div>
                           </div>

                          <div className="bg-blue-50/50 rounded-2xl p-4 border border-blue-100 flex items-center justify-between">
                             <div className="space-y-0.5">
                                <p className="text-[10px] font-black uppercase text-blue-600 tracking-widest leading-none mb-1">Packing Audit</p>
                                <div className="flex items-baseline gap-2">
                                  <p className="text-2xl font-black text-blue-900 leading-none">{loadData.grossWeightPacking || "0.00"}</p>
                                  <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest">NET KG</span>
                                </div>
                             </div>
                             <div className="flex gap-2">
                                <div className="flex flex-col gap-1">
                                  <span className="text-[8px] font-black text-slate-400 text-center uppercase">Net</span>
                                  <Input type="number" step="0.01" className="h-9 w-20 bg-white border-blue-200 rounded-lg font-bold text-xs" 
                                    value={loadData.netWeightPacking} onChange={(e) => setLoadData(p => ({...p, netWeightPacking: e.target.value}))} />
                                </div>
                                <div className="flex flex-col gap-1">
                                  <span className="text-[8px] font-black text-slate-400 text-center uppercase">Diff</span>
                                  <Input type="number" readOnly className="h-9 w-20 bg-amber-100 border-amber-200 rounded-lg font-black text-xs text-amber-700" 
                                    value={loadData.differanceWeight} />
                                </div>
                             </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                             <div className="space-y-1.5">
                                <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1 italic font-serif leading-none">Status (STG 7)</Label>
                                <Select value={loadData.checkStatus} onValueChange={(v) => setLoadData(p => ({...p, checkStatus: v}))}>
                                   <SelectTrigger className="h-10 border-2 border-slate-200 rounded-xl font-bold bg-white">
                                      <SelectValue placeholder="Decision" />
                                   </SelectTrigger>
                                   <SelectContent>
                                      <SelectItem value="Accept">Approved Quality</SelectItem>
                                      <SelectItem value="Reject">Reject Load</SelectItem>
                                   </SelectContent>
                                </Select>
                             </div>
                             <div className="space-y-1.5">
                                <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1 italic font-serif leading-none">Transporter</Label>
                                <Input className="h-10 border-slate-200 rounded-lg font-medium bg-white" placeholder="Carrier Name"
                                  value={loadData.transporterName} onChange={(e) => setLoadData(p => ({...p, transporterName: e.target.value}))} />
                             </div>
                          </div>

                          <div className="space-y-1.5">
                             <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1 italic font-serif leading-none">Weight Difference Reason (If any)</Label>
                             <Input className="h-10 border-slate-200 rounded-lg font-medium bg-white" placeholder="Specify reason..."
                               value={loadData.reason} onChange={(e) => setLoadData(p => ({...p, reason: e.target.value}))} />
                          </div>

                          <div className="pt-2 border-t border-slate-100 flex justify-between gap-4">
                             <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-2.5 flex-1 flex items-center justify-between group cursor-pointer hover:border-blue-400 transition-colors">
                                <span className="text-[9px] font-black text-slate-500 group-hover:text-blue-600 transition-colors uppercase">Weight Slip</span>
                                <Input type="file" className="hidden" id="weight-slip" />
                                <Label htmlFor="weight-slip" className="bg-slate-200 text-[8px] font-black px-2 py-1 rounded-md text-slate-600 group-hover:bg-blue-600 group-hover:text-white transition-all cursor-pointer">SELECT</Label>
                             </div>
                             <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-2.5 flex-1 flex items-center justify-between group cursor-pointer hover:border-blue-400 transition-colors">
                                <span className="text-[9px] font-black text-slate-500 group-hover:text-blue-600 transition-colors uppercase">Plate Image</span>
                                <Input type="file" className="hidden" id="plate-img" />
                                <Label htmlFor="plate-img" className="bg-slate-200 text-[8px] font-black px-2 py-1 rounded-md text-slate-600 group-hover:bg-blue-600 group-hover:text-white transition-all cursor-pointer">SELECT</Label>
                             </div>
                          </div>
                      </div>
                   </div>
                </div>
             </div>
          )}
          </div>

          <DialogFooter className="mt-4 border-t pt-4 px-8 pb-8">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={performDispatchConfirmation} disabled={isProcessing || dialogSelectedProducts.length === 0}>
               {isProcessing ? "Processing..." : `Confirm Dispatch (${dialogSelectedProducts.length})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </WorkflowStageShell>
  )
}
