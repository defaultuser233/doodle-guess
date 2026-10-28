import { afterEach, describe, expect, it, vi } from 'vitest'
import { SHARE_MESSAGES, shareImage } from './share'

const blob = new Blob(['fake-png'], { type: 'image/png' })

class ClipboardItemMock {
  items: Record<string, Blob>

  constructor(items: Record<string, Blob>) {
    this.items = items
  }
}

describe('shareImage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('uses the system share sheet when files are supported', async () => {
    const share = vi.fn(async () => undefined)
    vi.stubGlobal('navigator', {
      share,
      canShare: () => true,
    })

    await expect(shareImage(blob, 'doodle-cat.png')).resolves.toBe('shared')
    expect(share).toHaveBeenCalledTimes(1)
  })

  it('falls back to the clipboard and returns copied', async () => {
    const write = vi.fn(async () => undefined)
    vi.stubGlobal('navigator', { clipboard: { write } })
    vi.stubGlobal('ClipboardItem', ClipboardItemMock)
    vi.stubGlobal('window', { setTimeout: () => 0 })

    await expect(shareImage(blob, 'doodle-cat.png')).resolves.toBe('copied')
    expect(write).toHaveBeenCalledTimes(1)
  })

  it('downloads the image when clipboard writing fails', async () => {
    const write = vi.fn(async () => {
      throw new Error('denied')
    })
    const click = vi.fn()
    const appendChild = vi.fn()
    const link = {
      href: '',
      download: '',
      click,
      remove: vi.fn(),
    }
    vi.stubGlobal('navigator', { clipboard: { write } })
    vi.stubGlobal('ClipboardItem', ClipboardItemMock)
    vi.stubGlobal('window', { setTimeout: () => 0 })
    vi.stubGlobal('document', {
      createElement: () => link,
      body: { appendChild },
    })
    vi.stubGlobal('URL', {
      createObjectURL: () => 'blob:test',
      revokeObjectURL: vi.fn(),
    })

    await expect(shareImage(blob, 'doodle-cat.png')).resolves.toBe('downloaded')
    expect(link.download).toBe('doodle-cat.png')
    expect(click).toHaveBeenCalledTimes(1)
    expect(appendChild).toHaveBeenCalledTimes(1)
  })

  it('reports a cancelled system share separately', async () => {
    const share = vi.fn(async () => {
      throw new DOMException('cancelled', 'AbortError')
    })
    vi.stubGlobal('navigator', {
      share,
      canShare: () => true,
    })

    await expect(shareImage(blob, 'doodle-cat.png')).resolves.toBe('cancelled')
  })

  it('provides a message for every outcome', () => {
    expect(Object.keys(SHARE_MESSAGES).sort()).toEqual([
      'cancelled',
      'copied',
      'downloaded',
      'failed',
      'shared',
    ])
  })
})
