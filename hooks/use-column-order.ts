import { useState, useCallback } from "react"

const ORDER_PREFIX = "col_order_"

function readOrder(stageKey: string): string[] | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(ORDER_PREFIX + stageKey)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed) && parsed.every((s: unknown) => typeof s === "string")) return parsed
    return null
  } catch {
    return null
  }
}

function writeOrder(stageKey: string, order: string[]): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(ORDER_PREFIX + stageKey, JSON.stringify(order))
  } catch {}
}

/**
 * useColumnOrder
 *
 * Persists the user's column ordering preferences to localStorage.
 * Mirrors the pattern of usePersistedColumns but tracks ORDER, not visibility.
 *
 * @param stageKey     Unique key per stage (e.g. "pre-approval"). Use the same key as usePersistedColumns.
 * @param defaultOrder Full ordered list of column IDs for this stage.
 * @returns            [columnOrder, setColumnOrder]
 */
export function useColumnOrder(
  stageKey: string,
  defaultOrder: string[]
): [string[], (order: string[]) => void] {
  const [columnOrder, setColumnOrderInternal] = useState<string[]>(() => {
    const saved = readOrder(stageKey)
    if (!saved) return defaultOrder
    // Merge: keep saved ordering, add any new columns at the end, drop removed ones
    const defaultSet = new Set(defaultOrder)
    const newCols = defaultOrder.filter(id => !new Set(saved).has(id))
    return [...saved.filter(id => defaultSet.has(id)), ...newCols]
  })

  const setColumnOrder = useCallback(
    (order: string[]) => {
      setColumnOrderInternal(order)
      writeOrder(stageKey, order)
    },
    [stageKey]
  )

  return [columnOrder, setColumnOrder]
}
