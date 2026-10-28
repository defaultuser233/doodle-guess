import { describe, expect, it } from 'vitest'
import {
  SKETCH_ALPHA_CUTOFF,
  brushSize,
  getInkBounds,
  sketchInkRatio,
  strokesToSketch,
  type Stroke,
} from './drawing'

function stroke(x: number, y: number): Stroke {
  return {
    tool: 'pen',
    color: '#2E2A26',
    size: 16,
    points: [{ x, y, pressure: 0.5 }],
  }
}

describe('drawing helpers', () => {
  it('returns null bounds for an empty canvas', () => {
    expect(getInkBounds([])).toBeNull()
  })

  it('pads a single point into a visible square', () => {
    const bounds = getInkBounds([stroke(100, 100)])
    expect(bounds).not.toBeNull()
    expect(bounds?.minX).toBe(94)
    expect(bounds?.maxX).toBe(106)
    expect(bounds?.width).toBe(12)
  })

  it('keeps the larger axis when computing padding', () => {
    const bounds = getInkBounds([
      {
        tool: 'pen',
        color: '#000000',
        size: 10,
        points: [
          { x: 10, y: 20, pressure: 0.5 },
          { x: 110, y: 220, pressure: 0.5 },
        ],
      },
    ])
    expect(bounds).not.toBeNull()
    expect(bounds?.minX).toBeCloseTo(3)
    expect(bounds?.minY).toBeCloseTo(13)
    expect(bounds?.maxX).toBeCloseTo(117)
    expect(bounds?.maxY).toBeCloseTo(227)
    expect(bounds?.width).toBeCloseTo(114)
    expect(bounds?.height).toBeCloseTo(214)
  })

  it('ignores eraser strokes when computing fallback bounds', () => {
    const eraser: Stroke = {
      tool: 'eraser',
      color: '#000000',
      size: 80,
      points: [{ x: 900, y: 900, pressure: 0.5 }],
    }
    const bounds = getInkBounds([stroke(100, 100), eraser])
    expect(bounds?.minX).toBe(94)
    expect(bounds?.maxX).toBe(106)
    expect(bounds?.minY).toBe(94)
    expect(bounds?.maxY).toBe(106)
  })

  it('computes ink ratio from the shared alpha cutoff', () => {
    const empty = new Float32Array(784)
    expect(sketchInkRatio(null)).toBe(0)
    expect(sketchInkRatio(empty)).toBe(0)

    for (let index = 0; index < 8; index += 1) {
      empty[index] = SKETCH_ALPHA_CUTOFF
    }
    expect(sketchInkRatio(empty)).toBeCloseTo(8 / 784)
  })

  it('returns null without ink and never touches a canvas', () => {
    expect(strokesToSketch([])).toBeNull()
  })

  it('exposes the documented brush sizes', () => {
    expect(brushSize('fine')).toBe(6)
    expect(brushSize('marker')).toBe(16)
    expect(brushSize('brush')).toBe(30)
  })
})
