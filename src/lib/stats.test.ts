import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  loadSoundPreference,
  loadStats,
  recordGuess,
  saveSoundPreference,
  successRate,
} from './stats'

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

describe('stats', () => {
  beforeEach(() => {
    store.clear()
    vi.stubGlobal('localStorage', storage)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('starts from empty stats', () => {
    expect(loadStats()).toEqual({
      guesses: 0,
      wins: 0,
      streak: 0,
      bestStreak: 0,
    })
    expect(successRate(loadStats())).toBe(0)
  })

  it('tracks wins, losses, streaks and best streak', () => {
    recordGuess(false)
    expect(loadStats()).toMatchObject({ guesses: 1, wins: 0, streak: 0 })

    recordGuess(true)
    recordGuess(true)
    expect(loadStats()).toMatchObject({
      guesses: 3,
      wins: 2,
      streak: 2,
      bestStreak: 2,
    })

    recordGuess(false)
    expect(loadStats()).toMatchObject({ streak: 0, bestStreak: 2 })
  })

  it('computes a rounded success rate', () => {
    recordGuess(true)
    recordGuess(false)
    recordGuess(false)
    expect(successRate(loadStats())).toBe(33)
  })

  it('recovers from corrupt storage', () => {
    store.set('doodle-guess-stats-v1', 'not-json')
    expect(loadStats()).toEqual({
      guesses: 0,
      wins: 0,
      streak: 0,
      bestStreak: 0,
    })
  })

  it('persists the sound preference', () => {
    expect(loadSoundPreference()).toBe(false)
    saveSoundPreference(true)
    expect(loadSoundPreference()).toBe(true)
    saveSoundPreference(false)
    expect(loadSoundPreference()).toBe(false)
  })
})
