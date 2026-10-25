import type { Stats } from './types'

const STATS_KEY = 'doodle-guess-stats-v1'
const SOUND_KEY = 'doodle-guess-sound-v1'

const EMPTY_STATS: Stats = { guesses: 0, wins: 0, streak: 0, bestStreak: 0 }

export function loadStats(): Stats {
  try {
    const raw = localStorage.getItem(STATS_KEY)
    if (!raw) return { ...EMPTY_STATS }
    const parsed = JSON.parse(raw) as Partial<Stats>
    return {
      guesses: Number(parsed.guesses) || 0,
      wins: Number(parsed.wins) || 0,
      streak: Number(parsed.streak) || 0,
      bestStreak: Number(parsed.bestStreak) || 0,
    }
  } catch {
    return { ...EMPTY_STATS }
  }
}

function persistStats(stats: Stats): void {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats))
  } catch {
    // Stats are nice-to-have; ignore storage failures.
  }
}

export function recordGuess(success: boolean): Stats {
  const stats = loadStats()
  const next: Stats = {
    guesses: stats.guesses + 1,
    wins: stats.wins + (success ? 1 : 0),
    streak: success ? stats.streak + 1 : 0,
    bestStreak: success
      ? Math.max(stats.bestStreak, stats.streak + 1)
      : stats.bestStreak,
  }
  persistStats(next)
  return next
}

export function successRate(stats: Stats): number {
  if (stats.guesses === 0) return 0
  return Math.round((stats.wins / stats.guesses) * 100)
}

export function loadSoundPreference(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) === 'on'
  } catch {
    return false
  }
}

export function saveSoundPreference(enabled: boolean): void {
  try {
    localStorage.setItem(SOUND_KEY, enabled ? 'on' : 'off')
  } catch {
    // Ignore.
  }
}
