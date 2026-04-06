"use client"

import React from "react"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Eye, Search, Filter, RotateCcw } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AsyncCombobox } from "@/components/ui/async-combobox"
import { customerApi } from "@/lib/api-service"
import { cn } from "@/lib/utils"
import { Check, ChevronsUpDown } from "lucide-react"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface WorkflowStageShellProps {
  title: string
  description: string
  pendingCount: number
  children: React.ReactNode
  historyData: any[]
  historyContent?: React.ReactNode
  partyNames?: string[]
  fetchPartyOptions?: (search: string, page: number) => Promise<{ options: any[]; hasMore: boolean }>
  onFilterChange?: (filters: { search: string; status: string; startDate: string; endDate: string; partyName: string }) => void
  remarksColName?: string
  showStatusFilter?: boolean
  stageLevel?: number
  onTabChange?: (tab: "pending" | "history") => void
  historyFooter?: React.ReactNode
  isHistoryLoading?: boolean
}

const FIELD_GROUPS: Record<string, number> = {
  // Level 0: Order Punch (Standard)
  order_no: 0, so_no: 0, party_name: 0, product_name: 0, order_quantity: 0, rate: 0, freight_rate: 0,
  order_type: 0, customer_type: 0, customer_address: 0, payment_terms: 0, advance_amount: 0,
  broker_name: 0, order_punch_remarks: 0, final_rate: 0, transfer: 0, bill_company_name: 0,
  bill_address: 0, ship_company_name: 0, ship_address: 0,
  sku_name: 0, approval_qty: 0, delivery_date: 0, order_type_delivery_purpose: 0,
  rate_per_ltr: 0, rate_per_15kg: 0, rate_of_material: 0, remark: 0, pre_approval_user: 1,
  party_so_date: 0, start_date: 0, end_date: 0, depo_name: 0, futureperioddate: 0, 
  upload_so: 0, customer_contact_person_name: 0, customer_contact_person_whatsapp_no: 0,
  customer_name: 0,

  // Level 1: Pre-Approval
  d_sr_number: 1, pre_approval_qty: 1, pre_approval_remarks: 1, timestamp_1: 1, status_1: 1, planned_1: 1, actual_1: 1,

  // Level 2: Approval of Order
  rate_is_rightly_as_per_current_market_rate: 2, we_are_dealing_in_ordered_sku: 2, party_credit_status: 2,
  dispatch_date_confirmed: 2, overall_status_of_order: 2, order_confirmation_with_customer: 2,
  processid: 2, order_approval_user: 2, planned_2: 2, actual_2: 2, delay_2: 2,
  actual_approval_qty: 2, status_2: 2,

  // Level 3: Dispatch Planning
  dispatch_from: 3, dispatch_planning_user: 3, revert_planning_remarks: 3, 
  actual_3: 3, planned_3: 3, delay_3: 3,

  // Level 4: Material Load / Vehicle / Weightment (Stages 5, 6, 7)
  truck_no: 4, driver_name: 4, driver_mobile_no: 4, transporter_name: 4, rst_no: 4,
  gross_weight: 4, tare_weight: 4, net_weight: 4, actual_qty: 4,
  material_load_user: 4, weightment_slip_copy: 4, vehicle_no_plate_image: 4, 
  check_status: 4, vehicle_number: 4,
  fitness: 4, insurance: 4, tax_copy: 4, polution: 4, permit1: 4, permit2_out_state: 4,
  fitness_end_date: 4, insurance_end_date: 4, tax_end_date: 4, pollution_end_date: 4,
  permit1_end_date: 4, permit2_end_date: 4, actual_qty_dispatch: 4,
  product_name_1: 4, actual_dispatch_user: 4, extra_weight: 4,
  reason_of_difference_in_weight_if_any_speacefic: 4,

  // Level 5: Security Approval (Stage 8)
  bilty_no: 5, bilty_image: 5, vehicle_image_attachemrnt: 5, security_guard_status: 5,
  security_guard_user: 5, revert_security_remarks: 5, actual_4: 5, planned_4: 5,

  // Level 6: Make Invoice (Stage 9)
  bill_type: 6, invoice_date: 6, invoice_no: 6, invoice_copy: 6, bill_amount: 6, 
  make_invoice_user: 6, actual_5: 6, planned_5: 6,

  // Level 7: Check Invoice (Stage 11)
  verification_status: 7, actual_7: 7, planned_7: 7,

  // Level 8: Gate Out (Stage 12)
  gate_pass_copy: 8, actual_8: 8, planned_8: 8,

  // Level 9: Material Receipt (Stage 13)
  damage_qty: 9, damage_status: 9, actual_9: 9, planned_9: 9,

  // Level 10: Damage Adjustment
  credit_note_no: 10, actual_10: 10, planned_10: 10,
}

export function WorkflowStageShell({
  title,
  description,
  pendingCount,
  children,
  historyData,
  historyContent,
  partyNames = [],
  onFilterChange,
  remarksColName,
  showStatusFilter = false,
  stageLevel = 99,
  onTabChange,
  historyFooter,
  isHistoryLoading = false,
  fetchPartyOptions,
}: WorkflowStageShellProps) {
  const [filters, setFilters] = React.useState({
    search: "",
    status: "",
    startDate: "",
    endDate: "",
    partyName: ""
  })

  const [selectedHistoryItem, setSelectedHistoryItem] = React.useState<any>(null)
  const [historySearch, setHistorySearch] = React.useState("")
  const [partySearchOpen, setPartySearchOpen] = React.useState(false)

  const updateFilter = (key: keyof typeof filters, value: string) => {
    const newFilters = { ...filters, [key]: value }
    setFilters(newFilters)
    if (onFilterChange) {
      onFilterChange(newFilters)
    }
  }

  const formatKey = (key: string) => {
    return key
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  const renderValue = (value: any) => {
    if (value === null || value === undefined) return "—"
    if (typeof value === 'boolean') return value ? "Yes" : "No"
    if (typeof value === 'string' && (value.startsWith('http') || value.includes('/uploads/'))) {
      return (
        <a href={value} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-bold">
          View Attachment
        </a>
      )
    }
    return String(value)
  }

  return (
    <SidebarInset>
      <div className="p-6 space-y-4 w-full">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="h-6" />
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
          </div>
          <Badge variant="outline" className="px-4 py-1 text-sm bg-primary/5 text-primary border-primary/20">
            {pendingCount} Pending Items
          </Badge>
        </div>

        <Tabs 
          defaultValue="pending" 
          className="w-full"
          onValueChange={(val) => onTabChange?.(val as "pending" | "history")}
        >
          <TabsList className="grid w-full max-w-[400px] grid-cols-2 mb-2 bg-muted/50 p-1 rounded-lg h-9">
            <TabsTrigger value="pending" className="rounded-md text-xs py-1">
              Pending Tasks
            </TabsTrigger>
            <TabsTrigger value="history" className="rounded-md text-xs py-1">
              Stage History
            </TabsTrigger>
          </TabsList>

          <div className="flex flex-col gap-2 bg-card p-3 rounded-xl border shadow-sm mb-4">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search DO Number, Customer..."
                  className="pl-9 bg-transparent h-9"
                  value={filters.search}
                  onChange={(e) => updateFilter("search", e.target.value)}
                />
              </div>
              <Button variant="outline" size="icon" className="bg-transparent h-9 w-9">
                <Filter className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="bg-transparent h-9 w-9" onClick={() => {
                const reset = { search: "", status: "", startDate: "", endDate: "", partyName: "" };
                setFilters(reset);
                if (onFilterChange) onFilterChange(reset);
              }}>
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>

            {/* Extended Filters */}
            <div className={`grid grid-cols-1 gap-2 ${showStatusFilter ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
              {/* Status Select */}
              {showStatusFilter && (
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-muted-foreground">Status</Label>
                  <Select value={filters.status} onValueChange={(val) => updateFilter("status", val)}>
                    <SelectTrigger className="w-full h-8 bg-background px-3 text-sm">
                      <SelectValue placeholder="Select Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="on-time">On Time</SelectItem>
                      <SelectItem value="expire">Expire</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Start Date */}
              <div className="space-y-1">
                <Label className="text-xs font-medium text-muted-foreground">Start Date</Label>
                <Input
                  type="date"
                  className="w-full h-8 bg-background px-3 text-sm block"
                  value={filters.startDate}
                  onChange={(e) => updateFilter("startDate", e.target.value)}
                />
              </div>

              {/* End Date */}
              <div className="space-y-1">
                <Label className="text-xs font-medium text-muted-foreground">End Date</Label>
                <Input
                  type="date"
                  className="w-full h-8 bg-background px-3 text-sm block"
                  value={filters.endDate}
                  onChange={(e) => updateFilter("endDate", e.target.value)}
                />
              </div>

              {/* Party Name Select */}
              <div className="space-y-1">
                <Label className="text-xs font-medium text-muted-foreground">Party Name</Label>
                {partyNames && partyNames.length > 0 ? (
                  <Popover open={partySearchOpen} onOpenChange={setPartySearchOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={partySearchOpen}
                        className="w-full h-8 justify-between bg-background px-3 text-xs font-medium border-slate-200"
                      >
                        <span className="truncate">
                          {filters.partyName === "all" || !filters.partyName 
                            ? "All Parties" 
                            : filters.partyName}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search parties..." />
                        <CommandList>
                          <CommandEmpty>No party found.</CommandEmpty>
                          <CommandGroup>
                            <CommandItem
                              value="all"
                              onSelect={() => {
                                updateFilter("partyName", "all")
                                setPartySearchOpen(false)
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  filters.partyName === "all" ? "opacity-100" : "opacity-0"
                                )}
                              />
                              All Parties
                            </CommandItem>
                            {partyNames.map((name) => (
                              <CommandItem
                                key={name}
                                value={name}
                                onSelect={(currentValue) => {
                                  updateFilter("partyName", currentValue === filters.partyName ? "" : currentValue)
                                  setPartySearchOpen(false)
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    filters.partyName === name ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                {name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                ) : (
                  <AsyncCombobox
                    placeholder="Select Party Name"
                    searchPlaceholder="Search parties..."
                    value={filters.partyName}
                    onValueChange={(val) => updateFilter("partyName", val)}
                    onSelectOption={(opt: any) => {
                      // Optional: handle specific selection if needed
                    }}
                    fetchOptions={fetchPartyOptions || (async (search: string, page: number) => {
                      const res = await customerApi.getAll({ search, page, limit: 20 });
                      const list = res.data.customers || [];
                      return {
                        options: [
                          { value: "all", label: "All Parties" },
                          ...list.map((c: any) => ({ value: c.customer_name, label: c.customer_name }))
                        ],
                        hasMore: (list.length + (page - 1) * 20) < (res.data.pagination?.total || 0)
                      };
                    })}
                    className="w-full h-8 bg-background text-xs font-medium"
                  />
                )}
              </div>
            </div>
          </div>

          <TabsContent value="pending" className="space-y-2">
            {children}
          </TabsContent>

          <TabsContent value="history">
            {historyContent ? (
              <div className="mt-4">{historyContent}</div>
            ) : (
              <Card className="border-none shadow-sm overflow-hidden">
                {isHistoryLoading ? (
                  <div className="p-0 border-none shadow-none">
                    <table className="w-full text-sm table-fixed">
                      <thead className="bg-muted/30 border-b text-[10px] uppercase font-black text-slate-500 tracking-wider">
                        <tr>
                          <th className="px-4 py-3 text-left w-[12%]">Date</th>
                          <th className="px-4 py-3 text-left w-[18%]">Order No.</th>
                          <th className="px-4 py-3 text-left w-[18%]">Party Name</th>
                          <th className="px-4 py-3 text-left text-center w-[12%]">Status</th>
                          <th className="px-4 py-3 text-left w-[25%]">Remarks</th>
                          <th className="px-4 py-3 text-center w-[15%]">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...Array(5)].map((_, i) => (
                          <tr key={i} className="border-b transition-colors opacity-60">
                            <td className="px-4 py-4"><div className="h-3 w-16 bg-slate-200 animate-pulse rounded-full" /></td>
                            <td className="px-4 py-4"><div className="h-3 w-24 bg-blue-100 animate-pulse rounded-full" /></td>
                            <td className="px-4 py-4"><div className="h-3 w-32 bg-slate-200 animate-pulse rounded-full" /></td>
                            <td className="px-4 py-4 flex justify-center"><div className="h-4 w-16 bg-slate-200 animate-pulse rounded-full" /></td>
                            <td className="px-4 py-4"><div className="h-3 w-full bg-slate-100 animate-pulse rounded-full" /></td>
                            <td className="px-4 py-4 flex justify-center"><div className="h-7 w-12 bg-slate-200 animate-pulse rounded-full" /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : historyData && historyData.length > 0 ? (
                    <div className="overflow-x-auto max-h-[600px] overflow-y-auto relative">
                      <table className="w-full text-sm table-fixed">
                        <thead className="bg-muted/30 border-b text-[10px] uppercase font-black text-slate-500 tracking-wider sticky top-0 z-10 shadow-sm">
                          <tr>
                            <th className="px-4 py-3 text-left w-[12%]">Date</th>
                            <th className="px-4 py-3 text-left w-[18%]">Order No.</th>
                            <th className="px-4 py-3 text-left w-[18%]">Party Name</th>
                            <th className="px-4 py-3 text-left text-center w-[12%]">Status</th>
                            <th className="px-4 py-3 text-left w-[25%]">{remarksColName || "Remarks"}</th>
                            <th className="px-4 py-3 text-center w-[15%]">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {historyData.map((item, i) => (
                            <tr key={i} className="border-b hover:bg-muted/20 transition-colors">
                              <td className="px-4 py-3 text-xs">{item.date || "-"}</td>
                              <td className="px-4 py-3 font-bold text-blue-700 text-xs">{item.orderNo || "-"}</td>
                              <td className="px-4 py-3 text-xs font-semibold capitalize">{item.customerName || "-"}</td>
                              <td className="px-4 py-3 text-center">
                                <span
                                  className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tight ${item.status === "Approved" || item.status === "Completed" || item.status === "Verified"
                                      ? "bg-green-100 text-green-700 border border-green-200"
                                      : item.status === "Rejected"
                                        ? "bg-red-100 text-red-700 border border-red-200"
                                        : "bg-slate-100 text-slate-700 border border-slate-200"
                                    }`}
                                >
                                  {item.status || "Completed"}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-[10px] text-muted-foreground font-medium italic">
                                {item.remarks || "-"}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 px-2 text-[10px] font-black bg-white hover:bg-blue-50 hover:text-blue-700 border-2 transition-all uppercase italic tracking-tighter"
                                  onClick={() => setSelectedHistoryItem(item.rawData || item)}
                                >
                                  <Eye className="mr-1 h-3 w-3" />
                                  View
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {historyFooter}
                    </div>
                ) : (
                  <div className="p-8 text-center text-muted-foreground">No history records found.</div>
                )}
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* History Detail Dialog */}
        <Dialog open={!!selectedHistoryItem} onOpenChange={(open) => !open && setSelectedHistoryItem(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0 rounded-3xl border-none shadow-2xl">
            <DialogHeader className="p-6 pb-2 bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
              <div className="flex justify-between items-start">
                <div>
                  <DialogTitle className="text-2xl font-black uppercase tracking-tight italic">Record Details</DialogTitle>
                  <DialogDescription className="text-blue-100 font-bold mt-1 uppercase text-[10px] tracking-widest">
                    Comprehensive audit trail for {selectedHistoryItem?.so_no || selectedHistoryItem?.orderNo || "Order"}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="p-6 flex-1 overflow-y-auto space-y-6 bg-slate-50">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search fields or values..."
                  className="pl-9 bg-white border-2 focus:border-blue-400 rounded-xl h-10 shadow-sm"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                />
              </div>

              <div className="border-2 border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm">
                <Table>
                  <TableHeader className="bg-slate-100/50">
                    <TableRow>
                      <TableHead className="text-[10px] uppercase font-black text-slate-500 tracking-wider w-1/3">Field Name</TableHead>
                      <TableHead className="text-[10px] uppercase font-black text-slate-500 tracking-wider">Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedHistoryItem ? Object.entries(selectedHistoryItem)
                      .filter(([key]) => !['rawData', '_rowKey', 'id'].includes(key))
                      .filter(([key]) => {
                        // Cumulative visibility filter
                        const fieldLevel = FIELD_GROUPS[key]
                        return fieldLevel === undefined || fieldLevel <= stageLevel
                      })
                      .filter(([key, value]) => {
                        if (!historySearch) return true
                        const s = historySearch.toLowerCase()
                        return key.toLowerCase().includes(s) || String(value).toLowerCase().includes(s)
                      })
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([key, value]) => (
                        <TableRow key={key} className="hover:bg-blue-50/30 transition-colors border-slate-100">
                          <TableCell className="font-black text-slate-500 text-[10px] uppercase tracking-tight py-3">
                            {formatKey(key)}
                          </TableCell>
                          <TableCell className="py-3 text-xs font-bold text-slate-800">
                            {renderValue(value)}
                          </TableCell>
                        </TableRow>
                      )) : null}
                  </TableBody>
                </Table>
              </div>
            </div>
            <div className="p-4 bg-white border-t flex justify-end">
              <Button
                onClick={() => setSelectedHistoryItem(null)}
                className="bg-slate-900 hover:bg-black text-white px-8 font-black uppercase italic tracking-tighter"
              >
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </SidebarInset>
  )
}
