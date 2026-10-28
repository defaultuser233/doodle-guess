import { describe, expect, it } from 'vitest'
import type { Artwork } from './types'
import { BACKUP_APP, BACKUP_VERSION, createBackup, parseBackup } from './backup'

function artwork(overrides: Partial<Artwork> = {}): Artwork {
  return {
    id: 'art-1',
    createdAt: 100,
    image: 'data:image/webp;base64,AAAA',
    targetId: 'cat',
    targetZh: '猫',
    targetEmoji: '🐱',
    mode: 'challenge',
    guesses: [
      { id: 'cat', zh: '猫', emoji: '🐱', confidence: 0.76 },
    ],
    success: true,
    durationMs: 12000,
    origin: 'play',
    ...overrides,
  }
}

function backupWith(artworks: unknown[]): string {
  return JSON.stringify({
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: new Date(0).toISOString(),
    artworks,
  })
}

describe('backup', () => {
  it('round-trips a valid artwork', () => {
    const backup = createBackup([artwork()])
    const parsed = parseBackup(JSON.stringify(backup))

    expect(parsed.ok).toBe(true)
    expect(parsed.skipped).toBe(0)
    expect(parsed.artworks).toHaveLength(1)
    expect(parsed.artworks[0]).toMatchObject({
      id: 'art-1',
      targetZh: '猫',
      success: true,
    })
  })

  it('rejects a backup from another app or version', () => {
    expect(parseBackup('not json').ok).toBe(false)
    expect(
      parseBackup(
        JSON.stringify({
          app: 'other',
          version: 1,
          exportedAt: '',
          artworks: [artwork()],
        }),
      ).ok,
    ).toBe(false)
  })

  it('skips invalid records but keeps valid ones', () => {
    const parsed = parseBackup(
      backupWith([
        artwork({ id: 'good' }),
        artwork({ id: 'bad-image', image: 'https://example.com/cat.png' }),
        artwork({ id: 'bad-mode', mode: 'other' as Artwork['mode'] }),
        { nonsense: true },
      ]),
    )

    expect(parsed.ok).toBe(true)
    expect(parsed.artworks.map((item) => item.id)).toEqual(['good'])
    expect(parsed.skipped).toBe(3)
  })

  it('deduplicates ids and keeps the newest record', () => {
    const parsed = parseBackup(
      backupWith([
        artwork({ id: 'same', createdAt: 100, targetZh: '旧' }),
        artwork({ id: 'same', createdAt: 200, targetZh: '新' }),
      ]),
    )

    expect(parsed.artworks).toHaveLength(1)
    expect(parsed.artworks[0].targetZh).toBe('新')
  })

  it('fails when there is nothing importable', () => {
    const parsed = parseBackup(backupWith([{ id: 'nope' }]))
    expect(parsed.ok).toBe(false)
    expect(parsed.error).toContain('没有找到')
  })
})
