import { useCallback, useEffect, useRef, useState } from 'react'
import { BrushToolbar } from '../components/BrushToolbar'
import { CanvasBoard, type CanvasBoardHandle, type CanvasState } from '../components/CanvasBoard'
import { CategoryPicker } from '../components/CategoryPicker'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { GuessPanel, type GuessPhase, type GuessResult, type ModelState } from '../components/GuessPanel'
import { Icon } from '../components/Icon'
import { ResultOverlay } from '../components/ResultOverlay'
import { ThemeToggle } from '../components/ThemeToggle'
import { Toast } from '../components/Toast'
import { WordCard } from '../components/WordCard'
import { findCategory, type Category } from '../lib/categories'
import { hasOpenDialog } from '../lib/dialogStack'
import { loadClassifier } from '../lib/classifier'
import type { Theme } from '../lib/theme'
import {
  BRUSHES,
  PALETTE,
  brushSize,
  sketchInkRatio,
  type BrushId,
  type Tool,
} from '../lib/drawing'
import { measureAsync, measureSync } from '../lib/perf'
import { SHARE_MESSAGES, createShareCard, shareImage } from '../lib/share'
import { playSound } from '../lib/sound'
import { recordGuess } from '../lib/stats'
import { makeArtworkId, saveArtwork } from '../lib/storage'
import type { Artwork, GameMode, GuessRecord, Stats } from '../lib/types'
import { useToast } from '../hooks/useToast'

const ROUND_SECONDS = 90
// Share of 28×28 cells with visible ink required before asking the model.
const MIN_INK_RATIO = 0.015

type PendingAction = 'clear' | 'shuffle' | 'home' | 'gallery' | null

interface PersistOptions {
  target?: Category
  mode?: GameMode
  origin?: 'play' | 'free'
  message?: string
}

interface DrawScreenProps {
  mode: GameMode
  category: Category | null
  soundOn: boolean
  theme: Theme
  onToggleSound: () => void
  onToggleTheme: () => void
  onStatsChange: (stats: Stats) => void
  onHome: () => void
  onGallery: () => void
  onRestart: () => void
  onSaved: () => void
}

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export function DrawScreen({
  mode,
  category,
  soundOn,
  theme,
  onToggleSound,
  onToggleTheme,
  onStatsChange,
  onHome,
  onGallery,
  onRestart,
  onSaved,
}: DrawScreenProps) {
  const canvasRef = useRef<CanvasBoardHandle | null>(null)
  const guessPanelRef = useRef<HTMLElement | null>(null)
  const [startedAt] = useState(() => Date.now())
  const deadlineRef = useRef(startedAt + ROUND_SECONDS * 1000)
  const savedRef = useRef(false)
  const savingRef = useRef(false)
  const busyRef = useRef(false)
  const autoGuessRef = useRef(false)
  const handleGuessRef = useRef<(auto?: boolean) => Promise<void>>(
    async () => undefined,
  )
  const phaseRef = useRef<GuessPhase>('idle')
  const modelStateRef = useRef<ModelState>('loading')
  const lastStrokeCountRef = useRef(0)
  const sharingRef = useRef(false)

  const [tool, setTool] = useState<Tool>('pen')
  const [color, setColor] = useState<string>(PALETTE[0].value)
  const [sizeId, setSizeId] = useState<BrushId>('marker')
  const [canvasState, setCanvasState] = useState<CanvasState>({
    canUndo: false,
    canRedo: false,
    inkRatio: 0,
    strokeCount: 0,
    penStrokeCount: 0,
  })
  const [phase, setPhase] = useState<GuessPhase>('idle')
  const [guesses, setGuesses] = useState<GuessRecord[]>([])
  const [result, setResult] = useState<GuessResult>(null)
  const [modelState, setModelState] = useState<ModelState>('loading')
  const [saved, setSaved] = useState(false)
  const [successOpen, setSuccessOpen] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [secondsLeft, setSecondsLeft] = useState(ROUND_SECONDS)
  const [pendingAction, setPendingAction] = useState<PendingAction>(null)
  const [successGuess, setSuccessGuess] = useState<GuessRecord | null>(null)
  const [panelInView, setPanelInView] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const { toast, showToast } = useToast()

  const canGuess =
    canvasState.inkRatio >= MIN_INK_RATIO && modelState === 'ready'

  useEffect(() => {
    let alive = true
    loadClassifier()
      .then(() => {
        if (alive) setModelState('ready')
      })
      .catch(() => {
        if (alive) setModelState('error')
      })
    return () => {
      alive = false
    }
  }, [])

  const retryModel = useCallback(() => {
    setModelState('loading')
    loadClassifier()
      .then(() => setModelState('ready'))
      .catch(() => setModelState('error'))
  }, [])

  const handleCanvasState = useCallback((next: CanvasState) => {
    if (next.strokeCount !== lastStrokeCountRef.current) {
      lastStrokeCountRef.current = next.strokeCount
      if (savedRef.current) {
        savedRef.current = false
        setSaved(false)
      }
    }
    setCanvasState(next)
  }, [])

  const persist = useCallback(
    async (
      topGuesses: GuessRecord[],
      success: boolean,
      options: PersistOptions = {},
    ) => {
      if (savedRef.current) return true
      if (savingRef.current) return false
      const canvas = canvasRef.current
      if (!canvas) return false
      savingRef.current = true
      const target = options.target ?? category
      const artwork: Artwork = {
        id: makeArtworkId(),
        createdAt: Date.now(),
        image: canvas.exportImage(720),
        targetId: target?.id ?? null,
        targetZh: target?.zh ?? '自由画',
        targetEmoji: target?.emoji ?? '✏️',
        mode: options.mode ?? mode,
        guesses: topGuesses,
        success,
        durationMs:
          mode === 'challenge'
            ? Math.min(Date.now() - startedAt, ROUND_SECONDS * 1000)
            : Date.now() - startedAt,
        origin: options.origin ?? (mode === 'challenge' ? 'play' : 'free'),
      }
      try {
        const result = await measureAsync('storage.saveArtwork', () =>
          saveArtwork(artwork),
        )
        if (!result.ok) {
          savedRef.current = false
          setSaved(false)
          showToast('没存进去，可能是浏览器存储已满')
          return false
        }
        savedRef.current = true
        setSaved(true)
        onSaved()
        const message = options.message ?? '已收进画廊'
        showToast(
          result.trimmed > 0
            ? `${message}，已清理最旧的 ${result.trimmed} 幅`
            : message,
        )
        return true
      } finally {
        savingRef.current = false
      }
    },
    [category, mode, onSaved, showToast, startedAt],
  )

  const saveAsChallenge = useCallback(
    (picked: Category) => {
      setPickerOpen(false)
      void persist(guesses, false, {
        target: picked,
        mode: 'challenge',
        origin: 'free',
        message: '已作为挑战收进画廊',
      })
    },
    [guesses, persist],
  )

  const shareResultCard = useCallback(async () => {
    if (sharingRef.current || !category) return
    const image = canvasRef.current?.exportImage(1080)
    if (!image) {
      showToast('还没有可以分享的画作')
      return
    }

    sharingRef.current = true
    showToast('正在生成分享图…')
    try {
      const blob = await createShareCard({
        image,
        emoji: category.emoji,
        title: category.zh,
        confidence: successGuess?.confidence ?? null,
        seconds: elapsedSeconds,
        status: 'success',
      })
      if (!blob) {
        showToast('分享图生成失败，请再试一次')
        return
      }

      const outcome = await shareImage(blob, `doodle-${category.id}.png`)
      showToast(SHARE_MESSAGES[outcome])
    } catch {
      showToast('分享图生成失败，请再试一次')
    } finally {
      sharingRef.current = false
    }
  }, [category, elapsedSeconds, showToast, successGuess])

  const handleGuess = useCallback(
    async (auto = false) => {
      if (busyRef.current) return
      const canvas = canvasRef.current
      if (!canvas) return
      const sketch = measureSync('drawing.toSketch', () => canvas.toSketch())
      if (!sketch || sketchInkRatio(sketch) < MIN_INK_RATIO) {
        showToast('再多画几笔吧')
        return
      }
      if (modelState !== 'ready') {
        showToast(modelState === 'loading' ? 'AI 还在热身，稍等一下' : '识别模型没加载出来')
        return
      }

      busyRef.current = true
      setPhase('thinking')
      setResult(null)
      setGuesses([])
      const thinkingStarted = performance.now()

      try {
        const classifier = await loadClassifier()
        const predictions = measureSync('classifier.predict', () =>
          classifier.predict(sketch),
        )
        const wait = Math.max(0, 820 - (performance.now() - thinkingStarted))
        if (wait > 0) {
          await new Promise((resolve) => window.setTimeout(resolve, wait))
        }

        const top: GuessRecord[] = predictions.slice(0, 3).map((prediction) => {
          const matched = findCategory(prediction.id)
          return {
            id: prediction.id,
            zh: matched?.zh ?? prediction.id,
            emoji: matched?.emoji ?? '❓',
            confidence: prediction.confidence,
          }
        })

        setGuesses(top)
        setPhase('done')

        const isTop = Boolean(category && top[0]?.id === category.id)
        const isNear = Boolean(category && top.some((guess) => guess.id === category.id))

        if (mode === 'free') {
          setResult(null)
          playSound('click')
        } else {
          const stats = recordGuess(isTop)
          onStatsChange(stats)
          if (isTop) {
            setResult('success')
            setSuccessGuess(top[0])
            setElapsedSeconds(
              Math.min((Date.now() - startedAt) / 1000, ROUND_SECONDS),
            )
            setSuccessOpen(true)
            playSound('success')
            void persist(top, true)
          } else {
            setResult(isNear ? 'near' : 'miss')
            playSound('fail')
            if (auto) showToast('时间到！这是 AI 的答案')
          }
        }
      } catch {
        setPhase('error')
        setModelState('error')
      } finally {
        busyRef.current = false
      }
    },
    [category, mode, modelState, onStatsChange, persist, showToast, startedAt],
  )

  useEffect(() => {
    phaseRef.current = phase
  }, [phase])

  useEffect(() => {
    modelStateRef.current = modelState
  }, [modelState])

  useEffect(() => {
    handleGuessRef.current = handleGuess
  }, [handleGuess])

  useEffect(() => {
    if (mode !== 'challenge' || successOpen) return
    // The absolute deadline keeps the countdown honest even when the tab is
    // throttled or the interval is delayed.
    const tick = () => {
      const remaining = Math.max(
        0,
        Math.ceil((deadlineRef.current - Date.now()) / 1000),
      )
      setSecondsLeft(remaining)
      if (
        remaining === 0 &&
        !autoGuessRef.current &&
        modelStateRef.current === 'ready' &&
        phaseRef.current !== 'thinking' &&
        phaseRef.current !== 'done'
      ) {
        autoGuessRef.current = true
        void handleGuessRef.current(true)
      }
    }
    tick()
    const timer = window.setInterval(tick, 250)
    const onVisibility = () => tick()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [mode, successOpen])

  useEffect(() => {
    if (phase !== 'thinking' && phase !== 'done') return
    if (typeof window === 'undefined' || window.innerWidth > 1080) return
    const timer = window.setTimeout(() => {
      guessPanelRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    }, 140)
    return () => window.clearTimeout(timer)
  }, [phase])

  useEffect(() => {
    const panel = guessPanelRef.current
    if (!panel || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      ([entry]) => setPanelInView(entry.isIntersecting),
      { threshold: 0.35 },
    )
    observer.observe(panel)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return
      }
      if (hasOpenDialog() || successOpen || pendingAction !== null) return

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) canvasRef.current?.redo()
        else canvasRef.current?.undo()
        return
      }

      // Let native buttons/links handle Enter and their own keys.
      if (target?.closest('button, a, select, [role="button"]')) return

      if (event.key === 'e' || event.key === 'E') {
        setTool('eraser')
        return
      }
      if (event.key === 'b' || event.key === 'B') {
        setTool('pen')
        return
      }
      if (event.key === 'Enter') {
        event.preventDefault()
        void handleGuess()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleGuess, pendingAction, successOpen])

  const requestHome = () => {
    if (canvasState.inkRatio > MIN_INK_RATIO && !savedRef.current) {
      setPendingAction('home')
    } else {
      onHome()
    }
  }

  const requestGallery = () => {
    if (canvasState.inkRatio > MIN_INK_RATIO && !savedRef.current) {
      setPendingAction('gallery')
    } else {
      onGallery()
    }
  }

  const requestShuffle = () => {
    if (canvasState.inkRatio > MIN_INK_RATIO && !savedRef.current) {
      setPendingAction('shuffle')
    } else {
      onRestart()
    }
  }

  const handleClear = () => {
    if (!canvasState.canUndo) return
    setPendingAction('clear')
  }

  const confirmPending = () => {
    const action = pendingAction
    setPendingAction(null)
    if (action === 'clear') {
      canvasRef.current?.clear()
      setPhase('idle')
      setGuesses([])
      setResult(null)
      showToast('画布已清空')
      playSound('undo')
    } else if (action === 'shuffle') {
      onRestart()
    } else if (action === 'gallery') {
      onGallery()
    } else if (action === 'home') {
      onHome()
    }
  }

  const urgent = mode === 'challenge' && secondsLeft <= 15 && secondsLeft > 0
  const confirmCopy: Record<Exclude<PendingAction, null>, { title: string; description: string }> = {
    clear: {
      title: '清空画布？',
      description: '画布会被清空，所有笔迹都将丢失。',
    },
    shuffle: {
      title: '换一张词卡？',
      description: '当前画作还没收进画廊，换题会把它清空。',
    },
    home: {
      title: '离开画板？',
      description: '当前画作还没收进画廊，离开后就不见了。',
    },
    gallery: {
      title: '先去画廊？',
      description: '当前画作还没保存，离开画板会把它清空。',
    },
  }

  return (
    <main className="draw-screen">
      <header className="draw-top">
        <div className="draw-top__left">
          <button
            type="button"
            className="icon-button"
            aria-label="返回首页"
            onClick={requestHome}
          >
            <Icon name="arrow-left" size={22} />
          </button>
          <span className="draw-top__title">画板</span>
        </div>

        <WordCard category={category} mode={mode} onChangeWord={requestShuffle} />

        <div className="draw-top__right">
          {mode === 'challenge' ? (
            <span className={`timer${urgent ? ' is-urgent' : ''}`} role="timer">
              <Icon name="timer" size={18} />
              {secondsLeft === 0 ? '时间到' : formatTime(secondsLeft)}
            </span>
          ) : (
            <span className="free-badge">
              <Icon name="magic" size={16} /> 自由画
            </span>
          )}
          <button
            type="button"
            className="icon-button draw-top__sound"
            aria-label={soundOn ? '关闭音效' : '开启音效'}
            title={soundOn ? '关闭音效' : '开启音效'}
            onClick={onToggleSound}
          >
            <Icon name={soundOn ? 'sound-on' : 'sound-off'} size={20} />
          </button>
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
          <button
            type="button"
            className="btn btn--paper btn--small draw-top__gallery"
            onClick={requestGallery}
          >
            <Icon name="gallery" size={18} />
            <span>画廊</span>
          </button>
        </div>
      </header>

      <div className="draw-body">
        <section className="canvas-column" aria-label="作画区">
          <div className={`paper${tool === 'eraser' ? ' is-erasing' : ''}`}>
            <span className="paper__tape paper__tape--left" aria-hidden="true" />
            <span className="paper__tape paper__tape--right" aria-hidden="true" />
            <CanvasBoard
              ref={canvasRef}
              tool={tool}
              color={color}
              size={brushSize(sizeId)}
              onStateChange={handleCanvasState}
              onStrokeStart={() => playSound('stroke')}
            />
            <span className="paper__hint" aria-hidden="true">
              {canvasState.penStrokeCount === 0
                ? '从这里开始画'
                : mode === 'challenge'
                  ? '画得像不像，都没关系'
                  : '想画什么就画什么'}
            </span>
          </div>

          <BrushToolbar
            color={color}
            sizeId={sizeId}
            tool={tool}
            canUndo={canvasState.canUndo}
            canRedo={canvasState.canRedo}
            hasInk={canvasState.inkRatio > MIN_INK_RATIO}
            onColorChange={setColor}
            onSizeChange={setSizeId}
            onToolChange={setTool}
            onUndo={() => {
              canvasRef.current?.undo()
              playSound('undo')
            }}
            onRedo={() => {
              canvasRef.current?.redo()
              playSound('undo')
            }}
            onClear={handleClear}
          />
        </section>

        <GuessPanel
          panelRef={guessPanelRef}
          phase={phase}
          guesses={guesses}
          target={category}
          result={result}
          canGuess={canGuess}
          modelState={modelState}
          saved={saved}
          penStrokeCount={canvasState.penStrokeCount}
          showDirectSave={mode === 'free'}
          onGuess={() => void handleGuess()}
          onRetryModel={retryModel}
          onSave={() => void persist(guesses, false)}
          onSaveAsChallenge={
            mode === 'free' ? () => setPickerOpen(true) : undefined
          }
          onContinue={() => {
            setPhase('idle')
            setGuesses([])
            setResult(null)
          }}
        />
      </div>

      {!successOpen && !panelInView && phase !== 'thinking' && phase !== 'done' ? (
        <div className="mobile-guess-bar">
          <button
            type="button"
            className="btn btn--guess"
            onClick={() => void handleGuess()}
            disabled={!canGuess || modelState !== 'ready'}
          >
            <Icon name="sparkle" size={20} />
            让 AI 猜猜
          </button>
        </div>
      ) : null}

      <ResultOverlay
        open={successOpen}
        category={category}
        guess={successGuess}
        seconds={elapsedSeconds}
        saved={saved}
        onAgain={onRestart}
        onGallery={onGallery}
        onShare={() => void shareResultCard()}
        onSave={() => void persist(guesses, true)}
        onClose={() => setSuccessOpen(false)}
      />

      <ConfirmDialog
        open={pendingAction !== null}
        title={pendingAction ? confirmCopy[pendingAction].title : ''}
        description={pendingAction ? confirmCopy[pendingAction].description : ''}
        confirmLabel={pendingAction === 'clear' ? '清空' : '确定'}
        cancelLabel="再想想"
        danger={pendingAction !== 'shuffle'}
        onConfirm={confirmPending}
        onCancel={() => setPendingAction(null)}
      />

      <CategoryPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={saveAsChallenge}
      />

      <Toast message={toast} />

      <span className="draw-corner-note" aria-hidden="true">
        {BRUSHES.find((brush) => brush.id === sizeId)?.label ?? '马克笔'} ·{' '}
        {tool === 'eraser' ? '橡皮' : '画笔'}
      </span>
    </main>
  )
}
