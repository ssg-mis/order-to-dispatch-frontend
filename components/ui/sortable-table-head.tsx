"use client"

import * as React from "react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { TableHead } from "@/components/ui/table"
import { GripVertical } from "lucide-react"
import { cn } from "@/lib/utils"
import { ColumnDragDisabledContext } from "@/components/ui/column-drag-provider"

interface SortableTableHeadProps {
  id: string
  className?: string
  onClick?: () => void
  children: React.ReactNode
}

export function SortableTableHead({ id, className, onClick, children }: SortableTableHeadProps) {
  const disabled = React.useContext(ColumnDragDisabledContext)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    position: isDragging ? "relative" : undefined,
    zIndex: isDragging ? 10 : undefined,
  }

  return (
    <TableHead
      ref={setNodeRef}
      style={style}
      className={cn("group", className)}
      onClick={onClick}
    >
      <div className="flex items-center gap-0.5 justify-center">
        {!disabled && (
          <span
            {...attributes}
            {...listeners}
            className="cursor-grab opacity-0 group-hover:opacity-25 hover:!opacity-50 active:cursor-grabbing flex-shrink-0 touch-none"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical size={11} />
          </span>
        )}
        {children}
      </div>
    </TableHead>
  )
}
