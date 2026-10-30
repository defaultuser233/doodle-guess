import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CATEGORIES,
  findCategory,
  loadRecentWords,
  pickCategory,
  RECENT_WORD_LIMIT,
  rememberCategory,
} from './categories'

const store = new Map<string, string>()

const storage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => {
    store.set(key, value)
  },
  removeItem: (key: string) => {
    store.delete(key)
  },
  clear: () => store.clear(),
  key: (index: number) => [...store.keys()][index] ?? null,
  get length() {
    return store.size
  },
}

describe('categories', () => {
  beforeEach(() => {
    store.clear()
    vi.stubGlobal('localStorage', storage)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('finds a category by id and returns undefined for unknown ids', () => {
    expect(findCategory('cat')?.zh).toBe('猫')
    expect(findCategory('not-a-word')).toBeUndefined()
    expect(findCategory(null)).toBeUndefined()
  })

  it('picks a category from the shipped list', () => {
    const picked = pickCategory()
    expect(CATEGORIES.some((category) => category.id === picked.id)).toBe(true)
  })

  it('avoids the excluded category when an alternative exists', () => {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      expect(pickCategory('cat').id).not.toBe('cat')
    }
  })

  it('skips recently dealt words', () => {
    const recent = CATEGORIES.slice(0, -1).map((category) => category.id)
    const last = CATEGORIES[CATEGORIES.length - 1]

    expect(pickCategory(null, recent).id).toBe(last.id)
  })

  it('falls back to the whole list once every word is recent', () => {
    const recent = CATEGORIES.map((category) => category.id)
    const picked = pickCategory(null, recent)

    expect(CATEGORIES.some((category) => category.id === picked.id)).toBe(true)
  })

  it('keeps recent words newest first, deduped and capped', () => {
    rememberCategory('cat')
    rememberCategory('dog')
    rememberCategory('cat')

    expect(loadRecentWords()).toEqual(['cat', 'dog'])

    for (const category of CATEGORIES) rememberCategory(category.id)

    const recent = loadRecentWords()
    expect(recent).toHaveLength(RECENT_WORD_LIMIT)
    expect(recent[0]).toBe(CATEGORIES[CATEGORIES.length - 1].id)
  })

  it('ignores corrupt or missing history', () => {
    expect(loadRecentWords()).toEqual([])

    storage.setItem('doodle-guess-recent-words-v1', '{"nope":true}')
    expect(loadRecentWords()).toEqual([])

    storage.setItem('doodle-guess-recent-words-v1', '["cat", 42, null]')
    expect(loadRecentWords()).toEqual(['cat'])
  })
})
