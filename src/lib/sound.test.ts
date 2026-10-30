import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

interface FakeNode {
  connect: (node: unknown) => FakeNode
}

interface FakeSource extends FakeNode {
  buffer: AudioBuffer | null
  start: ReturnType<typeof vi.fn>
}

interface Harness {
  contexts: FakeAudioContext[]
  sources: FakeSource[]
  fetchMock: ReturnType<typeof vi.fn>
}

class FakeAudioContext {
  state = 'running'
  currentTime = 0
  destination = {}
  resume = vi.fn(() => Promise.resolve())
  instances: FakeAudioContext[]
  sources: FakeSource[]

  constructor(instances: FakeAudioContext[], sources: FakeSource[]) {
    this.instances = instances
    this.sources = sources
    instances.push(this)
  }

  createBufferSource(): FakeSource {
    const source: FakeSource = {
      buffer: null,
      connect: (node) => node as FakeNode,
      start: vi.fn(),
    }
    this.sources.push(source)
    return source
  }

  createGain(): FakeNode & { gain: { setValueAtTime: ReturnType<typeof vi.fn> } } {
    const gain = { setValueAtTime: vi.fn() }
    return {
      gain,
      connect: (node) => node as FakeNode,
    }
  }

  decodeAudioData(
    _data: ArrayBuffer,
    onSuccess: (buffer: AudioBuffer) => void,
  ): void {
    onSuccess({ duration: 0.5 } as AudioBuffer)
  }
}

function installHarness(): Harness {
  const contexts: FakeAudioContext[] = []
  const sources: FakeSource[] = []
  const fetchMock = vi.fn(() =>
    Promise.resolve({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    } as unknown as Response),
  )

  class BoundAudioContext extends FakeAudioContext {
    constructor() {
      super(contexts, sources)
    }
  }

  vi.stubGlobal('window', { AudioContext: BoundAudioContext })
  vi.stubGlobal('fetch', fetchMock)

  return { contexts, sources, fetchMock }
}

async function flush(): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0)
  })
}

// 音效暂时关闭：取消 describe.skip 即可在恢复音效后继续使用这些用例。
describe.skip('sound (音效暂时关闭)', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('stays silent until the user enables sound', async () => {
    const { contexts, fetchMock } = installHarness()
    const { isSoundEnabled, playSound } = await import('./sound')

    playSound('click')

    expect(isSoundEnabled()).toBe(false)
    expect(contexts).toHaveLength(0)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('preloads every sample once enabled and plays decoded buffers', async () => {
    const { contexts, sources, fetchMock } = installHarness()
    const { playSound, setSoundEnabled } = await import('./sound')

    setSoundEnabled(true)
    await flush()

    expect(contexts).toHaveLength(1)
    expect(fetchMock).toHaveBeenCalledTimes(5)

    playSound('success')

    expect(sources).toHaveLength(1)
    expect(sources[0]?.start).toHaveBeenCalledTimes(1)
    expect(sources[0]?.buffer).not.toBeNull()
  })

  it('does not fetch the same sample twice', async () => {
    const { fetchMock } = installHarness()
    const { playSound, setSoundEnabled } = await import('./sound')

    setSoundEnabled(true)
    await flush()

    playSound('stroke')
    playSound('stroke')
    await flush()

    expect(fetchMock).toHaveBeenCalledTimes(5)
  })

  it('falls back to silence when Web Audio is unavailable', async () => {
    vi.stubGlobal('window', {})
    const { playSound, setSoundEnabled } = await import('./sound')

    expect(() => {
      setSoundEnabled(true)
      playSound('click')
    }).not.toThrow()
  })
})
