"use client"

import { useEffect, useRef, useState, useMemo } from "react"
import { WorkflowStageShell } from "@/components/workflow/workflow-stage-shell"
import { Card } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"
import { gateInApi, orderApi, vehicleMasterApi } from "@/lib/api-service"
import { useQuery } from "@tanstack/react-query"
import { Camera, CheckCircle2, ChevronLeft, ChevronRight, Loader2, Truck, Upload, X } from "lucide-react"

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDate(dateStr: string) {
  if (!dateStr) return "—"
  try {
    return new Date(dateStr).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" })
  } catch {
    return dateStr
  }
}

// ─── Camera Upload Card ──────────────────────────────────────────────────────

interface ImageUploadCardProps {
  label: string
  capture: "environment" | "user" // rear vs front camera
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

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function GateInPage() {
  const { toast } = useToast()
  const { isReadOnly, user } = useAuth()

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
  const [backVehicleImage, setBackVehicleImage] = useState("")
  const [backVehicleFileName, setBackVehicleFileName] = useState("")
  const [driverPhoto, setDriverPhoto] = useState("")
  const [driverPhotoFileName, setDriverPhotoFileName] = useState("")
  const [gatepassPhoto, setGatepassPhoto] = useState("")
  const [gatepassPhotoFileName, setGatepassPhotoFileName] = useState("")
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
    setBackVehicleImage("")
    setBackVehicleFileName("")
    setDriverPhoto("")
    setDriverPhotoFileName("")
    setGatepassPhoto("")
    setGatepassPhotoFileName("")
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

  // ── Image upload helper ────────────────────────────────────────────────────
  const uploadImage = async (
    file: File,
    setUrl: (u: string) => void,
    setName: (n: string) => void,
    fieldKey: string
  ) => {
    setUploadingField(fieldKey)
    try {
      const res = await orderApi.uploadFile(file)
      if (res.success) {
        setUrl(res.data.url)
        setName(file.name)
        toast({ title: "Uploaded", description: `${file.name} uploaded successfully.` })
      } else {
        throw new Error(res.message)
      }
    } catch (err: any) {
      toast({ title: "Upload Failed", description: err?.message || "Failed to upload image.", variant: "destructive" })
    } finally {
      setUploadingField(null)
    }
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!selectedRecord) return

    setIsProcessing(true)
    try {
      const res = await gateInApi.submit({
        orderKey: selectedRecord.order_key,
        username: user?.username || "system",
        frontVehicleImage: frontVehicleImage || undefined,
        backVehicleImage: backVehicleImage || undefined,
        driverPhoto: driverPhoto || undefined,
        gatepassPhoto: gatepassPhoto || undefined,
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
        {/* Pending table */}
        <Card className="border-none shadow-sm overflow-auto max-h-150">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-card shadow-sm">
              <TableRow>
                <TableHead className="w-12 text-center">
                  <Checkbox
                    checked={pendingRecords.length > 0 && selectedRows.length === pendingRecords.length}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead className="whitespace-nowrap text-center">Order Key (DO No.)</TableHead>
                <TableHead className="whitespace-nowrap text-center">Vehicle No.</TableHead>
                <TableHead className="whitespace-nowrap text-center">Driver Name</TableHead>
                <TableHead className="whitespace-nowrap text-center">Saved By</TableHead>
                <TableHead className="whitespace-nowrap text-center">Saved At</TableHead>
                <TableHead className="whitespace-nowrap text-center">Products</TableHead>
                <TableHead className="whitespace-nowrap text-center">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isPendingLoading && pendingRecords.length === 0 ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i} className="opacity-40">
                    {[...Array(7)].map((_, j) => (
                      <TableCell key={j} className="py-4">
                        <div className="h-4 w-full bg-slate-200 animate-pulse rounded" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : pendingRecords.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-16 text-slate-400 font-semibold text-sm">
                    No pending gate-ins. Orders saved as draft in Actual Dispatch will appear here.
                  </TableCell>
                </TableRow>
              ) : (
                pendingRecords.map((record: any) => {
                  const draft = record.draft_data || {}
                  const productCount = draft.dialogSelectedProducts?.length ?? "—"
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
                      <TableCell className="text-center font-black text-blue-700 text-sm">{record.order_key}</TableCell>
                      <TableCell className="text-center font-semibold text-slate-700">{draft.vehicleNumber || "—"}</TableCell>
                      <TableCell className="text-center font-bold text-slate-700 italic">{draft.driverName || "—"}</TableCell>
                      <TableCell className="text-center text-slate-600 text-sm">{record.username}</TableCell>
                      <TableCell className="text-center text-slate-500 text-xs">{formatDate(record.saved_at)}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="text-xs font-bold">{productCount} item(s)</Badge>
                      </TableCell>
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
                      onFile={f => uploadImage(f, setFrontVehicleImage, setFrontVehicleFileName, "front")}
                      onClear={() => { setFrontVehicleImage(""); setFrontVehicleFileName("") }}
                    />
                    <ImageUploadCard
                      label="Back Vehicle Image"
                      capture="environment"
                      value={backVehicleImage}
                      fileName={backVehicleFileName}
                      isUploading={uploadingField === "back"}
                      onFile={f => uploadImage(f, setBackVehicleImage, setBackVehicleFileName, "back")}
                      onClear={() => { setBackVehicleImage(""); setBackVehicleFileName("") }}
                    />
                    <ImageUploadCard
                      label="Driver Photo"
                      capture="user"
                      value={driverPhoto}
                      fileName={driverPhotoFileName}
                      isUploading={uploadingField === "driver"}
                      onFile={f => uploadImage(f, setDriverPhoto, setDriverPhotoFileName, "driver")}
                      onClear={() => { setDriverPhoto(""); setDriverPhotoFileName("") }}
                    />
                    <ImageUploadCard
                      label="Vehicle Gate Pass"
                      capture="environment"
                      value={gatepassPhoto}
                      fileName={gatepassPhotoFileName}
                      isUploading={uploadingField === "gatepass"}
                      onFile={f => uploadImage(f, setGatepassPhoto, setGatepassPhotoFileName, "gatepass")}
                      onClear={() => { setGatepassPhoto(""); setGatepassPhotoFileName("") }}
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 font-medium mt-3">
                    On mobile, tapping a card opens your camera directly. On desktop, it opens the file picker.
                    All images are optional but recommended for complete gate-in records.
                    Max file size: <span className="font-bold">10 MB</span> per image.
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
