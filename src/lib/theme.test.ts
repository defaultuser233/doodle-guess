import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  applyTheme,
  loadTheme,
  nextTheme,
  saveTheme,
  systemTheme,
} from './theme'

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

const setProperty = vi.fn()
const dataset: Record<string, string> = {}

function stubEnvironment(dark: boolean) {
  vi.stubGlobal('localStorage', storage)
  vi.stubGlobal('window', {
    matchMedia: () => ({ matches: dark }),
  })
  vi.stubGlobal('document', {
    documentElement: {
      dataset,
      style: { setProperty },
    },
  })
}

describe('theme', () => {
  beforeEach(() => {
    store.clear()
    for (const key of Object.keys(dataset)) delete dataset[key]
    setProperty.mockClear()
    stubEnvironment(false)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('follows the system preference when nothing is saved', () => {
    expect(systemTheme()).toBe('light')
    expect(loadTheme()).toBe('light')

    vi.unstubAllGlobals()
    stubEnvironment(true)
    expect(systemTheme()).toBe('dark')
    expect(loadTheme()).toBe('dark')
  })

  it('lets a saved preference win over the system', () => {
    stubEnvironment(true)
    saveTheme('light')
    expect(loadTheme()).toBe('light')
    expect(store.get('doodle-guess-theme-v1')).toBe('light')
  })

  it('ignores invalid saved values', () => {
    store.set('doodle-guess-theme-v1', 'sepia')
    expect(loadTheme()).toBe('light')
  })

  it('applies the theme to the document', () => {
    applyTheme('dark')
    expect(dataset.theme).toBe('dark')
    expect(setProperty).toHaveBeenCalledWith('color-scheme', 'dark')
  })

  it('toggles between the two themes', () => {
    expect(nextTheme('light')).toBe('dark')
    expect(nextTheme('dark')).toBe('light')
  })
})
