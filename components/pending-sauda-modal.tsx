"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Download, FileText, Loader2 } from "lucide-react"
import { depotApi, reportsApi } from "@/lib/api-service"
import { generatePendingSaudaPdf, type PendingSaudaReport } from "@/lib/pending-sauda-pdf"
import { useToast } from "@/hooks/use-toast"

const ALL = "__all__"

export function PendingSaudaModal({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { toast } = useToast()
  const [depots, setDepots] = useState<string[]>([])
  const [depot, setDepot] = useState(ALL)
  const [optionsLoading, setOptionsLoading] = useState(false)
  const [loading, setLoading] = useState(false)

  // Each time the dialog opens, list the Depot Master depots plus any depot that
  // has pending DOs (in case a DO carries a depot name missing from the master).
  useEffect(() => {
    if (!open) return
    setDepot(ALL)
    setOptionsLoading(true)
    Promise.allSettled([depotApi.getAll({ all: "true" }), reportsApi.getPendingSauda()])
      .then(([masterRes, pendingRes]) => {
        const names: string[] = []
        if (masterRes.status === "fulfilled") {
          const items = masterRes.value?.data?.depots || (Array.isArray(masterRes.value?.data) ? masterRes.value.data : [])
          items.forEach((d: any) => d?.depot_name && names.push(String(d.depot_name).trim()))
        }
        if (pendingRes.status === "fulfilled") {
          ((pendingRes.value?.data as PendingSaudaReport)?.depotOptions || []).forEach((n) => n && names.push(n.trim()))
        }
        const seen = new Set<string>()
        const unique = names.filter((n) => {
          const k = n.toUpperCase()
          if (!n || seen.has(k)) return false
          seen.add(k)
          return true
        })
        setDepots(unique.sort((a, b) => a.localeCompare(b)))
      })
      .finally(() => setOptionsLoading(false))
  }, [open])

  const generate = async () => {
    setLoading(true)
    try {
      const depoName = depot === ALL ? "" : depot
      const res = await reportsApi.getPendingSauda(depoName ? { depo_name: depoName } : undefined)
      if (!res.success || !res.data) throw new Error(res.message || "Failed to fetch report")
      const data = res.data as PendingSaudaReport
      if (!data.count) {
        toast({ title: "No pending saudas", description: depoName ? `No pending DOs for ${depoName}.` : "No DOs are currently stuck in dispatch planning." })
        return
      }
      generatePendingSaudaPdf(data, depoName || undefined)
      onOpenChange(false)
    } catch (e: any) {
      toast({ title: "Could not generate PDF", description: e?.message || "An error occurred.", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[92vw] max-w-sm p-0 gap-0 flex flex-col overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b shrink-0" style={{ background: "oklch(0.97 0.012 245)" }}>
          <DialogTitle className="flex items-center gap-2 text-base font-black text-slate-900">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: "oklch(0.42 0.18 265 / 0.12)" }}>
              <FileText className="h-4 w-4" style={{ color: "oklch(0.42 0.18 265)" }} />
            </div>
            CP Pending Sauda Report
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 py-5 space-y-3">
          <p className="text-xs text-slate-500">
            Choose the depot to export. "All Depots" lists every depot, split depot-wise under each month.
          </p>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-1">Depo Name</label>
            <Select value={depot} onValueChange={setDepot} disabled={optionsLoading}>
              <SelectTrigger className="h-10 text-sm rounded-xl border-slate-200 bg-slate-50">
                <SelectValue placeholder={optionsLoading ? "Loading…" : "Select depot"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All Depots</SelectItem>
                {depots.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="px-6 py-4 border-t shrink-0 flex items-center justify-end gap-2 bg-white" style={{ borderColor: "oklch(0.90 0.025 245)" }}>
          <Button variant="outline" size="sm" className="rounded-xl" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
          <Button size="sm" className="rounded-xl gap-1.5 font-bold" style={{ background: "oklch(0.42 0.18 265)" }}
            onClick={generate} disabled={loading || optionsLoading}>
            {loading ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating…</> : <><Download className="h-3.5 w-3.5" /> Generate</>}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
