export const BOARD_SIZE = 1024
export const PAPER_COLOR = '#FFFDF8'
export const MAX_HISTORY = 60

/** Alpha below this is treated as faint noise rather than visible ink. */
export const SKETCH_ALPHA_CUTOFF = 30

let workingCanvas: HTMLCanvasElement | null = null
let workingContext: CanvasRenderingContext2D | null = null
let sampleCanvas: HTMLCanvasElement | null = null
let sampleContext: CanvasRenderingContext2D | null = null

function getSketchContexts(): {
  working: HTMLCanvasElement
  context: CanvasRenderingContext2D
  small: HTMLCanvasElement
  smallContext: CanvasRenderingContext2D
} | null {
  if (!workingCanvas) {
    workingCanvas = document.createElement('canvas')
    workingCanvas.width = 112
    workingCanvas.height = 112
    workingContext = workingCanvas.getContext('2d')
  }
  if (!sampleCanvas) {
    sampleCanvas = document.createElement('canvas')
    sampleCanvas.width = 28
    sampleCanvas.height = 28
    sampleContext = sampleCanvas.getContext('2d', { willReadFrequently: true })
  }
  if (!workingContext || !sampleContext) return null

  workingContext.setTransform(1, 0, 0, 1, 0, 0)
  workingContext.globalCompositeOperation = 'source-over'
  workingContext.clearRect(0, 0, 112, 112)
  workingContext.lineCap = 'round'
  workingContext.lineJoin = 'round'
  sampleContext.clearRect(0, 0, 28, 28)
  sampleContext.imageSmoothingEnabled = true
  sampleContext.imageSmoothingQuality = 'high'

  return {
    working: workingCanvas,
    context: workingContext,
    small: sampleCanvas,
    smallContext: sampleContext,
  }
}

export type Tool = 'pen' | 'eraser'

export interface Point {
  x: number
  y: number
  pressure: number
}

export interface Stroke {
  tool: Tool
  color: string
  size: number
  points: Point[]
}

export const PALETTE = [
  { name: '墨黑', value: '#2E2A26' },
  { name: '砖红', value: '#E4572E' },
  { name: '珊瑚', value: '#F28C6B' },
  { name: '姜黄', value: '#F2B134' },
  { name: '鼠尾草', value: '#6F9E77' },
  { name: '雾蓝', value: '#4F8FB3' },
  { name: '梅子', value: '#8C6BB1' },
  { name: '木棕', value: '#8A5A44' },
] as const

export const BRUSHES = [
  { id: 'fine', label: '细线', size: 6 },
  { id: 'marker', label: '马克笔', size: 16 },
  { id: 'brush', label: '水彩刷', size: 30 },
] as const

export type BrushId = (typeof BRUSHES)[number]['id']

export function brushSize(id: BrushId): number {
  return BRUSHES.find((brush) => brush.id === id)?.size ?? 16
}

function normalizedPressure(pressure: number): number {
  if (!Number.isFinite(pressure) || pressure <= 0.05) return 0.5
  return Math.min(1, Math.max(0.1, pressure))
}

function widthFor(stroke: Stroke, pressure: number): number {
  const base = stroke.tool === 'eraser' ? stroke.size * 2.4 : stroke.size
  return Math.max(1.5, base * (0.72 + normalizedPressure(pressure) * 0.56))
}

function paintDot(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  color: string,
): void {
  context.beginPath()
  context.arc(x, y, Math.max(width / 2, 1), 0, Math.PI * 2)
  context.fillStyle = color
  context.fill()
}

export function renderStrokes(
  context: CanvasRenderingContext2D,
  strokes: Stroke[],
  scale: number,
  offsetX = 0,
  offsetY = 0,
): void {
  context.save()
  context.lineCap = 'round'
  context.lineJoin = 'round'

  for (const stroke of strokes) {
    if (stroke.points.length === 0) continue
    context.globalCompositeOperation =
      stroke.tool === 'eraser' ? 'destination-out' : 'source-over'
    context.strokeStyle = stroke.color
    context.fillStyle = stroke.color

    if (stroke.points.length === 1) {
      const point = stroke.points[0]
      paintDot(
        context,
        point.x * scale + offsetX,
        point.y * scale + offsetY,
        widthFor(stroke, point.pressure),
        stroke.color,
      )
      continue
    }

    for (let index = 1; index < stroke.points.length; index += 1) {
      const from = stroke.points[index - 1]
      const to = stroke.points[index]
      context.beginPath()
      context.lineWidth = widthFor(stroke, to.pressure)
      context.moveTo(from.x * scale + offsetX, from.y * scale + offsetY)
      context.lineTo(to.x * scale + offsetX, to.y * scale + offsetY)
      context.stroke()
    }
  }

  context.restore()
}

export function drawLiveSegment(
  context: CanvasRenderingContext2D,
  stroke: Stroke,
  from: Point,
  to: Point,
  scale: number,
): void {
  context.save()
  context.lineCap = 'round'
  context.lineJoin = 'round'
  context.globalCompositeOperation =
    stroke.tool === 'eraser' ? 'destination-out' : 'source-over'
  context.strokeStyle = stroke.color
  context.lineWidth = widthFor(stroke, to.pressure)
  context.beginPath()
  context.moveTo(from.x * scale, from.y * scale)
  context.lineTo(to.x * scale, to.y * scale)
  context.stroke()
  context.restore()
}

export interface InkBounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
  width: number
  height: number
}

export function getInkBounds(strokes: Stroke[]): InkBounds | null {
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  let points = 0

  for (const stroke of strokes) {
    for (const point of stroke.points) {
      minX = Math.min(minX, point.x)
      minY = Math.min(minY, point.y)
      maxX = Math.max(maxX, point.x)
      maxY = Math.max(maxY, point.y)
      points += 1
    }
  }

  if (points === 0 || !Number.isFinite(minX)) return null

  const rawWidth = Math.max(maxX - minX, 1)
  const rawHeight = Math.max(maxY - minY, 1)
  const padding = Math.max(6, Math.max(rawWidth, rawHeight) * 0.035)
  minX -= padding
  minY -= padding
  maxX += padding
  maxY += padding

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  }
}

/**
 * Replays the vector strokes into a 28x28 grayscale sketch, matching the
 * normalized QuickDraw bitmap style: centered, aspect preserved, bold strokes.
 */
export function strokesToSketch(strokes: Stroke[]): Float32Array | null {
  const bounds = getInkBounds(strokes)
  if (!bounds) return null

  const workingSize = 112
  const inner = 96
  const scale = inner / Math.max(bounds.width, bounds.height)
  const offsetX = (workingSize - bounds.width * scale) / 2 - bounds.minX * scale
  const offsetY = (workingSize - bounds.height * scale) / 2 - bounds.minY * scale

  const scratch = getSketchContexts()
  if (!scratch) return null
  const { working, context, smallContext } = scratch

  for (const stroke of strokes) {
    if (stroke.points.length === 0) continue
    const isEraser = stroke.tool === 'eraser'
    context.globalCompositeOperation = isEraser ? 'destination-out' : 'source-over'
    context.strokeStyle = '#000000'
    context.fillStyle = '#000000'
    context.lineWidth = isEraser ? 20 : 7

    if (stroke.points.length === 1) {
      const point = stroke.points[0]
      paintDot(
        context,
        point.x * scale + offsetX,
        point.y * scale + offsetY,
        isEraser ? 20 : 7,
        '#000000',
      )
      continue
    }

    for (let index = 1; index < stroke.points.length; index += 1) {
      const from = stroke.points[index - 1]
      const to = stroke.points[index]
      context.beginPath()
      context.moveTo(from.x * scale + offsetX, from.y * scale + offsetY)
      context.lineTo(to.x * scale + offsetX, to.y * scale + offsetY)
      context.stroke()
    }
  }

  smallContext.drawImage(working, 0, 0, 28, 28)

  const pixels = smallContext.getImageData(0, 0, 28, 28).data
  const sketch = new Float32Array(28 * 28)
  let strongest = 0
  for (let index = 0; index < sketch.length; index += 1) {
    const alpha = pixels[index * 4 + 3]
    sketch[index] = alpha
    if (alpha > strongest) strongest = alpha
  }

  if (strongest < SKETCH_ALPHA_CUTOFF) return null
  return sketch
}

export function sketchInkRatio(sketch: Float32Array | null): number {
  if (!sketch) return 0
  let inked = 0
  for (const value of sketch) {
    if (value >= SKETCH_ALPHA_CUTOFF) inked += 1
  }
  return inked / sketch.length
}

export function renderArtwork(
  strokes: Stroke[],
  size: number,
): HTMLCanvasElement {
  const ink = document.createElement('canvas')
  ink.width = size
  ink.height = size
  const inkContext = ink.getContext('2d')
  if (inkContext) {
    const bounds = getInkBounds(strokes)
    if (bounds) {
      const margin = size * 0.1
      const available = size - margin * 2
      const scale = Math.min(
        available / bounds.width,
        available / bounds.height,
      )
      const offsetX = size / 2 - (bounds.minX + bounds.width / 2) * scale
      const offsetY = size / 2 - (bounds.minY + bounds.height / 2) * scale
      renderStrokes(inkContext, strokes, scale, offsetX, offsetY)
    } else {
      renderStrokes(inkContext, strokes, size / BOARD_SIZE)
    }
  }

  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')
  if (context) {
    context.fillStyle = PAPER_COLOR
    context.fillRect(0, 0, size, size)
    context.drawImage(ink, 0, 0)
  }
  return canvas
}

export function strokesToImage(strokes: Stroke[], size = 720): string {
  return renderArtwork(strokes, size).toDataURL('image/webp', 0.85)
}
