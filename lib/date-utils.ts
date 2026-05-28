const IST_LOCALE = "en-IN"
const IST_TIMEZONE = "Asia/Kolkata"

const TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/

export function isTimestamp(value: unknown): value is string | Date {
  if (value instanceof Date) return !isNaN(value.getTime())
  return typeof value === "string" && TIMESTAMP_RE.test(value)
}

export function formatToIST(value: string | Date): string {
  let date: Date
  if (value instanceof Date) {
    date = value
  } else {
    // If no timezone offset (Z or +HH:MM), the string has no zone info.
    // Treat it as UTC by normalising to ISO format and appending Z.
    const hasTimezone = /Z$|[+-]\d{2}:\d{2}$/.test(value.trim())
    const normalised = hasTimezone ? value : value.replace(" ", "T") + "Z"
    date = new Date(normalised)
  }
  if (isNaN(date.getTime())) return String(value)
  return date.toLocaleString(IST_LOCALE, {
    timeZone: IST_TIMEZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  })
}
