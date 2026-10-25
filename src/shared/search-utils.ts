/**
 * Normalizes text for search by removing accents/diacritics and converting to lowercase.
 * Example: "Cuán Grande es Él" -> "cuan grande es el"
 */
export function normalizeForSearch(text: string): string {
  if (!text) return ''
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accent marks
    .toLowerCase()
    .trim()
}

/**
 * Calculates Levenshtein distance between two short strings for typo tolerance.
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  const matrix: number[][] = []

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i]
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        )
      }
    }
  }

  return matrix[b.length][a.length]
}

/**
 * Searches a collection of items with accent insensitivity and typo tolerance.
 * Optimized for collections of 2,000+ items.
 */
export function searchItems<T>(
  items: T[],
  query: string,
  extractSearchableFields: (item: T) => string[]
): T[] {
  const normQuery = normalizeForSearch(query)
  if (!normQuery) return items

  const queryTokens = normQuery.split(/\s+/).filter((t) => t.length > 0)

  return items.filter((item) => {
    const fields = extractSearchableFields(item)
    const normFields = fields.map(normalizeForSearch)
    const combined = normFields.join(' ')

    // 1. Direct substring match (covers 95%+ of searches with highest speed)
    const allTokensMatch = queryTokens.every((token) => combined.includes(token))
    if (allTokensMatch) return true

    // 2. Typo tolerance: if query token is alphabetic and at least 4 letters, check small distance on individual words
    if (normQuery.length >= 4) {
      const words = combined.split(/\s+/)
      const hasCloseWord = queryTokens.every((token) => {
        // Do not fuzz numbers
        if (/^\d+$/.test(token)) {
          return combined.includes(token)
        }
        return words.some((w) => {
          if (Math.abs(w.length - token.length) > 2) return false
          const maxAllowedDistance = token.length >= 6 ? 2 : 1
          return levenshteinDistance(token, w) <= maxAllowedDistance
        })
      })
      if (hasCloseWord) return true
    }

    return false
  })
}
