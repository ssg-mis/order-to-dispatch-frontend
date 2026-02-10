"use client"

import { Card } from "@/components/ui/card"
import { WorkflowStageShell } from "@/components/workflow/workflow-stage-shell"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { Settings2, Loader2, ChevronDown, ChevronUp, Trash2, Plus, Check, Search, Package } from "lucide-react"
import { useState, useEffect, useMemo } from "react"
import { saveWorkflowHistory } from "@/lib/storage-utils"
import { skuApi, preApprovalApi } from "@/lib/api-service"
import { cn } from "@/lib/utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"



export default function PreApprovalPage() {
  const { toast } = useToast()
  const router = useRouter()
  const PAGE_COLUMNS = [
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
    { id: "ratePerLtr", label: "Rate Per Ltr." },
    { id: "productName", label: "Product Name" },
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
  ]

  const [visibleColumns, setVisibleColumns] = useState<string[]>([
    "soNo",
    "customerName",
    "deliveryPurpose",
    "deliveryDate",
    "oilType",
    "ratePer15Kg"
  ])
  const [isApproving, setIsApproving] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [pendingOrders, setPendingOrders] = useState<any[]>([])
  const [preApprovalData, setPreApprovalData] = useState<any>(null)
  const [productRates, setProductRates] = useState<{ [key: string]: { skuName: string; approvalQty: string; rate: string; remark: string; productName: string; rateOfMaterial: string; orderQty?: string } }>({})
  const [selectedRows, setSelectedRows] = useState<string[]>([])
  const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false)
  const [selectedProductRows, setSelectedProductRows] = useState<string[]>([])
  const [qtyValidationErrors, setQtyValidationErrors] = useState<{ [key: string]: string }>({})
  const [rateValidationErrors, setRateValidationErrors] = useState<{ [key: string]: string }>({})
  const [qtyInfoNotices, setQtyInfoNotices] = useState<{ [key: string]: string }>({})

  const [history, setHistory] = useState<any[]>([])
  const [expandedOrders, setExpandedOrders] = useState<string[]>([])
  const [dialogNewProducts, setDialogNewProducts] = useState<{ [key: string]: any[] }>({})
  
  // Date formatting helper
  const formatDate = (dateStr: string) => {
    if (!dateStr || dateStr === "—") return "—";
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      return date.toLocaleDateString("en-GB");
    } catch (e) {
      return dateStr;
    }
  };
  
  // SKU State
  const [skuMaster, setSkuMaster] = useState<string[]>([])
  
  // SKU Price List State
  const [showSkuPriceList, setShowSkuPriceList] = useState(false)
  const [skuRates, setSkuRates] = useState<any[]>([])
  const [loadingRates, setLoadingRates] = useState(false)
  const [calculatedPrices, setCalculatedPrices] = useState<{ [oilType: string]: any[] }>({})
  const [activeOilTab, setActiveOilTab] = useState<string>("")
  const [catalogContext, setCatalogContext] = useState<{ orderNo: string, oilWiseRates: any } | null>(null)

  // Fetch SKUs
  useEffect(() => {
    const fetchSkus = async () => {
      try {
        const response = await skuApi.getAll()
        if (response.success && Array.isArray(response.data)) {
          // Map to just names or keep full objects if more info needed later
          // Currently the UI seems to just list names in the command list
          setSkuMaster(response.data.map((sku: any) => sku.sku_name))
        }
      } catch (error) {
        console.error("Failed to fetch SKUs:", error)
        toast({
          title: "Warning",
          description: "Failed to load SKU list. Please try refeshing.",
          variant: "destructive",
        })
      }
    }
    
    fetchSkus()
  }, [])

  // Calculate SKU prices based on formulas
  const calculateSkuPrices = (baseRatePer15Kg: number, baseRatePer1Ltr: number, formulas: any[]) => {
    return formulas.map((item) => {
      let calculatedRate = 0
      const formula = item.formula?.trim() || ""
      
      try {
        if (!formula || formula === "") {
          // No formula, use stored rate
          calculatedRate = parseFloat(item.rate) || 0
        } else if (formula.toUpperCase() === "A") {
          // Direct 15 KG rate
          calculatedRate = baseRatePer15Kg
        } else if (formula.toUpperCase() === "B") {
          // Direct 1 LTR rate
          calculatedRate = baseRatePer1Ltr
        } else {
          // Replace A and B with actual values
          let evalFormula = formula
            .replace(/A/gi, baseRatePer15Kg.toString())
            .replace(/B/gi, baseRatePer1Ltr.toString())
          
          // Evaluate the formula (be cautious with eval in production)
          // eslint-disable-next-line no-eval
          calculatedRate = eval(evalFormula)
        }
      } catch (error) {
        console.error(`Error calculating rate for ${item.sku}:`, error)
        calculatedRate = 0
      }
      
      return {
        sku: item.sku,
        formula: item.formula || "—",
        calculatedRate: calculatedRate.toFixed(2)
      }
    })
  }

  // Fetch SKU rates and calculate prices
  const fetchAndCalculateRates = async (specificOrderContext?: { orderNo: string, oilWiseRates: any }) => {
    setLoadingRates(true)
    setCatalogContext(specificOrderContext || null)
    
    try {
      const response = await skuApi.getAllSkuRates()
      
      if (response.success) {
        setSkuRates(response.data)
        
        const oilWiseCalculations: { [oilType: string]: any[] } = {}
        
        if (specificOrderContext) {
          // Use only the specific order's rates
          Object.entries(specificOrderContext.oilWiseRates).forEach(([oilType, rates]: [string, any]) => {
            const baseRate15kg = rates.ratePer15Kg ? parseFloat(rates.ratePer15Kg) : 0
            const baseRateLtr = rates.ratePerLtr ? parseFloat(rates.ratePerLtr) : 0
            oilWiseCalculations[oilType] = calculateSkuPrices(baseRate15kg, baseRateLtr, response.data)
          })
        } else {
          // Legacy: Aggregate rates across all selected orders
          const selectedGroupItems = displayRows.filter(r => selectedRows.includes(r._rowKey))
          const allOilTypes = new Set<string>()
          
          selectedGroupItems.forEach(group => {
            if (group.oilWiseRates) {
              Object.keys(group.oilWiseRates).forEach(ot => allOilTypes.add(ot))
            }
          })

          allOilTypes.forEach(oilType => {
            let baseRate15kg = 0
            let baseRateLtr = 0

            for (const group of selectedGroupItems) {
              const rates = group.oilWiseRates?.[oilType]
              if (rates && (rates.ratePer15Kg && rates.ratePer15Kg !== "—" || rates.ratePerLtr && rates.ratePerLtr !== "—")) {
                baseRate15kg = rates.ratePer15Kg ? parseFloat(rates.ratePer15Kg) : 0
                baseRateLtr = rates.ratePerLtr ? parseFloat(rates.ratePerLtr) : 0
                if (baseRate15kg > 0 || baseRateLtr > 0) break;
              }
              if (baseRate15kg === 0 && group.ratePer15Kg) baseRate15kg = parseFloat(group.ratePer15Kg)
              if (baseRateLtr === 0 && group.ratePerLtr) baseRateLtr = parseFloat(group.ratePerLtr)
              if (baseRate15kg > 0 || baseRateLtr > 0) break;
            }

            oilWiseCalculations[oilType] = calculateSkuPrices(baseRate15kg, baseRateLtr, response.data)
          })
        }
        
        setCalculatedPrices(oilWiseCalculations)
        
        const oilTypes = Object.keys(oilWiseCalculations)
        if (oilTypes.length > 0 && (!activeOilTab || !oilTypes.includes(activeOilTab))) {
          setActiveOilTab(oilTypes[0])
        }
      }
    } catch (error) {
      console.error("Failed to fetch SKU rates:", error)
      toast({
        title: "Error",
        description: "Failed to load SKU rates",
        variant: "destructive"
      })
    } finally {
      setLoadingRates(false)
    }
  }



  // Map backend data (snake_case) to frontend format (camelCase)
  const mapBackendOrderToFrontend = (backendOrder: any) => {
    return {
      id: backendOrder.id,
      doNumber: backendOrder.order_no,
      orderNo: backendOrder.order_no,
      customerName: backendOrder.customer_name,
      orderType: backendOrder.order_type,
      customerType: backendOrder.customer_type,
      orderPurpose: backendOrder.order_type_delivery_purpose,
      deliveryDate: backendOrder.delivery_date,
      startDate: backendOrder.start_date,
      endDate: backendOrder.end_date,
      soDate: backendOrder.party_so_date,
      contactPerson: backendOrder.customer_contact_person_name,
      whatsappNo: backendOrder.customer_contact_person_whatsapp_no,
      customerAddress: backendOrder.customer_address,
      paymentTerms: backendOrder.payment_terms,
      advancePaymentTaken: backendOrder.advance_payment_to_be_taken,
      advanceAmount: backendOrder.advance_amount,
      isBrokerOrder: backendOrder.is_order_through_broker,
      brokerName: backendOrder.broker_name,
      transportType: backendOrder.type_of_transporting,
      depoName: backendOrder.depo_name,
      orderPunchRemarks: backendOrder.order_punch_remarks,
      totalWithGst: backendOrder.total_with_gst,
      // Product info (for individual row from DB)
      preApprovalProducts: [{
        _pid: `${backendOrder.id}-${backendOrder.order_no}`,
        id: backendOrder.id,
        productName: backendOrder.product_name,
        oilType: backendOrder.oil_type,
        uom: backendOrder.uom,
        orderQty: backendOrder.order_quantity,
        altUom: backendOrder.alternate_uom,
        altQty: backendOrder.order_quantity,
        ratePerLtr: backendOrder.rate_per_ltr,
        ratePer15Kg: backendOrder.rate_per_15kg,
        rateOfMaterial: backendOrder.rate_of_material, // Map rate_of_material
        skuName: backendOrder.sku_name,
        approvalQty: backendOrder.approval_qty,
      }]
    };
  };

  // Fetch pending orders from backend
  const fetchPendingOrders = async () => {
    try {
      setIsLoading(true);
      const response = await preApprovalApi.getPending({ limit: 1000 });
      
      if (response.success && response.data.orders) {
        const mappedOrders = response.data.orders.map(mapBackendOrderToFrontend);
        setPendingOrders(mappedOrders);
      }
    } catch (error: any) {
      console.error("Failed to fetch pending orders:", error);
      toast({
        title: "Error",
        description: error?.message || "Failed to load pending orders from server",
        variant: "destructive",
      });
      setPendingOrders([]); // Clear on error - don't use cache
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch history from backend
  const fetchHistory = async () => {
    try {
      const response = await preApprovalApi.getHistory({ limit: 1000 });
      
      if (response.success && response.data.orders) {
        const mappedHistory = response.data.orders.map((order: any) => ({
          orderNo: order.order_no,
          customerName: order.customer_name,
          stage: "Pre-Approval",
          status: "Completed" as const,
          processedBy: "System",
          timestamp: order.actual_1,
          date: order.actual_1 ? new Date(order.actual_1).toLocaleDateString("en-GB") : "-",
          remarks: order.remark || "-",
        }));
        setHistory(mappedHistory);
      }
    } catch (error: any) {
      console.error("Failed to fetch history:", error);
      setHistory([]); // Clear on error - don't use cache
    }
  };

  useEffect(() => {
    // Fetch data from backend
    fetchPendingOrders();
    fetchHistory();
    
    // Load Pre-Approval Draft Data (if any)
    const savedPreApprovalData = localStorage.getItem("preApprovalData");
    if (savedPreApprovalData) {
      setPreApprovalData(JSON.parse(savedPreApprovalData));
    }
  }, [])

  // Auto-calculate SKU prices when dialog opens
  useEffect(() => {
    if (isBulkDialogOpen && selectedRows.length > 0) {
      fetchAndCalculateRates()
    }
  }, [isBulkDialogOpen])

  const handleApprove = async (itemsToApprove: any[]) => {
    setIsApproving(true)
    try {
      // Preliminary validation
      for (const item of itemsToApprove) {
        const productKey = item._rowKey;
        const rateData = productRates[productKey];
        const product = item._product;
        
        const rateOfMaterial = parseFloat(rateData?.rateOfMaterial || product.rateOfMaterial || "0") || 0;
        const enteredRate = parseFloat(rateData?.rate) || 0;
        
        if (!rateData?.rate) {
          toast({
            title: "Rate Required",
            description: `Please enter a Final Rate for all selected products.`,
            variant: "destructive"
          });
          setIsApproving(false);
          return;
        }

        if (enteredRate < rateOfMaterial) {
          toast({
            title: "Invalid Rate",
            description: `Final rate for product in ${item._displayDo} cannot be less than ₹${rateOfMaterial.toFixed(2)}.`,
            variant: "destructive"
          });
          setIsApproving(false);
          return;
        }
      }

      const successfulApprovals: any[] = []
      const failedApprovals: any[] = []
      
      // Submit each approval to backend
      for (const item of itemsToApprove) {
        try {
          const product = item._product
          const productKey = item._rowKey
          const rateData = productRates[productKey]
          
          // Prepare submission data
          const submissionData = {
            sku_name: rateData?.skuName,
            product_name: rateData?.productName || rateData?.skuName,  // Include product_name
            approval_qty: rateData?.approvalQty ? parseFloat(rateData.approvalQty) : null,
            remaining_dispatch_qty: rateData?.approvalQty ? parseFloat(rateData.approvalQty) : null,
            rate_per_ltr: rateData?.rate ? parseFloat(rateData.rate) : (product.rateOfMaterial ? parseFloat(product.rateOfMaterial) : null), // Use manual rate or fallback to unit rate
            final_rate: rateData?.rate ? parseFloat(rateData.rate) : (product.rateOfMaterial ? parseFloat(product.rateOfMaterial) : null), // Store per-unit approved rate in final_rate
            rate_of_material: rateData?.rateOfMaterial ? parseFloat(rateData.rateOfMaterial) : (product.rateOfMaterial ? parseFloat(product.rateOfMaterial) : null),
            remark: rateData?.remark || null, // Use individual remark
          }
          
          // Call backend API to submit pre-approval
          await preApprovalApi.submit(product.id, submissionData)
          
          successfulApprovals.push(item)
          
          // Also save to workflow history for local tracking
          const historyEntry = {
            orderNo: item._displayDo,
            customerName: item.customerName || "Unknown",
            stage: "Pre-Approval",
            status: "Completed" as const,
            processedBy: "Current User",
            timestamp: new Date().toISOString(),
            remarks: rateData?.remark || "-", // Use individual remark
            orderType: item.orderType || "pre-approval"
          }
          saveWorkflowHistory(historyEntry)
          
        } catch (error: any) {
          console.error(`Failed to approve order ${item._displayDo}:`, error)
          failedApprovals.push({ item, error: error?.message || "Unknown error" })
        }
      }
      
      // Show results
      if (successfulApprovals.length > 0) {
        toast({
          title: "Approvals Submitted",
          description: `${successfulApprovals.length} product(s) approved successfully.`,
        })
        
        // Refresh data from backend
        await fetchPendingOrders()
        await fetchHistory()
      }
      
      if (failedApprovals.length > 0) {
        toast({
          title: "Some Approvals Failed",
          description: `${failedApprovals.length} approval(s) failed. Please try again.`,
          variant: "destructive",
        })
      }
      
      setSelectedRows([])
      setIsBulkDialogOpen(false)
      setProductRates({})
      
      // Navigate if all pending items are processed
      if (successfulApprovals.length > 0 && pendingOrders.length === successfulApprovals.length) {
        setTimeout(() => {
            router.push("/approval-of-order")
        }, 1500)
      }
    } finally {
      setIsApproving(false)
    }
  }

  const handleAddProductRow = (baseDo: string, orderData: any) => {
    // Calculate next suffix (A, B, C...)
    const occupiedSuffixes = new Set<string>();
    [...(orderData._products || []), ...(dialogNewProducts[baseDo] || [])].forEach(p => {
      const id = p.orderNo || p._originalOrderId || "";
      const match = id.match(/([A-Z])$/i);
      if (match) occupiedSuffixes.add(match[1].toUpperCase());
    });

    let charCode = 65; // 'A'
    while (occupiedSuffixes.has(String.fromCharCode(charCode))) {
      charCode++;
    }
    const nextSuffix = String.fromCharCode(charCode);
    const fullOrderNo = `${baseDo}${nextSuffix}`;

    const newId = `new-${Math.random().toString(36).substr(2, 9)}`;
    const newProduct = {
      _pid: newId,
      id: null,
      productName: "",
      oilType: "",
      uom: "Ltr",
      orderQty: "1",
      rateOfMaterial: "0",
      _isNew: true,
      _baseDo: baseDo,
      _rowKey: `${baseDo}-${newId}`,
      _originalOrderId: fullOrderNo,
      _orderData: orderData
    };
    
    setDialogNewProducts(prev => ({
      ...prev,
      [baseDo]: [...(prev[baseDo] || []), newProduct]
    }));

    // Auto-select the new row and initialize rates
    setSelectedProductRows(prev => [...prev, newProduct._rowKey]);
    setProductRates(prev => ({
      ...prev,
      [newProduct._rowKey]: {
        productName: "",
        skuName: "",
        approvalQty: "",
        rateOfMaterial: "0",
        orderQty: "1",
        rate: "",
        remark: ""
      }
    }));
  };

  const handleApproveWithAdditions = async (itemsToApprove: any[]) => {
    setIsApproving(true)
    try {
      // Preliminary validation
      for (const item of itemsToApprove) {
        const productKey = item._rowKey;
        const rateData = productRates[productKey];
        const product = item._product;
        
        const rateOfMaterial = parseFloat(rateData?.rateOfMaterial || product.rateOfMaterial || "0") || 0;
        const enteredRate = parseFloat(rateData?.rate) || 0;
        
        if (!rateData?.rate) {
          toast({
            title: "Rate Required",
            description: `Please enter a Final Rate for all selected products.`,
            variant: "destructive"
          });
          setIsApproving(false);
          return;
        }

        if (enteredRate < rateOfMaterial) {
          toast({
            title: "Invalid Rate",
            description: `Final rate for product in ${item._displayDo} cannot be less than ₹${rateOfMaterial.toFixed(2)}.`,
            variant: "destructive"
          });
          setIsApproving(false);
          return;
        }
      }

      const successfulApprovals: any[] = []
      const failedApprovals: any[] = []
      
      for (const item of itemsToApprove) {
        try {
          const product = item._product
          const productKey = item._rowKey
          const rateData = productRates[productKey]

          if (product._isNew) {
            // Use orderApi.create for new products
            const orderData = {
              ...product._orderData,
              order_no: product._originalOrderId, // Use suffixed order number (DO-065C etc)
              products: [{
                product_name: rateData?.skuName || rateData?.productName,
                uom: product.uom,
                order_quantity: parseFloat(rateData?.orderQty || "0"),
                rate_of_material: parseFloat(rateData?.rateOfMaterial || "0"),
                approval_qty: parseFloat(rateData?.approvalQty || "0"),
                rate_per_ltr: rateData?.rate ? parseFloat(rateData.rate) : parseFloat(rateData?.rateOfMaterial || "0"),
                final_rate: rateData?.rate ? parseFloat(rateData.rate) : parseFloat(rateData?.rateOfMaterial || "0"),
                remark: rateData?.remark || "",
                sku_name: rateData?.skuName
              }]
            };
            
            // Map keys back to snake_case if they were camelCase
            const mappedOrderData: any = {
              planned_1: new Date().toISOString() // Mark as passed Step 1 so it shows in Pre-Approval
            };
            Object.entries(orderData).forEach(([key, val]) => {
              if (key === 'customerName') mappedOrderData.customer_name = val;
              else if (key === 'orderType') mappedOrderData.order_type = val;
              else if (key === 'orderPurpose') mappedOrderData.order_type_delivery_purpose = val;
              else if (key === 'startDate') mappedOrderData.start_date = val;
              else if (key === 'endDate') mappedOrderData.end_date = val;
              else if (key === 'deliveryDate') mappedOrderData.delivery_date = val;
              else if (key === 'soDate') mappedOrderData.party_so_date = val;
              else if (key === 'contactPerson') mappedOrderData.customer_contact_person_name = val;
              else if (key === 'whatsappNo') mappedOrderData.customer_contact_person_whatsapp_no = val;
              else if (key === 'customerAddress') mappedOrderData.customer_address = val;
              else if (key === 'paymentTerms') mappedOrderData.payment_terms = val;
              else if (key === 'advancePaymentTaken') mappedOrderData.advance_payment_to_be_taken = val;
              else if (key === 'advanceAmount') mappedOrderData.advance_amount = val;
              else if (key === 'isBrokerOrder') mappedOrderData.is_order_through_broker = val;
              else if (key === 'brokerName') mappedOrderData.broker_name = val;
              else if (key === 'transportType') mappedOrderData.type_of_transporting = val;
              else if (key === 'depoName') mappedOrderData.depo_name = val;
              else if (key === 'orderPunchRemarks') mappedOrderData.order_punch_remarks = val;
              else if (key === 'customerType') mappedOrderData.customer_type = val;
              else if (key === 'totalWithGst') mappedOrderData.total_amount_with_gst = val;
              else mappedOrderData[key] = val;
            });

            const { orderApi } = await import('@/lib/api-service');
            await orderApi.create(mappedOrderData);
          } else {
            // Existing logic for existing products
            const submissionData = {
              sku_name: rateData?.skuName,
              product_name: rateData?.productName || rateData?.skuName,
              approval_qty: rateData?.approvalQty ? parseFloat(rateData.approvalQty) : null,
              remaining_dispatch_qty: rateData?.approvalQty ? parseFloat(rateData.approvalQty) : null,
              rate_per_ltr: rateData?.rate ? parseFloat(rateData.rate) : (product.rateOfMaterial ? parseFloat(product.rateOfMaterial) : null),
              final_rate: rateData?.rate ? parseFloat(rateData.rate) : (product.rateOfMaterial ? parseFloat(product.rateOfMaterial) : null),
              rate_of_material: rateData?.rateOfMaterial ? parseFloat(rateData.rateOfMaterial) : (product.rateOfMaterial ? parseFloat(product.rateOfMaterial) : null),
              remark: rateData?.remark || null,
            }
            await preApprovalApi.submit(product.id, submissionData)
          }
          
          successfulApprovals.push(item)
          
          const historyEntry = {
            orderNo: item._displayDo,
            customerName: item.customerName || "Unknown",
            stage: "Pre-Approval",
            status: "Completed" as const,
            processedBy: "Current User",
            timestamp: new Date().toISOString(),
            remarks: rateData?.remark || "-",
            orderType: item.orderType || "pre-approval"
          }
          saveWorkflowHistory(historyEntry)
          
        } catch (error: any) {
          console.error(`Failed to approve:`, error)
          failedApprovals.push({ item, error: error?.message || "Unknown error" })
        }
      }
      
      if (successfulApprovals.length > 0) {
        toast({ title: "Success", description: "Approvals and additions processed." });
        await fetchPendingOrders();
        await fetchHistory();
        setDialogNewProducts({});
      }
      
      if (failedApprovals.length > 0) {
        toast({ title: "Failed", description: "Some items failed to process.", variant: "destructive" });
      }
      
      setSelectedRows([])
      setIsBulkDialogOpen(false)
      setProductRates({})
    } finally {
      setIsApproving(false)
    }
  }

  const handleDeleteProduct = async (id: number, displayDo: string) => {
    if (!window.confirm(`Are you sure you want to delete product from ${displayDo}?`)) return;
    
    try {
      const { orderApi } = await import('@/lib/api-service');
      const response = await orderApi.delete(id);
      
      if (response.success) {
        toast({
          title: "Product Deleted",
          description: `Product from ${displayDo} has been removed.`,
        });
        fetchPendingOrders();
      }
    } catch (error: any) {
      console.error("Failed to delete product:", error);
      toast({
        title: "Delete Failed",
        description: error?.message || "Could not delete the product.",
        variant: "destructive",
        });
      }
    };

  const handleSkuSelection = async (sku: string, rowKey: string, product: any, orderContext: any) => {
    // Normalize SKU for better matching
    const normalizeSku = (skuName: string) => {
      let n = (skuName || "").toUpperCase();
      // 1. Remove pack info like 1*12 or 1 * 12 before stripping noise
      n = n.replace(/\d+\s*\*\s*\d+/g, ' '); 
      // 2. Clear separators
      n = n.replace(/[\/\(\)\*\-\,]/g, ' ');
      // 3. Standardize units
      n = n.replace(/\bKGS\b/g, 'KG');
      n = n.replace(/\bLTRS\b/g, 'LTR');
      n = n.replace(/\bMLT\b/g, 'ML');
      n = n.replace(/\b0+(\d)/g, '$1'); // 01 -> 1
      // 4. Remove oil types and generic prefixes
      n = n.replace(/\b(HK|SBO|RBO|PO|PALM|RICE|SOYA|OIL|SUNFLOWER|S\.O\.|R\.O\.|P\.O\.)\b/g, '');
      return n.replace(/\s+/g, ' ').trim();
    };
    
    // Extract core SKU tokens (size + type)
    const extractCoreTokens = (skuName: string) => {
      const normalized = normalizeSku(skuName);
      // Extract key tokens like "1 LTR PP" or "15 KG JAR"
      const tokens = normalized.split(' ').filter(t => t.length > 0);
      // Focus on size + unit + type
      return tokens.slice(0, 3).join(' ');
    };
    
    // Extract SKU portion from full product name
    const extractSku = (productName: string) => {
      const prefixes = ['HK Palm Oil ', 'HK RBO ', 'HK SBO ', 'HK PALM OIL ', 'HK '];
      let extracted = productName;
      for (const prefix of prefixes) {
        if (productName.toUpperCase().startsWith(prefix.toUpperCase())) {
          extracted = productName.substring(prefix.length).trim();
          break;
        }
      }
      return extracted.replace(/\bKGS\b/gi, 'KG');
    };
    
    const skuForRate = extractSku(sku);
    const normalizedSelected = normalizeSku(skuForRate);
    const coreTokensSelected = extractCoreTokens(skuForRate);
    
    // Use calculated rate from SKU Price List if available
    let rateValue = "";
    
    console.log("Selected SKU:", sku);
    console.log("Extracted SKU:", skuForRate);
    console.log("Normalized Selected:", normalizedSelected);
    console.log("Core Tokens Selected:", coreTokensSelected);
    console.log("Available calculated prices:", calculatedPrices);
    
    // Detect oil type from the selected SKU name for accurate rate lookup
    const detectOilTypeFromSku = (skuName: string) => {
      const s = (skuName || "").toUpperCase();
      // Look for Rice keywords first (more specific)
      if (s.includes("RICE") || s.includes("RBO") || s.includes("R.O.") || s.includes("RO ")) return "RICE OIL";
      if (s.includes("SOYA") || s.includes("SBO") || s.includes("S.O.") || s.includes("SO ")) return "SOYA OIL";
      if (s.includes("PALM") || s.includes("P.O.") || s.includes("PO ") || s.includes("P.O ")) return "PALM OIL";
      return null;
    };
    
    const detectedOilType = detectOilTypeFromSku(sku);
    const targetOilType = (detectedOilType || product.oilType || "Unknown").toUpperCase();
    
    // Use product's DO context for highly accurate calculation
    let pricesForOil = [];
    const oilRatesMap = orderContext?.oilWiseRates || {};
    
    // Find matching key in oilRatesMap (Palm Oil, Rice Oil, Soya Oil, etc.) with case-insensitive matching
    const contextOilKey = Object.keys(oilRatesMap).find(k => {
      const normalizedK = k.toUpperCase().replace(/\s+/g, '');
      const normalizedTarget = targetOilType.replace(/\s+/g, '');
      return normalizedK.includes(normalizedTarget) || normalizedTarget.includes(normalizedK);
    });
    
    if (contextOilKey) {
      const rates = oilRatesMap[contextOilKey];
      const base15 = parseFloat(rates.ratePer15Kg?.toString().replace('₹', '')) || 0;
      const baseLtr = parseFloat(rates.ratePerLtr?.toString().replace('₹', '')) || 0;
      if (base15 > 0 || baseLtr > 0) {
        console.log(`✓ Context Match: Found ${contextOilKey} rates for ${targetOilType} (15kg=${base15}, Ltr=${baseLtr})`);
        pricesForOil = calculateSkuPrices(base15, baseLtr, skuRates);
      }
    }

    // Fallback 1: Use product's own rates ONLY if its oil type matches the target
    if (pricesForOil.length === 0) {
      const prodOilType = (product.oilType || "").toUpperCase().replace(/\s+/g, '');
      const normTarget = targetOilType.replace(/\s+/g, '');
      
      if (prodOilType.includes(normTarget) || normTarget.includes(prodOilType)) {
        const raw15 = product.rate_per_15kg || product.ratePer15Kg;
        const rawLtr = product.rate_per_ltr || product.ratePerLtr;
        
        if (raw15 && rawLtr && raw15 !== "—" && rawLtr !== "—") {
          const base15 = parseFloat(raw15.toString().replace('₹', '')) || 0;
          const baseLtr = parseFloat(rawLtr.toString().replace('₹', '')) || 0;
          if (base15 > 0 || baseLtr > 0) {
            console.log(`✓ Product Match: Using row rates for matching oil type ${targetOilType}`);
            pricesForOil = calculateSkuPrices(base15, baseLtr, skuRates);
          }
        }
      }
    }

    // Fallback 2: Global calculatedPrices with case-insensitive lookup
    if (pricesForOil.length === 0) {
      const matchingKey = Object.keys(calculatedPrices || {}).find(
        (k: string) => {
          const nk = k.toUpperCase().replace(/\s+/g, '');
          const nt = targetOilType.replace(/\s+/g, '');
          return nk.includes(nt) || nt.includes(nk);
        }
      );
      if (matchingKey) {
        console.log(`✓ Global Match: Found ${matchingKey} rates in global map`);
        pricesForOil = calculatedPrices[matchingKey];
      }
    }
      
    // Try multiple matching strategies
    let calculatedRateResult = null;
    
    // Strategy 1: Exact match with extracted SKU
    calculatedRateResult = pricesForOil.find((item: any) => 
      item.sku.toUpperCase() === skuForRate.toUpperCase()
    );
    
    // Strategy 2: Match with full SKU name
    if (!calculatedRateResult) {
      calculatedRateResult = pricesForOil.find((item: any) => 
        item.sku.toUpperCase() === sku.toUpperCase()
      );
    }
    
    // Strategy 3: Normalized matching
    if (!calculatedRateResult) {
      calculatedRateResult = pricesForOil.find((item: any) => {
        const normalizedItem = normalizeSku(item.sku);
        console.log(`Comparing normalized "${normalizedSelected}" with "${normalizedItem}"`);
        return normalizedItem === normalizedSelected;
      });
    }
    
    // Strategy 4: Core token matching (size + unit + type)
    if (!calculatedRateResult) {
      calculatedRateResult = pricesForOil.find((item: any) => {
        const coreTokensItem = extractCoreTokens(item.sku);
        console.log(`Comparing core tokens "${coreTokensSelected}" with "${coreTokensItem}"`);
        return coreTokensItem === coreTokensSelected;
      });
    }
    
    // Strategy 5: Token-based containment match (all selected tokens must be in item)
    if (!calculatedRateResult) {
      const selectedTokens = normalizedSelected.split(' ').filter(t => t.length > 0);
      if (selectedTokens.length >= 1) { // At least one identifier like "990" or "13KG"
        calculatedRateResult = pricesForOil.find((item: any) => {
          const itemTokens = normalizeSku(item.sku).split(' ').filter(t => t.length > 0);
          // Match if all selected tokens (like "990" and "PP") exist in the catalog SKU tokens
          return selectedTokens.every(st => itemTokens.includes(st));
        });
      }
    }
    
    if (calculatedRateResult) {
      console.log("✓ Found calculated rate:", calculatedRateResult);
      rateValue = calculatedRateResult.calculatedRate;
    } else {
      console.log("✗ No calculated rate found, fetching from database...");
      // Fallback: fetch stored rate from database
      try {
        const response = await fetch(`/api/v1/skus/rate/${encodeURIComponent(skuForRate)}`);
        const data = await response.json();
        rateValue = data.success && data.rate ? data.rate.toString() : "";
      } catch (error) {
        console.error("Failed to fetch rate for SKU:", error);
      }
    }
    
    setProductRates(prev => ({ 
      ...prev, 
      [rowKey]: { 
        ...prev[rowKey], 
        skuName: sku,
        productName: sku,
        rateOfMaterial: rateValue,
        rate: rateValue
      } 
    }));
  };



  const destinationColumnsCount = visibleColumns.length + 1
  
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

      // Filter by Date Range (using deliveryDate or soDate as fallback)
      const orderDateStr = order.deliveryDate || order.soDate
      if (orderDateStr) {
          const orderDate = new Date(orderDateStr)
          if (filterValues.startDate) {
              const start = new Date(filterValues.startDate)
              if (orderDate < start) matches = false
          }
          if (filterValues.endDate) {
              const end = new Date(filterValues.endDate)
              if (orderDate > end) matches = false
          }
      }

      // Filter by Status (On Time / Expire)
      // "Expire" = deliveryDate is in the past
      // "On Time" = deliveryDate is today or future
      if (filterValues.status) {
          const today = new Date()
          today.setHours(0, 0, 0, 0) // normalized today
          
          if (orderDateStr) {
             const deliveryDate = new Date(orderDateStr)
             if (filterValues.status === "expire") {
                 if (deliveryDate >= today) matches = false
             } else if (filterValues.status === "on-time") {
                 if (deliveryDate < today) matches = false
             }
          }
      }

      return matches
  })

  // Group orders by base DO number (DO-022A, DO-022B → DO-022)
  const displayRows = useMemo(() => {
    const grouped: { [key: string]: any } = {}
    
    filteredPendingOrders.forEach((order) => {
      const originalOrderId = order.doNumber || order.orderNo || "DO-XXX"
      
      // Strip suffix (A, B, C...) from DO number for grouping/display
      const baseDoMatch = originalOrderId.match(/^(DO-\d+)/i)
      const baseDo = baseDoMatch ? baseDoMatch[1] : originalOrderId
      
      // Group by Order Number (baseDo) instead of Customer Name
      const groupKey = baseDo
      
      const products = (order.preApprovalProducts && order.preApprovalProducts.length > 0)
        ? order.preApprovalProducts
        : (order.products || [])

      if (!grouped[groupKey]) {
        grouped[groupKey] = {
          ...order,
          _displayDo: baseDo,
          _allBaseDos: new Set([baseDo]),
          _rowKey: groupKey,
          _allProducts: [],
          _productCount: 0,
          _ordersMap: {} // Map to store details for each base DO
        }
      } else {
        grouped[groupKey]._allBaseDos.add(baseDo)
      }
      
      // Store/Update details for this base DO group
      if (!grouped[groupKey]._ordersMap[baseDo]) {
        grouped[groupKey]._ordersMap[baseDo] = {
          customerName: order.customerName,
          customerType: order.customerType,
          orderPurpose: order.orderPurpose,
          orderType: order.orderType,
          startDate: order.startDate,
          endDate: order.endDate,
          deliveryDate: order.deliveryDate,
          soDate: order.soDate,
          transportType: order.transportType,
          contactPerson: order.contactPerson,
          whatsappNo: order.whatsappNo,
          customerAddress: order.customerAddress,
          paymentTerms: order.paymentTerms,
          advancePaymentTaken: order.advancePaymentTaken,
          advanceAmount: order.advanceAmount,
          isBrokerOrder: order.isBrokerOrder,
          brokerName: order.brokerName,
          depoName: order.depoName,
          orderPunchRemarks: order.orderPunchRemarks,
          totalWithGst: order.totalWithGst,
          _products: []
        }
      }
      
      // Aggregate products and link them to their original order ID
      products.forEach((prod: any) => {
        // Create a copy of the order data (excluding large arrays) to reference during processing
        const { _allProducts, _ordersMap, ...cleanOrderData } = grouped[groupKey]
        
        const productWithId = {
          ...prod,
          _originalOrderId: originalOrderId,
          _baseDo: baseDo,
          _rowKey: `${groupKey}-${prod._pid || prod.id}`,
          _orderData: cleanOrderData // Inject order data for use in submission/processing
        }
        grouped[groupKey]._allProducts.push(productWithId)
        grouped[groupKey]._ordersMap[baseDo]._products.push(productWithId)
      })
      
      grouped[groupKey]._productCount = grouped[groupKey]._allProducts.length
    })
    
    // Finalize display strings
    Object.values(grouped).forEach((grp: any) => {
      grp._displayDo = Array.from(grp._allBaseDos).join(", ")
      
      const allTransports = new Set<string>()
      Object.values(grp._ordersMap).forEach((order: any) => {
          if (order.transportType) allTransports.add(order.transportType)
      })
      grp.transportType = Array.from(allTransports).join(", ")
      
      
      // Aggregate rate fields from ALL products for SKU Price List calculations
      // Handle cases where one row has 15kg rate and another has 1ltr rate
      let collected15KgRate: string | null = null
      let collected1LtrRate: string | null = null
      
      grp._allProducts?.forEach((product: any) => {
        if (product.ratePer15Kg && !collected15KgRate) {
          collected15KgRate = product.ratePer15Kg
        }
        if (product.ratePerLtr && !collected1LtrRate) {
          collected1LtrRate = product.ratePerLtr
        }
      })
      
      grp.ratePer15Kg = collected15KgRate
      grp.ratePerLtr = collected1LtrRate

      // Create a map of oil type to rates for this DO group
      const oilWiseRates: { [key: string]: { ratePer15Kg: string | null, ratePerLtr: string | null } } = {}
      grp._allProducts?.forEach((product: any) => {
        const oilType = product.oilType || "General"
        if (!oilWiseRates[oilType]) {
          oilWiseRates[oilType] = { ratePer15Kg: null, ratePerLtr: null }
        }
        if (product.ratePer15Kg && !oilWiseRates[oilType].ratePer15Kg) {
          oilWiseRates[oilType].ratePer15Kg = product.ratePer15Kg
        }
        if (product.ratePerLtr && !oilWiseRates[oilType].ratePerLtr) {
          oilWiseRates[oilType].ratePerLtr = product.ratePerLtr
        }
      })
      grp.oilWiseRates = oilWiseRates

      // ALSO: Create a map of oil type to rates for EACH baseDo section
      Object.entries(grp._ordersMap).forEach(([baseDo, orderData]: [string, any]) => {
        const doOilWiseRates: { [key: string]: { ratePer15Kg: string | null, ratePerLtr: string | null } } = {}
        orderData._products?.forEach((product: any) => {
          const oilType = product.oilType || "General"
          if (!doOilWiseRates[oilType]) {
            doOilWiseRates[oilType] = { ratePer15Kg: null, ratePerLtr: null }
          }
          if (product.ratePer15Kg && !doOilWiseRates[oilType].ratePer15Kg) {
            doOilWiseRates[oilType].ratePer15Kg = product.ratePer15Kg
          }
          if (product.ratePerLtr && !doOilWiseRates[oilType].ratePerLtr) {
            doOilWiseRates[oilType].ratePerLtr = product.ratePerLtr
          }
        })
        orderData.oilWiseRates = doOilWiseRates
      })
    })
    
    return Object.values(grouped)
  }, [filteredPendingOrders])

  const toggleSelectAll = () => {
    if (selectedRows.length === displayRows.length) {
      setSelectedRows([])
    } else {
      setSelectedRows(displayRows.map(r => r._rowKey))
    }
  }

  const toggleSelectRow = (key: string) => {
    setSelectedRows(prev => 
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }

  const toggleSelectProductRow = (key: string, product?: any) => {
    setSelectedProductRows(prev => {
      const isCurrentlySelected = prev.includes(key)
      
      // If selecting a product and it's not already in productRates, initialize it
      if (!isCurrentlySelected && product && !productRates[key]) {
        setProductRates(prevRates => ({
          ...prevRates,
          [key]: {
            productName: product.productName || product.oilType || "",
            skuName: product.skuName || "",
            approvalQty: product.approvalQty || "",
            rateOfMaterial: product.rateOfMaterial || "",
            orderQty: product.orderQty || "",  // Initialize orderQty from existing product
            rate: "",
            remark: ""
          }
        }))
      }
      
      return isCurrentlySelected ? prev.filter(k => k !== key) : [...prev, key]
    })
  }

  const selectedItems = displayRows.filter(r => selectedRows.includes(r._rowKey))
  
   // Aggregate all products from selected items for the dialog summary count
  const allProductsFromSelectedOrders = useMemo(() => {
    return selectedItems.flatMap(order => {
        const existing = order._allProducts || [];
        // Extract baseDo from order details map (it's the key)
        const baseDoKey = Object.keys(order._ordersMap)[0];
        const nestedNew = dialogNewProducts[baseDoKey] || [];
        return [...existing, ...nestedNew];
    });
  }, [selectedItems, dialogNewProducts]);

  return (
    <WorkflowStageShell
      title="Stage 2: Pre-Approval"
      description="Review and set rates for item requirements."
      pendingCount={displayRows.length}
      historyData={history}
        partyNames={customerNames}
        onFilterChange={setFilterValues}
    >
      <div className="space-y-4">
        <div className="flex justify-end gap-2">
          {selectedRows.length > 0 && (
            <Dialog 
              open={isBulkDialogOpen} 
              onOpenChange={(open) => {
                setIsBulkDialogOpen(open)
                if (!open) {
                  setQtyValidationErrors({})
                  setRateValidationErrors({})
                  setSelectedProductRows([])
                }
              }}
            >
              <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700 shadow-md">
                  Process Selected ({selectedRows.length})
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-6xl max-w-6xl! max-h-[95vh] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                <DialogHeader className="border-b pb-4">
                  <DialogTitle className="text-xl font-bold text-slate-900 leading-none">Complete Pre-Approval ({allProductsFromSelectedOrders.length} Products)</DialogTitle>
                  <DialogDescription className="text-slate-500 mt-1.5">Select and edit products to approve. Only checked products will be processed.</DialogDescription>
                </DialogHeader>
                
                {/* Interleaved Order Details and Product Tables Section */}
                <div className="space-y-12 mb-8">
                  {selectedItems.map((customerGrp) => (
                    <div key={customerGrp._rowKey} className="space-y-6">
                      <h2 className="text-xl font-black text-blue-900 border-b-4 border-blue-100 pb-2 mt-4 uppercase tracking-tight flex items-center justify-between">
                        {customerGrp.customerName}
                        <Badge className="bg-blue-600 text-white ml-3 px-3 py-1 font-black">
                          {customerGrp._productCount} PRODUCTS
                        </Badge>
                      </h2>
                      
                      {/* Iterate through each unique base DO for this customer */}
                      {Object.entries(customerGrp._ordersMap).map(([baseDo, orderDetails]: [string, any], orderIdx) => {
                        const isExpanded = expandedOrders.includes(baseDo);
                        
                        const toggleExpand = () => {
                          setExpandedOrders(prev => 
                            isExpanded ? prev.filter(id => id !== baseDo) : [...prev, baseDo]
                          );
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
                                   <span className="text-xs text-blue-100 font-bold leading-none">{orderDetails._products.length} Items Selected</span>
                                 </div>
                               </div>
                               <div className="flex items-center gap-3">
                                 <div className="text-[11px] text-blue-50 font-bold uppercase tracking-widest mr-2">Click to {isExpanded ? 'Hide' : 'Show'} Details</div>
                                 <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-8 w-8 text-white hover:bg-white/20 rounded-full"
                                  >
                                    {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                                  </Button>
                               </div>
                            </div>

                            {/* Collapsible Order Details */}
                            {isExpanded && (
                              <div className="px-5 pb-5 animate-in slide-in-from-top-2 duration-200">
                                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 shadow-inner">
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                                    <div>
                                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">Customer Name</p>
                                      <p className="text-sm font-bold text-slate-900 leading-tight">{customerGrp.customerName || "—"}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">Depo Name</p>
                                      <p className="text-sm font-bold text-slate-900 leading-tight">{orderDetails.depoName || "—"}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">Delivery Purpose</p>
                                      <p className="text-sm font-bold text-slate-900 leading-tight capitalize">{orderDetails.orderPurpose?.replace(/-/g, ' ') || "—"}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">Order Type</p>
                                      <p className="text-sm font-bold text-slate-900 leading-tight capitalize">{orderDetails.orderType || "—"}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">Start Date</p>
                                      <p className="text-sm font-bold text-slate-900 leading-tight">{formatDate(orderDetails.startDate)}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">End Date</p>
                                      <p className="text-sm font-bold text-slate-900 leading-tight">{formatDate(orderDetails.endDate)}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">SO Date</p>
                                      <p className="text-sm font-bold text-slate-900 leading-tight">{formatDate(orderDetails.soDate)}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">Delivery Date</p>
                                      <p className="text-sm font-bold text-slate-900 leading-tight">{formatDate(orderDetails.deliveryDate)}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">Transport Type</p>
                                      <p className="text-sm font-bold text-slate-900 leading-tight">{orderDetails.transportType || "—"}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">Contact Person</p>
                                      <p className="text-sm font-bold text-slate-900 leading-tight">{orderDetails.contactPerson || "—"}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">WhatsApp No.</p>
                                      <p className="text-sm font-bold text-slate-900 leading-tight">{orderDetails.whatsappNo || "—"}</p>
                                    </div>
                                    <div className="col-span-2">
                                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">Customer Address</p>
                                      <p className="text-sm font-bold text-slate-900 leading-tight">{orderDetails.customerAddress || "—"}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">Payment Terms</p>
                                      <p className="text-sm font-bold text-slate-900 leading-tight capitalize">{orderDetails.paymentTerms || "—"}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">Advance Amount</p>
                                      <p className="text-base font-black text-blue-700 leading-tight">₹{orderDetails.advanceAmount || 0}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">Advance Payment</p>
                                      <p className="text-sm font-bold text-slate-900 leading-tight">{orderDetails.advancePaymentTaken ? "YES" : "NO"}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">Through Broker</p>
                                      <p className="text-sm font-bold text-slate-900 leading-tight">{orderDetails.isBrokerOrder ? orderDetails.brokerName || "Yes" : "No"}</p>
                                    </div>
                                    <div className="col-span-4 bg-amber-50 p-4 rounded-xl border border-amber-100 flex items-start gap-4">
                                      <div className="bg-amber-100 p-2 rounded-lg">
                                        <Settings2 className="h-5 w-5 text-amber-600" />
                                      </div>
                                      <div>
                                        <p className="text-[11px] text-amber-800 font-black uppercase tracking-widest mb-1 leading-none">Order Punch Remarks</p>
                                        <p className="text-sm font-medium text-slate-700 italic leading-snug">"{orderDetails.orderPunchRemarks || "No special instructions provided."}"</p>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Base Rates Summary Table */}
                            {orderDetails.oilWiseRates && Object.keys(orderDetails.oilWiseRates).length > 0 && (
                              <div className="px-5 mb-2">
                                <div className="border border-blue-100 rounded-2xl overflow-hidden shadow-sm bg-blue-50/30">
                                  <Table>
                                    <TableHeader className="bg-blue-600">
                                      <TableRow className="hover:bg-transparent border-blue-600">
                                        <TableHead className="h-8 text-[10px] uppercase font-black text-white tracking-widest pl-4">Base Rate Summary</TableHead>
                                        <TableHead className="h-8 text-[10px] uppercase font-black text-white tracking-widest">Rate / 15KG</TableHead>
                                        <TableHead className="h-8 text-[10px] uppercase font-black text-white tracking-widest">Rate / 1 LTR</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {Object.entries(orderDetails.oilWiseRates).map(([oilType, rates]: [string, any]) => (
                                        <TableRow key={oilType} className="hover:bg-blue-100/20 border-blue-100 last:border-0">
                                          <TableCell className="py-2.5 px-4 text-xs font-black text-blue-900 uppercase tracking-tight">{oilType}</TableCell>
                                          <TableCell className="py-2.5 px-4 text-xs font-black text-blue-600">
                                            <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-md">₹{rates.ratePer15Kg || "—"}</span>
                                          </TableCell>
                                          <TableCell className="py-2.5 px-4 text-xs font-black text-blue-600">
                                            <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-md">₹{rates.ratePerLtr || "—"}</span>
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              </div>
                            )}

                            <div className="flex justify-between items-center px-5 pt-4">
                                <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                    <Badge variant="outline" className="bg-blue-50">SKU LIST</Badge>
                                </h3>
                                <div className="flex items-center gap-2">
                                    <Button 
                                        onClick={() => {
                                            fetchAndCalculateRates({
                                                orderNo: baseDo,
                                                oilWiseRates: orderDetails.oilWiseRates
                                            });
                                            setShowSkuPriceList(true);
                                        }}
                                        variant="outline" 
                                        size="sm" 
                                        className="h-8 gap-2 bg-white hover:bg-green-50 text-green-600 border-green-200"
                                    >
                                        <Search className="h-4 w-4" /> View Catalog
                                    </Button>
                                    <Button 
                                        onClick={() => handleAddProductRow(baseDo, orderDetails)}
                                        variant="outline" 
                                        size="sm" 
                                        className="h-8 gap-2 bg-white hover:bg-blue-50 text-blue-600 border-blue-200"
                                    >
                                        <Plus className="h-4 w-4" /> Add SKU
                                    </Button>
                                </div>
                            </div>

                            {/* Render Product Table for this DO */}
                            <div className="px-5 pb-6">
                              {(() => {
                                const sectionProducts = [...orderDetails._products, ...(dialogNewProducts[baseDo] || [])];
                                const groupOilTypes = Array.from(new Set(sectionProducts.map((p: any) => (p.oilType || "").toLowerCase())));
                                
                                return (
                                  <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-white">
                                    <Table>
                                  <TableHeader>
                                    <TableRow className="bg-slate-50 border-b">
                                      <TableHead className="w-12 text-center text-[10px] uppercase font-black text-slate-500 tracking-wider">Select</TableHead>
                                      <TableHead className="text-[10px] uppercase font-black text-slate-500 tracking-wider">Product Info</TableHead>
                                      <TableHead className="text-[10px] uppercase font-black text-slate-500 tracking-wider">Order Qty</TableHead>
                                      <TableHead className="text-[10px] uppercase font-black text-slate-500 tracking-wider">Select SKU</TableHead>
                                      <TableHead className="text-[10px] uppercase font-black text-slate-500 tracking-wider">Rate (Mat.)</TableHead>
                                      <TableHead className="text-[10px] uppercase font-black text-slate-500 tracking-wider">Appr. Qty</TableHead>
                                       <TableHead className="text-[10px] uppercase font-black text-slate-500 tracking-wider">Final Rate</TableHead>
                                       <TableHead className="text-[10px] uppercase font-black text-slate-500 tracking-wider">Remarks</TableHead>
                                       <TableHead className="w-10 text-center text-[10px] uppercase font-black text-slate-500 tracking-wider">Action</TableHead>
                                     </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {[...orderDetails._products, ...(dialogNewProducts[baseDo] || [])].map((product: any) => {
                                      const rowKey = product._rowKey
                                      const isSelected = selectedProductRows.includes(rowKey)
                                      const hasError = qtyValidationErrors[rowKey]
                                       const isNew = product._isNew;
                                       const maxQty = isNew ? (parseFloat(productRates[rowKey]?.orderQty || "0") || 0) : (parseFloat(product.orderQty) || 0)
                                      
                                      return (
                                        <TableRow 
                                          key={rowKey} 
                                          className={cn(
                                            isSelected ? "bg-blue-50/40" : "",
                                            hasError ? "bg-red-50" : ""
                                          )}
                                        >
                                          <TableCell className="text-center p-3">
                                            <Checkbox 
                                              checked={isSelected}
                                              onCheckedChange={() => toggleSelectProductRow(rowKey, product)}
                                            />
                                          </TableCell>
                                          <TableCell className="p-3">
                                            <div className="flex flex-col">
                                              <span className="text-xs font-black text-slate-900 leading-none mb-1">{product.productName || product.oilType || "—"}</span>
                                              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">{product._originalOrderId}</span>
                                            </div>
                                          </TableCell>
                                          <TableCell className="p-3">
                                            <div className="flex flex-col gap-1">
                                              {!isNew ? (
                                                <>
                                                  <Badge variant="outline" className="border-blue-200 text-blue-700 font-black px-2">{maxQty}</Badge>
                                                  {/* Show remaining qty if approval_qty < order_qty */}
                                                  {product.approvalQty && parseFloat(product.approvalQty) > 0 && parseFloat(product.approvalQty) < maxQty && (
                                                    <span className="text-[9px] text-amber-600 font-bold">
                                                      Remaining: {maxQty - parseFloat(product.approvalQty)}
                                                    </span>
                                                  )}
                                                </>
                                              ) : (
                                                <>
                                                  <Input 
                                                  type="number"
                                                  className="h-9 w-20 text-xs font-black bg-gray-100 border-gray-200"
                                                  value={(() => {
                                                    // Auto-fill from parent product's order qty
                                                    const currentOilType = (productRates[rowKey]?.productName || "").toLowerCase();
                                                    const sameOilTypeProducts = orderDetails._products.filter((p: any) => {
                                                      const pOilType = (p.oilType || p.productName || "").toLowerCase();
                                                      return pOilType.includes("palm") && currentOilType.includes("palm") ||
                                                             (pOilType.includes("rice") || pOilType.includes("rbo")) && (currentOilType.includes("rice") || currentOilType.includes("rbo")) ||
                                                             (pOilType.includes("soya") || pOilType.includes("sbo")) && (currentOilType.includes("soya") || currentOilType.includes("sbo")) ||
                                                             pOilType.includes("sunflower") && currentOilType.includes("sunflower");
                                                    });
                                                    return sameOilTypeProducts.reduce((sum: number, p: any) => sum + (parseFloat(p.orderQty) || 0), 0) || "";
                                                  })()}
                                                  placeholder="Auto"
                                                  disabled={true}
                                                  readOnly={true}
                                                />
                                                </>
                                             )}
                                           </div>
                                          </TableCell>
                                          <TableCell className="p-2 min-w-45">
                                              <Select 
                                                value={productRates[rowKey]?.skuName || ""} 
                                                onValueChange={(value: string) => handleSkuSelection(value, rowKey, product, orderDetails)}
                                                disabled={!isSelected}
                                              >
                                              <SelectTrigger className="h-9 w-full bg-white px-3 border-slate-200 text-xs font-bold shadow-sm">
                                                <SelectValue placeholder="Select SKU..." />
                                              </SelectTrigger>
                                              <SelectContent className="max-h-[300px]">
                                                {skuMaster.filter(sku => {
                                                  const skuLower = sku.toLowerCase();
                                                  
                                                  // Get this specific product's oil type
                                                  const productOilType = (product.oilType || product.productName || "").toLowerCase();
                                                  
                                                  // Filter SKU based on this product's oil type only
                                                  if (productOilType.includes("palm")) {
                                                    return skuLower.includes("palm");
                                                  } else if (productOilType.includes("rice") || productOilType.includes("rbo")) {
                                                    return skuLower.includes("rbo") || skuLower.includes("rice");
                                                  } else if (productOilType.includes("soya") || productOilType.includes("sbo")) {
                                                    return skuLower.includes("sbo") || skuLower.includes("soya");
                                                  } else if (productOilType.includes("sunflower")) {
                                                    return skuLower.includes("sun");
                                                  }
                                                  
                                                  // If no specific oil type identified, show all SKUs (fallback)
                                                  return true;
                                                }).map((sku) => (
                                                  <SelectItem key={sku} value={sku} className="cursor-pointer py-2.5 px-4 text-xs font-bold hover:bg-blue-50 hover:text-blue-700 transition-colors">
                                                    {sku.replace(/MLT/g, 'ML')}
                                                  </SelectItem>
                                                ))}
                                              </SelectContent>
                                            </Select>
                                          </TableCell>
                                          <TableCell className="p-2">
                                            <div className="relative">
                                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] font-black">₹</span>
                                              <Input 
                                                type="number"
                                                className="h-9 text-xs bg-white pl-5 font-bold border-slate-200 focus:border-blue-500 focus:ring-blue-500"
                                                 value={productRates[rowKey]?.skuName ? (productRates[rowKey]?.rateOfMaterial || product.rateOfMaterial || "") : ""}
                                                 onChange={(e) => setProductRates({ 
                                                   ...productRates, 
                                                   [rowKey]: { 
                                                     ...productRates[rowKey], 
                                                     rateOfMaterial: e.target.value 
                                                   } 
                                                 })}
                                                 disabled={!isNew && true}
                                                 readOnly={!isNew}
                                                 placeholder="0.00"
                                               />
                                            </div>
                                          </TableCell>
                                          <TableCell className="p-2">
                                            <Input 
                                              type="number" 
                                              placeholder="Qty"
                                              className={cn(
                                                "h-9 text-xs bg-white font-bold border-slate-200 focus:border-blue-500 focus:ring-blue-500",
                                                hasError && "border-red-500 ring-1 ring-red-500"
                                              )}
                                              value={productRates[rowKey]?.approvalQty || ""} 
                                              onChange={(e) => {
                                                const value = e.target.value
                                                const qty = parseFloat(value) || 0
                                                
                                                // Calculate total order qty for all products in this order
                                                const allProducts = [...orderDetails._products, ...(dialogNewProducts[baseDo] || [])]
                                                const originalTotalOrderQty = orderDetails._products.reduce((sum: number, p: any) => sum + (parseFloat(p.orderQty) || 0), 0);
                                                const totalOrderQty = allProducts.reduce((sum, p) => {
                                                  const pQty = p._isNew 
                                                    ? (parseFloat(productRates[p._rowKey]?.orderQty || '0') || 0) 
                                                    : (parseFloat(p.orderQty) || 0)
                                                  return sum + pQty
                                                }, 0)
                                                
                                                // Calculate total approval qty including this change
                                                const totalApprovalQty = allProducts.reduce((sum, p) => {
                                                  if (p._rowKey === rowKey) {
                                                    return sum + qty  // Use the new value for current product
                                                  }
                                                  const approvalQty = parseFloat(productRates[p._rowKey]?.approvalQty || '0') || 0
                                                  return sum + approvalQty
                                                }, 0)
                                                
                                                // Validate only against total original budget (flexible distribution allowed)
                                                if (value && totalApprovalQty > originalTotalOrderQty) {
                                                  setQtyValidationErrors({
                                                    ...qtyValidationErrors,
                                                    [rowKey]: `Total exceeds budget ${originalTotalOrderQty}`
                                                  })
                                                } else {
                                                  const newErrors = {...qtyValidationErrors}
                                                  delete newErrors[rowKey]
                                                  setQtyValidationErrors(newErrors)
                                                }
                                                
                                                // Add informational notice if using other oil types' budget
                                                // Group by oil type to handle multiple SKUs for same product
                                                const currentOilType = (product.oilType || product.productName || productRates[rowKey]?.productName || "").toLowerCase()
                                                
                                                // Calculate total order qty for THIS oil type (ONLY from original products, not new SKUs)
                                                const sameOilTypeProducts = allProducts.filter(p => {
                                                  if (p._isNew) return false; // Exclude new SKUs from budget calculation
                                                  const pOilType = (p.oilType || p.productName || "").toLowerCase()
                                                  return pOilType.includes("palm") && currentOilType.includes("palm") ||
                                                         (pOilType.includes("rice") || pOilType.includes("rbo")) && (currentOilType.includes("rice") || currentOilType.includes("rbo")) ||
                                                         (pOilType.includes("soya") || pOilType.includes("sbo")) && (currentOilType.includes("soya") || currentOilType.includes("sbo")) ||
                                                         pOilType.includes("sunflower") && currentOilType.includes("sunflower")
                                                })
                                                
                                                const totalOilTypeOrderQty = sameOilTypeProducts.reduce((sum, p) => {
                                                  return sum + (parseFloat(p.orderQty) || 0)
                                                }, 0)
                                                
                                                // Calculate ALREADY APPROVED qty for THIS oil type (excluding current row)
                                                const alreadyApprovedQty = allProducts.reduce((sum, p) => {
                                                  const pKey = p._rowKey
                                                  if (pKey === rowKey) return sum; // Skip current row
                                                  
                                                  // Check if same oil type
                                                  const pOilType = (p.oilType || p.productName || (p._isNew ? productRates[pKey]?.productName : "")).toLowerCase()
                                                  const isSameType = 
                                                    pOilType.includes("palm") && currentOilType.includes("palm") ||
                                                    (pOilType.includes("rice") || pOilType.includes("rbo")) && (currentOilType.includes("rice") || currentOilType.includes("rbo")) ||
                                                    (pOilType.includes("soya") || pOilType.includes("sbo")) && (currentOilType.includes("soya") || currentOilType.includes("sbo")) ||
                                                    pOilType.includes("sunflower") && currentOilType.includes("sunflower")
                                                  
                                                  if (!isSameType) return sum;
                                                  
                                                  const pApproved = parseFloat(productRates[pKey]?.approvalQty || '0') || 0
                                                  return sum + pApproved
                                                }, 0)
                                                
                                                // Calculate REMAINING budget for this oil type
                                                const remainingBudget = totalOilTypeOrderQty - alreadyApprovedQty
                                                
                                                // Calculate total approved qty for THIS oil type (including current change)
                                                const totalOilTypeApprovedQty = alreadyApprovedQty + qty
                                                
                                                // Check if exceeding THIS oil type's total budget
                                                if (value && totalOilTypeApprovedQty > totalOilTypeOrderQty) {
                                                  // Exceeding budget - need to borrow from other oil types
                                                  const usedFromSameOil = remainingBudget > 0 ? remainingBudget : 0
                                                  const borrowedQty = qty - usedFromSameOil
                                                  
                                                  // Find products of OTHER oil types (only original products)
                                                  const otherOilTypeProducts = allProducts.filter(p => {
                                                    if (p._isNew) return false; // Exclude new SKUs
                                                    const pOilType = (p.oilType || p.productName || "").toLowerCase()
                                                    const isSameType = 
                                                      pOilType.includes("palm") && currentOilType.includes("palm") ||
                                                      (pOilType.includes("rice") || pOilType.includes("rbo")) && (currentOilType.includes("rice") || currentOilType.includes("rbo")) ||
                                                      (pOilType.includes("soya") || pOilType.includes("sbo")) && (currentOilType.includes("soya") || currentOilType.includes("sbo")) ||
                                                      pOilType.includes("sunflower") && currentOilType.includes("sunflower")
                                                    return !isSameType
                                                  })
                                                  
                                                  // Calculate remaining budget in other oil types
                                                  const otherOilTypeRemaining = otherOilTypeProducts.reduce((sum, p) => {
                                                    const pOrderQty = parseFloat(p.orderQty) || 0
                                                    const pApproved = parseFloat(productRates[p._rowKey]?.approvalQty || '0') || 0
                                                    return sum + (pOrderQty - pApproved)
                                                  }, 0)
                                                  
                                                  const otherOilTypeName = otherOilTypeProducts[0]?.productName || otherOilTypeProducts[0]?.oilType || 'other product'
                                                  const sameOilTypeName = sameOilTypeProducts[0]?.productName || sameOilTypeProducts[0]?.oilType || 'product'
                                                  
                                                  // Check if we have enough in other oil types
                                                  if (otherOilTypeRemaining >= borrowedQty) {
                                                    // Can borrow from other oil types
                                                    if (usedFromSameOil > 0) {
                                                      setQtyInfoNotices({
                                                        ...qtyInfoNotices,
                                                        [rowKey]: `Using ${usedFromSameOil} from ${sameOilTypeName}, ${borrowedQty} from ${otherOilTypeName}`
                                                      })
                                                    } else {
                                                      setQtyInfoNotices({
                                                        ...qtyInfoNotices,
                                                        [rowKey]: `Using ${borrowedQty} from ${otherOilTypeName}`
                                                      })
                                                    }
                                                  } else {
                                                    // Not enough budget even after borrowing - show exceed message
                                                    const totalAvailable = remainingBudget + otherOilTypeRemaining
                                                    setQtyInfoNotices({
                                                      ...qtyInfoNotices,
                                                      [rowKey]: `⚠️ Exceeds total available budget (${totalAvailable} available)`
                                                    })
                                                  }
                                                } else if (value && qty > 0) {
                                                  // Within budget - show informational notice
                                                  const sameOilTypeName = sameOilTypeProducts[0]?.productName || sameOilTypeProducts[0]?.oilType || 'product'
                                                  setQtyInfoNotices({
                                                    ...qtyInfoNotices,
                                                    [rowKey]: `Using ${qty} from ${sameOilTypeName}'s ${totalOilTypeOrderQty} budget`
                                                  })
                                                } else {
                                                  const newNotices = {...qtyInfoNotices}
                                                  delete newNotices[rowKey]
                                                  setQtyInfoNotices(newNotices)
                                                }
                                                
                                                
                                                
                                                setProductRates({ 
                                                  ...productRates, 
                                                  [rowKey]: { 
                                                    ...productRates[rowKey], 
                                                    approvalQty: value 
                                                  } 
                                                })
                                              }} 
                                              disabled={!isSelected}
                                            />
                                            {hasError && <p className="text-[9px] text-red-600 font-black mt-1 uppercase tracking-tighter text-center">{hasError}</p>}
                                            {!hasError && qtyInfoNotices[rowKey] && (
                                              <p className="text-[9px] text-blue-600 font-bold mt-1 tracking-tight text-center leading-tight">
                                                ℹ️ {qtyInfoNotices[rowKey]}
                                              </p>
                                            )}
                                          </TableCell>
                                          <TableCell className="p-2">
                                            <div className="relative">
                                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-blue-400 text-[10px] font-black">₹</span>
                                              <Input 
                                                type="number" 
                                                className={cn(
                                                  "h-9 text-xs bg-white font-black text-blue-700 border-slate-200 focus:border-blue-500 focus:ring-blue-500 pl-5",
                                                  rateValidationErrors[rowKey] && "border-red-500 ring-1 ring-red-500"
                                                )}
                                                value={productRates[rowKey]?.rate || ""} 
                                                onChange={(e) => {
                                                  const newValue = e.target.value;
                                                  const enteredRate = parseFloat(newValue) || 0;
                                                  const rateOfMaterial = parseFloat(productRates[rowKey]?.rateOfMaterial || product.rateOfMaterial || "0");
                                                  
                                                  if (newValue && enteredRate < rateOfMaterial) {
                                                    setRateValidationErrors({
                                                      ...rateValidationErrors,
                                                      [rowKey]: `Min ₹${rateOfMaterial}`
                                                    });
                                                  } else {
                                                    const newErrors = { ...rateValidationErrors };
                                                    delete newErrors[rowKey];
                                                    setRateValidationErrors(newErrors);
                                                  }

                                                  setProductRates({ 
                                                    ...productRates, 
                                                    [rowKey]: { 
                                                      ...productRates[rowKey], 
                                                      rate: newValue
                                                    } 
                                                  });
                                                }}
                                                disabled={!isSelected}
                                                placeholder="0.00"
                                              />
                                              {rateValidationErrors[rowKey] && (
                                                <p className="text-[9px] text-red-600 font-black mt-1 uppercase tracking-tighter text-center">
                                                  {rateValidationErrors[rowKey]}
                                                </p>
                                              )}
                                            </div>
                                          </TableCell>
                                          <TableCell className="p-2">
                                            <Input 
                                              className="h-9 text-[10px] bg-white border-slate-200 italic font-medium"
                                              value={productRates[rowKey]?.remark || ""}
                                              onChange={(e) => setProductRates({ 
                                                ...productRates, 
                                                [rowKey]: { 
                                                  ...productRates[rowKey], 
                                                  remark: e.target.value 
                                                } 
                                              })}
                                              disabled={!isSelected}
                                               placeholder="Add review remark..."
                                             />
                                           </TableCell>
                                           <TableCell className="p-2 text-center">
                                              {!isNew && (
                                                <Button
                                                  variant="ghost"
                                                  size="icon"
                                                  onClick={() => handleDeleteProduct(product.id, product._originalOrderId)}
                                                  className="h-8 w-8 text-destructive hover:text-red-700 hover:bg-red-50"
                                                >
                                                  <Trash2 className="h-4 w-4" />
                                                </Button>
                                              )}
                                              {isNew && (
                                                <Button
                                                  variant="ghost"
                                                  size="icon"
                                                  onClick={() => {
                                                    setDialogNewProducts(prev => ({
                                                      ...prev,
                                                      [baseDo]: prev[baseDo].filter(p => p._pid !== product._pid)
                                                    }));
                                                    setSelectedProductRows(prev => prev.filter(k => k !== rowKey));
                                                  }}
                                                  className="h-8 w-8 text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                                                >
                                                  <Trash2 className="h-4 w-4" />
                                                </Button>
                                              )}
                                           </TableCell>
                                         </TableRow>
                                      )
                                    })}
                                  </TableBody>
                                  <tfoot className="bg-slate-100/80 border-t-2 border-slate-200">
                                    <TableRow>
                                      <TableCell colSpan={2} className="p-3 text-right">
                                        <span className="text-[10px] uppercase font-black text-slate-500 tracking-wider">Totals:</span>
                                      </TableCell>
                                       <TableCell className="p-3">
                                         <Badge variant="secondary" className="bg-blue-100 text-blue-800 font-black px-2 shadow-sm border-blue-200">
                                           {[...orderDetails._products, ...(dialogNewProducts[baseDo] || [])].reduce((sum: number, p: any) => {
                                             // Only count original products, not new SKUs
                                             if (p._isNew) return sum;
                                             const qty = parseFloat(p.orderQty) || 0;
                                             return sum + qty;
                                           }, 0)}
                                         </Badge>
                                       </TableCell>
                                      <TableCell colSpan={2}></TableCell>
                                      <TableCell className="p-3 text-center">
                                        <Badge variant="secondary" className="bg-green-100 text-green-800 font-black px-2 shadow-sm border-green-200">
                                          {[...orderDetails._products, ...(dialogNewProducts[baseDo] || [])].reduce((sum: number, p: any) => {
                                            const rowKey = p._rowKey;
                                            return sum + (parseFloat(productRates[rowKey]?.approvalQty) || 0);
                                          }, 0)}
                                        </Badge>
                                      </TableCell>
                                      <TableCell colSpan={2}></TableCell>
                                    </TableRow>
                                  </tfoot>
                                </Table>
                              </div>
                                    )
                                  })()}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>


                

                <DialogFooter className="sm:justify-between gap-3 border-t pt-4">
                  {/* SKU Price List Button */}
                  
                  <div className="flex gap-3">
                    <Button variant="outline" onClick={() => {
                      setIsBulkDialogOpen(false)
                      setSelectedProductRows([])
                      setQtyValidationErrors({})
                      setRateValidationErrors({})
                      setQtyInfoNotices({})
                    }}>Cancel</Button>
                    <Button 
                      onClick={() => {
                        // Filter to only selected products
                        const selectedProducts = allProductsFromSelectedOrders.filter(p => selectedProductRows.includes(p._rowKey))
                        const itemsToApprove = selectedProducts.map(prod => ({
                          _product: prod,
                          _rowKey: prod._rowKey,
                          _displayDo: prod._originalOrderId,
                          customerName: prod._orderData.customerName,
                          orderType: prod._orderData.orderType
                        }))
                        handleApproveWithAdditions(itemsToApprove)
                      }} 
                      disabled={
                        isApproving || 
                        selectedProductRows.length === 0 ||
                        Object.keys(qtyValidationErrors).length > 0 ||
                        Object.keys(rateValidationErrors).length > 0
                      }
                      className="min-w-50 h-11 bg-blue-600 font-bold shadow-lg"
                    >
                      {isApproving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {isApproving ? "Processing..." : `Submit ${selectedProductRows.length} Product(s)`}
                    </Button>
                  </div>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="bg-transparent shadow-sm">
                <Settings2 className="mr-2 h-4 w-4" />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-62.5 max-h-100 overflow-y-auto">
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

        <Card className="border-none shadow-sm overflow-auto max-h-150">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-card shadow-sm">
              <TableRow>
                <TableHead className="w-12 text-center">
                  <Checkbox 
                    checked={displayRows.length > 0 && selectedRows.length === displayRows.length}
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
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={visibleColumns.length + 1} className="text-center py-8">
                    <div className="flex items-center justify-center gap-2 text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>Loading pending approvals...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : displayRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={visibleColumns.length + 1} className="text-center py-8 text-muted-foreground">
                    No Data pending for Pre Approval
                  </TableCell>
                </TableRow>
              ) : displayRows.map((rawOrder, i) => {
                  const CUSTOMER_MAP: Record<string, string> = {
                    cust1: "Acme Corp",
                    cust2: "Global Industries",
                    cust3: "Zenith Supply",
                  }
                  
                  // Get oil types from all products
                  const oilTypes = rawOrder._allProducts?.map((p: any) => p.oilType || p.productName).filter(Boolean).join(", ") || "—"
                  const firstProduct = rawOrder._allProducts?.[0]
                  
                  const row = {
                   orderNo: rawOrder._displayDo,
                   deliveryPurpose: rawOrder.orderPurpose || "Week On Week",
                   customerType: rawOrder.customerType || "Existing",
                   orderType: rawOrder.orderType || "Regular",
                   soNo: rawOrder._displayDo,
                   partySoDate: formatDate(rawOrder.soDate),
                   customerName: CUSTOMER_MAP[rawOrder.customerName] || rawOrder.customerName || "Acme Corp",
                   // Handle new date fields
                   startDate: formatDate(rawOrder.startDate),
                   endDate: formatDate(rawOrder.endDate),
                   deliveryDate: formatDate(rawOrder.deliveryDate),
                   // Show all oil types and product count
                   oilType: `${oilTypes} (${rawOrder._productCount} items)`,
                   ratePerLtr: firstProduct?.ratePerLtr || "—",
                   ratePer15Kg: firstProduct?.ratePer15Kg || "—",
                   
                   itemConfirm: rawOrder.itemConfirm?.toUpperCase() || "YES",
                   productName: firstProduct?.productName || firstProduct?.oilType || "",
                   uom: firstProduct?.uom || "",
                   orderQty: firstProduct?.orderQty || "",
                   altUom: firstProduct?.altUom || "",
                   altQty: firstProduct?.altQty || "",
                   
                   // Extended Columns
                   totalWithGst: rawOrder.totalWithGst || "—",
                   transportType: rawOrder.transportType || "—",
                   contactPerson: rawOrder.contactPerson || "—",
                   whatsapp: rawOrder.whatsappNo || "—",
                   address: rawOrder.customerAddress || "—",
                   paymentTerms: rawOrder.paymentTerms || "—",
                   advanceTaken: rawOrder.advancePaymentTaken || "—",
                   advanceAmount: rawOrder.advanceAmount || "—",
                   isBroker: rawOrder.isBrokerOrder || "—",
                   brokerName: rawOrder.brokerName || "—",
                   uploadSo: "so_document.pdf",
                   
                   products: rawOrder._allProducts || [],
                 }

                return (
                 <TableRow key={rawOrder._rowKey} className={selectedRows.includes(rawOrder._rowKey) ? "bg-blue-50/50" : ""}>
                   <TableCell className="text-center">
                     <Checkbox 
                       checked={selectedRows.includes(rawOrder._rowKey)}
                       onCheckedChange={() => toggleSelectRow(rawOrder._rowKey)}
                     />
                   </TableCell>
                   {PAGE_COLUMNS.filter((col) => visibleColumns.includes(col.id)).map((col) => (
                     <TableCell key={col.id} className="whitespace-nowrap text-center">
                       {row[col.id as keyof typeof row]}
                     </TableCell>
                   ))}
                 </TableRow>
                )
               })}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* SKU Price List Modal */}
      <Dialog open={showSkuPriceList} onOpenChange={setShowSkuPriceList}>
        <DialogContent className="w-[95vw] max-w-[95vw] lg:max-w-6xl max-h-[90vh] overflow-hidden flex flex-col p-4">
          <DialogHeader className="px-2 pt-2">
            <div className="flex items-center justify-between">
              <div>
                 <DialogTitle className="text-2xl font-black text-blue-900 tracking-tight uppercase">
                   {catalogContext ? `SKU Price List for ${catalogContext.orderNo}` : "SKU Price List Catalog"}
                 </DialogTitle>
                <DialogDescription className="text-slate-500 font-bold text-xs mt-1">
                  Automated rate calculations based on Order Punch inputs.
                </DialogDescription>
              </div>
              <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-blue-200 px-4 py-1.5 font-black text-xs">
                {Object.keys(calculatedPrices).length} OIL CATEGORIES
              </Badge>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-hidden mt-6">
            {loadingRates ? (
              <div className="h-full flex flex-col justify-center items-center">
                <div className="relative h-20 w-20">
                  <div className="absolute inset-0 rounded-full border-4 border-blue-100 opacity-25"></div>
                  <div className="absolute inset-0 rounded-full border-4 border-t-blue-600 animate-spin"></div>
                </div>
                <p className="text-sm font-black text-blue-900 mt-6 uppercase tracking-widest animate-pulse">Calculating Market Rates...</p>
              </div>
            ) : Object.keys(calculatedPrices).length === 0 ? (
              <div className="h-full flex flex-col justify-center items-center text-slate-400">
                <Search className="h-16 w-16 mb-4 opacity-20" />
                <p className="text-lg font-bold">No Rate Context Available</p>
                <p className="text-sm font-medium mt-1">Please ensure rates were defined during Order Punch.</p>
              </div>
            ) : (
              <Tabs value={activeOilTab} onValueChange={setActiveOilTab} className="h-full flex flex-col">
                <div className="border-b border-slate-100 pb-2 overflow-x-auto [&::-webkit-scrollbar]:hidden">
                  <TabsList className="bg-slate-50/50 p-1 rounded-2xl border border-slate-200 inline-flex">
                    {Object.keys(calculatedPrices).map(oilType => (
                      <TabsTrigger 
                        key={oilType} 
                        value={oilType}
                        className="rounded-xl px-6 py-2.5 text-xs font-black uppercase tracking-tight data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm transition-all"
                      >
                        {oilType}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </div>

                <div className="flex-1 overflow-hidden mt-4">
                  {Object.entries(calculatedPrices).map(([oilType, prices]) => (
                    <TabsContent key={oilType} value={oilType} className="h-full focus-visible:ring-0 mt-0 data-[state=inactive]:hidden">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full pb-4">
                        {/* Bulk SKUs Category */}
                        <div className="flex flex-col h-full bg-blue-50/30 rounded-4xl border-2 border-blue-100/50 overflow-hidden shadow-inner">
                          <div className="p-5 flex items-center justify-between border-b border-blue-100/50">
                            <div className="flex items-center gap-3">
                              <div className="bg-blue-600 p-2 rounded-xl shadow-lg shadow-blue-200">
                                <Package className="h-4 w-4 text-white" />
                              </div>
                              <span className="text-sm font-black text-blue-900 uppercase tracking-widest">Bulk Packaging</span>
                            </div>
                            <Badge variant="outline" className="bg-white border-blue-200 text-blue-700 font-bold px-3">
                               {prices.filter(item => {
                                 const sku = item.sku.toUpperCase();
                                 const isLargeSize = sku.includes('12') || sku.includes('13') || sku.includes('15') || sku.includes('20') || sku.includes('25');
                                 const hasBulkKeyword = sku.includes('KG') || sku.includes('TIN') || sku.includes('JAR') || sku.includes('BKT') || sku.includes('LTR');
                                 return isLargeSize && hasBulkKeyword;
                               }).length} SKUS
                            </Badge>
                          </div>
                          <div className="flex-1 overflow-y-auto px-2 py-2 max-h-120 scrollbar-auto border-t border-blue-100/30">
                            <Table>
                              <TableBody>
                                 {prices
                                   .filter(item => {
                                     const sku = item.sku.toUpperCase();
                                     const isLargeSize = sku.includes('12') || sku.includes('13') || sku.includes('15') || sku.includes('20') || sku.includes('25');
                                     const hasBulkKeyword = sku.includes('KG') || sku.includes('TIN') || sku.includes('JAR') || sku.includes('BKT') || sku.includes('LTR');
                                     return isLargeSize && hasBulkKeyword;
                                   })
                                  .map((item, idx) => (
                                    <TableRow key={idx} className="hover:bg-blue-100/50 transition-colors border-none group">
                                      <TableCell className="font-semibold text-slate-800 py-3 text-sm rounded-l-2xl pl-6">
                                        <div className="flex items-center gap-3">
                                          <span className="text-[10px] font-black text-blue-300 w-4 group-hover:text-blue-500 transition-colors">{(idx + 1).toString().padStart(2, '0')}</span>
                                          {item.sku}
                                        </div>
                                      </TableCell>
                                      <TableCell className="text-right font-black text-blue-700 text-lg py-3 pr-6 rounded-r-2xl">
                                        <span className="text-xs text-blue-300 mr-1 opacity-50 font-normal">₹</span>
                                        {item.calculatedRate}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>

                        {/* Retail SKUs Category */}
                        <div className="flex flex-col h-full bg-green-50/30 rounded-4xl border-2 border-green-100/50 overflow-hidden shadow-inner">
                          <div className="p-5 flex items-center justify-between border-b border-green-100/50">
                            <div className="flex items-center gap-3">
                              <div className="bg-green-600 p-2 rounded-xl shadow-lg shadow-green-200">
                                <Search className="h-4 w-4 text-white" />
                              </div>
                              <span className="text-sm font-black text-green-900 uppercase tracking-widest">Retail Packs</span>
                            </div>
                            <Badge variant="outline" className="bg-white border-green-200 text-green-700 font-bold px-3">
                               {prices.filter(item => {
                                 const sku = item.sku.toUpperCase();
                                 const isLargeSize = sku.includes('12') || sku.includes('13') || sku.includes('15') || sku.includes('20') || sku.includes('25');
                                 const hasBulkKeyword = sku.includes('KG') || sku.includes('TIN') || sku.includes('JAR') || sku.includes('BKT') || sku.includes('LTR');
                                 return !(isLargeSize && hasBulkKeyword);
                               }).length} SKUS
                            </Badge>
                          </div>
                          <div className="flex-1 overflow-y-auto px-2 py-2 max-h-120 scrollbar-auto border-t border-green-100/30">
                            <Table>
                              <TableBody>
                                 {prices
                                   .filter(item => {
                                     const sku = item.sku.toUpperCase();
                                     const isLargeSize = sku.includes('12') || sku.includes('13') || sku.includes('15') || sku.includes('20') || sku.includes('25');
                                     const hasBulkKeyword = sku.includes('KG') || sku.includes('TIN') || sku.includes('JAR') || sku.includes('BKT') || sku.includes('LTR');
                                     return !(isLargeSize && hasBulkKeyword);
                                   })
                                  .map((item, idx) => (
                                    <TableRow key={idx} className="hover:bg-green-100/50 transition-colors border-none group">
                                      <TableCell className="font-semibold text-slate-800 py-3 text-sm rounded-l-2xl pl-6">
                                        <div className="flex items-center gap-3">
                                          <span className="text-[10px] font-black text-green-300 w-4 group-hover:text-green-500 transition-colors">{(idx + 1).toString().padStart(2, '0')}</span>
                                          {item.sku}
                                        </div>
                                      </TableCell>
                                      <TableCell className="text-right font-black text-green-700 text-lg py-3 pr-6 rounded-r-2xl">
                                        <span className="text-xs text-green-300 mr-1 opacity-50 font-normal">₹</span>
                                        {item.calculatedRate}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      </div>
                    </TabsContent>
                  ))}
                </div>
              </Tabs>
            )}
          </div>
          
          <DialogFooter className="px-2 pb-2 mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowSkuPriceList(false)}
              className="rounded-2xl border-2 border-slate-200 font-black text-xs uppercase tracking-widest px-8 hover:bg-slate-50 transition-all h-12"
            >
              Close Catalog
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </WorkflowStageShell>
  )
}