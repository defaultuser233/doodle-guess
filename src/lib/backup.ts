import type { Artwork, GameMode, GuessRecord } from './types'

export const BACKUP_APP = 'doodle-guess'
export const BACKUP_VERSION = 1
const MAX_IMPORTED_ARTWORKS = 200
const MAX_IMAGE_LENGTH = 4_000_000

export interface BackupFile {
  app: typeof BACKUP_APP
  version: typeof BACKUP_VERSION
  exportedAt: string
  artworks: Artwork[]
}

export interface BackupParseResult {
  ok: boolean
  artworks: Artwork[]
  skipped: number
  error?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeGuess(value: unknown): GuessRecord | null {
  if (!isRecord(value)) return null
  if (
    typeof value.id !== 'string' ||
    value.id.length === 0 ||
    value.id.length > 120 ||
    typeof value.zh !== 'string' ||
    value.zh.length > 80 ||
    typeof value.emoji !== 'string' ||
    value.emoji.length > 16 ||
    typeof value.confidence !== 'number' ||
    !Number.isFinite(value.confidence) ||
    value.confidence < 0 ||
    value.confidence > 1
  ) {
    return null
  }
  return {
    id: value.id,
    zh: value.zh,
    emoji: value.emoji,
    confidence: value.confidence,
  }
}

function normalizeArtwork(value: unknown): Artwork | null {
  if (!isRecord(value)) return null
  const mode = value.mode
  if (mode !== 'challenge' && mode !== 'free') return null
  const origin = value.origin
  if (origin !== undefined && origin !== 'play' && origin !== 'free') return null
  if (
    typeof value.id !== 'string' ||
    value.id.length === 0 ||
    value.id.length > 120 ||
    typeof value.createdAt !== 'number' ||
    !Number.isFinite(value.createdAt) ||
    typeof value.image !== 'string' ||
    value.image.length > MAX_IMAGE_LENGTH ||
    !/^data:image\/(?:png|webp|jpeg|jpg);base64,[A-Za-z0-9+/=]+$/.test(value.image) ||
    (value.targetId !== null && typeof value.targetId !== 'string') ||
    typeof value.targetZh !== 'string' ||
    value.targetZh.length > 80 ||
    typeof value.targetEmoji !== 'string' ||
    value.targetEmoji.length > 16 ||
    typeof value.success !== 'boolean' ||
    typeof value.durationMs !== 'number' ||
    !Number.isFinite(value.durationMs) ||
    value.durationMs < 0 ||
    !Array.isArray(value.guesses) ||
    value.guesses.length > 5
  ) {
    return null
  }

  const guesses: GuessRecord[] = []
  for (const guess of value.guesses) {
    const normalized = normalizeGuess(guess)
    if (!normalized) return null
    guesses.push(normalized)
  }

  return {
    id: value.id,
    createdAt: value.createdAt,
    image: value.image,
    targetId: typeof value.targetId === 'string' ? value.targetId : null,
    targetZh: value.targetZh,
    targetEmoji: value.targetEmoji,
    mode: mode as GameMode,
    guesses,
    success: value.success,
    durationMs: value.durationMs,
    origin: origin as Artwork['origin'],
  }
}

export function createBackup(artworks: Artwork[]): BackupFile {
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    artworks,
  }
}

export function parseBackup(text: string): BackupParseResult {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return { ok: false, artworks: [], skipped: 0, error: '不是有效的 JSON 文件' }
  }

  if (!isRecord(data)) {
    return { ok: false, artworks: [], skipped: 0, error: '备份内容格式不对' }
  }
  if (data.app !== BACKUP_APP || data.version !== BACKUP_VERSION) {
    return {
      ok: false,
      artworks: [],
      skipped: 0,
      error: '不是「画个啥」的 v1 备份',
    }
  }
  if (!Array.isArray(data.artworks)) {
    return { ok: false, artworks: [], skipped: 0, error: '备份里没有作品列表' }
  }

  const total = data.artworks.length
  const byId = new Map<string, Artwork>()
  for (const item of data.artworks) {
    const artwork = normalizeArtwork(item)
    if (artwork) byId.set(artwork.id, artwork)
  }
  const artworks = [...byId.values()]
    .sort((left, right) => right.createdAt - left.createdAt)
    .slice(0, MAX_IMPORTED_ARTWORKS)

  if (artworks.length === 0) {
    return {
      ok: false,
      artworks: [],
      skipped: total,
      error: '没有找到可导入的作品',
    }
  }

  return {
    ok: true,
    artworks,
    skipped: Math.max(0, total - artworks.length),
  }
}
