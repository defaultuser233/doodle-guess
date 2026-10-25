import rawCategories from '../data/categories.json'

export interface Category {
  id: string
  en: string
  zh: string
  emoji: string
}

export const CATEGORIES = rawCategories as Category[]

const byId = new Map(CATEGORIES.map((category) => [category.id, category]))

export function findCategory(id: string | null | undefined): Category | undefined {
  if (!id) return undefined
  return byId.get(id)
}

export function pickCategory(excludeId?: string | null): Category {
  if (CATEGORIES.length <= 1) return CATEGORIES[0]
  let candidate = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)]
  let guard = 0
  while (candidate.id === excludeId && guard < 8) {
    candidate = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)]
    guard += 1
  }
  return candidate
}
