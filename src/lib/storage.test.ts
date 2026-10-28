import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Artwork } from './types'
import {
  clearArtworks,
  countArtworks,
  deleteArtwork,
  listArtworks,
  saveArtwork,
} from './storage'

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

function artwork(index: number, createdAt = index): Artwork {
  return {
    id: `art-${String(index).padStart(3, '0')}`,
    createdAt,
    image: 'data:image/webp;base64,AAAA',
    targetId: 'cat',
    targetZh: '猫',
    targetEmoji: '🐱',
    mode: 'challenge',
    guesses: [],
    success: true,
    durationMs: 1000,
    origin: 'play',
  }
}

describe('storage', () => {
  beforeEach(async () => {
    store.clear()
    vi.stubGlobal('localStorage', storage)
    await clearArtworks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('saves and lists newest first', async () => {
    await saveArtwork(artwork(1, 100))
    await saveArtwork(artwork(2, 300))
    await saveArtwork(artwork(3, 200))

    const list = await listArtworks()
    expect(list.map((item) => item.id)).toEqual([
      'art-002',
      'art-003',
      'art-001',
    ])
    expect(await countArtworks()).toBe(3)
  })

  it('updates an existing record instead of duplicating it', async () => {
    await saveArtwork(artwork(1))
    const updated = { ...artwork(1), targetZh: '老虎', targetId: 'tiger' }
    await saveArtwork(updated)

    const list = await listArtworks()
    expect(list).toHaveLength(1)
    expect(list[0].targetZh).toBe('老虎')
  })

  it('deletes single artworks and clears the gallery', async () => {
    await saveArtwork(artwork(1))
    await saveArtwork(artwork(2))
    await deleteArtwork('art-001')
    expect((await listArtworks()).map((item) => item.id)).toEqual(['art-002'])

    await clearArtworks()
    expect(await listArtworks()).toEqual([])
  })

  it('keeps only the newest 100 artworks', async () => {
    let lastResult: Awaited<ReturnType<typeof saveArtwork>> | null = null
    for (let index = 0; index < 101; index += 1) {
      lastResult = await saveArtwork(artwork(index))
    }

    const list = await listArtworks()
    expect(list).toHaveLength(100)
    expect(list.some((item) => item.id === 'art-000')).toBe(false)
    expect(list[0].id).toBe('art-100')
    expect(lastResult?.ok).toBe(true)
    expect(lastResult?.trimmed).toBe(1)
  }, 15000)

  it('reports a failed save instead of pretending it worked', async () => {
    vi.resetModules()
    vi.stubGlobal('indexedDB', undefined)
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota exceeded')
      },
      removeItem: () => undefined,
      clear: () => undefined,
      key: () => null,
      length: 0,
    })

    const fallback = await import('./storage')
    const result = await fallback.saveArtwork(artwork(1))

    expect(result.ok).toBe(false)
    expect(result.reason).toBe('storage-unavailable')
  })

  it('falls back to localStorage when IndexedDB is unavailable', async () => {
    vi.resetModules()
    vi.stubGlobal('indexedDB', undefined)

    const fallback = await import('./storage')
    await fallback.saveArtwork(artwork(1, 10))
    await fallback.saveArtwork(artwork(2, 20))

    expect((await fallback.listArtworks()).map((item) => item.id)).toEqual([
      'art-002',
      'art-001',
    ])
    expect(await fallback.countArtworks()).toBe(2)

    await fallback.deleteArtwork('art-001')
    expect(await fallback.countArtworks()).toBe(1)
    await fallback.clearArtworks()
    expect(await fallback.countArtworks()).toBe(0)
  })
})
