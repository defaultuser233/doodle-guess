import { useRef } from 'react'
import type { Category } from '../lib/categories'
import { useDialogFocus } from '../hooks/useDialogFocus'
import type { GuessRecord } from '../lib/types'
import { DialogPortal } from './DialogPortal'
import { Icon } from './Icon'
import { Confetti } from './Confetti'

interface ResultOverlayProps {
  open: boolean
  category: Category | null
  guess: GuessRecord | null
  seconds: number
  saved: boolean
  onAgain: () => void
  onGallery: () => void
  onShare: () => void
  onSave: () => void
  onClose: () => void
}

export function ResultOverlay({
  open,
  category,
  guess,
  seconds,
  saved,
  onAgain,
  onGallery,
  onShare,
  onSave,
  onClose,
}: ResultOverlayProps) {
  const closeRef = useRef<HTMLButtonElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)

  useDialogFocus({
    open: open && category !== null,
    onClose,
    panelRef,
    initialFocusRef: closeRef,
  })

  if (!open || !category) return null

  return (
    <DialogPortal>
      <div
      className="result-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="result-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <Confetti active={open} />
      <div ref={panelRef} className="result-card" tabIndex={-1}>
        <button
          ref={closeRef}
          type="button"
          className="result-card__close"
          aria-label="关闭结果"
          onClick={onClose}
        >
          <Icon name="close" size={20} />
        </button>
        <span className="result-card__tape" aria-hidden="true" />
        <div className="result-card__stamp" aria-hidden="true">
          猜中啦<span>!</span>
        </div>
        <p className="result-card__eyebrow">小猜的答案</p>
        <div className="result-card__answer">
          <span className="result-card__emoji" aria-hidden="true">
            {category.emoji}
          </span>
          <h2 id="result-title">{category.zh}</h2>
          <small>{category.en}</small>
        </div>
        <p className="result-card__stats">
          {guess
            ? `把握 ${Math.round(guess.confidence * 100)}%`
            : '我猜对了'}{' '}
          · 用时 {Math.max(1, Math.round(seconds))} 秒
        </p>
        {saved ? (
          <p className="result-card__saved">
            <Icon name="check" size={16} /> 已自动收进画廊
          </p>
        ) : (
          <button
            type="button"
            className="btn btn--ghost btn--small result-card__save"
            onClick={onSave}
          >
            保存到画廊
          </button>
        )}
        <div className="result-card__actions">
          <button type="button" className="btn btn--primary" onClick={onAgain}>
            <Icon name="refresh" size={18} /> 再来一张
          </button>
          <button type="button" className="btn btn--paper" onClick={onShare}>
            <Icon name="share" size={18} /> 分享战绩
          </button>
          <button type="button" className="btn btn--paper" onClick={onGallery}>
            <Icon name="gallery" size={18} /> 去画廊
          </button>
        </div>
        <span className="result-card__doodle" aria-hidden="true">
          <Icon name="sparkle" size={34} />
        </span>
      </div>
    </div>
    </DialogPortal>
  )
}
