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
import { Upload, X, Plus, Settings2, ShieldAlert, ShieldCheck, Truck, ChevronDown, ChevronUp, FileText } from "lucide-react"
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ALL_WORKFLOW_COLUMNS as ALL_COLUMNS } from "@/lib/workflow-columns"
import { securityGuardApprovalApi, orderApi } from "@/lib/api-service"
import { useAuth } from "@/hooks/use-auth"
import { useQuery } from "@tanstack/react-query"
import { Loader2, ChevronLeft, ChevronRight, Filter, RotateCcw, ExternalLink } from "lucide-react"

export default function SecurityApprovalPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { isReadOnly, user } = useAuth()
  const [confirmDetails, setConfirmDetails] = useState<Record<string, { qty: string }>>({})
  const [expandedOrders, setExpandedOrders] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending")
  const [pendingPage, setPendingPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);

  const [filterValues, setFilterValues] = useState({
    status: "",
    startDate: "",
    endDate: "",
    partyName: "all",
    search: ""
  })

  const [filterOptions, setFilterOptions] = useState<{ customerNames: string[], depots: string[] }>({
    customerNames: [],
    depots: []
  });
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

  const renderDocumentLink = (value: string) => {
    if (!value || value === "—") return <p className="text-[10px] font-black text-slate-400 leading-none">NOT UPLOADED</p>;
    
    // Check if it's a URL
    if (String(value).startsWith('http')) {
      return (
        <a 
          href={value} 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-1 bg-violet-50 text-violet-700 rounded-lg hover:bg-violet-100 transition-all border border-violet-200 w-fit group shadow-sm mt-0.5"
        >
          <FileText className="h-3 w-3 group-hover:scale-110 transition-transform" />
          <span className="text-[10px] font-black uppercase tracking-tight">VIEW PHOTO</span>
        </a>
      );
    }
    
    return <p className="text-xs font-bold text-slate-700 leading-none">{formatDate(value)}</p>;
  };

  const [visibleColumns, setVisibleColumns] = useState<string[]>([
    "partySoDate",
    "orderNo",
    "customerName",
    "status",
  ])
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [selectedGroups, setSelectedGroups] = useState<any[]>([])
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isUploading, setIsUploading] = useState<string | null>(null)
  const [uploadData, setUploadData] = useState({
    biltyNo: "",
    biltyImage: "" as string,
    biltyImageName: "",
    vehicleImages: [] as string[],
    vehicleImageNames: [] as string[],
    checklist: {
      mallLoad: false,
      qtyMatch: false,
      gaadiCovered: false,
      image: false,
      driverCond: false,
    },
    verdict: "", // Removed default selection to force user intent
    remarks: "", // Added state to track revert remarks
  })

  // Fetch filter options
  useEffect(() => {
    const fetchFilters = async () => {
      try {
        const res = await securityGuardApprovalApi.getFilters();
        if (res.success) {
          setFilterOptions(res.data);
        }
      } catch (err) {
        console.error("Failed to fetch filters", err);
      }
    };
    fetchFilters();
  }, []);

  // Pending query with numeric pagination
  const {
    data: pendingResult,
    isLoading: isPendingLoading,
    refetch: refetchPending,
  } = useQuery({
    queryKey: ["security-approval-pending", filterValues, pendingPage],
    queryFn: async () => {
      const response = await securityGuardApprovalApi.getPending({
        page: pendingPage,
        limit: 10,
        search: filterValues.search,
        customer_name: filterValues.partyName === "all" ? undefined : filterValues.partyName,
      });
      return response.success ? response.data : { approvals: [], pagination: { total: 0 } };
    },
  });

  // History query with numeric pagination
  const {
    data: historyResult,
    isLoading: isHistoryLoading,
    refetch: refetchHistory,
  } = useQuery({
    queryKey: ["security-approval-history", filterValues, historyPage],
    queryFn: async () => {
      const response = await securityGuardApprovalApi.getHistory({
        page: historyPage,
        limit: 10,
        search: filterValues.search,
        customer_name: filterValues.partyName === "all" ? undefined : filterValues.partyName,
        start_date: filterValues.startDate,
        end_date: filterValues.endDate,
      });
      return response.success ? response.data : { approvals: [], pagination: { total: 0 } };
    },
    enabled: activeTab === "history",
  });

  const pendingOrders = useMemo(() => {
    return pendingResult?.approvals || [];
  }, [pendingResult]);

  const historyOrders = useMemo(() => {
    return historyResult?.approvals?.map((record: any) => ({
      ...record,
      orderNo: record.so_no,
      doNumber: record.d_sr_number,
      customerName: (record.transfer === 'yes' && record.bill_company_name) ? record.bill_company_name : record.party_name,
      stage: "Security Approval",
      status: "Completed" as const,
      processedBy: "System",
      timestamp: record.actual_4,
      date: record.actual_4 ? new Date(record.actual_4).toLocaleDateString("en-GB") : "-",
      remarks: record.bilty_no || "-",
      rawData: record,
    })) || [];
  }, [historyResult]);

  // Reset pages when filters change
  useEffect(() => {
    setPendingPage(1);
    setHistoryPage(1);
  }, [filterValues]);

  const handleFileUpload = async (file: File, type: 'bilty' | 'vehicle') => {
    if (!file) return;

    const uploadId = type === 'bilty' ? 'bilty' : `vehicle-${Date.now()}`;
    setIsUploading(uploadId);

    try {
      const response = await orderApi.uploadFile(file);
      if (response.success) {
        if (type === 'bilty') {
          setUploadData(p => ({
            ...p,
            biltyImage: response.data.url,
            biltyImageName: file.name
          }));
        } else {
          setUploadData(p => ({
            ...p,
            vehicleImages: [...p.vehicleImages, response.data.url],
            vehicleImageNames: [...p.vehicleImageNames, file.name]
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
    // refetchPending and refetchHistory are already initiated by the queryKey dependency on filterValues
  }, [])

  const handleBulkSubmit = async () => {
    if (selectedGroups.length === 0) return

    // Submit only selected products across all groups
    const allSelectedProducts = selectedGroups.flatMap(group =>
      group._allProducts.filter((p: any) => selectedProducts.includes(p._rowKey))
    )

    if (allSelectedProducts.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one product to process",
        variant: "destructive"
      })
      return
    }

    if (!uploadData.verdict) {
      toast({
        title: "Error",
        description: "Please select a Security Verdict",
        variant: "destructive"
      })
      return
    }

    if (uploadData.verdict === "REJECT" && !uploadData.remarks?.trim()) {
      toast({
        title: "Error",
        description: "Please provide a reason for rejecting via the Revert Remarks field",
        variant: "destructive"
      })
      return
    }

    setIsProcessing(true)
    try {
      const successfulSubmissions: any[] = []
      const failedSubmissions: any[] = []

      // Submit each selected product to backend API
      for (const product of allSelectedProducts) {
        const recordId = product.id; // Use the lift_receiving_confirmation table ID

        try {
          if (recordId) {
            const submitData = {
              bilty_no: uploadData.biltyNo || null,
              bilty_image: uploadData.biltyImage || null,
              vehicle_image_attachemrnt: uploadData.vehicleImages.length > 0 ? uploadData.vehicleImages.join(',') : null,
              verdict_status: uploadData.verdict, // Adding verdict to API 
              username: user?.username || null, // Add username for tracking
              remarks: uploadData.verdict === 'REJECT' ? uploadData.remarks : null // Pass remarks if rejecting
            };

            console.log('[SECURITY] Submitting approval for ID:', recordId, submitData);
            const response = await securityGuardApprovalApi.submit(recordId, submitData);
            console.log('[SECURITY] API Response:', response);

            if (response.success) {
              successfulSubmissions.push({ product, response });
            } else {
              failedSubmissions.push({ product, error: response.message || 'Unknown error' });
            }
          } else {
            console.warn('[SECURITY] Skipping - no record ID found for:', product);
            failedSubmissions.push({ product, error: 'No record ID found' });
          }
        } catch (error: any) {
          console.error('[SECURITY] Failed to submit approval:', error);
          failedSubmissions.push({ product, error: error?.message || error?.toString() || 'Unknown error' });
        }
      }

      // Show results
      if (successfulSubmissions.length > 0) {
        toast({
          title: "Security Approved",
          description: `${successfulSubmissions.length} approval(s) completed successfully.`,
        });

        // Clear selections and form
        setSelectedItems([]);
        setIsDialogOpen(false);
        setUploadData({
          biltyNo: "",
          biltyImage: "",
          biltyImageName: "",
          vehicleImages: [],
          vehicleImageNames: [],
          checklist: {
            mallLoad: false,
            qtyMatch: false,
            gaadiCovered: false,
            image: false,
            driverCond: false,
          },
          verdict: "",
          remarks: "",
        });

        // Refresh data from backend
        await refetchPending();
        await refetchHistory();

        // Navigate to next stage after delay
        setTimeout(() => {
          router.push("/make-invoice")
        }, 1500)
      }

      if (failedSubmissions.length > 0) {
        console.error('[SECURITY] Failed submissions:', failedSubmissions);
        toast({
          title: "Some Approvals Failed",
          description: `${failedSubmissions.length} approval(s) failed. Check console for details.`,
          variant: "destructive",
        })
      }
    } catch (error: any) {
      console.error('[SECURITY] Unexpected error:', error);
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
  const customerNames = Array.from(new Set(pendingOrders.map((order: any) => order.party_name || "Unknown")))


  const filteredPendingOrders = pendingOrders;

  // Group orders by actual_1 date and Truck No
  const displayRows = useMemo(() => {
    const grouped: { [key: string]: any } = {}

    filteredPendingOrders.forEach((order: any) => {
      // Step 1: Create a grouping key based on date (YYYY-MM-DD) and truck_no
      const actualDate = order.actual_1 ? order.actual_1.split('T')[0] : 'NoDate'
      const truckNo = (order.truck_no || order.truckNo || 'NoTruck').toUpperCase().trim()
      const groupKey = `${actualDate}_${truckNo}`

      if (!grouped[groupKey]) {
        grouped[groupKey] = {
          _rowKey: groupKey,
          actualDate: actualDate,
          truckNo: truckNo,
          customerNames: new Set<string>(),
          doNumberList: new Set<string>(),
          _allProducts: [],
          _ordersMap: {}, // Group items by DO for interleaved view
          _productCount: 0
        }
      }

      const group = grouped[groupKey]
      const currentCustName = (order.transfer === 'yes' && order.bill_company_name)
        ? order.bill_company_name
        : (order.party_name || order.partyName || "Unknown Customer")
      group.customerNames.add(currentCustName)

      const rawDoNumber = order.so_no || order.soNo || "—"
      const doNumber = rawDoNumber.replace(/[A-Z]+$/, '')
      group.doNumberList.add(doNumber)

      // Handle interleaved grouping (by unique DO)
      const baseDo = doNumber.split(/[A-Z]$/)[0] // Simple base DO extraction
      if (!group._ordersMap[baseDo]) {
        group._ordersMap[baseDo] = {
          _products: [],
          depoName: order.depo_name || order.depoName || "—",
          deliveryPurpose: order.order_type_delivery_purpose || "—",
          orderType: order.order_type || "—",
          startDate: order.start_date,
          endDate: order.end_date,
          deliveryDate: order.delivery_date,
          transportType: order.type_of_transporting || "—",
          contactPerson: order.customer_contact_person_name || "—",
          whatsapp: order.customer_contact_person_whatsapp_no || "—",
          address: order.customer_address || "—",
          paymentTerms: order.payment_terms || "—",
          advanceAmount: order.advance_amount || 0,
          isBroker: order.is_order_through_broker || false,
          brokerName: order.broker_name || "—",
          partyCredit: order.party_credit_status || "Good",
          orderPunchRemarks: order.order_punch_remarks || "—",
          partySoDate: formatDate(order.party_so_date || order.partySoDate),
          uploadSo: order.upload_so || null,
        }
      }

      const product = {
        ...order,
        _rowKey: `${groupKey}-${order.d_sr_number || order.id}`,
        id: order.id,
        specificOrderNo: doNumber,
        productName: order.product_name || order.productName,
        qtyToDispatch: order.actual_qty_dispatch || order.qty_to_be_dispatched || 0,
        deliveryFrom: order.dispatch_from || "—",
        actualQty: order.actual_qty_dispatch,
        truckNo: order.truck_no,
        rstNo: order.rst_no,
        grossWeight: order.gross_weight,
        tareWeight: order.tare_weight,
        netWeight: order.net_weight,
        weightDiff: order.difference || 0,
        reason_of_difference_in_weight_if_any_speacefic: order.reason_of_difference_in_weight_if_any_speacefic,
        transporterName: order.transporter_name,
        dsrNumber: order.d_sr_number,
        processid: order.processid || null
      }

      group._ordersMap[baseDo]._products.push(product)
      group._allProducts.push(product)
      group._productCount = group._allProducts.length
    })

    // Finalize groups
    return Object.values(grouped).map((group: any) => {
      const uniqueCustomers = Array.from(group.customerNames as Set<string>)
      const uniqueDos = Array.from(group.doNumberList as Set<string>)
      const uniqueProcessIds = Array.from(new Set<string>(group._allProducts.map((p: any) => (p.processid as string) || "—")))

      const formatLabel = (list: string[]) => {
        if (list.length === 0) return "—"
        if (list.length === 1) return list[0]
        return `${list[0]} & ${list.length - 1} more`
      }

      return {
        ...group,
        partySoDate: formatDate(group._allProducts[0]?.party_so_date),
        doNumber: formatLabel(uniqueDos),
        customerName: formatLabel(uniqueCustomers),
        processId: formatLabel(uniqueProcessIds),
        vehicleNo: group.truckNo !== 'NOTRUCK' ? group.truckNo : "—",
        orderPunchRemarks: group._allProducts[0]?.order_punch_remarks || "—",
        uploadSo: group._allProducts[0]?.upload_so || group._allProducts[0]?.uploadSo || null,
        isDisabled: group._allProducts.some((p: any) => p.actual_1 == null)
      }
    })
  }, [filteredPendingOrders])

  const toggleSelectItem = (itemKey: string) => {
    setSelectedItems(prev =>
      prev.includes(itemKey)
        ? prev.filter(k => k !== itemKey)
        : [...prev, itemKey]
    )
  }

  const toggleSelectAll = () => {
    const enabledRows = displayRows.filter(r => !r.isDisabled)
    if (selectedItems.length === enabledRows.length && enabledRows.length > 0) {
      setSelectedItems([])
    } else {
      setSelectedItems(enabledRows.map(r => r._rowKey))
    }
  }

  const handleOpenDialog = () => {
    if (selectedItems.length === 0) return

    const targets = displayRows.filter(r => selectedItems.includes(r._rowKey))
    if (targets.length > 0) {
      setSelectedGroups(targets)
      // Select all products for all selected groups by default
      const allRowKeys = targets.flatMap(g => g._allProducts.map((p: any) => p._rowKey))
      setSelectedProducts(allRowKeys)

      setUploadData({
        biltyNo: "",
        biltyImage: "",
        biltyImageName: "",
        vehicleImages: [],
        vehicleImageNames: [],
        checklist: {
          mallLoad: false,
          qtyMatch: false,
          gaadiCovered: false,
          image: false,
          driverCond: false,
        },
        verdict: "",
        remarks: "",
      })
      setIsDialogOpen(true)
    }
  }

  return (
    <WorkflowStageShell
      historyFooter={
        <div className="px-6 py-4 border-t bg-slate-50/50 flex items-center justify-between">
          <div className="text-xs text-slate-500 font-medium tracking-tight">
            Showing <span className="text-slate-900">{(historyPage - 1) * 10 + 1}</span> to <span className="text-slate-900">{Math.min(historyPage * 10, historyResult?.pagination?.total || 0)}</span> of <span className="text-slate-900">{historyResult?.pagination?.total || 0}</span> records
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
              disabled={historyPage === 1 || isHistoryLoading}
              className="h-8 w-8 p-0 border-slate-200 hover:bg-white hover:text-blue-600 disabled:opacity-40 transition-all"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center px-2">
              <span className="text-xs font-semibold text-slate-900">Page {historyPage}</span>
              <span className="text-[10px] text-slate-400 font-medium mx-1">of</span>
              <span className="text-xs font-semibold text-slate-900">{historyResult?.pagination?.totalPages || 1}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setHistoryPage(p => p + 1)}
              disabled={historyPage >= (historyResult?.pagination?.totalPages || 1) || isHistoryLoading}
              className="h-8 w-8 p-0 border-slate-200 hover:bg-white hover:text-blue-600 disabled:opacity-40 transition-all"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      }
      title="Stage 8: Security Guard Approval"
      description="Upload bilty and vehicle images for security verification."
      pendingCount={pendingResult?.pagination?.total || 0}
      historyData={historyOrders}
      onFilterChange={setFilterValues}
      partyNames={filterOptions.customerNames}
      showStatusFilter={true}
      stageLevel={5}
      onTabChange={setActiveTab}
      isHistoryLoading={isHistoryLoading}
      showDateFilters={false}
    >
      <div className="space-y-4">
        <div className="flex justify-end gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="bg-transparent border-slate-200 text-slate-600 hover:bg-slate-50">
                <Settings2 className="mr-2 h-4 w-4" />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-62.5 max-h-100 overflow-y-auto">
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

          <Button
            onClick={handleOpenDialog}
            disabled={selectedItems.length === 0}
            className="bg-purple-600 hover:bg-purple-700 shadow-lg font-black uppercase tracking-tighter italic"
          >
            <Upload className="mr-2 h-4 w-4" />
            Process Security ({selectedItems.length})
          </Button>
        </div>

        <Card className="border-none shadow-xl rounded-3xl overflow-hidden bg-white/50 backdrop-blur-md">
        {/* Desktop Table View */}
        <Card className="hidden md:block border-none shadow-xl rounded-3xl overflow-hidden bg-white/50 backdrop-blur-md">
          <Table>
            <TableHeader className="bg-slate-50 sticky top-0 z-10">
              <TableRow>
                <TableHead className="w-12 text-center">
                  <Checkbox
                    checked={displayRows.length > 0 && selectedItems.length === displayRows.filter(r => !r.isDisabled).length && displayRows.filter(r => !r.isDisabled).length > 0}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead className="text-[10px] uppercase font-black text-slate-500 tracking-wider">DO DATE</TableHead>
                <TableHead className="text-[10px] uppercase font-black text-slate-500 tracking-wider">DO NUMBERS</TableHead>
                <TableHead className="text-[10px] uppercase font-black text-slate-500 tracking-wider">PROCESS ID</TableHead>
                <TableHead className="text-[10px] uppercase font-black text-slate-500 tracking-wider">CUSTOMER NAME</TableHead>
                <TableHead className="text-[10px] uppercase font-black text-slate-500 tracking-wider text-center">ITEM COUNT</TableHead>
                <TableHead className="text-[10px] uppercase font-black text-slate-500 tracking-wider text-center">VEHICLE NO.</TableHead>
                <TableHead className="text-[10px] uppercase font-black text-slate-500 tracking-wider text-center">ORDER PUNCH REMARKS</TableHead>
                <TableHead className="text-[10px] uppercase font-black text-slate-500 tracking-wider text-center">STATUS</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isPendingLoading && pendingOrders.length === 0 ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i} className="opacity-40 border-b border-slate-50">
                    <TableCell className="text-center py-4"><div className="h-4 w-4 bg-slate-200 animate-pulse rounded mx-auto" /></TableCell>
                    <TableCell className="p-4 text-center"><div className="h-3 w-20 bg-slate-200 animate-pulse rounded-full mx-auto" /></TableCell>
                    <TableCell className="p-4"><div className="h-3 w-32 bg-slate-200 animate-pulse rounded-full" /></TableCell>
                    <TableCell className="p-4"><div className="h-3 w-16 bg-slate-200 animate-pulse rounded-full" /></TableCell>
                    <TableCell className="p-4"><div className="h-3 w-40 bg-slate-200 animate-pulse rounded-full" /></TableCell>
                    <TableCell className="text-center p-4"><div className="h-6 w-8 bg-slate-200 animate-pulse rounded mx-auto" /></TableCell>
                    <TableCell className="text-center p-4"><div className="h-3 w-24 bg-slate-200 animate-pulse rounded-full mx-auto" /></TableCell>
                    <TableCell className="text-center p-4"><div className="h-3 w-32 bg-slate-200 animate-pulse rounded-full mx-auto" /></TableCell>
                    <TableCell className="text-center p-4"><div className="h-5 w-24 bg-slate-200 animate-pulse rounded-full mx-auto" /></TableCell>
                  </TableRow>
                ))
              ) : displayRows.length > 0 ? (
                displayRows.map((group) => (
                  <TableRow key={group._rowKey} className={cn("hover:bg-purple-50/30 transition-colors", selectedItems.includes(group._rowKey) ? "bg-purple-50/50" : "")}>
                    <TableCell className="text-center p-4">
                      <Checkbox disabled={group.isDisabled} checked={selectedItems.includes(group._rowKey)} onCheckedChange={() => toggleSelectItem(group._rowKey)} />
                    </TableCell>
                    <TableCell className="p-4 text-center text-xs font-medium">{group.partySoDate}</TableCell>
                    <TableCell className="p-4">
                      <div className="flex flex-wrap gap-1 max-w-sm">
                        {group.doNumber.split(", ").map((doNum: string) => (
                          <Badge key={doNum} variant="outline" className="bg-white text-purple-700 border-purple-200 font-bold text-[10px]">{doNum}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="p-4">
                      <span className="text-xs font-bold text-slate-600">{group.processId}</span>
                    </TableCell>
                    <TableCell className="p-4 font-black text-slate-700 uppercase tracking-tighter italic">{group.customerName}</TableCell>
                    <TableCell className="text-center p-4">
                      <div className="flex flex-col items-center">
                        <span className="font-black text-lg text-slate-800">{group._productCount}</span>
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Products</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center p-4">
                      <span className="text-xs font-bold text-slate-700">{group.vehicleNo}</span>
                    </TableCell>
                    <TableCell className="text-center p-4">
                      <span className="text-xs text-slate-600 font-medium">{group.orderPunchRemarks}</span>
                    </TableCell>
                    <TableCell className="text-center p-4">
                      {group._allProducts.some((p: any) => p.security_guard_status === 'REJECT') ? (
                        <Badge className="bg-red-100 text-red-700 border-red-200 font-black text-[10px] uppercase">REJECTED</Badge>
                      ) : (
                        <Badge className="bg-orange-100 text-orange-700 border-orange-200 font-black text-[10px] uppercase">Pending Guard</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-20">
                    <div className="flex flex-col items-center gap-2">
                      <ShieldAlert className="w-12 h-12 text-slate-200" />
                      <p className="text-slate-400 font-black uppercase tracking-widest text-xs">No vehicles pending for security check</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {/* Pending Pagination Footer */}
          <div className="px-6 py-4 border-t bg-slate-50/50 flex items-center justify-between rounded-b-3xl">
            <div className="text-xs text-slate-500 font-medium tracking-tight">
              Showing <span className="text-slate-900">{(pendingPage - 1) * 10 + 1}</span> to <span className="text-slate-900">{Math.min(pendingPage * 10, pendingResult?.pagination?.total || 0)}</span> of <span className="text-slate-900">{pendingResult?.pagination?.total || 0}</span> orders
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPendingPage(p => Math.max(1, p - 1))}
                disabled={pendingPage === 1 || isPendingLoading}
                className="h-8 w-8 p-0 border-slate-200 hover:bg-white hover:text-blue-600 disabled:opacity-40 transition-all"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center px-2">
                <span className="text-xs font-semibold text-slate-900">Page {pendingPage}</span>
                <span className="text-[10px] text-slate-400 font-medium mx-1">of</span>
                <span className="text-xs font-semibold text-slate-900">{pendingResult?.pagination?.totalPages || 1}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPendingPage(p => p + 1)}
                disabled={pendingPage >= (pendingResult?.pagination?.totalPages || 1) || isPendingLoading}
                className="h-8 w-8 p-0 border-slate-200 hover:bg-white hover:text-blue-600 disabled:opacity-40 transition-all"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>

        {/* Mobile Card View */}
        <div className="md:hidden space-y-4">
          {isPendingLoading && pendingOrders.length === 0 ? (
            [...Array(3)].map((_, i) => (
              <Card key={i} className="p-4 space-y-4 animate-pulse bg-white/50">
                <div className="h-4 w-1/3 bg-slate-200 rounded" />
                <div className="h-8 w-full bg-slate-100 rounded" />
                <div className="h-4 w-1/2 bg-slate-200 rounded" />
              </Card>
            ))
          ) : displayRows.length > 0 ? (
            displayRows.map((group) => (
              <Card key={group._rowKey} className={cn("p-4 border-2 transition-all relative overflow-hidden", selectedItems.includes(group._rowKey) ? "border-purple-500 bg-purple-50/30 shadow-lg" : "border-slate-100 bg-white shadow-sm")}>
                <div className="absolute top-0 left-0 w-1 h-full bg-purple-500" />
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{group.partySoDate}</span>
                      <Checkbox 
                        disabled={group.isDisabled} 
                        checked={selectedItems.includes(group._rowKey)} 
                        onCheckedChange={() => toggleSelectItem(group._rowKey)}
                        className="h-5 w-5 border-2 border-purple-200 data-[state=checked]:bg-purple-600"
                      />
                    </div>
                    
                    <div className="space-y-1">
                      <h4 className="text-sm font-black text-slate-800 uppercase leading-tight italic">{group.customerName}</h4>
                      <div className="flex flex-wrap gap-1">
                        {group.doNumber.split(", ").map((doNum: string) => (
                          <Badge key={doNum} variant="outline" className="bg-purple-50 text-purple-700 border-purple-100 font-bold text-[9px] px-1.5 py-0">#{doNum}</Badge>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 py-2 border-y border-slate-50">
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Vehicle No</p>
                        <p className="text-xs font-bold text-slate-700">{group.vehicleNo}</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Process ID</p>
                        <p className="text-xs font-bold text-slate-700">{group.processId}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Truck className="h-3 w-3 text-slate-400" />
                        <span className="text-xs font-black text-slate-600">{group._productCount} Products</span>
                      </div>
                      {group._allProducts.some((p: any) => p.security_guard_status === 'REJECT') ? (
                        <Badge className="bg-red-100 text-red-700 font-black text-[9px]">REJECTED</Badge>
                      ) : (
                        <Badge className="bg-orange-100 text-orange-700 font-black text-[9px]">PENDING GUARD</Badge>
                      )}
                    </div>

                    {group.orderPunchRemarks && group.orderPunchRemarks !== "—" && (
                      <div className="mt-2 p-2 bg-slate-50 rounded-lg">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Remarks</p>
                        <p className="text-[10px] font-medium text-slate-600 italic">"{group.orderPunchRemarks}"</p>
                      </div>
                    )}

                    {/* Dynamic columns selected by user */}
                    <div className="grid grid-cols-1 gap-y-3 pt-2">
                      {visibleColumns.filter(colId => 
                        !['partySoDate', 'doNumber', 'customerName', 'vehicleNo', 'processId', 'status', 'orderPunchRemarks'].includes(colId)
                      ).map(colId => {
                        const col = ALL_COLUMNS.find(c => c.id === colId);
                        if (!col) return null;
                        let val = group[colId as keyof typeof group] || "—";
                        return (
                          <div key={colId} className="space-y-0.5 border-l-2 border-slate-100 pl-3">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{col.label}</p>
                            <p className="text-xs font-bold text-slate-700 leading-relaxed">{String(val)}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </Card>
            ))
          ) : (
            <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-100">
              <ShieldAlert className="w-12 h-12 text-slate-200 mx-auto mb-4" />
              <p className="text-slate-400 font-black uppercase tracking-widest text-xs">No pending vehicles</p>
            </div>
          )}

          {/* Mobile Pagination */}
          <div className="flex items-center justify-between px-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setPendingPage(p => Math.max(1, p - 1))} disabled={pendingPage === 1}>Prev</Button>
            <span className="text-xs font-black text-slate-500 uppercase">Page {pendingPage} of {pendingResult?.pagination?.totalPages || 1}</span>
            <Button variant="outline" size="sm" onClick={() => setPendingPage(p => p + 1)} disabled={pendingPage >= (pendingResult?.pagination?.totalPages || 1)}>Next</Button>
          </div>
        </div>
        </Card>
      </div>

      {/* Split-View Dialog (Premium Refactor) */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[95vw] max-w-[95vw]! max-h-[95vh] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] p-0">
          <DialogHeader className="border-b p-6 md:p-8 bg-slate-50/50">
            <DialogTitle className="text-xl md:text-2xl font-black text-slate-900 leading-none uppercase tracking-tighter italic">
              Security Verification Audit
            </DialogTitle>
            <DialogDescription className="text-slate-500 mt-2 font-bold uppercase text-[10px] tracking-widest">
              Reviewing {selectedGroups.length} Batch(es) for final gatepass authorization
            </DialogDescription>
          </DialogHeader>

          {selectedGroups.length > 0 && (
            <div className="space-y-12 mt-6">
              {selectedGroups.map((group, groupIdx) => (
                <div key={group._rowKey} className="space-y-6">
                  <h2 className="text-xl font-black text-slate-800 border-b-4 border-slate-100 pb-2 mt-4 uppercase tracking-tight flex items-center justify-between">
                    {group.customerName}
                    <Badge className="bg-blue-600 text-white ml-3 px-3 py-1 font-black">
                      {group._productCount} PRODUCTS
                    </Badge>
                  </h2>

                  {Object.entries(group._ordersMap).map(([baseDo, orderDetails]: [string, any], orderIdx) => {
                    const orderProducts = orderDetails._products;
                    const enabledOrderProducts = orderProducts;
                    const allOrderSelected = enabledOrderProducts.length > 0 && enabledOrderProducts.every((p: any) => selectedProducts.includes(p._rowKey));
                    const isOrderDisabled = false;
                    const isExpanded = expandedOrders.includes(baseDo);
                    const toggleExpand = () => {
                      setExpandedOrders(prev => isExpanded ? prev.filter(id => id !== baseDo) : [...prev, baseDo]);
                    };

                    // Use details from the first product of the order for the details bar
                    const firstProd = orderProducts[0] || {};

                    return (
                      <div key={`${group._rowKey}-${baseDo}`} className="space-y-4 border-2 border-slate-100 rounded-3xl overflow-hidden bg-white shadow-sm">
                        <div className="bg-blue-600 px-5 py-3 flex items-center justify-between cursor-pointer" onClick={toggleExpand}>
                          <div className="flex items-center gap-4">
                            <Badge className="bg-white text-blue-800 hover:bg-white px-4 py-1.5 text-sm font-black tracking-tight rounded-full shadow-sm">
                              ORDER: {baseDo}
                            </Badge>
                            <div className="flex flex-col">
                              <span className="text-[10px] text-blue-100 font-black uppercase tracking-widest leading-none mb-1">GROUP {groupIdx + 1} | SECTION {orderIdx + 1}</span>
                              <span className="text-xs text-blue-100 font-bold leading-none">
                                {orderProducts.filter((p: any) => selectedProducts.includes(p._rowKey)).length} Items Selected
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-[11px] text-blue-50 font-bold uppercase tracking-widest mr-2 leading-none cursor-pointer">
                              {isExpanded ? 'HIDE DISPATCH DETAILS ▲' : 'CLICK TO SHOW DETAILS ▼'}
                            </div>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/20 rounded-full">
                              {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                            </Button>
                          </div>
                        </div>

                        <div className="px-5 pb-5 space-y-4">
                          {/* Collapsible Dispatch Details Bar */}
                          {isExpanded && (
                            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 md:p-6 relative shadow-inner mt-2 animate-in slide-in-from-top-2 duration-300">
                               <div className="space-y-6">
                                  {/* Section 1: Order Information */}
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                                    <div className="col-span-1">
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Purpose</p>
                                      <p className="text-xs font-bold text-slate-900">{orderDetails.deliveryPurpose || "—"}</p>
                                    </div>
                                    <div className="col-span-1">
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Start/End Date</p>
                                      <p className="text-[10px] md:text-xs font-bold text-slate-700">
                                        {formatDate(orderDetails.startDate)} - {formatDate(orderDetails.endDate)}
                                      </p>
                                    </div>
                                    <div className="col-span-1">
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">DO Date</p>
                                      <p className="text-xs font-bold text-slate-700">{orderDetails.partySoDate || "—"}</p>
                                    </div>
                                    <div className="col-span-1">
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Transport</p>
                                      <p className="text-xs font-bold text-slate-900">{orderDetails.transportType || "—"}</p>
                                    </div>

                                    <div className="col-span-1">
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Credit</p>
                                      <Badge className={cn("text-[10px] font-black px-2 py-0.5", orderDetails.partyCredit === 'Good' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')}>
                                        {orderDetails.partyCredit || "Good"}
                                      </Badge>
                                    </div>
                                    <div className="col-span-2 md:col-span-1">
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Address</p>
                                      <p className="text-[10px] font-medium text-slate-600 leading-tight truncate" title={orderDetails.address}>{orderDetails.address || "—"}</p>
                                    </div>
                                    <div className="col-span-1">
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Contact</p>
                                      <p className="text-[10px] md:text-xs font-bold text-slate-900">{orderDetails.contactPerson} ({orderDetails.whatsapp || "—"})</p>
                                    </div>

                                    <div className="col-span-2">
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Broker / Advance</p>
                                      <p className="text-xs font-bold text-slate-900 leading-none">{orderDetails.brokerName || "—"} / ₹{orderDetails.advanceAmount || 0}</p>
                                    </div>

                                    <div className="col-span-2">
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Order Punch Remarks</p>
                                      <p className="text-[10px] font-medium text-slate-600 leading-tight italic">"{orderDetails.orderPunchRemarks || "No special instructions."}"</p>
                                    </div>
                                    <div className="col-span-2">
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">PO Copy</p>
                                      {group.uploadSo ? (
                                        <a href={group.uploadSo} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-all border border-blue-200 w-fit group shadow-sm mt-0.5">
                                          <FileText className="h-3 w-3" />
                                          <span className="text-[10px] font-black uppercase tracking-tight">VIEW PO</span>
                                        </a>
                                      ) : <p className="text-[10px] font-black text-slate-400 mt-1">NOT UPLOADED</p>}
                                    </div>
                                  </div>

                                  <div className="h-px bg-slate-200" />

                                  {/* Section 2: Dispatch Details (Documents) */}
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                                    <div>
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Truck No</p>
                                      <p className="text-xs font-black text-blue-700 uppercase">{firstProd.truck_no || firstProd.truckNo || "—"}</p>
                                    </div>
                                    <div>
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Transporter</p>
                                      <p className="text-xs font-bold text-slate-700 leading-none truncate">{firstProd.transporter_name || "—"}</p>
                                    </div>
                                    <div>
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Fitness</p>
                                      {renderDocumentLink(firstProd.fitness)}
                                    </div>
                                    <div>
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Insurance</p>
                                      {renderDocumentLink(firstProd.insurance)}
                                    </div>
                                    <div>
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Pollution</p>
                                      {renderDocumentLink(firstProd.polution)}
                                    </div>
                                    <div>
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Tax Copy</p>
                                      {renderDocumentLink(firstProd.tax_copy)}
                                    </div>
                                    <div>
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Permit 1</p>
                                      {renderDocumentLink(firstProd.permit1)}
                                    </div>
                                    <div>
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Permit 2</p>
                                      {renderDocumentLink(firstProd.permit2_out_state)}
                                    </div>
                                  </div>

                                  <div className="h-px bg-slate-200" />

                                  {/* Section 3: Vehicle & Driver Details */}
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-x-6 md:gap-y-8">
                                    <div className="col-span-2 md:col-span-4 flex items-center gap-2 mb-[-8px]">
                                      <div className="h-3 w-1 bg-blue-600 rounded-full" />
                                      <p className="text-[10px] font-black uppercase tracking-widest text-blue-900/60 italic">Vehicle Specifications</p>
                                    </div>
                                    
                                    <div>
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Type</p>
                                      <p className="text-xs font-bold text-slate-900">{firstProd.vehicle_type || "—"}</p>
                                    </div>
                                    <div>
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Passing Wt</p>
                                      <p className="text-xs font-bold text-slate-900">{firstProd.passing_weight || "—"}</p>
                                    </div>
                                    <div>
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">GVW / ULW</p>
                                      <p className="text-xs font-bold text-slate-900">{firstProd.gvw || "0"} / {firstProd.ulw || "0"}</p>
                                    </div>
                                    <div>
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Road Tax</p>
                                      <p className="text-xs font-bold text-slate-900">{firstProd.road_tax || "—"}</p>
                                    </div>

                                    <div className="col-span-2 md:col-span-4 flex items-center gap-2 mb-[-8px] mt-2">
                                      <div className="h-3 w-1 bg-amber-600 rounded-full" />
                                      <p className="text-[10px] font-black uppercase tracking-widest text-amber-900/60 italic">Driver Information</p>
                                    </div>

                                    <div>
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Name</p>
                                      <p className="text-xs font-bold text-slate-900">{firstProd.driver_name || "—"}</p>
                                    </div>
                                    <div>
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Contact</p>
                                      <p className="text-xs font-bold text-slate-900">{firstProd.driver_contact_no || "—"}</p>
                                    </div>
                                    <div>
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">License</p>
                                      <p className="text-xs font-bold text-slate-900">{firstProd.driving_license_no || "—"}</p>
                                    </div>
                                    <div>
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Valid Upto</p>
                                      <p className="text-xs font-bold text-slate-900">{formatDate(firstProd.dl_valid_upto)}</p>
                                    </div>
                                  </div>

                                  <div className="h-px bg-slate-200" />

                                  {/* Section 4: Weight Details */}
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                                    <div>
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">RST No</p>
                                      <p className="text-xs font-black text-blue-700 leading-none">#{firstProd.rst_no || firstProd.rstNo || "—"}</p>
                                    </div>
                                    <div className="col-span-1">
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Gross / Tare / Net</p>
                                      <p className="text-[10px] font-black text-slate-700 leading-none">
                                        {firstProd.gross_weight || 0}/{firstProd.tare_weight || 0}/<span className="text-blue-600">{(Number(firstProd.gross_weight || 0) - Number(firstProd.tare_weight || 0))}</span>
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Diff / Extra</p>
                                      <p className="text-xs font-black text-slate-700 leading-none">
                                        <span className={(parseFloat(firstProd.weight_diff) || 0) < 0 ? "text-red-500" : "text-green-600"}>{firstProd.weight_diff || 0}</span> / {firstProd.extra_weight || 0}
                                      </p>
                                    </div>
                                    <div className="col-span-2 md:col-span-1">
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Reason</p>
                                      <p className="text-[10px] font-medium text-slate-500 italic mt-1 leading-tight">{firstProd.reason_of_difference_in_weight_if_any_speacefic || "—"}</p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                          )}

                          {/* Simple Product Table (Always Visible) */}
                          {/* Responsive Product List */}
                          <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-white">
                            {/* Desktop Table */}
                            <div className="hidden md:block">
                              <Table>
                                <TableHeader className="bg-slate-50">
                                  <TableRow>
                                    <TableHead className="w-12 text-center h-10">
                                      <Checkbox
                                        checked={allOrderSelected}
                                        disabled={isOrderDisabled}
                                        onCheckedChange={(checked) => {
                                          if (checked) {
                                            setSelectedProducts(prev => Array.from(new Set([...prev, ...enabledOrderProducts.map((p: any) => p._rowKey)])))
                                          } else {
                                            setSelectedProducts(prev => prev.filter(k => !enabledOrderProducts.some((p: any) => p._rowKey === k)))
                                          }
                                        }}
                                      />
                                    </TableHead>
                                    <TableHead className="text-[10px] uppercase font-black h-10">PRODUCT INFO</TableHead>
                                    <TableHead className="text-[10px] uppercase font-black text-center h-10">QTY</TableHead>
                                    <TableHead className="text-[10px] uppercase font-black text-center h-10">STATUS</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {orderProducts.map((product: any) => (
                                    <TableRow key={product._rowKey} className={cn(selectedProducts.includes(product._rowKey) ? "bg-blue-50/20" : "", "h-14")}>
                                      <TableCell className="text-center p-2">
                                        <Checkbox
                                          checked={selectedProducts.includes(product._rowKey)}
                                          onCheckedChange={() => {
                                            if (selectedProducts.includes(product._rowKey)) {
                                              setSelectedProducts(prev => prev.filter(k => k !== product._rowKey))
                                            } else {
                                              setSelectedProducts(prev => [...prev, product._rowKey])
                                            }
                                          }}
                                        />
                                      </TableCell>
                                      <TableCell className="p-2">
                                        <div className="flex flex-col">
                                          <span className="text-xs font-black text-slate-800 uppercase tracking-tight">{product.productName}</span>
                                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{product.specificOrderNo}</span>
                                        </div>
                                      </TableCell>
                                      <TableCell className="text-center p-2">
                                        <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700 font-black text-xs px-3">
                                          {product.actual_qty_dispatch || product.actualQty || "0"}
                                        </Badge>
                                      </TableCell>
                                      <TableCell className="text-center p-2">
                                        {product.security_guard_status === 'REJECT' ? (
                                          <Badge variant="destructive" className="font-black text-[8px] uppercase">REJECTED BY SECURITY</Badge>
                                        ) : product.actual_1 == null ? (
                                          <Badge variant="destructive" className="font-black text-[8px] uppercase">Pending Data</Badge>
                                        ) : (
                                          <Badge className="bg-green-100 text-green-700 border-green-200 font-black text-[9px] uppercase">Loaded OK</Badge>
                                        )}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>

                            {/* Mobile Card-List for Products */}
                            <div className="md:hidden divide-y divide-slate-100">
                              <div className="p-3 bg-slate-50 flex items-center justify-between">
                                <span className="text-[10px] font-black uppercase text-slate-500">Products in this Load</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-[9px] font-black text-slate-400">SELECT ALL</span>
                                  <Checkbox
                                    checked={allOrderSelected}
                                    onCheckedChange={(checked) => {
                                      if (checked) {
                                        setSelectedProducts(prev => Array.from(new Set([...prev, ...enabledOrderProducts.map((p: any) => p._rowKey)])))
                                      } else {
                                        setSelectedProducts(prev => prev.filter(k => !enabledOrderProducts.some((p: any) => p._rowKey === k)))
                                      }
                                    }}
                                  />
                                </div>
                              </div>
                              {orderProducts.map((product: any) => (
                                <div key={product._rowKey} className={cn("p-4 flex items-center justify-between gap-4", selectedProducts.includes(product._rowKey) ? "bg-blue-50/30" : "bg-white")}>
                                  <div className="flex-1 space-y-1">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-black text-slate-800 uppercase leading-none">{product.productName}</span>
                                      <Badge className="bg-blue-600 text-white font-black text-[9px] h-4">QTY: {product.actual_qty_dispatch || 0}</Badge>
                                    </div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">#{product.specificOrderNo}</p>
                                    {product.security_guard_status === 'REJECT' ? (
                                      <Badge variant="destructive" className="text-[8px] h-4">REJECTED</Badge>
                                    ) : product.actual_1 == null ? (
                                      <Badge variant="destructive" className="text-[8px] h-4">MISSING DATA</Badge>
                                    ) : (
                                      <Badge className="bg-green-100 text-green-700 text-[8px] h-4">LOADED OK</Badge>
                                    )}
                                  </div>
                                  <Checkbox
                                    checked={selectedProducts.includes(product._rowKey)}
                                    onCheckedChange={() => {
                                      if (selectedProducts.includes(product._rowKey)) {
                                        setSelectedProducts(prev => prev.filter(k => k !== product._rowKey))
                                      } else {
                                        setSelectedProducts(prev => [...prev, product._rowKey])
                                      }
                                    }}
                                    className="h-6 w-6 rounded-lg"
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}

              {/* 2. Final Verification Form (Bottom Content) */}
              <div className="px-4 md:px-8 pt-8 space-y-8 animate-in fade-in duration-500 border-t-4 border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-6 bg-blue-600 rounded-full" />
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest italic">Verification Checklist</h3>
                </div>

                <div className="bg-slate-50 border-2 border-slate-100 rounded-3xl p-4 md:p-8 space-y-8 shadow-sm">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Bilty/GR No</Label>
                      <Input
                        placeholder="BL-100293"
                        className="h-12 md:h-14 border-2 border-slate-200 rounded-2xl px-6 font-black text-lg text-slate-700 focus:border-blue-600 transition-all uppercase placeholder:text-slate-300"
                        value={uploadData.biltyNo}
                        onChange={(e) => setUploadData(p => ({ ...p, biltyNo: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Bilty Image</Label>
                      <div className="relative h-12 md:h-14">
                        <Input type="file" className="hidden" id="bilty-img" onChange={(e) => {
                          if (e.target.files?.[0]) handleFileUpload(e.target.files[0], 'bilty')
                        }} />
                        <Label htmlFor="bilty-img" className="absolute inset-0 border-2 border-dashed border-slate-200 rounded-2xl flex items-center justify-center bg-white cursor-pointer hover:bg-slate-50 hover:border-blue-300 transition-all">
                          <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                            {isUploading === 'bilty' ? "WAIT..." : (uploadData.biltyImage ? "FILE READY" : "SCAN COPY")}
                          </span>
                        </Label>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Security Verdict</Label>
                      <Select value={uploadData.verdict} onValueChange={(v) => {
                        setUploadData(p => ({ ...p, verdict: v, remarks: v === "APPROVE" ? "" : p.remarks }))
                      }}>
                        <SelectTrigger className={cn("h-12 md:h-14 border-2 rounded-2xl px-6 font-black text-sm uppercase transition-all", uploadData.verdict === "APPROVE" ? "border-green-200 bg-green-50 text-green-700" : uploadData.verdict === "REJECT" ? "border-red-200 bg-red-50 text-red-700" : "border-slate-200 bg-white")}>
                          <SelectValue placeholder="Verdict" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="APPROVE" className="font-bold text-green-700 uppercase">APPROVE GATEPASS</SelectItem>
                          <SelectItem value="REJECT" className="font-bold text-red-700 uppercase">REJECT & REVERT</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {uploadData.verdict === "REJECT" && (
                    <div className="space-y-3 animate-in fade-in slide-in-from-top-4 duration-300">
                      <Label className="text-[10px] font-black uppercase text-red-600 tracking-widest ml-1">Reason for Rejection <span className="text-red-500">*</span></Label>
                      <textarea
                        placeholder="Explain why this load is rejected..."
                        className="w-full h-24 border-2 border-red-200 bg-red-50/50 rounded-2xl p-4 font-medium text-sm text-slate-700 focus:border-red-500 focus:ring-4 focus:ring-red-100 transition-all resize-none"
                        value={uploadData.remarks || ""}
                        onChange={(e) => setUploadData(p => ({ ...p, remarks: e.target.value }))}
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {Object.entries(uploadData.checklist).map(([key, val]) => (
                      <div 
                        key={key} 
                        onClick={() => setUploadData(p => ({ ...p, checklist: { ...p.checklist, [key]: !val } }))}
                        className={cn("flex items-center gap-2 p-3 rounded-xl border-2 transition-all cursor-pointer", val ? "bg-blue-600 border-blue-600 shadow-md" : "bg-white border-slate-100")}
                      >
                        <Checkbox id={key} checked={val} onCheckedChange={(checked) => setUploadData(p => ({ ...p, checklist: { ...p.checklist, [key]: !!checked } }))} className={cn(val ? "border-white bg-white data-[state=checked]:text-blue-600" : "")} />
                        <Label htmlFor={key} className={cn("text-[9px] font-black uppercase cursor-pointer tracking-tighter leading-none truncate", val ? "text-white" : "text-slate-600")}>{key.replace(/([A-Z])/g, ' $1')}</Label>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Proof Images</Label>
                    <div className="flex flex-wrap gap-3">
                      {uploadData.vehicleImages.map((url, idx) => (
                        <div key={idx} className="w-20 h-20 rounded-xl border-2 border-slate-100 overflow-hidden relative group shadow-sm">
                          <img src={url} className="w-full h-full object-cover" />
                          <button onClick={() => {
                            const images = [...uploadData.vehicleImages]
                            const names = [...uploadData.vehicleImageNames]
                            images.splice(idx, 1)
                            names.splice(idx, 1)
                            setUploadData(p => ({ ...p, vehicleImages: images, vehicleImageNames: names }))
                          }} className="absolute inset-0 bg-red-600/80 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"><X className="w-4 h-4" /></button>
                        </div>
                      ))}
                      <label className="w-20 h-20 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center bg-white cursor-pointer hover:bg-slate-50 hover:border-blue-300 transition-all">
                        {isUploading?.startsWith('vehicle') ? <Loader2 className="w-5 h-5 animate-spin text-blue-500" /> : <Plus className="w-6 h-6 text-slate-200" />}
                        <input type="file" multiple className="hidden" onChange={(e) => {
                          if (e.target.files) {
                            Array.from(e.target.files).forEach(file => handleFileUpload(file, 'vehicle'))
                          }
                        }} />
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="mt-8 border-t p-4 md:p-8 bg-slate-50/50 flex flex-col sm:flex-row gap-4">
            <Button variant="ghost" className="font-bold text-slate-500 uppercase text-xs order-last sm:order-none" onClick={() => setIsDialogOpen(false)}>Cancel Action</Button>
            <Button
              onClick={handleBulkSubmit}
              disabled={isProcessing || selectedProducts.length === 0 || isReadOnly}
              className="bg-purple-600 hover:bg-purple-700 h-14 md:h-12 px-10 rounded-2xl md:rounded-xl shadow-lg font-black uppercase tracking-tighter italic text-base md:text-lg flex-1 sm:flex-none"
            >
              {isProcessing ? "WAIT..." : `Authorize Gatepass (${selectedProducts.length})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </WorkflowStageShell>
  )
}