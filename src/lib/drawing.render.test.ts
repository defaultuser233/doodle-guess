import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  drawLiveSegment,
  getVisibleInkBounds,
  renderArtwork,
  renderStrokes,
  strokesToImage,
  strokesToSketch,
  type Stroke,
} from './drawing'

interface FakeCanvas {
  width: number
  height: number
  getContext: (type?: string, options?: unknown) => unknown
  toDataURL: (type?: string, quality?: number) => string
}

function makeCanvas(): FakeCanvas {
  const canvas: FakeCanvas = {
    width: 0,
    height: 0,
    getContext: () => null,
    toDataURL: () => 'data:image/webp;base64,AAAA',
  }
  canvas.getContext = vi.fn(() => {
    const size = Math.max(1, canvas.width * canvas.height)
    return {
      save: vi.fn(),
      restore: vi.fn(),
      clearRect: vi.fn(),
      setTransform: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      quadraticCurveTo: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      fillRect: vi.fn(),
      drawImage: vi.fn(),
      getImageData: vi.fn(() => ({
        data: new Uint8ClampedArray(size * 4).fill(255),
      })),
      globalCompositeOperation: 'source-over',
      strokeStyle: '',
      fillStyle: '',
      lineWidth: 1,
      lineCap: '',
      lineJoin: '',
    }
  }) as unknown as FakeCanvas['getContext']
  return canvas
}

const stroke: Stroke = {
  tool: 'pen',
  color: '#2E2A26',
  size: 16,
  points: [
    { x: 100, y: 100, pressure: 0.5 },
    { x: 200, y: 140, pressure: 0.5 },
    { x: 300, y: 100, pressure: 0.5 },
    { x: 400, y: 160, pressure: 0.5 },
    { x: 500, y: 120, pressure: 0.5 },
  ],
}

describe('drawing rendering', () => {
  beforeEach(() => {
    vi.stubGlobal('document', {
      createElement: vi.fn(() => makeCanvas()),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders smooth multi-point strokes and straight two-point strokes', () => {
    const context = makeCanvas().getContext() as unknown as CanvasRenderingContext2D
    expect(() => renderStrokes(context, [stroke], 1)).not.toThrow()
    expect(context.quadraticCurveTo).toHaveBeenCalled()
    expect(context.stroke).toHaveBeenCalled()

    const twoPoints: Stroke = {
      ...stroke,
      points: stroke.points.slice(0, 2),
    }
    expect(() => renderStrokes(context, [twoPoints], 1)).not.toThrow()
    expect(() => renderStrokes(context, [stroke], 1, 10, 20)).not.toThrow()
  })

  it('renders live segments and dots without throwing', () => {
    const context = makeCanvas().getContext() as unknown as CanvasRenderingContext2D
    const dot: Stroke = {
      ...stroke,
      tool: 'eraser',
      points: [stroke.points[0]],
    }
    expect(() =>
      drawLiveSegment(context, stroke, stroke.points[0], stroke.points[1], 1),
    ).not.toThrow()
    expect(() => renderStrokes(context, [dot], 1)).not.toThrow()
  })

  it('computes visible bounds, sketches, and exported artwork', () => {
    const bounds = getVisibleInkBounds([stroke])
    expect(bounds).not.toBeNull()
    expect(bounds!.width).toBeGreaterThan(0)

    const sketch = strokesToSketch([stroke])
    expect(sketch).toBeInstanceOf(Float32Array)
    expect(sketch).toHaveLength(784)

    expect(renderArtwork([stroke], 128)).toBeDefined()
    expect(strokesToImage([stroke], 128)).toMatch(/^data:image\//)
  })
})
