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
import { Settings2, ChevronDown, ChevronUp, Truck, Weight, CheckCircle2, XCircle, FileText, ExternalLink } from "lucide-react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { actualDispatchApi, vehicleDetailsApi, materialLoadApi, skuApi, orderApi, depotApi, vehicleMasterApi, transportMasterApi, driverMasterApi, draftApi, gateInApi } from "@/lib/api-service"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useAuth } from "@/hooks/use-auth"
import { useQuery } from "@tanstack/react-query"
import { Loader2, ChevronLeft, ChevronRight } from "lucide-react"

export default function ActualDispatchPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { isReadOnly, user } = useAuth()
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending")
  const [pendingPage, setPendingPage] = useState(1)
  const [historyPage, setHistoryPage] = useState(1)
  const limit = 20

  const [filterValues, setFilterValues] = useState({
    search: "",
    status: "",
    startDate: "",
    endDate: "",
    partyName: ""
  })
  const [activeDepots, setActiveDepots] = useState<any[]>([])
  const [selectedDepoTab, setSelectedDepoTab] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [skus, setSkus] = useState<any[]>([])
  const [selectedOrders, setSelectedOrders] = useState<string[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [confirmDetails, setConfirmDetails] = useState<Record<string, { qty: string }>>({})
  const [expandedOrders, setExpandedOrders] = useState<string[]>([])
  const [selectedGroups, setSelectedGroups] = useState<any[]>([])
  const [dialogSelectedProducts, setDialogSelectedProducts] = useState<string[]>([])
  const [revertRemarks, setRevertRemarks] = useState("")
  const [filterOptions, setFilterOptions] = useState<{ customerNames: string[] }>({ customerNames: [] })
  const [isSavingDraft, setIsSavingDraft] = useState(false)
  const [gateInData, setGateInData] = useState<any>(null)
  const [isGateInPopupOpen, setIsGateInPopupOpen] = useState(false)

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
    fitness_file_name: "",
    insurance_file_name: "",
    tax_file_name: "",
    pollution_file_name: "",
    permit1_file_name: "",
    permit2_file_name: "",
    fitness_end_date: "",
    insurance_end_date: "",
    tax_end_date: "",
    pollution_end_date: "",
    permit1_end_date: "",
    permit2_end_date: "",
    registration_no: "",
    vehicle_type: "",
    rto: "",
    passing_weight: "",
    road_tax: "",
    gvw: "",
    ulw: "",
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
    vehicleNoPlateImage_file_name: "",
    checkStatus: "",
    remarks: "",
    overloadRemarks: "",
    extraWeight: "0",
    weightmentSlip_file_name: "",
    freightRateType: "",
    freightAmount: "",
    cash_bank: "",
    diesel_advance: "",
    bhada: ""
  })

  const [isUploading, setIsUploading] = useState<string | null>(null)
  const [vehicleMaster, setVehicleMaster] = useState<any[]>([])
  const [driverMaster, setDriverMaster] = useState<any[]>([])
  const [transporterMaster, setTransporterMaster] = useState<any[]>([])
  const [driverName, setDriverName] = useState("")
  const [driverData, setDriverData] = useState({
    contact_no: "",
    license_no: "",
    valid_upto: ""
  })

  // Date validation for vehicle documents (Min Today + 5 days)
  const minDate = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() + 5)
    return d.toISOString().split("T")[0]
  }, [])

  // Interstate detection logic: Check if any selected order address state differs from vehicle RTO state
  const isInterState = useMemo(() => {
    if (selectedGroups.length === 0 || !vehicleData.rto) return false;
    
    const rtoPrefix = vehicleData.rto.substring(0, 2).toUpperCase();
    const statePrefixMap: Record<string, string> = {
      "CG": "chhattisgarh", "KA": "karnataka", "MH": "maharashtra", "DL": "delhi",
      "UP": "uttar pradesh", "HR": "haryana", "RJ": "rajasthan", "MP": "madhya pradesh",
      "GJ": "gujarat", "PB": "punjab", "WB": "west bengal", "BR": "bihar",
      "OD": "odisha", "AS": "assam", "TS": "telangana", "AP": "andhra pradesh",
      "TN": "tamil nadu", "KL": "kerala", "UK": "uttarakhand", "UA": "uttarakhand",
      "HP": "himachal pradesh", "JH": "jharkhand", "GA": "goa", "JK": "jammu",
      "PY": "puducherry", "TR": "tripura", "MZ": "mizoram", "NL": "nagaland",
      "MN": "manipur", "ML": "meghalaya", "SK": "sikkim", "AR": "arunachal",
    };

    const vehicleState = statePrefixMap[rtoPrefix];
    if (!vehicleState) return true; // Assume interstate if prefix unknown

    let hasInterStateOrder = false;
    selectedGroups.forEach(group => {
      Object.values(group._ordersMap).forEach((order: any) => {
        const addr = (order.address || "").toLowerCase();
        if (!addr.includes(vehicleState)) {
          hasInterStateOrder = true;
        }
      });
    });

    return hasInterStateOrder;
  }, [selectedGroups, vehicleData.rto]);

  const handleFileChange = async (field: string, fileNameField: string, file: File | null, type: 'vehicle' | 'load' = 'vehicle') => {
    if (!file) return

    setIsUploading(field)
    try {
      const response = await orderApi.uploadFile(file)
      if (response.success) {
        if (type === 'vehicle') {
          setVehicleData(p => ({
            ...p,
            [field]: response.data.url,
            [fileNameField]: file.name
          }))
        } else {
          setLoadData(p => ({
            ...p,
            [field]: response.data.url,
            [fileNameField]: file.name
          }))
        }
        toast({
          title: "Upload Successful",
          description: `${file.name} has been uploaded.`,
        })
      }
    } catch (error: any) {
      console.error("Upload failed:", error)
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload file to S3",
        variant: "destructive",
      })
    } finally {
      setIsUploading(null)
    }
  }

  // --- Helper Functions ---
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

  const getSkuWeight = (productName: string): number => {
    if (!productName || skus.length === 0) return 0
    let matchedSku = skus.find(sku => sku.sku_name?.toUpperCase() === productName.toUpperCase())
    if (matchedSku) return matchedSku?.sku_weight ? parseFloat(matchedSku.sku_weight) : 0
    const normalizeSkuName = (name: string) => name.toUpperCase().replace(/KGS/g, 'KG').replace(/LTRS/g, 'LTR').replace(/\s+/g, ' ').trim()
    const normalizedProductName = normalizeSkuName(productName)
    matchedSku = skus.find(sku => normalizeSkuName(sku.sku_name || '') === normalizedProductName)
    if (matchedSku) return matchedSku?.sku_weight ? parseFloat(matchedSku.sku_weight) : 0
    matchedSku = skus.find(sku => {
      const normalizedSkuName = normalizeSkuName(sku.sku_name || '')
      return normalizedSkuName.includes(normalizedProductName) || normalizedProductName.includes(normalizedSkuName)
    })
    if (matchedSku) return matchedSku?.sku_weight ? parseFloat(matchedSku.sku_weight) : 0
    return 0
  }

  const getSkuGrossWeight = (productName: string): number => {
    if (!productName || skus.length === 0) return 0
    const normalizeSkuName = (name: string) => name.toUpperCase().replace(/KGS/g, 'KG').replace(/LTRS/g, 'LTR').replace(/\s+/g, ' ').trim()
    const normalizedProductName = normalizeSkuName(productName)
    let matchedSku = skus.find(sku => sku.sku_name?.toUpperCase() === productName.toUpperCase()) ||
      skus.find(sku => normalizeSkuName(sku.sku_name || '') === normalizedProductName) ||
      skus.find(sku => {
        const normalizedSkuName = normalizeSkuName(sku.sku_name || '')
        return normalizedSkuName.includes(normalizedProductName) || normalizedProductName.includes(normalizedSkuName)
      })
    
    const grossWeight = matchedSku?.gross_weight ? parseFloat(matchedSku.gross_weight) : 0
    const skuWeight = matchedSku?.sku_weight ? parseFloat(matchedSku.sku_weight) : 0
    
    return grossWeight > 0 ? grossWeight : skuWeight
  }

  const calculateWeight = (productName: string, qty: string | number): number => {
    const skuWeight = getSkuWeight(productName)
    const quantity = typeof qty === 'string' ? parseFloat(qty) || 0 : qty
    return skuWeight * quantity
  }

  const calculateGrossWeight = (productName: string, qty: string | number): number => {
    const skuGrossWeight = getSkuGrossWeight(productName)
    const quantity = typeof qty === 'string' ? parseFloat(qty) || 0 : qty
    return skuGrossWeight * quantity
  }

  // --- End Helpers ---

  const PAGE_COLUMNS = [
    { id: "partySoDate", label: "DO Date" },
    { id: "orderNo", label: "DO Number" },
    { id: "processId", label: "Process ID" },
    { id: "customerName", label: "Customer Name" },
    { id: "qtyToDispatch", label: "Qty to Dispatch" },
    { id: "deliveryFrom", label: "Delivery From" },
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
    { id: "dispatchfrom", label: "Dispatch from" },
    { id: "revertSecurityRemarks", label: "Revert(Security-Guard) Remarks" }
  ]

  const [visibleColumns, setVisibleColumns] = useState<string[]>([
    "partySoDate",
    "orderNo",
    "processId",
    "customerName",
    "qtyToDispatch",
    "deliveryFrom",
    "orderPunchRemarks",
    "status",
    "revertSecurityRemarks"
  ])

  // Pending query with numeric pagination
  const {
    data: pendingResult,
    isLoading: isPendingLoading,
    refetch: refetchPending,
  } = useQuery({
    queryKey: ["actual-dispatch-pending", filterValues, pendingPage, user?.depo_access?.['Actual Dispatch']],
    queryFn: async () => {
      const response = await actualDispatchApi.getPending({
        page: pendingPage,
        limit,
        search: filterValues.search,
        party_name: filterValues.partyName === "all" ? undefined : filterValues.partyName,
        depo_names: user?.depo_access?.['Actual Dispatch'] || []
      });
      return response.success ? response.data : { dispatches: [], pagination: { total: 0 } };
    },
    staleTime: 0,               // always consider data stale → refetch when navigating back
    refetchOnWindowFocus: true, // refetch when user switches browser tab back
  });

  // History query with numeric pagination
  const {
    data: historyResult,
    isLoading: isHistoryLoading,
    refetch: refetchHistory,
  } = useQuery({
    queryKey: ["actual-dispatch-history", filterValues, historyPage, user?.depo_access?.['Actual Dispatch']],
    queryFn: async () => {
      const response = await actualDispatchApi.getHistory({
        page: historyPage,
        limit,
        search: filterValues.search,
        party_name: filterValues.partyName === "all" ? undefined : filterValues.partyName,
        depo_names: user?.depo_access ? (user.depo_access['Actual Dispatch'] || []) : undefined
      });
      return response.success ? response.data : { dispatches: [], pagination: { total: 0 } };
    },
    enabled: activeTab === "history",
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const pendingOrders = useMemo(() => {
    return pendingResult?.dispatches || [];
  }, [pendingResult]);

  const historyOrders = useMemo(() => {
    return historyResult?.dispatches || [];
  }, [historyResult]);

  // Fetch SKU details for weight calculations
  const fetchSkus = async () => {
    try {
      console.log('[ACTUAL DISPATCH] Fetching SKUs for weight calculation...')
      const response = await skuApi.getAll({ limit: 1000 })
      console.log('[ACTUAL DISPATCH] SKU API Response:', response)

      if (response.success && response.data) {
        // Backend returns either an array (old) or an object with skuDetails (new)
        let skuArray = []
        if (Array.isArray(response.data)) {
          skuArray = response.data
        } else if (response.data.skuDetails && Array.isArray(response.data.skuDetails)) {
          skuArray = response.data.skuDetails
        } else if (typeof response.data === 'object') {
          // Robust fallback
          skuArray = response.data.skus || response.data.items || []
        }
        
        console.log(`[ACTUAL DISPATCH] Loaded ${skuArray.length} SKUs`)
        setSkus(skuArray)
      } else {
        console.error('[ACTUAL DISPATCH] SKU API returned no data:', response)
      }
    } catch (error: any) {
      console.error("[ACTUAL DISPATCH] Failed to fetch SKUs:", error)
    }
  }

  const fetchDepots = async () => {
    try {
      const response = await depotApi.getAll({ all: 'false' });
      if (response.success && response.data?.depots) {
        let depots = response.data.depots;

        // Filter by user permissions: strict deny-by-default even for admins.
        const allowedDepos = user?.depo_access?.['Actual Dispatch'] || [];
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
      console.error("[ACTUAL DISPATCH] Failed to fetch depots:", error);
    }
  };

  useEffect(() => {
    fetchSkus();
    fetchDepots();
  }, [user?.depo_access])

  const availableDepots = useMemo(() => {
    return activeDepots.map(d => d.depot_name);
  }, [activeDepots]);

  useEffect(() => {
    if (availableDepots.length > 0 && (!selectedDepoTab || !availableDepots.includes(selectedDepoTab))) {
      setSelectedDepoTab(availableDepots[0]);
    }
  }, [availableDepots, selectedDepoTab]);

  // Fetch dynamic filters
  useEffect(() => {
    const fetchFilters = async () => {
      try {
        const response = await actualDispatchApi.getFilters();
        if (response.success) {
          setFilterOptions(response.data);
        }
      } catch (error) {
        console.error("Failed to fetch filter options:", error);
      }
    };
    fetchFilters();
  }, []);

  const fetchMasterData = async () => {
    try {
      const [vRes, tRes] = await Promise.all([
        vehicleMasterApi.getAll({ all: 'true' }),
        transportMasterApi.getAll({ all: 'true' })
      ]);
      if (vRes.success) setVehicleMaster(vRes.data.vehicles || []);
      const dRes = await driverMasterApi.getAll({ all: 'true' });
      if (dRes.success) setDriverMaster(dRes.data.drivers || []);
      if (tRes.success) setTransporterMaster(tRes.data.transporters || []);
    } catch (error) {
      console.error("Failed to fetch master data:", error);
    }
  };

  useEffect(() => {
    fetchMasterData();
  }, []);

  // Reset pagination on filter change
  useEffect(() => {
    setPendingPage(1);
    setHistoryPage(1);
  }, [filterValues, selectedDepoTab]);

  // ── Refetch fresh data from DB whenever stage tab or depot tab changes ──
  useEffect(() => {
    if (activeTab === "pending") {
      refetchPending();
    } else if (activeTab === "history") {
      refetchHistory();
    }
  }, [activeTab, selectedDepoTab]);

  // Auto-calculate Net Weight (Gross - Tare)
  useEffect(() => {
    const gross = parseFloat(loadData.grossWeight) || 0
    const tare = parseFloat(loadData.tareWeight) || 0
    const net = gross - tare

    setLoadData(prev => ({
      ...prev,
      netWeightPacking: (loadData.grossWeight || loadData.tareWeight) ? net.toFixed(2) : prev.netWeightPacking
    }))
  }, [loadData.grossWeight, loadData.tareWeight])

  // Calculate Expected SKU Weight for calculations
  const totalPackingWeightFromSku = useMemo(() => {
    return selectedGroups.flatMap(g => g._allProducts)
      .filter((prod: any) => dialogSelectedProducts.includes(prod._rowKey))
      .reduce((total, prod) => {
        const rowKey = prod._rowKey
        return total + calculateGrossWeight(prod.productName, confirmDetails[rowKey]?.qty || prod.qtyToDispatch)
      }, 0)
  }, [selectedGroups, confirmDetails, skus, dialogSelectedProducts])

  // Auto-fill Gross Weight from calculated total packing weight
  useEffect(() => {
    if (totalPackingWeightFromSku > 0 && !loadData.grossWeight) {
      setLoadData(p => ({ ...p, grossWeight: totalPackingWeightFromSku.toFixed(2) }))
    }
  }, [totalPackingWeightFromSku])

  // Auto-calculate Total Weight and Difference
  const totalCombinedWeight = useMemo(() => {
    const packingWeight = totalPackingWeightFromSku || 0
    const extraWeight = parseFloat(loadData.extraWeight) || 0
    return packingWeight + extraWeight
  }, [totalPackingWeightFromSku, loadData.extraWeight])

  useEffect(() => {
    const net = parseFloat(loadData.netWeightPacking) || 0
    const diff = net - totalCombinedWeight

    setLoadData(prev => ({
      ...prev,
      differanceWeight: (loadData.netWeightPacking || totalCombinedWeight > 0) ? diff.toFixed(2) : ""
    }))
  }, [loadData.netWeightPacking, totalCombinedWeight])

  // Auto-update Actual Qty when selected products or their confirmed quantities change
  useEffect(() => {
    if (selectedGroups.length === 0) return;
    const totalQty = selectedGroups.flatMap(g => g._allProducts)
      .filter((p: any) => dialogSelectedProducts.includes(p._rowKey))
      .reduce((sum, p) => sum + parseFloat(confirmDetails[p._rowKey]?.qty || p.qtyToDispatch || "0"), 0);

    setLoadData(prev => ({
      ...prev,
      actualQty: String(totalQty)
    }));
  }, [dialogSelectedProducts, confirmDetails, selectedGroups]);


  /* Extract unique customer names */


  const filteredPendingOrders = pendingOrders.filter((order: any) => {
    let matches = true

    // Filter by Planned/Actual Status (Must have planned_1, must not have actual_1)
    if (order.planned_1 === null || order.planned_1 === undefined || order.actual_1 !== null) {
      matches = false
    }

    // Filter by Party Name
    const currentCustName = (order.transfer === 'yes' && order.bill_company_name) ? order.bill_company_name : (order.party_name || order.customerName)
    if (filterValues.partyName && filterValues.partyName !== "all" && currentCustName !== filterValues.partyName) {
      matches = false
    }

    // Filter by Date Range
    const orderDateStr = order.actualDispatchData?.confirmedAt || order.dispatchData?.dispatchDate || order.dispatchData?.dispatchedAt || order.timestamp
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

  const filteredHistory = useMemo(() => {
    return historyOrders.map((order: any) => ({
      ...order,
      rawData: order,
      orderNo: order.actualDispatchData?.orderNo || order.order_no || "-",
      customerName: (order.transfer === 'yes' && order.bill_company_name) ? order.bill_company_name : (order.party_name || order.customerName || "-"),
      timestamp: order.actualDispatchData?.confirmedAt || order.timestamp,
      date: new Date(order.actualDispatchData?.confirmedAt || order.timestamp || new Date()).toLocaleDateString("en-GB"),
      stage: "Actual Dispatch",
      status: "Completed",
      remarks: "Dispatch Confirmed",
    }))
  }, [historyOrders])

  const displayRows = useMemo(() => {
    const grouped: { [key: string]: any } = {}

    filteredPendingOrders.forEach((order: any) => {
      const custName = (order.transfer === 'yes' && order.bill_company_name) ? order.bill_company_name : (order.party_name || order.customerName || "Unknown")
      const doNumber = order.so_no || order.soNo || "DO/26-27/0001"
      // Group by Base DO (e.g. DO/26-27/0001 from DO/26-27/0001A)
      const baseDoMatch = doNumber.match(/^(DO[-\/](?:\d{2}-\d{2}\/)?\d+)/i)
      const baseDo = baseDoMatch ? baseDoMatch[1].toUpperCase() : doNumber

      // Group by DO Date (party_so_date)
      const groupKey = baseDo;

      if (!grouped[groupKey]) {
        grouped[groupKey] = {
          customerName: custName,
          _rowKey: groupKey,
          _allProducts: [],
          _productCount: 0,
          _ordersMap: {},
          _allBaseDos: new Set()
        }
      }

      grouped[groupKey]._allBaseDos.add(baseDo)

      if (!grouped[groupKey]._ordersMap[baseDo]) {
        const internalOrder = order.data?.orderData || order;
        const checklist = order.data?.checklistResults || {};

        grouped[groupKey]._ordersMap[baseDo] = {
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
          partySoDate: formatDate(internalOrder.party_so_date || internalOrder.partySoDate),
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
          uploadSo: internalOrder.upload_so || internalOrder.uploadSo || null,
          rateRightly: internalOrder.rate_is_rightly_as_per_current_market_rate || checklist.rate || "—",
          dealingInOrder: internalOrder.we_are_dealing_in_ordered_sku || checklist.sku || "—",
          partyCredit: internalOrder.party_credit_status || checklist.credit || "—",
          dispatchConfirmed: internalOrder.dispatch_date_confirmed || checklist.dispatch || "—",
          overallStatus: internalOrder.overall_status_of_order || checklist.overall || "—",
          orderConfirmation: internalOrder.order_confirmation_with_customer || checklist.confirm || "—",
          revertSecurityRemarks: order.revert_security_remarks || internalOrder.revert_security_remarks || order.revertSecurityRemarks || "—",
          grossWeight: internalOrder.gross_weight || "—",
          tareWeight: internalOrder.tare_weight || "—",
          netWeight: internalOrder.net_weight || "—",
          weightDiff: internalOrder.weight_diff || "—",
          extraWeight: internalOrder.extra_weight || "—",
          weightmentSlip: internalOrder.weightment_slip_copy || null,
          rstNo: internalOrder.rst_no || "—",
          weightDiffReason: internalOrder.reason_of_difference_in_weight_if_any_speacefic || "—"
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
        dsrNumber: order.d_sr_number,
        rate: order.final_rate || order.rate_of_material,
        processid: order.processid || null,
        uploadSo: order.upload_so || order.uploadSo || null
      }

      grouped[groupKey]._ordersMap[baseDo]._products.push(productMeta)
      grouped[groupKey]._allProducts.push(productMeta)
    })

    return Object.values(grouped).map((group: any) => {
      const firstOrderDetails = Object.values(group._ordersMap)[0] as any || {};
      return {
        ...group,
        ...firstOrderDetails, // Flatten all detail fields into the group object
        orderNo: Array.from(group._allBaseDos).join(", "),
        processId: group._allProducts[0]?.processid || "—",
        uploadSo: group._allProducts[0]?.uploadSo || group._allProducts[0]?.upload_so || null,
        qtyToDispatch: group._allProducts.reduce((sum: number, p: any) => sum + parseFloat(p.qtyToDispatch || 0), 0),
        orderPunchRemarks: Array.from(new Set(Object.values(group._ordersMap).map((o: any) => o.orderPunchRemarks))).filter(Boolean).join("; ") || "—",
        _productCount: group._allProducts.length
      };
    }).filter(group => {
      if (group._productCount <= 0) return false;
      if (!selectedDepoTab) return true;
      return (group.depoName || "").trim().toUpperCase() === selectedDepoTab.trim().toUpperCase();
    })
  }, [filteredPendingOrders, selectedDepoTab])

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


  const handleOpenDialog = async (group?: any) => {
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
        fitness_file_name: "",
        insurance_file_name: "",
        tax_file_name: "",
        pollution_file_name: "",
        permit1_file_name: "",
        permit2_file_name: "",
        fitness_end_date: "",
        insurance_end_date: "",
        tax_end_date: "",
        pollution_end_date: "",
        permit1_end_date: "",
        permit2_end_date: "",
        registration_no: "",
        vehicle_type: "",
        rto: "",
        passing_weight: "",
        road_tax: "",
        gvw: "",
        ulw: "",
      })
      setDriverName("")
      setDriverData({
        contact_no: "",
        license_no: "",
        valid_upto: ""
      })
      setLoadData({
        actualQty: String(targetGroups.flatMap(g => g._allProducts).reduce((sum, p) => sum + parseFloat(p.qtyToDispatch || "0"), 0)),
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
        weightmentSlip_file_name: "",
        vehicleNoPlateImage_file_name: "",
        overloadRemarks: "",
        freightRateType: "",
        freightAmount: "",
        cash_bank: "",
        diesel_advance: "",
        bhada: ""
      })

      // Silently restore saved draft if one exists
      if (user?.username && targetGroups.length > 0) {
        const orderKey = targetGroups[0]._rowKey;
        try {
          const res = await draftApi.get(user.username, orderKey);
          if (res.success && res.data?.draft_data) {
            const d = res.data.draft_data;
            if (d.vehicleNumber !== undefined) setVehicleNumber(d.vehicleNumber);
            if (d.vehicleData)    setVehicleData(prev => ({ ...prev, ...d.vehicleData }));
            if (d.loadData)       setLoadData(prev => ({ ...prev, ...d.loadData }));
            if (d.driverName)     setDriverName(d.driverName);
            if (d.driverData)     setDriverData(prev => ({ ...prev, ...d.driverData }));
            if (d.confirmDetails) setConfirmDetails(prev => ({ ...prev, ...d.confirmDetails }));
            if (d.dialogSelectedProducts) setDialogSelectedProducts(d.dialogSelectedProducts);
            toast({ title: "Draft Restored", description: "Your saved draft has been loaded." });
          }
        } catch {
          // Draft load failure is non-critical — silently ignore
        }
      }

      // Fetch gate-in status for this order
      setGateInData(null);
      if (targetGroups.length > 0) {
        const orderKey = targetGroups[0]._rowKey;
        try {
          const giRes = await gateInApi.check(orderKey);
          if (giRes.success && giRes.data) {
            setGateInData(giRes.data);
          }
        } catch {
          // Non-critical
        }
      }
    }
  }


  const toggleSelectDialogProduct = (key: string) => {
    if (dialogSelectedProducts.includes(key)) {
      setDialogSelectedProducts(prev => prev.filter(k => k !== key))
    } else {
      setDialogSelectedProducts(prev => [...prev, key])
    }
  }

  const handleSaveDraft = async () => {
    if (!user?.username || selectedGroups.length === 0) return;
    const orderKey = selectedGroups[0]._rowKey;
    const draftData = { 
      vehicleNumber, 
      vehicleData, 
      loadData, 
      confirmDetails, 
      dialogSelectedProducts, 
      driverName, 
      driverData,
      totalPackingWeight: totalPackingWeightFromSku 
    };

    setIsSavingDraft(true);
    try {
      const res = await draftApi.save(user.username, orderKey, draftData);
      if (res.success) {
        toast({ title: "Draft Saved", description: "Your progress has been saved. You can resume later." });
      } else {
        toast({ title: "Save Failed", description: res.message || "Could not save draft.", variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Save Failed", description: error?.message || "Could not save draft.", variant: "destructive" });
    } finally {
      setIsSavingDraft(false);
    }
  };

  const performDispatchConfirmation = async () => {
    // 1. Basic Vehicle Check
    if (!vehicleNumber.trim()) {
      toast({ title: "Validation Error", description: "Vehicle Registration Number is required", variant: "destructive" });
      return;
    }

    // 2. Stage 6: Vehicle Document Validation
    // ONLY IF DEPO IS BANARI
    const isBanari = selectedDepoTab?.toUpperCase() === 'BANARI';

    if (isBanari) {
      const vehicleDocs = [
        { key: 'fitness', label: 'Fitness' },
        { key: 'fitness_end_date', label: 'Fitness Expiry' },
        { key: 'insurance', label: 'Insurance' },
        { key: 'insurance_end_date', label: 'Insurance Expiry' },
        { key: 'tax_copy', label: 'Tax' },
        { key: 'tax_end_date', label: 'Tax Expiry' },
        { key: 'polution', label: 'Pollution' },
        { key: 'pollution_end_date', label: 'Pollution Expiry' },
        { key: 'permit1', label: 'Permit 1' },
        { key: 'permit1_end_date', label: 'Permit 1 Expiry' },
        { key: 'permit2_out_state', label: 'Permit 2' },
        { key: 'permit2_end_date', label: 'Permit 2 Expiry' },
      ];

      for (const doc of vehicleDocs) {
        const val = vehicleData[doc.key as keyof typeof vehicleData];
        // Skip required check for Permit 2 (both file and date are optional)
        if (doc.key === 'permit2_out_state' || doc.key === 'permit2_end_date') continue;

        if (!val) {
          toast({
            title: "Validation Error",
            description: `${doc.label} is required (Stage 6) for BANARI`,
            variant: "destructive"
          });
          return;
        }
      }

      if (!vehicleData.checkStatus) {
        toast({ title: "Validation Error", description: "Vehicle Check Status is required", variant: "destructive" });
        return;
      }
      // Remarks mandatory ONLY if status is Reject
      if (vehicleData.checkStatus === "Reject" && !vehicleData.remarks.trim()) {
        toast({ title: "Validation Error", description: "Vehicle Remarks are required for rejection", variant: "destructive" });
        return;
      }

      // 3. Stage 7: Weightment Audit Validation
      if (!loadData.actualQty || parseFloat(loadData.actualQty) <= 0) {
        toast({ title: "Validation Error", description: "Valid Actual Qty is required", variant: "destructive" });
        return;
      }
      if (!loadData.rstNo.trim()) {
        toast({ title: "Validation Error", description: "RST No is required", variant: "destructive" });
        return;
      }
      // Weightment Slip and No Plate Image are now optional per user request
      if (!loadData.grossWeight || parseFloat(loadData.grossWeight) <= 0) {
        toast({ title: "Validation Error", description: "Valid Gross Weight is required", variant: "destructive" });
        return;
      }
      if (!loadData.tareWeight || parseFloat(loadData.tareWeight) <= 0) {
        toast({ title: "Validation Error", description: "Valid Tare Weight is required", variant: "destructive" });
        return;
      }
      if (!loadData.checkStatus) {
        toast({ title: "Validation Error", description: "Quality Status (STG 7) is required", variant: "destructive" });
        return;
      }
      if (!loadData.transporterName.trim()) {
        toast({ title: "Validation Error", description: "Transporter Name is required", variant: "destructive" });
        return;
      }
      // Reason mandatory ONLY if status is Reject
      if (loadData.checkStatus === "Reject" && !loadData.reason.trim()) {
        toast({ title: "Validation Error", description: "Weight Difference Reason is required for load rejection", variant: "destructive" });
        return;
      }

      // 4. Validate Document End Dates (Min Today + 5 Days)
      const dateFields = [
        { key: 'fitness_end_date', label: 'Fitness' },
        { key: 'insurance_end_date', label: 'Insurance' },
        { key: 'tax_end_date', label: 'Tax' },
        { key: 'pollution_end_date', label: 'Pollution' },
        { key: 'permit1_end_date', label: 'Permit 1' },
        { key: 'permit2_end_date', label: 'Permit 2' },
      ];

      for (const field of dateFields) {
        const dateVal = vehicleData[field.key as keyof typeof vehicleData];
        if (dateVal && dateVal < minDate) {
          toast({
            title: "Date Error",
            description: `${field.label} End Date must be at least 5 days from today (Min: ${formatDate(minDate)})`,
            variant: "destructive"
          });
          return;
        }
      }
    }

    setIsProcessing(true)
    try {
      if (selectedGroups.length === 0 || dialogSelectedProducts.length === 0) {
        setIsDialogOpen(false);
        return;
      }

      // Validation for Overload
      const isOverloaded = totalCombinedWeight > (parseFloat(vehicleData.passing_weight) || 0);
      if (isOverloaded && !loadData.overloadRemarks.trim()) {
        toast({
          title: "Overload Check",
          description: "Overload remarks are mandatory as the vehicle is overloaded.",
          variant: "destructive"
        });
        setIsProcessing(false);
        return;
      }

      // Validation for Interstate Permit
      if (isInterState && (!vehicleData.permit2_end_date || !vehicleData.permit2_out_state || vehicleData.permit2_out_state === 'pending')) {
        toast({
          title: "Interstate Document Required",
          description: "National / Other State Permit is mandatory for interstate dispatches.",
          variant: "destructive"
        });
        setIsProcessing(false);
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
          // Combine ALL fields into one request
          const payload = {
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

            // End Dates
            fitness_end_date: vehicleData.fitness_end_date || null,
            insurance_end_date: vehicleData.insurance_end_date || null,
            tax_end_date: vehicleData.tax_end_date || null,
            pollution_end_date: vehicleData.pollution_end_date || null,
            permit1_end_date: vehicleData.permit1_end_date || null,
            permit2_end_date: vehicleData.permit2_end_date || null,

            // Stage 7 fields
            actual_qty: parseFloat(loadData.actualQty) || parseFloat(confirmedQty),
            weightment_slip_copy: loadData.weightmentSlip || "pending",
            rst_no: loadData.rstNo,
            gross_weight: parseFloat(loadData.grossWeight),
            tare_weight: parseFloat(loadData.tareWeight),
            net_weight: parseFloat(loadData.netWeightPacking) || null,
            transporter_name: loadData.transporterName,
            reason_of_difference_in_weight_if_any_speacefic: loadData.reason,
            truck_no: loadData.truckNo || vehicleNumber,
            vehicle_no_plate_image: loadData.vehicleNoPlateImage || "pending",
            extra_weight: parseFloat(loadData.extraWeight) || 0,
            difference: parseFloat(loadData.differanceWeight) || 0,
            registration_no: vehicleData.registration_no || null,
            vehicle_type: vehicleData.vehicle_type || null,
            vehicle_overload_remarks: loadData.overloadRemarks || null,
            gvw: parseFloat(vehicleData.gvw) || 0,
            ulw: parseFloat(vehicleData.ulw) || 0,
            passing_weight: parseFloat(vehicleData.passing_weight) || 0,
            rto: vehicleData.rto || null,
            road_tax: vehicleData.tax_end_date || null,
            driver_name: driverName || null,
            driver_contact_no: driverData.contact_no || null,
            driving_license_no: driverData.license_no || null,
            dl_valid_upto: driverData.valid_upto || null,
            cash_bank: parseFloat(loadData.cash_bank) || 0,
            diesel_advance: parseFloat(loadData.diesel_advance) || 0,
            bhada: parseFloat(loadData.bhada) || 0,
            username: user?.username || null // Add username for tracking
          };

          const res = await actualDispatchApi.submit(dsrNumber, payload);

          if (!res.success) throw new Error(res.message);

          successfulDispatches.push({ item, dsrNumber });
        } catch (error: any) {
          console.error('[SUBMISSION ERROR] Details:', {
            dsrNumber,
            error: error,
            message: error?.message || (error?.response?.data?.message) || 'Unknown error'
          });
          failedDispatches.push({ item, error: error?.message || 'Unknown error' });
        }
      }

      // Show results
      if (successfulDispatches.length > 0) {
        toast({
          title: "Dispatch, Vehicle & Load Confirmed",
          description: `${successfulDispatches.length} item(s) processed through all stages successfully.`,
        });

        // Clean up draft from DB after successful submission
        if (user?.username && selectedGroups.length > 0) {
          const orderKey = selectedGroups[0]._rowKey;
          try { await draftApi.delete(user.username, orderKey); } catch { /* non-critical */ }
        }

        setSelectedOrders([]);
        setIsDialogOpen(false);
        setConfirmDetails({});
        setSelectedGroups([]);
        setDialogSelectedProducts([]);

        await refetchPending();
        await refetchHistory();

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

  const handleRevert = async () => {
    if (!revertRemarks.trim()) {
      toast({ title: "Validation Error", description: "Revert remarks are required", variant: "destructive" });
      return;
    }

    setIsProcessing(true);
    try {
      const itemsToRevert = selectedGroups.flatMap(g =>
        g._allProducts.filter((p: any) => dialogSelectedProducts.includes(p._rowKey))
      );

      if (itemsToRevert.length === 0) {
        toast({ title: "Error", description: "No products selected to revert", variant: "destructive" });
        setIsProcessing(false);
        return;
      }

      const successfulReverts = [];
      const failedReverts = [];

      for (const item of itemsToRevert) {
        const dsrNumber = item.d_sr_number || item.dsrNumber;
        if (!dsrNumber) continue;

        try {
          const res = await actualDispatchApi.revert(dsrNumber, user?.username || 'system', revertRemarks.trim());
          if (res.success) {
            successfulReverts.push(dsrNumber);
          } else {
            failedReverts.push({ dsrNumber, message: res.message });
          }
        } catch (err: any) {
          failedReverts.push({ dsrNumber, message: err.message });
        }
      }

      if (successfulReverts.length > 0) {
        toast({
          title: "Revert Successful",
          description: `${successfulReverts.length} item(s) reverted to Pre-Approval.`,
        });

        // Reset and refresh
        setIsDialogOpen(false);
        setSelectedOrders([]);
        setDialogSelectedProducts([]);
        setConfirmDetails({});
        setSelectedGroups([]);
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

  return (
    <WorkflowStageShell
      title="Stage 5: Actual Dispatch"
      description="Confirm actual dispatch details before vehicle assignment."
      pendingCount={displayRows.length}
      historyData={filteredHistory}
      partyNames={filterOptions.customerNames}
      onFilterChange={setFilterValues}
      remarksColName="Confirmation"
      onTabChange={setActiveTab}
      isHistoryLoading={isHistoryLoading}
      showDateFilters={false}
      historyFooter={
        <div className="flex items-center justify-between px-4 py-3 border-t bg-slate-50/50 rounded-b-xl">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Showing Page <span className="text-slate-900 mx-1">{historyPage}</span>
            {historyResult?.pagination?.totalPages && (
              <> of <span className="text-slate-900 mx-1">{historyResult.pagination.totalPages}</span></>
            )}
            <span className="ml-2 text-[9px] lowercase italic font-normal text-slate-400">({historyResult?.pagination?.total || 0} items)</span>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
              disabled={historyPage === 1}
              className="h-8 rounded-lg font-bold shadow-sm bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              <ChevronLeft className="h-4 w-4 mr-1" /> Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setHistoryPage(p => p + 1)}
              disabled={historyPage >= (historyResult?.pagination?.totalPages || 1)}
              className="h-8 rounded-lg font-bold shadow-sm bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      }
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
            <DropdownMenuContent align="end" className="w-62.5 max-h-100 overflow-y-auto">
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
            title={isReadOnly ? "View Dispatch Details" : "Confirm Dispatch"}
          >
            Confirm Dispatch ({selectedOrders.length})
          </Button>
        </div>

        {availableDepots.length > 0 && (
          <div className="mt-4 mb-2">
            <Tabs value={selectedDepoTab} onValueChange={setSelectedDepoTab} className="w-full">
              <TabsList className="bg-slate-100/50 p-1 h-auto flex-wrap justify-start gap-1 border border-slate-200/60 rounded-xl shadow-sm">
                {availableDepots.map((depoName: string) => (
                  <TabsTrigger
                    key={depoName}
                    value={depoName}
                    className="px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-300 data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-md hover:bg-white/60 text-slate-500"
                  >
                    {depoName}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        )}

        <Card className="border-none shadow-sm overflow-auto max-h-150">
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
                              {row.has_draft ? (
                                <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200">Draft Saved</Badge>
                              ) : row.has_gate_in ? (
                                <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200">Ready for Dispatch</Badge>
                              ) : (
                                <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-blue-200">Ready for Gate In</Badge>
                              )}
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
                    No orders pending for actual dispatch
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <div className="flex items-center justify-between px-6 py-4 border-t bg-slate-50/50 rounded-b-2xl">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              Showing Page <span className="text-slate-900 mx-1">{displayRows.length > 0 ? pendingPage : 0}</span>
              {displayRows.length > 0 && (
                <> of <span className="text-slate-900 mx-1">
                  {/* Use raw backend row count to detect last page, not grouped displayRows */}
                  {pendingOrders.length < limit ? pendingPage : (pendingResult?.pagination?.totalPages || 1)}
                </span></>
              )}
              <span className="ml-2 text-slate-300">|</span>
              <span className="ml-2 text-[10px] lowercase italic font-normal text-slate-400">{displayRows.length} item{displayRows.length !== 1 ? 's' : ''} in this depot</span>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPendingPage(p => Math.max(1, p - 1))}
                disabled={pendingPage === 1 || displayRows.length === 0}
                className="h-8 rounded-lg font-bold shadow-sm bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                <ChevronLeft className="h-4 w-4 mr-1" /> Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPendingPage(p => p + 1)}
                disabled={
                  displayRows.length === 0 ||
                  pendingOrders.length < limit || // backend returned less than a full page = last page
                  pendingPage >= (pendingResult?.pagination?.totalPages || 1)
                }
                className="h-8 rounded-lg font-bold shadow-sm bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>



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

            {/* Gate-In Status Banner */}
            <div className={`flex items-center gap-3 px-5 py-3 rounded-xl mb-4 border-2 ${gateInData ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
              <button
                type="button"
                onClick={() => { if (gateInData) setIsGateInPopupOpen(true); }}
                className={`flex items-center gap-2 font-black text-sm uppercase tracking-tight ${gateInData ? 'text-emerald-700 cursor-pointer hover:underline' : 'text-red-600 cursor-default'}`}
              >
                {gateInData
                  ? <><CheckCircle2 className="h-5 w-5 text-emerald-500" /> Gate-In Verified — Click to View Images</>
                  : <><XCircle className="h-5 w-5 text-red-400" /> Gate-In Not Done Yet</>
                }
              </button>
            </div>

            {/* Gate-In Images Popup */}
            {isGateInPopupOpen && gateInData && (
              <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60" onClick={() => setIsGateInPopupOpen(false)}>
                <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-2xl w-full mx-4" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                      <CheckCircle2 className="h-6 w-6 text-emerald-500" /> Gate-In Images
                    </h3>
                    <button type="button" onClick={() => setIsGateInPopupOpen(false)} className="text-slate-400 hover:text-slate-700 text-2xl font-black">✕</button>
                  </div>
                  <div className="text-xs text-slate-500 font-semibold mb-4">
                    Submitted by <span className="text-slate-800">{gateInData.username}</span> on{" "}
                    {gateInData.submitted_at ? new Date(gateInData.submitted_at).toLocaleString("en-GB") : "—"}
                  </div>
                  <div className="grid grid-cols-4 gap-4">
                    {[
                      { label: "Front Vehicle", url: gateInData.front_vehicle_image },
                      { label: "Back Vehicle",  url: gateInData.back_vehicle_image },
                      { label: "Driver Photo",  url: gateInData.driver_photo },
                      { label: "Gatepass Photo", url: gateInData.gatepass_photo },
                    ].map(img => (
                      <div key={img.label} className="flex flex-col items-center gap-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{img.label}</span>
                        {img.url ? (
                          <a href={img.url} target="_blank" rel="noopener noreferrer">
                            <img src={img.url} alt={img.label} className="w-full h-40 object-cover rounded-xl border-2 border-slate-200 hover:opacity-90 transition-opacity cursor-zoom-in shadow" />
                          </a>
                        ) : (
                          <div className="w-full h-40 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center text-xs text-slate-400 font-bold">NO IMAGE</div>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-end mt-6">
                    <Button onClick={() => setIsGateInPopupOpen(false)} className="bg-emerald-600 hover:bg-emerald-700 font-black">
                      <CheckCircle2 className="h-4 w-4 mr-2" /> Confirm & Close
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {selectedGroups.length > 0 && (
              <div className="space-y-12 mt-6">
                {/* 1. Multi-Customer Interleaved Details */}
                {selectedGroups.map((group, groupIdx) => {
                  return (
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
                                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">DO Date</p>
                                    <p className="text-sm font-bold text-slate-900 leading-tight">{orderDetails.partySoDate || "—"}</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">RST No</p>
                                    {orderDetails.weightmentSlip || orderDetails.weightment_slip_copy ? (
                                      <a href={orderDetails.weightmentSlip || orderDetails.weightment_slip_copy} target="_blank" rel="noopener noreferrer" className="text-sm font-black text-blue-600 hover:text-blue-800 underline leading-tight">
                                        #{orderDetails.rstNo || orderDetails.rst_no || "—"}
                                      </a>
                                    ) : (
                                      <p className="text-sm font-bold text-slate-900 leading-tight">#{orderDetails.rstNo || orderDetails.rst_no || "—"}</p>
                                    )}
                                  </div>
                                  <div>
                                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">Gross / Tare / Net</p>
                                    <p className="text-sm font-black text-slate-900 leading-tight">
                                      {orderDetails.grossWeight} / {orderDetails.tareWeight} / <span className="text-blue-600 font-black">{((Number(orderDetails.grossWeight || 0) - Number(orderDetails.tareWeight || 0)) || "0").toString()}</span>
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">Weight Diff</p>
                                    <p className="text-sm font-black text-amber-600 leading-tight">{orderDetails.weightDiff}</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">Extra Weight</p>
                                    <p className="text-sm font-black text-purple-600 leading-tight">{orderDetails.extraWeight || orderDetails.extra_weight || "0"}</p>
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
                                  <div className="col-span-2 bg-amber-50 p-4 rounded-xl border border-amber-100 flex items-start gap-4">
                                    <div className="bg-amber-100 p-2 rounded-lg">
                                      <Settings2 className="h-5 w-5 text-amber-600" />
                                    </div>
                                    <div>
                                      <p className="text-[11px] text-amber-800 font-black uppercase tracking-widest mb-1 leading-none">Order Punch Remarks</p>
                                      <p className="text-sm font-medium text-slate-700 italic leading-snug">"{group.orderPunchRemarks || "No special instructions provided."}"</p>
                                    </div>
                                  </div>
                                  <div className={cn(
                                    "col-span-2 p-4 rounded-xl border flex items-start gap-4 transition-all duration-300",
                                    group.uploadSo 
                                      ? "bg-blue-50 border-blue-100 hover:bg-blue-100 cursor-pointer group" 
                                      : "bg-slate-50 border-slate-100 opacity-60"
                                  )}
                                  onClick={() => {
                                    if (group.uploadSo) {
                                      window.open(group.uploadSo, '_blank');
                                    }
                                  }}>
                                    <div className={cn(
                                      "p-2 rounded-lg",
                                      group.uploadSo ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-400"
                                    )}>
                                      <FileText className="h-5 w-5" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className={cn(
                                        "text-[11px] font-black uppercase tracking-widest mb-1 leading-none",
                                        group.uploadSo ? "text-blue-800" : "text-slate-500"
                                      )}>PO Copy (SO Upload)</p>
                                      {group.uploadSo ? (
                                        <div className="flex items-center gap-1">
                                          <p className="text-sm font-bold text-blue-700 truncate">View Attachment</p>
                                          <ExternalLink className="h-3 w-3 text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </div>
                                      ) : (
                                        <p className="text-sm font-medium text-slate-400 italic">No attachment</p>
                                      )}
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
                  );
                })}

                {/* 2. Consolidated Product Table */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b-2 border-slate-100 pb-4">
                    <h3 className="text-xl font-black text-slate-800 flex items-center gap-2 uppercase tracking-tight">
                      Consolidated Product List
                      <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 text-sm px-3">{dialogSelectedProducts.length} / {selectedGroups.reduce((s, g) => s + g._allProducts.length, 0)} Items</Badge>
                    </h3>
                  </div>

                  <div className="border border-slate-200 rounded-3xl overflow-hidden shadow-sm bg-white">
                    <Table>
                      <TableHeader className="bg-slate-50 sticky top-0 z-10">
                        <TableRow>
                          <TableHead className="w-12.5 text-center text-[10px] uppercase font-black text-slate-500 tracking-wider">
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
                          <TableHead className="w-45 text-[10px] uppercase font-black text-slate-500 tracking-wider">ACTUAL QTY DISPATCHED</TableHead>
                          <TableHead className="w-30 text-[10px] uppercase font-black text-slate-500 tracking-wider text-center">GROSS WEIGHT (KG)</TableHead>
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
                                  className="h-10 text-xs font-black border-2 border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 transition-colors shadow-sm"
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
                                  {calculateGrossWeight(prod.productName, confirmDetails[rowKey]?.qty || prod.qtyToDispatch).toFixed(2)} kg
                                </div>
                              </TableCell>
                              <TableCell className="p-3 text-center">
                                <Badge variant="outline" className="text-[9px] bg-orange-50 text-orange-700 border-orange-200 uppercase font-black px-2 py-0.5">Pending</Badge>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                        {/* Total Weight Row - only includes SELECTED products */}
                        <TableRow className="bg-purple-50 border-t-2 border-purple-200">
                          <TableCell colSpan={3} className="text-right p-4 font-black text-xs uppercase text-purple-900 tracking-wider">
                            TOTALS:
                          </TableCell>
                          <TableCell className="p-4 text-center">
                            <div className="font-black text-sm text-purple-700">
                              {selectedGroups.flatMap(g => g._allProducts).filter((p: any) => dialogSelectedProducts.includes(p._rowKey)).reduce((sum, p) => sum + parseFloat(p.qtyToDispatch || "0"), 0)}
                            </div>
                          </TableCell>
                          <TableCell />
                          <TableCell className="p-4 text-center">
                            <div className="font-black text-sm text-purple-700">
                              {selectedGroups.flatMap(g => g._allProducts).filter((p: any) => dialogSelectedProducts.includes(p._rowKey)).reduce((sum, p) => sum + parseFloat(confirmDetails[p._rowKey]?.qty || p.qtyToDispatch || "0"), 0)}
                            </div>
                          </TableCell>
                          <TableCell className="p-4 text-center">
                            <div className="flex flex-col items-center">
                              <span className="text-[9px] font-black text-purple-400 uppercase tracking-tighter mb-1">TOTAL PACKING WEIGHT</span>
                              <div className="font-black text-lg text-purple-700">
                                {selectedGroups.flatMap(g => g._allProducts)
                                  .filter((prod: any) => dialogSelectedProducts.includes(prod._rowKey))
                                  .reduce((total, prod) => {
                                    const rowKey = prod._rowKey
                                    return total + calculateGrossWeight(prod.productName, confirmDetails[rowKey]?.qty || prod.qtyToDispatch)
                                  }, 0).toFixed(2)} kg
                              </div>
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
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Vehicle Registration Number <span className="text-red-500">*</span></Label>
                            <Select 
                              value={vehicleNumber} 
                              onValueChange={(v) => {
                                setVehicleNumber(v);
                                const selectedV = vehicleMaster.find(veh => veh.registration_no === v);
                                if (selectedV) {
                                  // Autofill Logic
                                  setVehicleData(p => ({
                                    ...p,
                                    registration_no: selectedV.registration_no || "",
                                    vehicle_type: selectedV.vehicle_type || "",
                                    rto: selectedV.rto || "",
                                    passing_weight: selectedV.passing || "",
                                    fitness_end_date: selectedV.fitness ? new Date(selectedV.fitness).toISOString().split('T')[0] : "",
                                    insurance_end_date: selectedV.insurance ? new Date(selectedV.insurance).toISOString().split('T')[0] : "",
                                    tax_end_date: selectedV.road_tax ? new Date(selectedV.road_tax).toISOString().split('T')[0] : "",
                                    pollution_end_date: selectedV.pollution ? new Date(selectedV.pollution).toISOString().split('T')[0] : "",
                                    permit1_end_date: selectedV.state_permit ? new Date(selectedV.state_permit).toISOString().split('T')[0] : "",
                                    // Images
                                    fitness: selectedV.fitness_image || p.fitness,
                                    insurance: selectedV.insurance_image || p.insurance,
                                    tax_copy: selectedV.road_tax_image || p.tax_copy,
                                    polution: selectedV.pollution_image || p.polution,
                                    permit1: selectedV.state_permit_image || p.permit1,
                                    gvw: selectedV.gvw || "",
                                    ulw: selectedV.ulw || "",
                                  }));
                                  setLoadData(p => ({
                                    ...p,
                                    truckNo: selectedV.registration_no || "",
                                    transporterName: selectedV.transporter || p.transporterName,
                                    grossWeight: selectedV.gvw || p.grossWeight,
                                    tareWeight: selectedV.ulw || p.tareWeight
                                  }));
                                }
                              }}
                            >
                              <SelectTrigger className="h-12 border-2 border-slate-200 rounded-xl px-4 font-black text-lg focus:border-purple-500 transition-colors uppercase bg-white shadow-sm">
                                <SelectValue placeholder="Select Vehicle" />
                              </SelectTrigger>
                              <SelectContent className="max-h-[300px]">
                                {vehicleMaster.map(v => (
                                  <SelectItem key={v.id} value={v.registration_no} className="font-bold">{v.registration_no}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Driver Name <span className="text-red-500">*</span></Label>
                            <Select 
                              value={driverName} 
                              onValueChange={(v) => {
                                setDriverName(v);
                                const selectedD = driverMaster.find(d => d.driver_name === v);
                                if (selectedD) {
                                  setDriverData({
                                    contact_no: selectedD.mobile_no || "",
                                    license_no: selectedD.driving_licence_no || "",
                                    valid_upto: selectedD.valid_upto ? new Date(selectedD.valid_upto).toISOString().split('T')[0] : ""
                                  });
                                }
                              }}
                            >
                              <SelectTrigger className="h-12 border-2 border-slate-200 rounded-xl px-4 font-black text-lg focus:border-purple-500 transition-colors uppercase bg-white shadow-sm">
                                <SelectValue placeholder="Select Driver" />
                              </SelectTrigger>
                              <SelectContent className="max-h-[300px]">
                                {driverMaster.map(d => (
                                  <SelectItem key={d.id} value={d.driver_name} className="font-bold">{d.driver_name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Vehicle Details Badges */}
                          <div className="grid grid-cols-2 gap-2 mt-auto pb-1">
                             <div className="bg-white border-2 border-slate-100 rounded-xl px-3 py-1.5 shadow-sm">
                                <p className="text-[8px] font-black uppercase text-slate-400 leading-none mb-1">Type</p>
                                <p className="text-[11px] font-black text-slate-700 uppercase leading-none">{vehicleData.vehicle_type || '---'}</p>
                             </div>
                             <div className="bg-white border-2 border-slate-100 rounded-xl px-3 py-1.5 shadow-sm">
                                <p className="text-[8px] font-black uppercase text-slate-400 leading-none mb-1">RTO</p>
                                <p className="text-[11px] font-black text-slate-700 uppercase leading-none">{vehicleData.rto || '---'}</p>
                             </div>
                             <div className="bg-white border-2 border-slate-100 rounded-xl px-3 py-1.5 shadow-sm">
                                <p className="text-[8px] font-black uppercase text-slate-400 leading-none mb-1">Pass Wt</p>
                                <p className={cn("text-[11px] font-black uppercase leading-none", (totalCombinedWeight > (parseFloat(vehicleData.passing_weight) || 0)) ? "text-red-600" : "text-purple-600")}>
                                  {vehicleData.passing_weight || '0.00'} KG
                                </p>
                             </div>
                             <div className="bg-white border-2 border-slate-100 rounded-xl px-3 py-1.5 shadow-sm">
                                <p className="text-[8px] font-black uppercase text-slate-400 leading-none mb-1">GVW</p>
                                <p className="text-[11px] font-black text-slate-700 uppercase leading-none">{vehicleData.gvw || '---'} KG</p>
                             </div>
                             <div className="bg-white border-2 border-slate-100 rounded-xl px-3 py-1.5 shadow-sm">
                                <p className="text-[8px] font-black uppercase text-slate-400 leading-none mb-1">ULW</p>
                                <p className="text-[11px] font-black text-slate-700 uppercase leading-none">{vehicleData.ulw || '---'} KG</p>
                             </div>
                           </div>

                           {/* Driver Details Badges */}
                           <div className="grid grid-cols-2 gap-2 mt-2">
                              <div className="bg-white border-2 border-slate-100 rounded-xl px-3 py-1.5 shadow-sm">
                                 <p className="text-[8px] font-black uppercase text-slate-400 leading-none mb-1">Contact</p>
                                 <p className="text-[11px] font-black text-slate-700 uppercase leading-none">{driverData.contact_no || '---'}</p>
                              </div>
                              <div className="bg-white border-2 border-slate-100 rounded-xl px-3 py-1.5 shadow-sm">
                                 <p className="text-[8px] font-black uppercase text-slate-400 leading-none mb-1">License No</p>
                                 <p className="text-[11px] font-black text-slate-700 uppercase leading-none">{driverData.license_no || '---'}</p>
                              </div>
                              <div className="bg-white border-2 border-slate-100 rounded-xl px-3 py-1.5 shadow-sm">
                                 <p className="text-[8px] font-black uppercase text-slate-400 leading-none mb-1">Valid Upto</p>
                                 <p className="text-[11px] font-black text-slate-700 uppercase leading-none">{formatDate(driverData.valid_upto) || '---'}</p>
                              </div>
                           </div>
                        </div>

                      <div className="pt-4 border-t border-slate-200">
                        <p className="text-[10px] font-black uppercase text-slate-400 mb-3 tracking-widest leading-none">Digital Documents (STAGE 6)</p>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-white border border-dashed border-slate-300 rounded-xl p-2.5 flex flex-col gap-2 group cursor-pointer hover:border-purple-400 transition-colors">
                            <div className="flex items-center justify-between w-full">
                              <span className="text-[10px] font-black text-slate-500 group-hover:text-purple-600 transition-colors uppercase">
                                Fitness <span className="text-red-500">*</span> {vehicleData.fitness_file_name && <span className="text-purple-500 normal-case font-medium ml-1">({vehicleData.fitness_file_name})</span>}
                              </span>
                               <div className="flex items-center gap-2">
                                 {vehicleData.fitness && vehicleData.fitness !== 'pending' ? (
                                   <a 
                                     href={vehicleData.fitness} 
                                     target="_blank" 
                                     className="bg-purple-100 text-[9px] font-black px-2.5 py-1 rounded-lg text-purple-700 hover:bg-purple-600 hover:text-white transition-all shadow-sm"
                                   >
                                     VIEW
                                   </a>
                                 ) : (
                                   <>
                                     <Input type="file" className="hidden" id="fitness-doc" onChange={(e) => handleFileChange('fitness', 'fitness_file_name', e.target.files?.[0] || null)} />
                                     <Label htmlFor="fitness-doc" title="Max file size: 10 MB" className="bg-slate-100 text-[9px] font-black px-2.5 py-1 rounded-lg text-slate-600 group-hover:bg-purple-600 group-hover:text-white transition-all cursor-pointer">
                                       {isUploading === 'fitness' ? "..." : (vehicleData.fitness_file_name ? 'REPLACE' : 'UPLOAD')}
                                     </Label>
                                   </>
                                 )}
                               </div>
                            </div>
                            <Input
                              type="date"
                              className="h-7 text-[10px] border-slate-200 rounded-lg px-2 font-bold focus:border-purple-500 transition-colors bg-slate-100 cursor-not-allowed opacity-80"
                              min={minDate}
                              value={vehicleData.fitness_end_date}
                              onChange={(e) => setVehicleData(p => ({ ...p, fitness_end_date: e.target.value }))}
                              readOnly
                            />
                          </div>
                          <div className="bg-white border border-dashed border-slate-300 rounded-xl p-2.5 flex flex-col gap-2 group cursor-pointer hover:border-purple-400 transition-colors">
                            <div className="flex items-center justify-between w-full">
                              <span className="text-[10px] font-black text-slate-500 group-hover:text-purple-600 transition-colors uppercase">
                                Insurance <span className="text-red-500">*</span> {vehicleData.insurance_file_name && <span className="text-purple-500 normal-case font-medium ml-1">({vehicleData.insurance_file_name})</span>}
                              </span>
                               <div className="flex items-center gap-2">
                                 {vehicleData.insurance && vehicleData.insurance !== 'pending' ? (
                                   <a 
                                     href={vehicleData.insurance} 
                                     target="_blank" 
                                     className="bg-purple-100 text-[9px] font-black px-2.5 py-1 rounded-lg text-purple-700 hover:bg-purple-600 hover:text-white transition-all shadow-sm"
                                   >
                                     VIEW
                                   </a>
                                 ) : (
                                   <>
                                     <Input type="file" className="hidden" id="ins-doc" onChange={(e) => handleFileChange('insurance', 'insurance_file_name', e.target.files?.[0] || null)} />
                                     <Label htmlFor="ins-doc" title="Max file size: 10 MB" className="bg-slate-100 text-[9px] font-black px-2.5 py-1 rounded-lg text-slate-600 group-hover:bg-purple-600 group-hover:text-white transition-all cursor-pointer">
                                       {isUploading === 'insurance' ? "..." : (vehicleData.insurance_file_name ? 'REPLACE' : 'UPLOAD')}
                                     </Label>
                                   </>
                                 )}
                               </div>
                            </div>
                            <Input
                              type="date"
                              className="h-7 text-[10px] border-slate-200 rounded-lg px-2 font-bold focus:border-purple-500 transition-colors bg-slate-100 cursor-not-allowed opacity-80"
                              min={minDate}
                              value={vehicleData.insurance_end_date}
                              onChange={(e) => setVehicleData(p => ({ ...p, insurance_end_date: e.target.value }))}
                              readOnly
                            />
                          </div>
                          <div className="bg-white border border-dashed border-slate-300 rounded-xl p-2.5 flex flex-col gap-2 group cursor-pointer hover:border-purple-400 transition-colors">
                            <div className="flex items-center justify-between w-full">
                              <span className="text-[10px] font-black text-slate-500 group-hover:text-purple-600 transition-colors uppercase">
                                Tax Copy <span className="text-red-500">*</span> {vehicleData.tax_file_name && <span className="text-purple-500 normal-case font-medium ml-1">({vehicleData.tax_file_name})</span>}
                              </span>
                               <div className="flex items-center gap-2">
                                 {vehicleData.tax_copy && vehicleData.tax_copy !== 'pending' ? (
                                   <a 
                                     href={vehicleData.tax_copy} 
                                     target="_blank" 
                                     className="bg-purple-100 text-[9px] font-black px-2.5 py-1 rounded-lg text-purple-700 hover:bg-purple-600 hover:text-white transition-all shadow-sm"
                                   >
                                     VIEW
                                   </a>
                                 ) : (
                                   <>
                                     <Input type="file" className="hidden" id="tax-doc" onChange={(e) => handleFileChange('tax_copy', 'tax_file_name', e.target.files?.[0] || null)} />
                                     <Label htmlFor="tax-doc" title="Max file size: 10 MB" className="bg-slate-100 text-[9px] font-black px-2.5 py-1 rounded-lg text-slate-600 group-hover:bg-purple-600 group-hover:text-white transition-all cursor-pointer">
                                       {isUploading === 'tax_copy' ? "..." : (vehicleData.tax_file_name ? 'REPLACE' : 'UPLOAD')}
                                     </Label>
                                   </>
                                 )}
                               </div>
                            </div>
                            <Input
                              type="date"
                              className="h-7 text-[10px] border-slate-200 rounded-lg px-2 font-bold focus:border-purple-500 transition-colors bg-slate-100 cursor-not-allowed opacity-80"
                              min={minDate}
                              value={vehicleData.tax_end_date}
                              onChange={(e) => setVehicleData(p => ({ ...p, tax_end_date: e.target.value }))}
                              readOnly
                            />
                          </div>
                          <div className="bg-white border border-dashed border-slate-300 rounded-xl p-2.5 flex flex-col gap-2 group cursor-pointer hover:border-purple-400 transition-colors">
                            <div className="flex items-center justify-between w-full">
                              <span className="text-[10px] font-black text-slate-500 group-hover:text-purple-600 transition-colors uppercase">
                                Pollution <span className="text-red-500">*</span> {vehicleData.pollution_file_name && <span className="text-purple-500 normal-case font-medium ml-1">({vehicleData.pollution_file_name})</span>}
                              </span>
                               <div className="flex items-center gap-2">
                                 {vehicleData.polution && vehicleData.polution !== 'pending' ? (
                                   <a 
                                     href={vehicleData.polution} 
                                     target="_blank" 
                                     className="bg-purple-100 text-[9px] font-black px-2.5 py-1 rounded-lg text-purple-700 hover:bg-purple-600 hover:text-white transition-all shadow-sm"
                                   >
                                     VIEW
                                   </a>
                                 ) : (
                                   <>
                                     <Input type="file" className="hidden" id="poll-doc" onChange={(e) => handleFileChange('polution', 'pollution_file_name', e.target.files?.[0] || null)} />
                                     <Label htmlFor="poll-doc" title="Max file size: 10 MB" className="bg-slate-100 text-[9px] font-black px-2.5 py-1 rounded-lg text-slate-600 group-hover:bg-purple-600 group-hover:text-white transition-all cursor-pointer">
                                       {isUploading === 'polution' ? "..." : (vehicleData.pollution_file_name ? 'REPLACE' : 'UPLOAD')}
                                     </Label>
                                   </>
                                 )}
                               </div>
                            </div>
                            <Input
                              type="date"
                              className="h-7 text-[10px] border-slate-200 rounded-lg px-2 font-bold focus:border-purple-500 transition-colors bg-slate-100 cursor-not-allowed opacity-80"
                              min={minDate}
                              value={vehicleData.pollution_end_date}
                              onChange={(e) => setVehicleData(p => ({ ...p, pollution_end_date: e.target.value }))}
                              readOnly
                            />
                          </div>
                          <div className="bg-white border border-dashed border-slate-300 rounded-xl p-2.5 flex flex-col gap-2 group cursor-pointer hover:border-purple-400 transition-colors">
                            <div className="flex items-center justify-between w-full">
                              <span className="text-[10px] font-black text-slate-500 group-hover:text-purple-600 transition-colors uppercase">
                                State Permit <span className="text-red-500">*</span> {vehicleData.permit1_file_name && <span className="text-purple-500 normal-case font-medium ml-1">({vehicleData.permit1_file_name})</span>}
                              </span>
                               <div className="flex items-center gap-2">
                                 {vehicleData.permit1 && vehicleData.permit1 !== 'pending' ? (
                                   <a 
                                     href={vehicleData.permit1} 
                                     target="_blank" 
                                     className="bg-purple-100 text-[9px] font-black px-2.5 py-1 rounded-lg text-purple-700 hover:bg-purple-600 hover:text-white transition-all shadow-sm"
                                   >
                                     VIEW
                                   </a>
                                 ) : (
                                   <>
                                     <Input type="file" className="hidden" id="permit1-doc" onChange={(e) => handleFileChange('permit1', 'permit1_file_name', e.target.files?.[0] || null)} />
                                     <Label htmlFor="permit1-doc" title="Max file size: 10 MB" className="bg-slate-100 text-[9px] font-black px-2.5 py-1 rounded-lg text-slate-600 group-hover:bg-purple-600 group-hover:text-white transition-all cursor-pointer">
                                       {isUploading === 'permit1' ? "..." : (vehicleData.permit1_file_name ? 'REPLACE' : 'UPLOAD')}
                                     </Label>
                                   </>
                                 )}
                               </div>
                            </div>
                            <Input
                              type="date"
                              className="h-7 text-[10px] border-slate-200 rounded-lg px-2 font-bold focus:border-purple-500 transition-colors bg-slate-100 cursor-not-allowed opacity-80"
                              min={minDate}
                              value={vehicleData.permit1_end_date}
                              onChange={(e) => setVehicleData(p => ({ ...p, permit1_end_date: e.target.value }))}
                              readOnly
                            />
                          </div>
                          <div className={cn(
                            "bg-white border border-dashed border-slate-300 rounded-xl p-2.5 flex flex-col gap-2 group transition-colors",
                            !isInterState ? "opacity-40 grayscale cursor-not-allowed bg-slate-50 border-slate-200" : "hover:border-purple-400 cursor-pointer"
                          )}>
                            <div className="flex items-center justify-between w-full">
                              <span className={cn(
                                "text-[10px] font-black uppercase transition-colors",
                                isInterState ? "text-slate-500 group-hover:text-purple-600" : "text-slate-400"
                              )}>
                                National / Other State Permit {isInterState && <span className="text-red-500">*</span>} {vehicleData.permit2_file_name && <span className="text-purple-500 normal-case font-medium ml-1">({vehicleData.permit2_file_name})</span>}
                              </span>
                               <div className="flex items-center gap-2">
                                 {vehicleData.permit2_out_state && vehicleData.permit2_out_state !== 'pending' ? (
                                   <a 
                                     href={vehicleData.permit2_out_state} 
                                     target="_blank" 
                                     className="bg-purple-100 text-[9px] font-black px-2.5 py-1 rounded-lg text-purple-700 hover:bg-purple-600 hover:text-white transition-all shadow-sm"
                                   >
                                     VIEW
                                   </a>
                                 ) : (
                                   <>
                                     <Input 
                                       type="file" 
                                       className="hidden" 
                                       id="permit2-doc" 
                                       disabled={!isInterState}
                                       onChange={(e) => handleFileChange('permit2_out_state', 'permit2_file_name', e.target.files?.[0] || null)} 
                                     />
                                     <Label
                                       htmlFor="permit2-doc"
                                       title="Max file size: 10 MB"
                                       className={cn(
                                         "text-[9px] font-black px-2.5 py-1 rounded-lg transition-all",
                                         isInterState ? "bg-slate-100 text-slate-600 hover:bg-purple-600 hover:text-white cursor-pointer" : "bg-slate-200 text-slate-400 cursor-not-allowed"
                                       )}
                                     >
                                       {isUploading === 'permit2_out_state' ? "..." : (vehicleData.permit2_file_name ? 'REPLACE' : 'UPLOAD')}
                                     </Label>
                                   </>
                                 )}
                               </div>
                            </div>
                            <Input
                              type="date"
                              className={cn(
                                "h-7 text-[10px] border-slate-200 rounded-lg px-2 font-bold focus:border-purple-500 transition-colors",
                                isInterState ? "bg-white" : "bg-slate-100 cursor-not-allowed"
                              )}
                              min={minDate}
                              value={vehicleData.permit2_end_date}
                              onChange={(e) => setVehicleData(p => ({ ...p, permit2_end_date: e.target.value }))}
                              disabled={!isInterState}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="pt-4 border-t border-slate-200 grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Check Status <span className="text-red-500">*</span></Label>
                          <Select value={vehicleData.checkStatus} onValueChange={(v) => setVehicleData(p => ({ ...p, checkStatus: v }))}>
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
                          <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">
                            Remarks {vehicleData.checkStatus === "Reject" ? <span className="text-red-500">*</span> : <span className="text-slate-400 font-normal normal-case">(Optional)</span>}
                          </Label>
                          <Input
                            placeholder="Add notes..."
                            className="h-12 border-2 border-slate-200 rounded-xl bg-white font-medium focus:border-purple-500 transition-colors"
                            value={vehicleData.remarks}
                            onChange={(e) => setVehicleData(p => ({ ...p, remarks: e.target.value }))}
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
                          <Label className="text-[10px] font-black uppercase text-slate-400 tracking-tighter ml-1">Actual Qty <span className="text-red-500">*</span></Label>
                          <Input type="number" step="0.01" className="h-10 border-2 border-slate-200 rounded-lg font-bold bg-white focus:border-blue-500 transition-colors"
                            value={loadData.actualQty} onChange={(e) => setLoadData(p => ({ ...p, actualQty: e.target.value }))} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-black uppercase text-slate-400 tracking-tighter ml-1">RST No <span className="text-red-500">*</span></Label>
                          <Input className="h-10 border-slate-200 rounded-lg font-bold"
                            value={loadData.rstNo} onChange={(e) => setLoadData(p => ({ ...p, rstNo: e.target.value }))} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-black uppercase text-slate-400 tracking-tighter ml-1">Truck No</Label>
                          <Input className="h-10 border-slate-200 rounded-lg font-bold bg-slate-50 font-mono uppercase" value={loadData.truckNo || vehicleNumber} readOnly />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-black uppercase text-slate-400 tracking-tighter ml-1 flex justify-between items-center">
                            Weightment Slip <span className="text-slate-400 font-normal normal-case">(Optional)</span> {loadData.weightmentSlip_file_name && <span className="text-blue-600 text-[8px] truncate max-w-20">({loadData.weightmentSlip_file_name})</span>}
                          </Label>
                          <div className="flex gap-2">
                            <Input type="file" className="hidden" id="weightment-slip" onChange={(e) => handleFileChange('weightmentSlip', 'weightmentSlip_file_name', e.target.files?.[0] || null, 'load')} />
                            <Label htmlFor="weightment-slip" title="Max file size: 10 MB" className="h-10 flex-1 flex items-center justify-center bg-slate-100 border-2 border-dashed border-slate-200 rounded-lg text-[10px] font-black text-slate-600 cursor-pointer hover:bg-blue-50 hover:border-blue-400 transition-all">
                              {isUploading === 'weightmentSlip' ? "..." : (loadData.weightmentSlip ? 'REPLACE' : 'UPLOAD')}
                            </Label>
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-black uppercase text-slate-400 tracking-tighter ml-1 flex justify-between items-center">
                            No Plate Image <span className="text-slate-400 font-normal normal-case">(Optional)</span> {loadData.vehicleNoPlateImage_file_name && <span className="text-blue-600 text-[8px] truncate max-w-20">({loadData.vehicleNoPlateImage_file_name})</span>}
                          </Label>
                          <div className="flex gap-2">
                            <Input type="file" className="hidden" id="no-plate" onChange={(e) => handleFileChange('vehicleNoPlateImage', 'vehicleNoPlateImage_file_name', e.target.files?.[0] || null, 'load')} />
                            <Label htmlFor="no-plate" title="Max file size: 10 MB" className="h-10 flex-1 flex items-center justify-center bg-slate-100 border-2 border-dashed border-slate-200 rounded-lg text-[10px] font-black text-slate-600 cursor-pointer hover:bg-blue-50 hover:border-blue-400 transition-all">
                              {isUploading === 'vehicleNoPlateImage' ? "..." : (loadData.vehicleNoPlateImage ? 'REPLACE' : 'UPLOAD')}
                            </Label>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-black uppercase text-slate-400 tracking-tighter ml-1">Gross Wt <span className="text-red-500">*</span></Label>
                          <Input type="number" step="0.01" className="h-10 border-slate-200 rounded-lg font-bold text-blue-600"
                            value={loadData.grossWeight} onChange={(e) => setLoadData(p => ({ ...p, grossWeight: e.target.value }))} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-black uppercase text-slate-500 tracking-tighter ml-1">Tare Wt <span className="text-red-500">*</span></Label>
                          <Input type="number" step="0.01" className="h-10 border-slate-200 rounded-lg font-bold"
                            value={loadData.tareWeight} onChange={(e) => setLoadData(p => ({ ...p, tareWeight: e.target.value }))} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-black uppercase text-slate-500 tracking-tighter ml-1">Net Weight</Label>
                          <Input type="number" step="0.01" readOnly className="h-10 border-2 border-slate-200 rounded-lg font-bold bg-slate-50"
                            value={loadData.netWeightPacking} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-black uppercase text-slate-500 tracking-tighter ml-1">Difference</Label>
                          <Input type="number" readOnly className={`h-10 border-2 rounded-lg font-bold ${Math.abs(parseFloat(loadData.differanceWeight) || 0) > 20 ? 'bg-red-50 text-red-700 border-red-200' : 'bg-green-50 text-green-700 border-green-200'}`}
                            value={loadData.differanceWeight} />
                        </div>
                      </div>

                      <div className="pt-4 border-t-2 border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-black uppercase text-slate-500 tracking-tighter ml-1">Total packing weight</Label>
                          <Input readOnly className="h-10 border-slate-200 rounded-lg font-bold bg-slate-50" value={totalPackingWeightFromSku.toFixed(2)} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-black uppercase text-slate-500 tracking-tighter ml-1">Extra packing material weight</Label>
                          <Input type="number" step="0.001" className="h-10 border-2 border-slate-200 rounded-lg font-bold bg-white focus:border-blue-500 transition-colors"
                            placeholder="0.000"
                            value={loadData.extraWeight} onChange={(e) => setLoadData(p => ({ ...p, extraWeight: e.target.value }))} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-black uppercase text-slate-500 tracking-tighter ml-1">Total Weight</Label>
                          <Input readOnly className="h-10 border-slate-200 rounded-lg font-bold bg-blue-50 text-blue-700" value={totalCombinedWeight.toFixed(2)} />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1 italic font-serif leading-none">Status (STG 7) <span className="text-red-500">*</span></Label>
                          <Select value={loadData.checkStatus} onValueChange={(v) => setLoadData(p => ({ ...p, checkStatus: v }))}>
                            <SelectTrigger className="h-10 border-2 border-slate-200 rounded-xl font-bold bg-white">
                              <SelectValue placeholder="Decision" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Accept">Approved Quality</SelectItem>
                              <SelectItem value="Reject">Reject Load</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className={cn("space-y-1.5 w-full transition-all duration-300", (loadData.transporterName && !['Company Vehicle', 'Party Vehicle'].includes(loadData.transporterName)) ? "col-span-2 md:col-span-2" : "col-span-2")}>
                          <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1 italic font-serif leading-none">Transporter <span className="text-red-500">*</span></Label>
                          <Select 
                            value={loadData.transporterName} 
                            onValueChange={(v) => {
                              const isNormal = !['Company Vehicle', 'Party Vehicle'].includes(v);
                              setLoadData(p => ({ 
                                ...p, 
                                transporterName: v, 
                                freightRateType: isNormal ? p.freightRateType : "", 
                                freightAmount: isNormal ? p.freightAmount : "",
                                cash_bank: isNormal ? p.cash_bank : "",
                                diesel_advance: isNormal ? p.diesel_advance : "",
                                bhada: isNormal ? p.bhada : ""
                              }));
                            }}
                          >
                            <SelectTrigger className="h-10 border-2 border-slate-200 rounded-xl font-bold bg-white w-full shadow-sm text-blue-700">
                              <SelectValue placeholder="Select Transporter" />
                            </SelectTrigger>
                            <SelectContent className="max-h-[300px]">
                              <SelectItem value="Company Vehicle" className="font-bold text-blue-600 bg-blue-50/30">Company Vehicle</SelectItem>
                              <SelectItem value="Party Vehicle" className="font-bold text-purple-600 bg-purple-50/30">Party Vehicle</SelectItem>
                              <div className="h-px bg-slate-100 my-1" />
                              {transporterMaster.map(t => (
                                <SelectItem key={t.id} value={t.transporter_name} className="font-medium">{t.transporter_name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {loadData.transporterName && !['Company Vehicle', 'Party Vehicle'].includes(loadData.transporterName) && (
                        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                              <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1 italic font-serif leading-none">Freight Rate Type <span className="text-red-500">*</span></Label>
                              <Select 
                                value={loadData.freightRateType} 
                                onValueChange={(v) => setLoadData(p => ({ ...p, freightRateType: v }))}
                              >
                                <SelectTrigger className="h-10 border-2 border-slate-200 rounded-xl font-bold bg-white focus:ring-2 focus:ring-blue-500">
                                  <SelectValue placeholder="Select Type" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Fixed Bhada" className="font-medium">Fixed Bhada</SelectItem>
                                  <SelectItem value="Bhada Rate" className="font-medium">Bhada Rate</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            {loadData.freightRateType && (
                              <div className="space-y-1.5 animate-in slide-in-from-right-2 duration-300">
                                <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1 italic font-serif leading-none">
                                  {loadData.freightRateType === 'Bhada Rate' ? 'Bhada Rate (Per Metric Ton)' : 'Fixed Bhada Amount'} <span className="text-red-500">*</span>
                                </Label>
                                <div className="relative">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">₹</span>
                                  <Input 
                                    type="number" 
                                    step="0.01"
                                    className="h-10 pl-7 border-2 border-slate-200 rounded-lg font-bold bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                                    placeholder="0.00"
                                    value={loadData.freightAmount} 
                                    onChange={(e) => setLoadData(p => ({ ...p, freightAmount: e.target.value }))} 
                                  />
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Advance Bhada Section */}
                          <div className="space-y-4 pt-4 border-t-2 border-slate-100">
                            <div className="flex items-center gap-2">
                              <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 font-black px-3">Advance Bhada</Badge>
                              <div className="h-px flex-1 bg-slate-100" />
                            </div>
                            
                            <div className="grid grid-cols-3 gap-4">
                              <div className="space-y-1.5">
                                <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Bank</Label>
                                <Input 
                                  type="number" 
                                  step="0.01"
                                  className="h-10 border-2 border-slate-200 rounded-lg font-bold bg-white focus:border-blue-500 transition-all"
                                  placeholder="0.00"
                                  value={loadData.cash_bank} 
                                  onChange={(e) => setLoadData(p => ({ ...p, cash_bank: e.target.value }))} 
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Diesel Advance</Label>
                                <Input 
                                  type="number" 
                                  step="0.01"
                                  className="h-10 border-2 border-slate-200 rounded-lg font-bold bg-white focus:border-blue-500 transition-all"
                                  placeholder="0.00"
                                  value={loadData.diesel_advance} 
                                  onChange={(e) => setLoadData(p => ({ ...p, diesel_advance: e.target.value }))} 
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Cash Advance</Label>
                                <Input 
                                  type="number" 
                                  step="0.01"
                                  className="h-10 border-2 border-slate-200 rounded-lg font-bold bg-white focus:border-blue-500 transition-all"
                                  placeholder="0.00"
                                  value={loadData.bhada} 
                                  onChange={(e) => setLoadData(p => ({ ...p, bhada: e.target.value }))} 
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-1 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1 italic font-serif leading-none">
                            Weight Difference Reason {Math.abs(parseFloat(loadData.differanceWeight) || 0) > 20 ? <span className="text-red-500">* (Required)</span> : <span className="text-slate-400 font-normal normal-case">(Optional)</span>}
                          </Label>
                          <Input
                            className={`h-10 rounded-lg font-medium bg-white ${Math.abs(parseFloat(loadData.differanceWeight) || 0) > 20 ? 'border-2 border-red-400 focus:border-red-500' : 'border-slate-200'}`}
                            placeholder={Math.abs(parseFloat(loadData.differanceWeight) || 0) > 20 ? "Required: explain weight difference..." : "Specify reason..."}
                            value={loadData.reason} onChange={(e) => setLoadData(p => ({ ...p, reason: e.target.value }))} />
                        </div>

                        {/* Overload Alert & Remarks */}
                        {totalCombinedWeight > (parseFloat(vehicleData.passing_weight) || 0) && (
                          <div className="p-4 bg-red-50 border-2 border-red-100 rounded-2xl space-y-3 animate-in fade-in slide-in-from-top-2">
                             <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                                <p className="text-sm font-black text-red-600 uppercase tracking-tighter">Vehicle is overload!</p>
                             </div>
                             <div className="space-y-1.5">
                                <Label className="text-[10px] font-black uppercase text-red-500 tracking-widest ml-1">Overload Remarks <span className="text-red-500">*</span></Label>
                                <Input 
                                  placeholder="Why is the vehicle being overloaded? (MANDATORY)"
                                  className="h-10 border-2 border-red-200 rounded-xl bg-white font-bold text-red-700 placeholder:text-red-300 focus:border-red-500 transition-all"
                                  value={loadData.overloadRemarks}
                                  onChange={(e) => setLoadData(p => ({ ...p, overloadRemarks: e.target.value }))}
                                />
                             </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
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
                <Button
                  variant="outline"
                  onClick={handleSaveDraft}
                  disabled={isSavingDraft || isProcessing || isReadOnly}
                  className="border-amber-300 text-amber-700 hover:bg-amber-50 font-semibold"
                  title="Save current form data as a draft to resume later"
                >
                  {isSavingDraft ? "Saving..." : "Save as Draft"}
                </Button>
                <Button onClick={performDispatchConfirmation} disabled={isProcessing || dialogSelectedProducts.length === 0 || isReadOnly || !gateInData} title={isReadOnly ? "View Only Access" : !gateInData ? "Gate-In Required" : "Confirm Dispatch"}>
                  {isProcessing ? "Processing..." : `Confirm Dispatch (${dialogSelectedProducts.length})`}
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
    </WorkflowStageShell>
  );
}
