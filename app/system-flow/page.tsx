"use client"

import {
  AlertTriangle,
  BadgeCheck,
  Boxes,
  ClipboardPen,
  FileCheck,
  FileSearch,
  FileSignature,
  FileText,
  Gauge,
  PackageCheck,
  Send,
  ShieldCheck,
  Truck,
} from "lucide-react"

const stages = [
  {
    no: "00", title: "Order Punch", actor: "Sales / Admin",
    action: "Create order with customer, SKU, depot, quantity, rates, and documents.",
    icon: ClipboardPen, color: "#6366f1", bg: "#eef2ff", border: "#c7d2fe",
  },
  {
    no: "01", title: "Pre Approval", actor: "Commercial Reviewer",
    action: "Validate special terms, customer fit, and commercial approval.",
    icon: BadgeCheck, color: "#d97706", bg: "#fffbeb", border: "#fde68a",
  },
  {
    no: "02", title: "Approval of Order", actor: "Approval Manager",
    action: "Check market rate, SKU availability, credit, and dispatch date.",
    icon: FileSearch, color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe",
  },
  {
    no: "03", title: "Dispatch Planning", actor: "Logistics Planner",
    action: "Assign depot, allocation, dispatch schedule, and LRC record.",
    icon: PackageCheck, color: "#059669", bg: "#ecfdf5", border: "#a7f3d0",
  },
  {
    no: "04", title: "Actual Dispatch", actor: "Dispatch Desk",
    action: "Create DSR, dispatch quantity, and remaining quantity movement.",
    icon: Send, color: "#0891b2", bg: "#ecfeff", border: "#a5f3fc",
  },
  {
    no: "05", title: "Vehicle Details", actor: "Transport Team",
    action: "Attach vehicle number, driver, transport company, and contact.",
    icon: Truck, color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe",
  },
  {
    no: "06", title: "Material Load", actor: "Warehouse Team",
    action: "Record loaded quantity, loading time, batch, and physical readiness.",
    icon: Boxes, color: "#ea580c", bg: "#fff7ed", border: "#fed7aa",
  },
  {
    no: "07", title: "Security Approval", actor: "Security Guard",
    action: "Verify vehicle match, material clearance, seal, and gate readiness.",
    icon: ShieldCheck, color: "#e11d48", bg: "#fff1f2", border: "#fecdd3",
  },
  {
    no: "08A", title: "Make Invoice", actor: "Billing Team",
    action: "Generate proforma invoice and invoice reference.",
    icon: FileText, color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe",
  },
  {
    no: "08B", title: "Check Invoice", actor: "Invoice Verifier",
    action: "Verify invoice quantity, rate, and order linkage.",
    icon: FileCheck, color: "#059669", bg: "#ecfdf5", border: "#a7f3d0",
  },
  {
    no: "09", title: "Gate Out", actor: "Security Gate",
    action: "Capture vehicle exit time and final seal confirmation.",
    icon: Gauge, color: "#d97706", bg: "#fffbeb", border: "#fde68a",
  },
  {
    no: "10", title: "Material Receipt", actor: "Customer / Receiver",
    action: "Confirm received quantity, receipt date, and delivery completion.",
    icon: FileSignature, color: "#6366f1", bg: "#eef2ff", border: "#c7d2fe",
  },
]

// ─── Layout constants ──────────────────────────────────────────────────────────
const COLS      = 4
const CARD_W    = 226
const CARD_H    = 164
const GAP_X     = 56
const GAP_Y     = 80
const PAD_X     = 36
const PAD_Y     = 92   // tall top padding for above-row arcs
const RIGHT_PAD = 120  // right space for dispatch-revert arc

const colX = (c: number) => PAD_X + c * (CARD_W + GAP_X)
const rowY = (r: number) => PAD_Y + r * (CARD_H + GAP_Y)
const cx   = (c: number) => colX(c) + CARD_W / 2
const cy   = (r: number) => rowY(r) + CARD_H / 2

// colX: 0→36  1→318  2→600  3→882
// cx:   0→149 1→431  2→713  3→995
// rowY: 0→92  1→336  2→580
// cy:   0→174 1→418  2→662

const SVG_W = colX(3) + CARD_W + PAD_X + RIGHT_PAD  // 882+226+36+120 = 1264
const EX_Y  = rowY(2) + CARD_H + 60                 // exception card y
const SVG_H = EX_Y + CARD_H + 56

// Heights for above-row arcs (all < PAD_Y=92, so safely above cards)
const ARC_BRANCH  = 16  // branch (00→02) arc peak y
const ARC_REVERT  = 40  // dispatch planning revert (03→01) arc peak y
const ARC_DISPATCH = 60  // dispatch cancelled (04→01) top horizontal segment y

// Right-side arc x-position for dispatch revert
const RIGHT_ARC_X = SVG_W - 54  // = 1210

// snake: row 0 L→R, row 1 R→L, row 2 L→R
const gridPos = stages.map((_, i) => {
  const row = Math.floor(i / COLS)
  const pos = i % COLS
  const col = row % 2 === 0 ? pos : COLS - 1 - pos
  return { row, col, x: colX(col), y: rowY(row) }
})

// ─── Arrow helpers ─────────────────────────────────────────────────────────────
interface Arrow {
  d: string
  type: "forward" | "branch" | "revert"
  label?: string
  labelX?: number
  labelY?: number
  labelRotate?: number
}

// Rounded-corner rectangular arc: right→up→left→down into a card top
// Used for dispatch revert (04) → Pre Approval (01)
const R = 16
const dispatchRevertPath =
  `M ${colX(3) + CARD_W} ${cy(1)} ` +
  `H ${RIGHT_ARC_X - R} Q ${RIGHT_ARC_X} ${cy(1)} ${RIGHT_ARC_X} ${cy(1) - R} ` +
  `V ${ARC_DISPATCH + R} Q ${RIGHT_ARC_X} ${ARC_DISPATCH} ${RIGHT_ARC_X - R} ${ARC_DISPATCH} ` +
  `H ${cx(1) + R} Q ${cx(1)} ${ARC_DISPATCH} ${cx(1)} ${ARC_DISPATCH + R} ` +
  `V ${rowY(0)}`

const arrows: Arrow[] = [
  // ── Forward row 0 (L→R) ──────────────────────────────────────────────
  { type: "forward", d: `M${colX(0)+CARD_W} ${cy(0)} H${colX(1)}` },
  { type: "forward", d: `M${colX(1)+CARD_W} ${cy(0)} H${colX(2)}` },
  { type: "forward", d: `M${colX(2)+CARD_W} ${cy(0)} H${colX(3)}` },
  // ── Turn: col 3, row 0 → row 1 ───────────────────────────────────────
  { type: "forward", d: `M${cx(3)} ${rowY(0)+CARD_H} V${rowY(1)}` },
  // ── Forward row 1 (R→L) ──────────────────────────────────────────────
  { type: "forward", d: `M${colX(3)} ${cy(1)} H${colX(2)+CARD_W}` },
  { type: "forward", d: `M${colX(2)} ${cy(1)} H${colX(1)+CARD_W}` },
  { type: "forward", d: `M${colX(1)} ${cy(1)} H${colX(0)+CARD_W}` },
  // ── Turn: col 0, row 1 → row 2 ───────────────────────────────────────
  { type: "forward", d: `M${cx(0)} ${rowY(1)+CARD_H} V${rowY(2)}` },
  // ── Forward row 2 (L→R) ──────────────────────────────────────────────
  { type: "forward", d: `M${colX(0)+CARD_W} ${cy(2)} H${colX(1)}` },
  { type: "forward", d: `M${colX(1)+CARD_W} ${cy(2)} H${colX(2)}` },
  { type: "forward", d: `M${colX(2)+CARD_W} ${cy(2)} H${colX(3)}` },

  // ── Branch: 00 → 02  (regular order skips Pre Approval) ──────────────
  // Cubic bezier arcing above, peaks at y=ARC_BRANCH=16
  {
    type: "branch",
    d: `M${cx(0)} ${rowY(0)} C${cx(0)} ${ARC_BRANCH} ${cx(2)} ${ARC_BRANCH} ${cx(2)} ${rowY(0)}`,
    label: "Regular order — skips Pre Approval",
    labelX: (cx(0) + cx(2)) / 2,   // 431 — above card 01 (Pre Approval), perfect
    labelY: ARC_BRANCH - 4,
  },

  // ── Revert: Dispatch Planning (03) → Pre Approval (01) ───────────────
  // Wide cubic bezier above row 0, peaks at y=ARC_REVERT=40
  {
    type: "revert",
    d: `M${cx(3)} ${rowY(0)} C${cx(3)} ${ARC_REVERT} ${cx(1)} ${ARC_REVERT} ${cx(1)} ${rowY(0)}`,
    label: "Rejected — revert to Pre Approval",
    labelX: (cx(1) + cx(3)) / 2,   // 713 — above card 02 (Approval of Order)
    labelY: ARC_REVERT - 4,
  },

  // ── Revert: Actual Dispatch (04) → Pre Approval (01) ─────────────────
  // Rounded-corner arc: right side → up → left → down into card 01 top
  {
    type: "revert",
    d: dispatchRevertPath,
    label: "Dispatch cancelled — revert",
    labelX: RIGHT_ARC_X + 12,
    labelY: (cy(1) + ARC_DISPATCH) / 2,   // midpoint of right vertical segment
    labelRotate: -90,
  },

  // ── Revert: Material Receipt (10) → Damage Adjustment (exception) ────
  {
    type: "revert",
    d: `M${cx(3)} ${rowY(2)+CARD_H} C${cx(3)} ${EX_Y+20} ${cx(2)} ${EX_Y+20} ${cx(2)} ${EX_Y}`,
    label: "Damage / shortage reported",
    labelX: (cx(2) + cx(3)) / 2,
    labelY: EX_Y + 30,
  },
]

export default function SystemFlowPage() {
  return (
    <div className="min-h-screen bg-slate-50/60 p-6">
      <div className="mx-auto max-w-[1400px]">

        {/* ── Page header ── */}
        <div className="mb-7">
          <div className="flex items-center gap-3 mb-1">
            <div className="h-7 w-1 rounded-full bg-indigo-500" />
            <h1 className="text-xl font-bold tracking-tight text-slate-900">System Flow</h1>
          </div>
          <p className="ml-4 pl-3 text-sm text-slate-500">
            End-to-end order lifecycle — from punch to delivery
          </p>
        </div>

        {/* ── Legend ── */}
        <div className="mb-5 flex flex-wrap items-center gap-6 rounded-xl border border-slate-200 bg-white px-5 py-3 shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Flow Key</span>
          {[
            { color: "#059669", dash: false, label: "Forward flow" },
            { color: "#d97706", dash: true,  label: "Branch — skip Pre Approval" },
            { color: "#e11d48", dash: true,  label: "Revert / Exception" },
          ].map(({ color, dash, label }) => (
            <div key={label} className="flex items-center gap-2">
              <svg width="36" height="12">
                <line x1="0" y1="6" x2="28" y2="6"
                  stroke={color} strokeWidth="2"
                  strokeDasharray={dash ? "5 3" : undefined} />
                <polygon points="26,3 34,6 26,9" fill={color} />
              </svg>
              <span className="text-xs font-semibold text-slate-600">{label}</span>
            </div>
          ))}
        </div>

        {/* ── Flow canvas ── */}
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="relative" style={{ width: SVG_W, height: SVG_H }}>

            {/* SVG arrows */}
            <svg
              className="pointer-events-none absolute inset-0"
              width={SVG_W}
              height={SVG_H}
              fill="none"
              aria-hidden
            >
              <defs>
                <marker id="fwd"   markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto">
                  <path d="M0 0 L9 4.5 L0 9 Z" fill="#059669" />
                </marker>
                <marker id="brnch" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto">
                  <path d="M0 0 L9 4.5 L0 9 Z" fill="#d97706" />
                </marker>
                <marker id="rvrt"  markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto">
                  <path d="M0 0 L9 4.5 L0 9 Z" fill="#e11d48" />
                </marker>
              </defs>

              {arrows.map((a, i) => {
                const isFwd    = a.type === "forward"
                const isBranch = a.type === "branch"
                const stroke   = isFwd ? "#059669" : isBranch ? "#d97706" : "#e11d48"
                const marker   = isFwd ? "url(#fwd)" : isBranch ? "url(#brnch)" : "url(#rvrt)"
                const hasLabel = !isFwd && a.label && a.labelX !== undefined && a.labelY !== undefined

                return (
                  <g key={i}>
                    <path
                      d={a.d}
                      stroke={stroke}
                      strokeWidth={isFwd ? 2.5 : 1.8}
                      strokeDasharray={!isFwd ? "6 4" : undefined}
                      markerEnd={marker}
                      opacity={0.9}
                    />
                    {hasLabel && (() => {
                      const isRotated = !!a.labelRotate
                      // Pill dimensions
                      const pw = isRotated ? 108 : (a.label!.length * 6.1)
                      const ph = 18
                      return (
                        <g transform={
                          isRotated
                            ? `translate(${a.labelX},${a.labelY}) rotate(${a.labelRotate})`
                            : `translate(${a.labelX},${a.labelY})`
                        }>
                          <rect
                            x={-pw / 2} y={-ph / 2}
                            width={pw} height={ph}
                            rx={5}
                            fill={isBranch ? "#fffbeb" : "#fff1f2"}
                            stroke={isBranch ? "#fbbf24" : "#fda4af"}
                            strokeWidth={1}
                          />
                          <text
                            x={0} y={5}
                            textAnchor="middle"
                            fontSize={9.5}
                            fontWeight={700}
                            fill={isBranch ? "#92400e" : "#9f1239"}
                            fontFamily="system-ui, -apple-system, sans-serif"
                            letterSpacing="0.01em"
                          >
                            {a.label}
                          </text>
                        </g>
                      )
                    })()}
                  </g>
                )
              })}
            </svg>

            {/* ── Stage cards ── */}
            {stages.map((s, i) => {
              const { x, y } = gridPos[i]
              const Icon = s.icon
              return (
                <div
                  key={s.no}
                  className="absolute flex flex-col overflow-hidden rounded-xl border bg-white shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-px"
                  style={{ left: x, top: y, width: CARD_W, height: CARD_H, borderColor: s.border }}
                >
                  <div className="h-[3px] w-full shrink-0" style={{ background: s.color }} />
                  <div className="flex flex-1 flex-col gap-2 p-3.5">
                    <div className="flex items-center justify-between">
                      <div
                        className="flex h-[30px] w-[30px] items-center justify-center rounded-lg shrink-0"
                        style={{ background: s.bg }}
                      >
                        <Icon size={15} strokeWidth={2} style={{ color: s.color }} />
                      </div>
                      <span
                        className="rounded px-1.5 py-0.5 text-[10px] font-black tabular-nums tracking-wider"
                        style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}
                      >
                        {s.no}
                      </span>
                    </div>
                    <div className="-mt-0.5">
                      <h3 className="text-[13px] font-bold leading-snug text-slate-900">{s.title}</h3>
                      <p className="mt-0.5 text-[9.5px] font-bold uppercase tracking-[0.1em]" style={{ color: s.color }}>
                        {s.actor}
                      </p>
                    </div>
                    <p className="mt-auto text-[11px] leading-[1.45] text-slate-500 line-clamp-3">
                      {s.action}
                    </p>
                  </div>
                </div>
              )
            })}

            {/* ── Exception card: Damage Adjustment ── */}
            <div
              className="absolute flex flex-col overflow-hidden rounded-xl border bg-white shadow-sm"
              style={{ left: colX(2), top: EX_Y, width: CARD_W, borderColor: "#fecdd3" }}
            >
              <div className="h-[3px] w-full bg-rose-500" />
              <div className="flex flex-col gap-2 p-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex h-[30px] w-[30px] items-center justify-center rounded-lg bg-rose-50">
                    <AlertTriangle size={15} strokeWidth={2} className="text-rose-600" />
                  </div>
                  <span className="rounded border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[10px] font-black tracking-wider text-rose-600">
                    EX
                  </span>
                </div>
                <div>
                  <h3 className="text-[13px] font-bold leading-snug text-slate-900">Damage Adjustment</h3>
                  <p className="mt-0.5 text-[9.5px] font-bold uppercase tracking-[0.1em] text-rose-500">
                    Exception after delivery
                  </p>
                </div>
                <p className="text-[11px] leading-[1.45] text-slate-500">
                  Use when receiver reports damage or shortage after material receipt.
                </p>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
