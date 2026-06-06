"use client"

import { useRef, useState, useMemo, useCallback } from "react"
import { WorkflowStageShell } from "@/components/workflow/workflow-stage-shell"
import { Card } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"
import { gateInApi, orderApi, vehicleMasterApi } from "@/lib/api-service"
import { useQuery } from "@tanstack/react-query"
import { Camera, CheckCircle2, ChevronLeft, ChevronRight, Loader2, Truck, X, ArrowUpDown, ArrowUp, ArrowDown, Settings2 } from "lucide-react"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem } from "@/components/ui/dropdown-menu"
import { usePersistedColumns } from "@/hooks/use-persisted-columns"
import { useColumnOrder } from "@/hooks/use-column-order"
import { SortableTableHead } from "@/components/ui/sortable-table-head"
import { ColumnDragProvider } from "@/components/ui/column-drag-provider"

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDate(dateStr: string) {
  if (!dateStr) return "—"
  try {
    return new Date(dateStr).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" })
  } catch {
    return dateStr
  }
}

const MAX_COMPRESSED_IMAGE_BYTES = 850 * 1024
const MAX_COMPRESSED_IMAGE_DIMENSION = 1600

async function compressImageForUpload(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file

  const bitmap = await createImageBitmap(file)
  const canvas = document.createElement("canvas")

  const context = canvas.getContext("2d")
  if (!context) {
    bitmap.close()
    return file
  }

  const toBlob = (quality: number) =>
    new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", quality))

  let maxDimension = Math.min(MAX_COMPRESSED_IMAGE_DIMENSION, Math.max(bitmap.width, bitmap.height))
  let blob: Blob | null = null

  while (maxDimension >= 320) {
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))

    canvas.width = width
    canvas.height = height
    context.clearRect(0, 0, width, height)
    context.drawImage(bitmap, 0, 0, width, height)

    let quality = 0.82
    blob = await toBlob(quality)

    while (blob && blob.size > MAX_COMPRESSED_IMAGE_BYTES && quality > 0.34) {
      quality -= 0.08
      blob = await toBlob(quality)
    }

    if (blob && blob.size <= MAX_COMPRESSED_IMAGE_BYTES) break
    maxDimension -= 250
  }

  bitmap.close()

  if (!blob || blob.size > MAX_COMPRESSED_IMAGE_BYTES) return file

  const cleanName = file.name.replace(/\.[^.]+$/, "")
  return new File([blob], `${cleanName}.jpg`, { type: "image/jpeg", lastModified: Date.now() })
}

// ─── Camera Upload Card ──────────────────────────────────────────────────────

interface ImageUploadCardProps {
  label: string
  capture?: "environment" | "user" // optional camera hint
  value: string
  fileName: string
  isUploading: boolean
  onFile: (file: File) => void
  onClear: () => void
}

function ImageUploadCard({ label, capture, value, fileName, isUploading, onFile, onClear }: ImageUploadCardProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="flex flex-col items-center gap-3 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-4 hover:border-blue-300 transition-colors">
      <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</span>

      {value ? (
        <div className="relative w-full">
          <a href={value} target="_blank" rel="noopener noreferrer">
            <img
              src={value}
              alt={label}
              className="w-full h-40 object-cover rounded-xl border border-slate-200 hover:opacity-90 transition-opacity cursor-zoom-in"
            />
          </a>
          <button
            type="button"
            onClick={onClear}
            className="absolute top-1 right-1 bg-red-500 text-white rounded-full h-6 w-6 flex items-center justify-center shadow-md hover:bg-red-600 transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
          <p className="text-[10px] text-slate-500 font-semibold mt-1 text-center truncate">{fileName}</p>
        </div>
      ) : (
        <button
          type="button"
          disabled={isUploading}
          onClick={() => inputRef.current?.click()}
          className="flex flex-col items-center gap-2 w-full h-40 justify-center rounded-xl border-2 border-slate-200 bg-white hover:bg-blue-50 hover:border-blue-300 transition-colors text-slate-400 hover:text-blue-500"
        >
          {isUploading ? (
            <Loader2 className="h-8 w-8 animate-spin" />
          ) : (
            <>
              <Camera className="h-8 w-8" />
              <span className="text-xs font-bold">Tap to open camera</span>
              <span className="text-[10px] font-medium text-slate-400">or choose from gallery</span>
            </>
          )}
        </button>
      )}

      {/* Hidden file input — capture attribute opens camera on mobile */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture={capture}
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0]
          if (file) onFile(file)
          e.target.value = "" // allow re-selecting same file
        }}
      />
    </div>
  )
}

const PAGE_COLUMNS = [
  { id: "order_key",   label: "Order Key (DO No.)" },
  { id: "vehicle_no",  label: "Vehicle No." },
  { id: "driver_name", label: "Driver Name" },
  { id: "saved_by",    label: "Saved By" },
  { id: "saved_at",    label: "Saved At" },
  { id: "products",    label: "Products" },
] as const
type ColId = typeof PAGE_COLUMNS[number]["id"]

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function GateInPage() {
  const { toast } = useToast()
  const { isReadOnly, user, isAdmin, isFeatureEnabled } = useAuth()

  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending")
  const [pendingPage, setPendingPage] = useState(1)
  const [historyPage, setHistoryPage] = useState(1)
  const limit = 20

  const [selectedRows, setSelectedRows] = useState<string[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState<any>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  // Vehicle master state
  const [vehicleData, setVehicleData] = useState<any>(null)
  const [isLoadingVehicle, setIsLoadingVehicle] = useState(false)

  // Image state
  const [frontVehicleImage, setFrontVehicleImage] = useState("")
  const [frontVehicleFileName, setFrontVehicleFileName] = useState("")
  const [frontVehicleFile, setFrontVehicleFile] = useState<File | null>(null)
  const [backVehicleImage, setBackVehicleImage] = useState("")
  const [backVehicleFileName, setBackVehicleFileName] = useState("")
  const [backVehicleFile, setBackVehicleFile] = useState<File | null>(null)
  const [driverPhoto, setDriverPhoto] = useState("")
  const [driverPhotoFileName, setDriverPhotoFileName] = useState("")
  const [driverPhotoFile, setDriverPhotoFile] = useState<File | null>(null)
  const [gatepassPhoto, setGatepassPhoto] = useState("")
  const [gatepassPhotoFileName, setGatepassPhotoFileName] = useState("")
  const [gatepassPhotoFile, setGatepassPhotoFile] = useState<File | null>(null)
  const [uploadingField, setUploadingField] = useState<string | null>(null)

  // ── Pending ────────────────────────────────────────────────────────────────
  const {
    data: pendingResult,
    isLoading: isPendingLoading,
    refetch: refetchPending,
  } = useQuery({
    queryKey: ["gate-in-pending", pendingPage],
    queryFn: async () => {
      const res = await gateInApi.getPending({ page: pendingPage, limit })
      return res.success ? res.data : { records: [], pagination: { total: 0 } }
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
  })

  // ── History ────────────────────────────────────────────────────────────────
  const {
    data: historyResult,
    isLoading: isHistoryLoading,
    refetch: refetchHistory,
  } = useQuery({
    queryKey: ["gate-in-history", historyPage],
    queryFn: async () => {
      const res = await gateInApi.getHistory({ page: historyPage, limit })
      return res.success ? res.data : { records: [], pagination: { total: 0 } }
    },
    enabled: activeTab === "history",
    staleTime: 0,
    refetchOnWindowFocus: true,
  })

  const pendingRecords: any[] = pendingResult?.records || []
  const historyRecords: any[] = historyResult?.records || []

  // ── History shape for WorkflowStageShell ──────────────────────────────────
  const historyData = useMemo(() =>
    historyRecords.map((r: any) => ({
      date: formatDate(r.submitted_at),
      orderNo: r.order_key,
      customerName: r.draft_data?.vehicleNumber || r.order_key,
      driverName: r.draft_data?.driverName || "—",
      status: "Completed",
      remarks: `Gate-In by ${r.username}`,
      rawData: r,
    })), [historyRecords])

  // ── Select helpers ─────────────────────────────────────────────────────────

  // ── Pending Table Sorting ─────────────────────────────────────
  const [pendingSortField, setPendingSortField] = useState<string>("")
  const [pendingSortDir, setPendingSortDir] = useState<"asc" | "desc">("asc")

  const handlePendingSort = (field: string) => {
    if (pendingSortField === field) {
      setPendingSortDir(prev => prev === "asc" ? "desc" : "asc")
    } else {
      setPendingSortField(field)
      setPendingSortDir("asc")
    }
  }

  const PendingSortIcon = ({ field }: { field: string }) => {
    if (pendingSortField !== field) return <ArrowUpDown className="ml-1 h-3 w-3 text-slate-400 inline" />
    return pendingSortDir === "asc"
      ? <ArrowUp className="ml-1 h-3 w-3 text-blue-600 inline" />
      : <ArrowDown className="ml-1 h-3 w-3 text-blue-600 inline" />
  }

  // Sorts pendingRecords by any field key
  const sortedPendingRecords = useMemo(() => {
    if (!pendingSortField || !pendingRecords || pendingRecords.length === 0) return pendingRecords
    return [...pendingRecords].sort((a: any, b: any) => {
      const aVal = String(a[pendingSortField] ?? "").toLowerCase()
      const bVal = String(b[pendingSortField] ?? "").toLowerCase()
      if (aVal < bVal) return pendingSortDir === "asc" ? -1 : 1
      if (aVal > bVal) return pendingSortDir === "asc" ? 1 : -1
      return 0
    })
  }, [pendingRecords, pendingSortField, pendingSortDir])

  const [visibleColumns, setVisibleColumns] = usePersistedColumns("gate-in", PAGE_COLUMNS.map(c => c.id))
  const [columnOrder, setColumnOrder] = useColumnOrder("gate-in", PAGE_COLUMNS.map(c => c.id))
  const orderedVisibleCols = useMemo(() =>
    columnOrder
      .map(id => PAGE_COLUMNS.find(c => c.id === id))
      .filter((c): c is typeof PAGE_COLUMNS[number] => !!c && visibleColumns.includes(c.id as ColId)),
    [columnOrder, visibleColumns]
  )
  const handleColumnReorder = useCallback((newVisibleOrder: string[]) => {
    const hiddenCols = columnOrder.filter(id => !visibleColumns.includes(id as ColId))
    setColumnOrder([...newVisibleOrder, ...hiddenCols])
  }, [columnOrder, visibleColumns, setColumnOrder])

  const COL_SORT_FIELD: Partial<Record<ColId, string>> = {
    order_key:   "order_key",
    vehicle_no:  "vehicle_no",
    driver_name: "driver_name",
    saved_by:    "saved_by",
    saved_at:    "saved_at",
  }

  const renderCell = (record: any, colId: ColId) => {
    const draft = record.draft_data || {}
    const productCount = draft.dialogSelectedProducts?.length ?? "—"
    switch (colId) {
      case "order_key":
        return <TableCell key={colId} className="text-center font-black text-blue-700 text-sm">{record.order_key}</TableCell>
      case "vehicle_no":
        return <TableCell key={colId} className="text-center font-semibold text-slate-700">{draft.vehicleNumber || "—"}</TableCell>
      case "driver_name":
        return <TableCell key={colId} className="text-center font-bold text-slate-700 italic">{draft.driverName || "—"}</TableCell>
      case "saved_by":
        return <TableCell key={colId} className="text-center text-slate-600 text-sm">{record.username}</TableCell>
      case "saved_at":
        return <TableCell key={colId} className="text-center text-slate-500 text-xs">{formatDate(record.saved_at)}</TableCell>
      case "products":
        return <TableCell key={colId} className="text-center"><Badge variant="outline" className="text-xs font-bold">{productCount} item(s)</Badge></TableCell>
      default:
        return null
    }
  }

  const toggleSelectAll = () => {
    if (selectedRows.length === pendingRecords.length) setSelectedRows([])
    else setSelectedRows(pendingRecords.map((r: any) => r.order_key))
  }

  const toggleRow = (key: string) => {
    setSelectedRows(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }

  // ── Open dialog ────────────────────────────────────────────────────────────
  const handleOpenDialog = (record: any) => {
    setSelectedRecord(record)
    setFrontVehicleImage("")
    setFrontVehicleFileName("")
    setFrontVehicleFile(null)
    setBackVehicleImage("")
    setBackVehicleFileName("")
    setBackVehicleFile(null)
    setDriverPhoto("")
    setDriverPhotoFileName("")
    setDriverPhotoFile(null)
    setGatepassPhoto("")
    setGatepassPhotoFileName("")
    setGatepassPhotoFile(null)
    setVehicleData(null)
    setIsDialogOpen(true)

    const vehicleNo = record?.draft_data?.vehicleNumber
    if (vehicleNo) {
      setIsLoadingVehicle(true)
      vehicleMasterApi.getAll({ search: vehicleNo, all: "true" })
        .then(res => {
          if (res.success && res.data?.vehicles?.length > 0) {
            const match = res.data.vehicles.find((v: any) =>
              v.registration_no?.toUpperCase() === vehicleNo.toUpperCase()
            ) || res.data.vehicles[0]
            setVehicleData(match)
          } else {
            setVehicleData(null)
          }
        })
        .catch(() => setVehicleData(null))
        .finally(() => setIsLoadingVehicle(false))
    }
  }

  // ── Image helpers ──────────────────────────────────────────────────────────
  const selectImage = (
    file: File,
    currentPreview: string,
    setPreview: (u: string) => void,
    setName: (n: string) => void,
    setFile: (f: File | null) => void
  ) => {
    if (currentPreview.startsWith("blob:")) URL.revokeObjectURL(currentPreview)
    const previewUrl = URL.createObjectURL(file)
    setPreview(previewUrl)
    setName(file.name)
    setFile(file)
  }

  const clearImage = (
    previewUrl: string,
    setPreview: (u: string) => void,
    setName: (n: string) => void,
    setFile: (f: File | null) => void
  ) => {
    if (previewUrl.startsWith("blob:")) URL.revokeObjectURL(previewUrl)
    setPreview("")
    setName("")
    setFile(null)
  }

  const uploadSelectedImage = async (file: File | null, fieldKey: string) => {
    if (!file) return undefined

    setUploadingField(fieldKey)
    try {
      const uploadFile = await compressImageForUpload(file)
      const res = await orderApi.uploadFile(uploadFile)
      if (res.success) {
        return res.data.url
      } else {
        throw new Error(res.message)
      }
    } catch (err: any) {
      throw new Error(err?.message || "Failed to upload image.")
    } finally {
      setUploadingField(null)
    }
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!selectedRecord) return

    setIsProcessing(true)
    try {
      const [
        uploadedFrontVehicleImage,
        uploadedBackVehicleImage,
        uploadedDriverPhoto,
        uploadedGatepassPhoto,
      ] = await Promise.all([
        uploadSelectedImage(frontVehicleFile, "front"),
        uploadSelectedImage(backVehicleFile, "back"),
        uploadSelectedImage(driverPhotoFile, "driver"),
        uploadSelectedImage(gatepassPhotoFile, "gatepass"),
      ])

      const res = await gateInApi.submit({
        orderKey: selectedRecord.order_key,
        username: user?.username || "system",
        frontVehicleImage: uploadedFrontVehicleImage,
        backVehicleImage: uploadedBackVehicleImage,
        driverPhoto: uploadedDriverPhoto,
        gatepassPhoto: uploadedGatepassPhoto,
      })

      if (!res.success) throw new Error(res.message)

      toast({ title: "Gate-In Submitted", description: `Order ${selectedRecord.order_key} gate-in recorded.` })
      setIsDialogOpen(false)
      setSelectedRows([])
      await refetchPending()
      await refetchHistory()
    } catch (err: any) {
      toast({ title: "Submission Failed", description: err?.message || "Could not submit gate-in.", variant: "destructive" })
    } finally {
      setIsProcessing(false)
    }
  }

  // ── Draft data helpers ─────────────────────────────────────────────────────
  const getDraftField = (record: any, path: string) => {
    try {
      const parts = path.split(".")
      let val: any = record?.draft_data
      for (const p of parts) val = val?.[p]
      return val ?? "—"
    } catch {
      return "—"
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <WorkflowStageShell
      title="Gate In"
      description="Record vehicle gate-in photos before Actual Dispatch confirmation."
      pendingCount={pendingRecords.length}
      historyData={historyData}
      onFilterChange={() => { }}
      onTabChange={setActiveTab}
      isHistoryLoading={isHistoryLoading}
      showDateFilters={false}
      historyFooter={
        <div className="flex items-center justify-between px-4 py-3 border-t bg-slate-50/50 rounded-b-xl">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Page <span className="text-slate-900 mx-1">{historyPage}</span>
            {historyResult?.pagination?.totalPages && (
              <> of <span className="text-slate-900 mx-1">{historyResult.pagination.totalPages}</span></>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setHistoryPage(p => Math.max(1, p - 1))} disabled={historyPage === 1}
              className="h-8 rounded-lg font-bold shadow-sm bg-white border-slate-200 text-slate-600 hover:bg-slate-50">
              <ChevronLeft className="h-4 w-4 mr-1" /> Previous
            </Button>
            <Button variant="outline" size="sm" onClick={() => setHistoryPage(p => p + 1)} disabled={historyPage >= (historyResult?.pagination?.totalPages || 1)}
              className="h-8 rounded-lg font-bold shadow-sm bg-white border-slate-200 text-slate-600 hover:bg-slate-50">
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {(isAdmin || isFeatureEnabled('can_toggle_columns')) && (
          <div className="flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="bg-transparent h-9 text-xs">
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
          </div>
        )}
        {/* Pending cards for mobile */}
        <div className="md:hidden space-y-3">
          {isPendingLoading && pendingRecords.length === 0 ? (
            [...Array(3)].map((_, i) => (
              <Card key={i} className="border-slate-200 p-4 shadow-sm">
                <div className="space-y-3 opacity-50">
                  <div className="h-4 w-32 bg-slate-200 animate-pulse rounded" />
                  <div className="h-3 w-full bg-slate-200 animate-pulse rounded" />
                  <div className="h-3 w-2/3 bg-slate-200 animate-pulse rounded" />
                </div>
              </Card>
            ))
          ) : pendingRecords.length === 0 ? (
            <Card className="border-slate-200 p-6 text-center text-sm font-semibold text-slate-400 shadow-sm">
              No pending gate-ins. Orders saved as draft in Actual Dispatch will appear here.
            </Card>
          ) : (
            pendingRecords.map((record: any) => {
              const draft = record.draft_data || {}
              const productCount = draft.dialogSelectedProducts?.length ?? "—"
              const isSelected = selectedRows.includes(record.order_key)

              return (
                <Card
                  key={record.order_key}
                  className={`border-slate-200 p-4 shadow-sm ${isSelected ? "bg-blue-50 border-blue-200" : "bg-white"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Order Key</div>
                      <div className="mt-1 truncate text-base font-black text-blue-700">{record.order_key}</div>
                    </div>
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleRow(record.order_key)}
                      className="mt-1"
                    />
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div className="min-w-0">
                      <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Vehicle</div>
                      <div className="mt-1 truncate font-semibold text-slate-700">{draft.vehicleNumber || "—"}</div>
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Driver</div>
                      <div className="mt-1 truncate font-semibold italic text-slate-700">{draft.driverName || "—"}</div>
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Saved By</div>
                      <div className="mt-1 truncate font-medium text-slate-600">{record.username || "—"}</div>
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Saved At</div>
                      <div className="mt-1 truncate text-xs font-medium text-slate-500">{formatDate(record.saved_at)}</div>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
                    <Badge variant="outline" className="text-xs font-bold">{productCount} item(s)</Badge>
                    <Button
                      size="sm"
                      disabled={isReadOnly}
                      onClick={() => handleOpenDialog(record)}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-sm"
                    >
                      Gate In
                    </Button>
                  </div>
                </Card>
              )
            })
          )}
        </div>

        {/* Pending table */}
        <Card className="hidden md:block border-none shadow-sm overflow-auto max-h-150">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-card shadow-sm">
              <TableRow>
                <TableHead className="w-12 text-center">
                  <Checkbox
                    checked={pendingRecords.length > 0 && selectedRows.length === pendingRecords.length}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <ColumnDragProvider columnIds={orderedVisibleCols.map(c => c.id)} onReorder={handleColumnReorder} disabled={!isAdmin && !isFeatureEnabled('can_reorder_columns')}>
                  {orderedVisibleCols.map(col => {
                    const sf = COL_SORT_FIELD[col.id]
                    return (
                      <SortableTableHead
                        key={col.id}
                        id={col.id}
                        className={`whitespace-nowrap text-center${sf ? " cursor-pointer select-none hover:text-blue-600 transition-colors" : ""}`}
                        onClick={sf ? () => handlePendingSort(sf) : undefined}
                      >
                        {col.label}{sf && <PendingSortIcon field={sf} />}
                      </SortableTableHead>
                    )
                  })}
                </ColumnDragProvider>
                <TableHead className="whitespace-nowrap text-center">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isPendingLoading && pendingRecords.length === 0 ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i} className="opacity-40">
                    {[...Array(orderedVisibleCols.length + 2)].map((_, j) => (
                      <TableCell key={j} className="py-4">
                        <div className="h-4 w-full bg-slate-200 animate-pulse rounded" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : pendingRecords.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={orderedVisibleCols.length + 2} className="text-center py-16 text-slate-400 font-semibold text-sm">
                    No pending gate-ins. Orders saved as draft in Actual Dispatch will appear here.
                  </TableCell>
                </TableRow>
              ) : (
                sortedPendingRecords.map((record: any) => {
                  return (
                    <TableRow
                      key={record.order_key}
                      className={`transition-colors cursor-pointer hover:bg-blue-50/50 ${selectedRows.includes(record.order_key) ? "bg-blue-50" : ""}`}
                    >
                      <TableCell className="text-center">
                        <Checkbox
                          checked={selectedRows.includes(record.order_key)}
                          onCheckedChange={() => toggleRow(record.order_key)}
                        />
                      </TableCell>
                      {orderedVisibleCols.map(col => renderCell(record, col.id))}
                      <TableCell className="text-center">
                        <Button
                          size="sm"
                          disabled={isReadOnly}
                          onClick={() => handleOpenDialog(record)}
                          className="bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-sm"
                        >
                          Gate In
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </Card>

        {/* Pagination */}
        <div className="flex items-center justify-between px-2 py-3 border-t bg-slate-50/50 rounded-b-xl">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Page <span className="text-slate-900 mx-1">{pendingPage}</span>
            {pendingResult?.pagination?.totalPages && (
              <> of <span className="text-slate-900 mx-1">{pendingResult.pagination.totalPages}</span></>
            )}
            <span className="ml-2 text-[9px] lowercase italic font-normal">({pendingResult?.pagination?.total || 0} items)</span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPendingPage(p => Math.max(1, p - 1))} disabled={pendingPage === 1}
              className="h-8 rounded-lg font-bold shadow-sm bg-white border-slate-200 text-slate-600">
              <ChevronLeft className="h-4 w-4 mr-1" /> Previous
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPendingPage(p => p + 1)} disabled={pendingPage >= (pendingResult?.pagination?.totalPages || 1)}
              className="h-8 rounded-lg font-bold shadow-sm bg-white border-slate-200 text-slate-600">
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      </div>

      {/* ── Gate-In Dialog ─────────────────────────────────────────────────── */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[90vw] max-w-[95vw]! max-h-[95vh] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] p-0">
          <div className="p-8">
            <DialogHeader className="border-b pb-6 mb-6">
              <DialogTitle className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                <Truck className="h-7 w-7 text-blue-600" />
                Gate In — {selectedRecord?.order_key}
              </DialogTitle>
              <DialogDescription className="text-slate-500 font-medium text-base mt-2">
                Upload vehicle photos for this order. Saved draft details are shown below.
              </DialogDescription>
            </DialogHeader>

            {selectedRecord && (
              <div className="space-y-8">

                {/* ── Order & Draft Details ── */}
                <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6">
                  <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-4">Order Details (from Draft)</h3>

                  {/* Combined load banner — shown when multiple orders share this vehicle */}
                  {(() => {
                    const keys: string[] = selectedRecord?.draft_data?.combinedGroupKeys || []
                    if (keys.length <= 1) return null
                    return (
                      <div className="mb-4 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 flex flex-wrap gap-2 items-center">
                        <span className="text-[10px] font-black uppercase tracking-widest text-amber-600">Combined Load — All DO Nos.</span>
                        {keys.map((k: string) => (
                          <span key={k} className={`text-xs font-bold px-2 py-0.5 rounded-md ${k === selectedRecord.order_key ? "bg-amber-400 text-white" : "bg-white border border-amber-300 text-amber-800"}`}>
                            {k}
                          </span>
                        ))}
                      </div>
                    )
                  })()}

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { label: "DO No.", value: selectedRecord.order_key },
                      { label: "Vehicle No.", value: getDraftField(selectedRecord, "vehicleNumber") },
                      { label: "Driver Name", value: getDraftField(selectedRecord, "driverName") },
                      { label: "Saved By", value: selectedRecord.username },
                      { label: "Saved At", value: formatDate(selectedRecord.saved_at) },
                      { label: "Transporter", value: getDraftField(selectedRecord, "loadData.transporterName") },
                      {
                        label: "Gross Weight",
                        value: getDraftField(selectedRecord, "totalPackingWeight") !== "—"
                          ? getDraftField(selectedRecord, "totalPackingWeight")
                          : getDraftField(selectedRecord, "loadData.grossWeight")
                      },
                      { label: "Tare Weight", value: getDraftField(selectedRecord, "loadData.tareWeight") },
                      { label: "RST No.", value: getDraftField(selectedRecord, "loadData.rstNo") },
                    ].map(f => (
                      <div key={f.label} className="flex flex-col">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{f.label}</span>
                        <span className="text-sm font-bold text-slate-800 mt-0.5">{f.value || "—"}</span>
                      </div>
                    ))}
                  </div>

                </div>

                {/* ── Vehicle Master Details ── */}
                <div className="bg-blue-50 rounded-2xl border border-blue-200 p-6">
                  <h3 className="text-sm font-black uppercase tracking-widest text-blue-600 mb-4 flex items-center gap-2">
                    <Truck className="h-4 w-4" /> Vehicle Master Details
                    {isLoadingVehicle && <Loader2 className="h-4 w-4 animate-spin ml-2 text-blue-400" />}
                  </h3>
                  {!isLoadingVehicle && !vehicleData && (
                    <p className="text-xs text-slate-400 font-medium">No vehicle master record found for this vehicle number.</p>
                  )}
                  {vehicleData && (
                    <div className="space-y-5">
                      {/* Basic info */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                          { label: "Registration No.", value: vehicleData.registration_no },
                          { label: "Vehicle Type", value: vehicleData.vehicle_type },
                          { label: "RTO", value: vehicleData.rto },
                          { label: "Transporter", value: vehicleData.transporter },
                          { label: "GVW", value: vehicleData.gvw },
                          { label: "ULW", value: vehicleData.ulw },
                          { label: "Passing", value: vehicleData.passing },
                          // { 
                          //   label: "Total Product Gross Weight", 
                          //   value: getDraftField(selectedRecord, "totalPackingWeight") !== "—" 
                          //     ? getDraftField(selectedRecord, "totalPackingWeight") 
                          //     : getDraftField(selectedRecord, "loadData.grossWeight") 
                          // },
                          { label: "Status", value: vehicleData.status },
                        ].map(f => (
                          <div key={f.label} className="flex flex-col">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{f.label}</span>
                            <span className="text-sm font-bold text-slate-800 mt-0.5">{f.value || "—"}</span>
                          </div>
                        ))}
                      </div>

                      {/* Document dates + images */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[
                          { label: "Fitness Date", date: vehicleData.fitness, image: vehicleData.fitness_image },
                          { label: "Pollution Date", date: vehicleData.pollution, image: vehicleData.pollution_image },
                          { label: "Insurance Date", date: vehicleData.insurance, image: vehicleData.insurance_image },
                          { label: "Road Tax Date", date: vehicleData.road_tax, image: vehicleData.road_tax_image },
                          { label: "State Permit Date", date: vehicleData.state_permit, image: vehicleData.state_permit_image },
                        ].map(doc => (
                          <div key={doc.label} className="flex items-center gap-4 bg-white rounded-xl border border-slate-200 p-3">
                            <div className="flex-1 min-w-0">
                              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">{doc.label}</span>
                              <span className="text-sm font-bold text-slate-800">{doc.date ? formatDate(doc.date) : "—"}</span>
                            </div>
                            {doc.image ? (
                              <a href={doc.image} target="_blank" rel="noopener noreferrer" className="shrink-0">
                                <img
                                  src={doc.image}
                                  alt={doc.label}
                                  className="h-14 w-20 object-cover rounded-lg border border-slate-200 hover:opacity-80 transition-opacity cursor-zoom-in"
                                />
                              </a>
                            ) : (
                              <div className="h-14 w-20 shrink-0 rounded-lg border border-dashed border-slate-200 bg-slate-50 flex items-center justify-center">
                                <span className="text-[9px] text-slate-300 font-bold uppercase">No Image</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Image Upload ── */}
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-4">Vehicle & Driver Photos</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <ImageUploadCard
                      label="Front Vehicle Image"
                      capture="environment"
                      value={frontVehicleImage}
                      fileName={frontVehicleFileName}
                      isUploading={uploadingField === "front"}
                      onFile={f => selectImage(f, frontVehicleImage, setFrontVehicleImage, setFrontVehicleFileName, setFrontVehicleFile)}
                      onClear={() => clearImage(frontVehicleImage, setFrontVehicleImage, setFrontVehicleFileName, setFrontVehicleFile)}
                    />
                    <ImageUploadCard
                      label="Back Vehicle Image"
                      capture="environment"
                      value={backVehicleImage}
                      fileName={backVehicleFileName}
                      isUploading={uploadingField === "back"}
                      onFile={f => selectImage(f, backVehicleImage, setBackVehicleImage, setBackVehicleFileName, setBackVehicleFile)}
                      onClear={() => clearImage(backVehicleImage, setBackVehicleImage, setBackVehicleFileName, setBackVehicleFile)}
                    />
                    <ImageUploadCard
                      label="Driver Photo"
                      capture="environment"
                      value={driverPhoto}
                      fileName={driverPhotoFileName}
                      isUploading={uploadingField === "driver"}
                      onFile={f => selectImage(f, driverPhoto, setDriverPhoto, setDriverPhotoFileName, setDriverPhotoFile)}
                      onClear={() => clearImage(driverPhoto, setDriverPhoto, setDriverPhotoFileName, setDriverPhotoFile)}
                    />
                    <ImageUploadCard
                      label="Vehicle Gate Pass"
                      capture="environment"
                      value={gatepassPhoto}
                      fileName={gatepassPhotoFileName}
                      isUploading={uploadingField === "gatepass"}
                      onFile={f => selectImage(f, gatepassPhoto, setGatepassPhoto, setGatepassPhotoFileName, setGatepassPhotoFile)}
                      onClear={() => clearImage(gatepassPhoto, setGatepassPhoto, setGatepassPhotoFileName, setGatepassPhotoFile)}
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 font-medium mt-3">
                    On mobile, tapping a card opens your camera directly. On desktop, it opens the file picker.
                    All images are optional but recommended for complete gate-in records.
                    Images are compressed and uploaded only when you confirm gate-in.
                  </p>
                </div>

              </div>
            )}
          </div>

          <DialogFooter className="mt-4 border-t pt-4 px-8 pb-8 flex justify-end gap-3">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSubmit}
              disabled={isProcessing || isReadOnly}
              className="bg-emerald-600 hover:bg-emerald-700 font-black"
            >
              {isProcessing ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Submitting...</>
              ) : (
                <><CheckCircle2 className="h-4 w-4 mr-2" /> Confirm Gate In</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </WorkflowStageShell>
  )
}
