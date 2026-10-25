export type GameMode = 'challenge' | 'free'

export interface GuessRecord {
  id: string
  zh: string
  emoji: string
  confidence: number
}

export interface Artwork {
  id: string
  createdAt: number
  image: string
  targetId: string | null
  targetZh: string
  targetEmoji: string
  mode: GameMode
  guesses: GuessRecord[]
  success: boolean
  durationMs: number
  /** Where the artwork came from; older records have no value. */
  origin?: 'play' | 'free'
}

export interface Stats {
  guesses: number
  wins: number
  streak: number
  bestStreak: number
}
