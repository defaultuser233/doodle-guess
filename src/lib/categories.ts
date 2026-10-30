import rawCategories from '../data/categories.json'

export interface Category {
  id: string
  en: string
  zh: string
  emoji: string
}

export const CATEGORIES = rawCategories as Category[]

const RECENT_KEY = 'doodle-guess-recent-words-v1'

export const RECENT_WORD_LIMIT = 30

const byId = new Map(CATEGORIES.map((category) => [category.id, category]))

export function findCategory(id: string | null | undefined): Category | undefined {
  if (!id) return undefined
  return byId.get(id)
}

export function loadRecentWords(): string[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.filter((id): id is string => typeof id === 'string')
  } catch {
    return []
  }
}

export function rememberCategory(id: string): void {
  if (typeof localStorage === 'undefined') return
  const next = [id, ...loadRecentWords().filter((recent) => recent !== id)].slice(
    0,
    RECENT_WORD_LIMIT,
  )
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next))
  } catch {
    // Word history is a nicety; ignore storage failures.
  }
}

export function pickCategory(
  excludeId?: string | null,
  recent: readonly string[] = [],
): Category {
  const withoutExcluded = CATEGORIES.filter(
    (category) => category.id !== excludeId,
  )
  const fresh = withoutExcluded.filter(
    (category) => !recent.includes(category.id),
  )
  const pool = fresh.length > 0 ? fresh : withoutExcluded
  return pool[Math.floor(Math.random() * pool.length)] ?? CATEGORIES[0]
}
