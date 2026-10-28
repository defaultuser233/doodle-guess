import { describe, expect, it } from 'vitest'
import { CATEGORIES, findCategory, pickCategory } from './categories'

describe('categories', () => {
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
})
