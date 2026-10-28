import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./categories', () => ({
  CATEGORIES: [{ id: 'cat' }, { id: 'dog' }],
}))

const INPUT = 784
const OUTPUT = 2
const WEIGHT_BYTES = INPUT * OUTPUT
const BIAS_OFFSET = WEIGHT_BYTES
const SCALE_OFFSET = BIAS_OFFSET + OUTPUT * 4
const BUFFER_BYTES = SCALE_OFFSET + OUTPUT * 4

const meta = {
  version: 1,
  input: INPUT,
  imageSize: 28,
  labels: ['cat', 'dog'],
  layers: [
    {
      in: INPUT,
      out: OUTPUT,
      activation: 'linear',
      qOffset: 0,
      qLength: WEIGHT_BYTES,
      biasOffset: BIAS_OFFSET,
      scaleOffset: SCALE_OFFSET,
    },
  ],
}

function makeWeights(): ArrayBuffer {
  const buffer = new ArrayBuffer(BUFFER_BYTES)
  const quantized = new Int8Array(buffer, 0, WEIGHT_BYTES)
  for (let index = 0; index < INPUT; index += 1) {
    quantized[index] = 10
  }
  const scales = new Float32Array(buffer, SCALE_OFFSET, OUTPUT)
  scales[0] = 0.001
  scales[1] = 0.001
  return buffer
}

function successResponse(payload = meta): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

function weightsResponse(): Response {
  return new Response(makeWeights(), { status: 200 })
}

describe('classifier', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('loads metadata/weights and returns ranked predictions', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      return url.endsWith('model.json') ? successResponse() : weightsResponse()
    })
    vi.stubGlobal('fetch', fetchMock)

    const { loadClassifier } = await import('./classifier')
    const classifier = await loadClassifier()
    const sketch = new Float32Array(INPUT).fill(255)
    const predictions = classifier.predict(sketch)

    expect(predictions).toHaveLength(2)
    expect(predictions[0].id).toBe('cat')
    expect(predictions[0].confidence).toBeGreaterThan(0.99)
    expect(predictions[0].confidence + predictions[1].confidence).toBeCloseTo(1)
  })

  it('rejects a sketch that is not 28x28', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) =>
        String(input).endsWith('model.json') ? successResponse() : weightsResponse(),
      ),
    )
    const { loadClassifier } = await import('./classifier')
    const classifier = await loadClassifier()
    expect(() => classifier.predict(new Float32Array(10))).toThrow(
      'sketch must be 28x28',
    )
  })

  it('rejects labels that do not match the current word cards', async () => {
    const mismatched = { ...meta, labels: ['cat', 'fish'] }
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) =>
        String(input).endsWith('model.json')
          ? successResponse(mismatched)
          : weightsResponse(),
      ),
    )
    const { loadClassifier } = await import('./classifier')
    await expect(loadClassifier()).rejects.toThrow('模型标签与词卡数据不一致')
  })

  it('resets the singleton promise after a failed load so retry works', async () => {
    const fetchMock = vi
      .fn<(input: RequestInfo | URL) => Promise<Response>>()
      .mockResolvedValue(new Response('offline', { status: 503 }))
    vi.stubGlobal('fetch', fetchMock)

    const { loadClassifier } = await import('./classifier')
    await expect(loadClassifier()).rejects.toThrow('model.json 503')
    expect(fetchMock).toHaveBeenCalledTimes(2)

    fetchMock.mockImplementation(async (input: RequestInfo | URL) =>
      String(input).endsWith('model.json') ? successResponse() : weightsResponse(),
    )
    const classifier = await loadClassifier()
    expect(classifier.labels).toEqual(['cat', 'dog'])
  })
})
