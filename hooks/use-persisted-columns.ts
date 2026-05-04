/**
 * usePersistedColumns
 *
 * A production-ready custom React hook that persists the user's column-visibility
 * preferences for any workflow-stage table to the browser's localStorage.
 *
 * ─── HOW IT WORKS ────────────────────────────────────────────────────────────
 *  1. On first mount, the hook reads the saved value from localStorage under the
 *     key  `col_prefs_<stageKey>`.
 *  2. If a saved value exists and is valid (non-empty string array) it is used as
 *     the initial state — so the user sees exactly the columns they last chose.
 *  3. If no saved value exists (e.g. first visit) the provided `defaultColumns`
 *     are used instead.
 *  4. Whenever the returned setter is called, the new value is written to
 *     localStorage immediately and the React state is updated — keeping both
 *     in sync at all times.
 *
 * ─── USAGE ───────────────────────────────────────────────────────────────────
 *
 *  // In any page component, replace:
 *  //   const [visibleColumns, setVisibleColumns] = useState<string[]>([...defaults])
 *  // with:
 *  const [visibleColumns, setVisibleColumns] = usePersistedColumns(
 *    "make-invoice",           // unique key per workflow stage
 *    ["partySoDate", "orderNo", "customerName", "status"]  // fallback defaults
 *  )
 *
 *  // The setter works exactly like a normal React setState:
 *  setVisibleColumns(prev => checked ? [...prev, col.id] : prev.filter(id => id !== col.id))
 *
 * ─── STORAGE KEY CONVENTION ──────────────────────────────────────────────────
 *  localStorage key format:  col_prefs_<stageKey>
 *
 *  Recommended stageKey values (keep them stable — changing a key loses prefs):
 *    "make-invoice"      "check-invoice"     "gate-out"
 *    "material-receipt"  "damage-adjustment" "security-approval"
 *    "pre-approval"      "approval-of-order" "actual-dispatch"
 *    "dispatch-material"
 *
 * ─── PRODUCTION NOTES ────────────────────────────────────────────────────────
 *  • Safe in SSR/Next.js — localStorage access is guarded by typeof window check.
 *  • Safe against corrupt/stale data — invalid stored values fall back to defaults.
 *  • Zero external dependencies — uses only React hooks.
 *  • Per-user, per-browser persistence — no server round-trip needed.
 *  • To reset a user's preferences programmatically:
 *      localStorage.removeItem("col_prefs_make-invoice")
 *  • To wipe ALL column preferences at once:
 *      Object.keys(localStorage).filter(k => k.startsWith("col_prefs_")).forEach(k => localStorage.removeItem(k))
 */

import { useState, useCallback, Dispatch, SetStateAction } from "react"

const STORAGE_PREFIX = "col_prefs_"

/**
 * Reads and validates a column preference array from localStorage.
 * Returns null if nothing is stored or the stored value is invalid.
 */
function readFromStorage(stageKey: string): string[] | null {
  if (typeof window === "undefined") return null          // SSR safety
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + stageKey)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    // Validate: must be a non-empty array of strings
    if (
      Array.isArray(parsed) &&
      parsed.length > 0 &&
      parsed.every((item) => typeof item === "string")
    ) {
      return parsed
    }
    return null
  } catch {
    return null   // JSON.parse failed — corrupt data, ignore
  }
}

/**
 * Writes a column preference array to localStorage.
 * Silently swallows errors (e.g. private browsing with storage disabled).
 */
function writeToStorage(stageKey: string, columns: string[]): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(STORAGE_PREFIX + stageKey, JSON.stringify(columns))
  } catch {
    // Storage full or disabled — silently continue, UI still works
  }
}

/**
 * usePersistedColumns
 *
 * @param stageKey       Unique identifier for this workflow stage (e.g. "make-invoice").
 *                       This becomes the localStorage key suffix.
 * @param defaultColumns The columns to show on first visit (or if preferences are lost).
 * @returns              [visibleColumns, setVisibleColumns] — a drop-in replacement
 *                       for useState<string[]>.
 */
export function usePersistedColumns(
  stageKey: string,
  defaultColumns: string[]
): [string[], Dispatch<SetStateAction<string[]>>] {
  const [visibleColumns, setVisibleColumnsInternal] = useState<string[]>(() => {
    return readFromStorage(stageKey) ?? defaultColumns
  })

  // Wrap the setter so every update is mirrored to localStorage
  const setVisibleColumns: Dispatch<SetStateAction<string[]>> = useCallback(
    (value) => {
      setVisibleColumnsInternal((prev) => {
        const next = typeof value === "function" ? value(prev) : value
        writeToStorage(stageKey, next)
        return next
      })
    },
    [stageKey]
  )

  return [visibleColumns, setVisibleColumns]
}
