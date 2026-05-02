"use client"

import { useEffect, useMemo, useState } from "react"
import { Clock, Loader2, Pencil, RefreshCw, Save, Trash2 } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"
import { processStageApi } from "@/lib/api-service"

const STAGE_OPTIONS = [
  "Pre Approval",
  "Approval of Order",
  "Dispatch Planning",
  "Actual Dispatch",
  "Security Guard Approval",
  "Make Invoice (Proforma)",
  "Check Invoice",
  "Gate Out",
  "Confirm Material Receipt",
  "Damage Adjustment",
  "Gate In",
]

interface ProcessStage {
  id: number
  stage_name: string
  stage_time: string
  stage_time_seconds: number
  submitted_at: string
}

function formatTat(seconds: number) {
  const totalMinutes = Math.round(Number(seconds || 0) / 60)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (hours && minutes) return `${hours} hr ${minutes} min`
  if (hours) return `${hours} hr`
  return `${minutes} min`
}

export default function SetTurnAroundTimePage() {
  const { toast } = useToast()
  const { isReadOnly } = useAuth()
  const [stages, setStages] = useState<ProcessStage[]>([])
  const [stageName, setStageName] = useState("")
  const [hours, setHours] = useState("0")
  const [minutes, setMinutes] = useState("30")
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [editingStageId, setEditingStageId] = useState<number | null>(null)

  const selectedExistingStage = useMemo(
    () => {
      if (editingStageId) {
        return stages.find((stage) => stage.id === editingStageId)
      }
      return stages.find((stage) => stage.stage_name === stageName)
    },
    [editingStageId, stages, stageName]
  )

  const fetchStages = async () => {
    setIsLoading(true)
    try {
      const response = await processStageApi.getAll()
      if (response.success) {
        setStages(Array.isArray(response.data) ? response.data : [])
      }
    } catch (error: any) {
      toast({
        title: "Failed to load TAT",
        description: error?.message || "Unable to fetch process stage TAT.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchStages()
  }, [])

  useEffect(() => {
    if (!selectedExistingStage) return
    const totalMinutes = Math.round(Number(selectedExistingStage.stage_time_seconds || 0) / 60)
    setHours(String(Math.floor(totalMinutes / 60)))
    setMinutes(String(totalMinutes % 60))
  }, [selectedExistingStage])

  const handleEdit = (stage: ProcessStage) => {
    setEditingStageId(stage.id)
    setStageName(stage.stage_name)
    const totalMinutes = Math.round(Number(stage.stage_time_seconds || 0) / 60)
    setHours(String(Math.floor(totalMinutes / 60)))
    setMinutes(String(totalMinutes % 60))
  }

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this TAT entry?")) return
    setDeletingId(id)
    try {
      const response = await processStageApi.delete(id)
      if (response.success) {
        toast({ title: "TAT deleted", description: "Stage TAT has been deleted." })
        await fetchStages()
      }
    } catch (error: any) {
      toast({
        title: "Delete failed",
        description: error?.message || "Unable to delete process stage TAT.",
        variant: "destructive",
      })
    } finally {
      setDeletingId(null)
    }
  }

  const handleSubmit = async () => {
    const totalMinutes = Number(hours || 0) * 60 + Number(minutes || 0)

    if (!stageName) {
      toast({ title: "Stage required", description: "Please select a stage.", variant: "destructive" })
      return
    }

    if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) {
      toast({ title: "Invalid TAT", description: "Enter time greater than zero.", variant: "destructive" })
      return
    }

    setIsSubmitting(true)
    try {
      const payload = { stage_name: stageName, total_minutes: totalMinutes }
      const response = editingStageId
        ? await processStageApi.update(editingStageId, payload)
        : await processStageApi.save(payload)
      if (response.success) {
        toast({ title: "TAT saved", description: `${stageName} TAT has been saved.` })
        setEditingStageId(null)
        await fetchStages()
      }
    } catch (error: any) {
      toast({
        title: "Save failed",
        description: error?.message || "Unable to save process stage TAT.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="p-8 max-w-[1400px] mx-auto min-h-screen space-y-8 animate-in fade-in duration-700">
      <PageHeader
        title="Set Turn Around Time"
        description="Set stage-wise target completion time for the dispatch process"
      >
        <Button variant="outline" onClick={fetchStages} disabled={isLoading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
        <Card className="border-none shadow-xl rounded-2xl overflow-hidden bg-white">
          <CardHeader className="border-b bg-slate-50/70">
            <CardTitle className="flex items-center gap-2 text-xl text-slate-800">
              <Clock className="h-5 w-5 text-primary" />
              Stage TAT
            </CardTitle>
            <CardDescription>Save target time for a selected stage.</CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="stage-name">Stage Name</Label>
              <Select
                value={stageName}
                onValueChange={(value) => {
                  setStageName(value)
                  setEditingStageId(null)
                }}
              >
                <SelectTrigger id="stage-name" className="h-10">
                  <SelectValue placeholder="Select stage" />
                </SelectTrigger>
                <SelectContent>
                  {STAGE_OPTIONS.map((stage) => (
                    <SelectItem key={stage} value={stage}>
                      {stage}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tat-hours">Hours</Label>
                <Input
                  id="tat-hours"
                  type="number"
                  min="0"
                  value={hours}
                  onChange={(event) => setHours(event.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tat-minutes">Minutes</Label>
                <Input
                  id="tat-minutes"
                  type="number"
                  min="0"
                  max="59"
                  value={minutes}
                  onChange={(event) => setMinutes(event.target.value)}
                  placeholder="30"
                />
              </div>
            </div>

            {selectedExistingStage && (
              <div className="rounded-lg border bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Existing TAT: {formatTat(selectedExistingStage.stage_time_seconds)}
              </div>
            )}

            <Button className="w-full" onClick={handleSubmit} disabled={isSubmitting || isReadOnly}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {editingStageId ? "Update TAT" : "Save TAT"}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-none shadow-xl rounded-2xl overflow-hidden bg-white">
          <CardHeader className="border-b bg-slate-50/70">
            <CardTitle className="text-xl text-slate-800">Configured Stage TAT</CardTitle>
            <CardDescription>{stages.length} stage{stages.length === 1 ? "" : "s"} configured</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="w-[80px]">ID</TableHead>
                    <TableHead>Stage Name</TableHead>
                    <TableHead className="text-center">TAT</TableHead>
                    <TableHead className="text-center">Submitted At</TableHead>
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                        <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                        Loading TAT data...
                      </TableCell>
                    </TableRow>
                  ) : stages.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                        No TAT configured yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    stages.map((stage) => (
                      <TableRow key={stage.id}>
                        <TableCell className="font-medium">{stage.id}</TableCell>
                        <TableCell>{stage.stage_name}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary" className="font-semibold">
                            {formatTat(stage.stage_time_seconds)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center text-muted-foreground">
                          {stage.submitted_at ? new Date(stage.submitted_at).toLocaleString() : ""}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEdit(stage)}
                              disabled={isReadOnly}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDelete(stage.id)}
                              disabled={isReadOnly || deletingId === stage.id}
                            >
                              {deletingId === stage.id
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : <Trash2 className="h-3.5 w-3.5" />
                              }
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
