import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import {
  BOARD_SIZE,
  drawLiveSegment,
  sketchInkRatio,
  renderStrokes,
  strokesToImage,
  strokesToSketch,
  type Point,
  type Stroke,
  type Tool,
} from '../lib/drawing'

export interface CanvasState {
  canUndo: boolean
  canRedo: boolean
  inkRatio: number
  strokeCount: number
}

export interface CanvasBoardHandle {
  undo: () => void
  redo: () => void
  clear: () => void
  exportImage: (size?: number) => string
  toSketch: () => Float32Array | null
  getInkRatio: () => number
}

interface CanvasBoardProps {
  tool: Tool
  color: string
  size: number
  onStateChange: (state: CanvasState) => void
  onStrokeStart?: () => void
  onStrokeEnd?: () => void
  disabled?: boolean
}

export const CanvasBoard = forwardRef<CanvasBoardHandle, CanvasBoardProps>(
  function CanvasBoard(
    {
      tool,
      color,
      size,
      onStateChange,
      onStrokeStart,
      onStrokeEnd,
      disabled = false,
    },
    ref,
  ) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null)
    const strokesRef = useRef<Stroke[]>([])
    const redoRef = useRef<Stroke[]>([])
    const currentStrokeRef = useRef<Stroke | null>(null)
    const drawingRef = useRef(false)
    const scaleRef = useRef(1)
    const stateCallbackRef = useRef(onStateChange)
    const strokeStartRef = useRef(onStrokeStart)
    const strokeEndRef = useRef(onStrokeEnd)

    useEffect(() => {
      stateCallbackRef.current = onStateChange
    }, [onStateChange])

    useEffect(() => {
      strokeStartRef.current = onStrokeStart
      strokeEndRef.current = onStrokeEnd
    }, [onStrokeStart, onStrokeEnd])

    const redraw = useCallback(() => {
      const canvas = canvasRef.current
      if (!canvas) return
      const context = canvas.getContext('2d')
      if (!context) return
      context.setTransform(1, 0, 0, 1, 0, 0)
      context.clearRect(0, 0, canvas.width, canvas.height)
      renderStrokes(context, strokesRef.current, canvas.width / BOARD_SIZE)
    }, [])

    const syncState = useCallback(() => {
      const sketch = strokesToSketch(strokesRef.current)
      stateCallbackRef.current({
        canUndo: strokesRef.current.length > 0,
        canRedo: redoRef.current.length > 0,
        inkRatio: sketchInkRatio(sketch),
        strokeCount: strokesRef.current.length,
      })
    }, [])

    useEffect(() => {
      const canvas = canvasRef.current
      if (!canvas) return
      const container = canvas.parentElement
      if (!container) return

      const resize = () => {
        const rect = container.getBoundingClientRect()
        const cssSize = Math.max(1, Math.round(rect.width))
        const ratio = Math.min(window.devicePixelRatio || 1, 2.5)
        canvas.width = Math.round(cssSize * ratio)
        canvas.height = Math.round(cssSize * ratio)
        scaleRef.current = canvas.width / BOARD_SIZE
        redraw()
      }

      resize()
      const observer = new ResizeObserver(resize)
      observer.observe(container)
      return () => observer.disconnect()
    }, [redraw])

    const pointFromEvent = useCallback((event: PointerEvent): Point => {
      const canvas = canvasRef.current
      if (!canvas) return { x: 0, y: 0, pressure: 0.5 }
      const rect = canvas.getBoundingClientRect()
      const x = ((event.clientX - rect.left) / Math.max(rect.width, 1)) * BOARD_SIZE
      const y = ((event.clientY - rect.top) / Math.max(rect.height, 1)) * BOARD_SIZE
      const pressure =
        event.pointerType === 'mouse'
          ? 0.5
          : event.pressure > 0.05
            ? event.pressure
            : 0.55
      return {
        x: Math.max(0, Math.min(BOARD_SIZE, x)),
        y: Math.max(0, Math.min(BOARD_SIZE, y)),
        pressure,
      }
    }, [])

    const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
      if (disabled) return
      if (event.pointerType === 'mouse' && event.button !== 0) return
      event.preventDefault()
      const canvas = canvasRef.current
      if (!canvas) return
      const stroke: Stroke = {
        tool,
        color,
        size,
        points: [pointFromEvent(event.nativeEvent)],
      }
      currentStrokeRef.current = stroke
      drawingRef.current = true
      canvas.setPointerCapture(event.pointerId)
      const context = canvas.getContext('2d')
      if (context) {
        drawLiveSegment(
          context,
          stroke,
          stroke.points[0],
          stroke.points[0],
          scaleRef.current,
        )
      }
      strokeStartRef.current?.()
    }

    const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
      if (!drawingRef.current) return
      const stroke = currentStrokeRef.current
      const canvas = canvasRef.current
      if (!stroke || !canvas) return
      const context = canvas.getContext('2d')
      if (!context) return
      const native = event.nativeEvent
      const events =
        typeof native.getCoalescedEvents === 'function'
          ? native.getCoalescedEvents()
          : [native]
      for (const sample of events) {
        const point = pointFromEvent(sample)
        const previous = stroke.points[stroke.points.length - 1]
        if (!previous) continue
        if (Math.hypot(point.x - previous.x, point.y - previous.y) < 0.6) {
          continue
        }
        stroke.points.push(point)
        drawLiveSegment(context, stroke, previous, point, scaleRef.current)
      }
    }

    const finishStroke = (event: ReactPointerEvent<HTMLCanvasElement>) => {
      if (!drawingRef.current) return
      drawingRef.current = false
      const stroke = currentStrokeRef.current
      currentStrokeRef.current = null
      const canvas = canvasRef.current
      if (canvas?.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId)
      }
      if (stroke && stroke.points.length > 0) {
        strokesRef.current = [...strokesRef.current, stroke]
        redoRef.current = []
      }
      redraw()
      syncState()
      strokeEndRef.current?.()
    }

    const undo = useCallback(() => {
      if (drawingRef.current || strokesRef.current.length === 0) return
      const strokes = strokesRef.current
      const last = strokes[strokes.length - 1]
      strokesRef.current = strokes.slice(0, -1)
      redoRef.current = [...redoRef.current, last]
      redraw()
      syncState()
    }, [redraw, syncState])

    const redo = useCallback(() => {
      if (drawingRef.current || redoRef.current.length === 0) return
      const redoStack = redoRef.current
      const restored = redoStack[redoStack.length - 1]
      redoRef.current = redoStack.slice(0, -1)
      strokesRef.current = [...strokesRef.current, restored]
      redraw()
      syncState()
    }, [redraw, syncState])

    const clear = useCallback(() => {
      if (drawingRef.current) return
      strokesRef.current = []
      redoRef.current = []
      redraw()
      syncState()
    }, [redraw, syncState])

    const exportImage = useCallback(
      (imageSize = 720) => strokesToImage(strokesRef.current, imageSize),
      [],
    )

    const toSketch = useCallback(
      () => strokesToSketch(strokesRef.current),
      [],
    )

    const getInkRatio = useCallback(
      () => sketchInkRatio(strokesToSketch(strokesRef.current)),
      [],
    )

    useImperativeHandle(
      ref,
      () => ({ undo, redo, clear, exportImage, toSketch, getInkRatio }),
      [undo, redo, clear, exportImage, toSketch, getInkRatio],
    )

    return (
      <canvas
        ref={canvasRef}
        className={`canvas-board__surface canvas-board__surface--${tool}${
          disabled ? ' is-disabled' : ''
        }`}
        aria-label="画板，用鼠标或手指作画"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishStroke}
        onPointerCancel={finishStroke}
        onPointerLeave={(event) => {
          if (drawingRef.current) finishStroke(event)
        }}
        onContextMenu={(event) => event.preventDefault()}
      />
    )
  },
)
