/** Strips spaces and lowercases — "HK RBO 15 KG" → "hkrbo15kg" */
export function normalizeSearch(str: string): string {
  return str.replace(/\s+/g, '').toLowerCase()
}

/** Returns true if `text` contains `query`, ignoring spaces and case on both sides */
export function matchesSearch(text: string, query: string): boolean {
  if (!query) return true
  const t = normalizeSearch(String(text ?? ''))
  const q = normalizeSearch(query)
  return t.includes(q) || String(text ?? '').toLowerCase().includes(query.toLowerCase().trim())
}
