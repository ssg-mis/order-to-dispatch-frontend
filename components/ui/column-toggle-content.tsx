"use client"

import { useState } from "react"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import {
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"

interface Column {
  id: string
  label: string
}

interface ColumnToggleContentProps {
  columns: Column[]
  visibleColumns: string[]
  setVisibleColumns: (updater: (prev: string[]) => string[]) => void
}

export function ColumnToggleContent({ columns, visibleColumns, setVisibleColumns }: ColumnToggleContentProps) {
  const [search, setSearch] = useState("")

  const filtered = [...columns]
    .sort((a, b) => a.label.localeCompare(b.label))
    .filter((col) => col.label.toLowerCase().includes(search.toLowerCase()))

  return (
    <>
      <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
      <div className="px-2 py-1">
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search columns..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-7 text-sm"
          />
        </div>
      </div>
      <DropdownMenuSeparator />
      <div className="max-h-[300px] overflow-y-auto">
        {filtered.map((col) => (
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
        {filtered.length === 0 && (
          <p className="py-2 text-center text-xs text-muted-foreground">No columns found</p>
        )}
      </div>
    </>
  )
}
