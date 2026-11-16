"use client"

import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

// ── Types (mirror the /reports/pending-sauda response) ──────────────────────
interface OilBucket { qty: number; kg: number; rate: number }
export interface PendingSaudaDORow {
  do_date: string | null
  do_no: string
  sauda_no: string
  customer_name: string
  broker_name: string
  depo_name: string
  rice: OilBucket
  soya: OilBucket
  palm: OilBucket
  total_bal: number
  total_kg: number
  start_date: string | null
  end_date: string | null
  delivery_purpose: string | null
  dispatched: number[]
}
interface MonthSubtotal {
  rice: number; soya: number; palm: number; total: number
  riceKg: number; soyaKg: number; palmKg: number; totalKg: number
}
export interface PendingSaudaDepot {
  name: string
  rows: PendingSaudaDORow[]
}
export interface PendingSaudaMonth {
  label: string
  rows: PendingSaudaDORow[]
  depots?: PendingSaudaDepot[]
  subtotal: MonthSubtotal
}
export interface PendingSaudaReport {
  months: PendingSaudaMonth[]
  grandTotal: MonthSubtotal
  count: number
  depotOptions?: string[]
}

// ── Colors (RGB) — matched to the source workbook ───────────────────────────
const WHITE: [number, number, number] = [255, 255, 255]
const YELLOW: [number, number, number] = [255, 255, 0]
const DEPOT_FILL: [number, number, number] = [255, 242, 204]

// Column header fills (more saturated)
const HEAD_FILL: Record<number, [number, number, number]> = {
  5: [248, 203, 173],  // Rice Oil — peach
  6: [252, 228, 214],  // Rate
  7: [169, 208, 142],  // Soya Oil — green
  8: [198, 224, 180],  // Rate
  9: [142, 170, 219],  // Palm Oil — blue
  10: [180, 198, 231], // Rate
  11: [142, 170, 219], // Total Bal. — blue
}
// Data cell fills (lighter tints)
const DATA_FILL: Record<number, [number, number, number]> = {
  5: [252, 228, 214], 6: [252, 228, 214],   // peach
  7: [226, 239, 218], 8: [226, 239, 218],   // green
  9: [180, 198, 231], 10: [180, 198, 231], 11: [180, 198, 231], // blue
}

// Column widths (mm) — sum ≈ 285 (A4 landscape, 6mm margins)
const COL_WIDTHS = [16, 15, 12, 41, 16, 12, 13, 12, 13, 12, 13, 13, 16, 16, 15, 23, 27]
const HEADERS = [
  "DO Date", "DO No.", "Sauda No.", "Customer Name", "Broker",
  "Rice Oil", "Rate", "Soya Oil", "Rate", "Palm Oil", "Rate", "Total Bal.",
  "Start Date", "End Date", "Status", "Remark (future period date or W-W)", "Dispatched Qty Detail",
]

// ── Formatting helpers ──────────────────────────────────────────────────────
const pad = (n: number) => String(n).padStart(2, "0")
const fmtDate = (s: string | null): string => {
  if (!s) return ""
  const d = new Date(s)
  if (isNaN(d.getTime())) return ""
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`
}
const inNum = (n: number) => Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })
const qtyOrDash = (n: number) => (n && n > 0 ? inNum(n) : "-")
const rateOrDash = (n: number) =>
  n && n > 0 ? Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-"
const dispatchedStr = (arr: number[]) =>
  (arr || []).map((q) => (q % 1 === 0 ? String(q) : String(q))).join("+")

// Expired once the End Date has passed (before today); otherwise Upcoming
const statusOf = (r: PendingSaudaDORow): string => {
  if (!r.end_date) return "Upcoming"
  const end = new Date(r.end_date)
  if (isNaN(end.getTime())) return "Upcoming"
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  end.setHours(0, 0, 0, 0)
  return end < today ? "Expired" : "Upcoming"
}
const remarkOf = (r: PendingSaudaDORow): string => {
  const p = (r.delivery_purpose || "").toLowerCase()
  if (p.includes("week")) return "W-W"
  const end = fmtDate(r.end_date)
  return end ? `upto ${end}` : ""
}

// ── Main entry ──────────────────────────────────────────────────────────────
// `depotName` = the depot chosen for export; omit/blank for all depots.
export function generatePendingSaudaPdf(report: PendingSaudaReport, depotName?: string) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" })

  // "upto" date is always one day before the download date
  const upto = new Date()
  upto.setDate(upto.getDate() - 1)
  const uptoStr = `${pad(upto.getDate())}-${pad(upto.getMonth() + 1)}-${upto.getFullYear()}`

  // Build body rows + a parallel rowTypes array used by didParseCell for fills.
  const body: any[] = []
  const rowTypes: string[] = []

  const pushData = (r: PendingSaudaDORow) => {
    body.push([
      fmtDate(r.do_date), r.do_no, r.sauda_no, r.customer_name, r.broker_name,
      qtyOrDash(r.rice.qty), rateOrDash(r.rice.rate),
      qtyOrDash(r.soya.qty), rateOrDash(r.soya.rate),
      qtyOrDash(r.palm.qty), rateOrDash(r.palm.rate),
      qtyOrDash(r.total_bal),
      fmtDate(r.start_date), fmtDate(r.end_date),
      statusOf(r), remarkOf(r), dispatchedStr(r.dispatched),
    ])
    rowTypes.push("data")
  }
  const pushBanner = (label: string) => {
    body.push([{ content: label, colSpan: 17, styles: { halign: "center" } }])
    rowTypes.push("special")
  }
  const pushDepotBanner = (name: string) => {
    body.push([{ content: `DEPO : ${name.toUpperCase()}`, colSpan: 17, styles: { halign: "center" } }])
    rowTypes.push("depot")
  }
  const pushSubtotalUnits = (s: MonthSubtotal) => {
    body.push([
      "", "", "", "", "",
      qtyOrDash(s.rice), "", qtyOrDash(s.soya), "", qtyOrDash(s.palm), "",
      qtyOrDash(s.total), "", "", "", "", "",
    ])
    rowTypes.push("special")
  }
  const pushSubtotalKg = (s: MonthSubtotal) => {
    body.push([
      "", "", "", "", "",
      qtyOrDash(s.riceKg), "KGS", qtyOrDash(s.soyaKg), "KGS", qtyOrDash(s.palmKg), "KGS",
      qtyOrDash(s.totalKg), "KGS", "", "", "", "",
    ])
    rowTypes.push("special")
  }

  // Nothing pending (e.g. a depot with no open DOs): one clear notice row instead of data
  if (!report.months.length) {
    body.push([{ content: "NO PENDING SAUDA", colSpan: 17, styles: { halign: "center", fontSize: 11, cellPadding: 4 } }])
    rowTypes.push("special")
  }

  report.months.forEach((m) => {
    pushBanner(m.label)
    const depots = m.depots?.length ? m.depots : [{ name: "DEPO NOT SET", rows: m.rows }]
    depots.forEach((dp) => {
      pushDepotBanner(dp.name)
      dp.rows.forEach(pushData)
    })
    pushSubtotalUnits(m.subtotal)
    pushSubtotalKg(m.subtotal)
  })

  // Grand total (two rows)
  const g = report.grandTotal
  body.push([
    { content: "Grand Total", colSpan: 5, styles: { halign: "right" } },
    qtyOrDash(g.rice), "", qtyOrDash(g.soya), "", qtyOrDash(g.palm), "",
    qtyOrDash(g.total), "", "", "", "", "",
  ])
  rowTypes.push("special")
  body.push([
    { content: "Weight", colSpan: 5, styles: { halign: "right" } },
    qtyOrDash(g.riceKg), "KGS", qtyOrDash(g.soyaKg), "KGS", qtyOrDash(g.palmKg), "KGS",
    qtyOrDash(g.totalKg), "KGS", "", "", "", "",
  ])
  rowTypes.push("special")

  // Head: company title + report subtitle + column headers (repeats per page)
  const subtitle = `CP Pending Sauda Report upto ${uptoStr}` + (depotName ? ` (Depo : ${depotName})` : "")
  const head = [
    [{ content: "SHRI SHYAM OIL EXTRACTIONS PVT LTD", colSpan: 17, styles: { fontSize: 13, halign: "center", valign: "middle" } }],
    [{ content: subtitle, colSpan: 17, styles: { fontSize: 9.5, halign: "center", valign: "middle" } }],
    HEADERS.map((h) => ({ content: h })),
  ]

  const columnStyles: Record<number, any> = {}
  COL_WIDTHS.forEach((w, i) => { columnStyles[i] = { cellWidth: w } })

  autoTable(doc, {
    head: head as any,
    body,
    startY: 6,
    margin: { top: 6, left: 6, right: 6, bottom: 6 },
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 6.6,
      cellPadding: 1,
      lineColor: [0, 0, 0],
      lineWidth: 0.1,
      textColor: [0, 0, 0],
      overflow: "linebreak",
      valign: "middle",
      halign: "center",
    },
    headStyles: { fontStyle: "bold", fillColor: WHITE, textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.1 },
    columnStyles,
    didParseCell: (d: any) => {
      const ci = d.column.index
      if (d.section === "head") {
        d.cell.styles.fillColor = HEAD_FILL[ci] || WHITE
        d.cell.styles.halign = "center"
        return
      }
      if (d.section === "body") {
        if (rowTypes[d.row.index] === "data") {
          d.cell.styles.fillColor = DATA_FILL[ci] || WHITE
          d.cell.styles.halign = ci === 3 || ci === 4 || ci === 15 || ci === 16 ? "left" : "center"
        } else if (rowTypes[d.row.index] === "depot") {
          d.cell.styles.fillColor = DEPOT_FILL
          d.cell.styles.fontStyle = "bold"
        } else {
          d.cell.styles.fillColor = YELLOW
          d.cell.styles.fontStyle = "bold"
        }
      }
    },
  })

  // Footer: "Page X of Y" on every page
  const pageCount = (doc as any).getNumberOfPages()
  const pageSize = doc.internal.pageSize
  const pageWidth = (pageSize as any).getWidth ? (pageSize as any).getWidth() : (pageSize as any).width
  const pageHeight = (pageSize as any).getHeight ? (pageSize as any).getHeight() : (pageSize as any).height
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(0, 0, 0)
    doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, pageHeight - 2, { align: "center" })
  }

  // Open in a new tab for preview; the browser's PDF viewer handles download/print.
  doc.setProperties({ title: subtitle })
  window.open(doc.output("bloburl") as unknown as string, "_blank")
}
