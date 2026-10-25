import { useEffect, useRef } from 'react'
import { Icon } from './Icon'
import type { Artwork } from '../lib/types'

interface ArtworkModalProps {
  artwork: Artwork | null
  onClose: () => void
  onDownload: (artwork: Artwork) => void
  onShare: (artwork: Artwork) => void
  onDelete: (artwork: Artwork) => void
}

const fullDateFormatter = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

export function ArtworkModal({
  artwork,
  onClose,
  onDownload,
  onShare,
  onDelete,
}: ArtworkModalProps) {
  const closeRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (!artwork) return
    closeRef.current?.focus()
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [artwork, onClose])

  if (!artwork) return null

  const originLabel =
    artwork.origin === 'free'
      ? artwork.mode === 'challenge'
        ? '自由画改题'
        : '自由画'
      : artwork.mode === 'challenge'
        ? '挑战作品'
        : '自由画'

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        className="artwork-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="artwork-title"
      >
        <button
          ref={closeRef}
          type="button"
          className="artwork-modal__close"
          aria-label="关闭"
          onClick={onClose}
        >
          <Icon name="close" size={20} />
        </button>
        <div className="artwork-modal__image">
          <img src={artwork.image} alt={`${artwork.targetZh}的画作`} />
        </div>
        <div className="artwork-modal__info">
          <p className="eyebrow">画廊藏品</p>
          <h2 id="artwork-title">
            {artwork.targetEmoji} {artwork.targetZh}
          </h2>
          <p className="artwork-modal__meta">
            {fullDateFormatter.format(artwork.createdAt)} · 用时{' '}
            {Math.max(1, Math.round(artwork.durationMs / 1000))} 秒 ·{' '}
            {originLabel}
          </p>

          {artwork.guesses.length > 0 ? (
            <ol className="artwork-modal__guesses">
              {artwork.guesses.map((guess, index) => (
                <li key={guess.id}>
                  <span>{index === 0 ? <Icon name="crown" size={15} /> : index + 1}</span>
                  <span className="artwork-modal__emoji">{guess.emoji}</span>
                  <strong>{guess.zh}</strong>
                  <small>{Math.round(guess.confidence * 100)}%</small>
                </li>
              ))}
            </ol>
          ) : (
            <p className="artwork-modal__empty">这幅还没让小猜看过。</p>
          )}

          <div className="artwork-modal__actions">
            <button
              type="button"
              className="btn btn--primary btn--small"
              onClick={() => onDownload(artwork)}
            >
              <Icon name="download" size={17} /> 保存为图片
            </button>
            <button
              type="button"
              className="btn btn--paper btn--small"
              onClick={() => onShare(artwork)}
            >
              <Icon name="share" size={17} /> 分享
            </button>
            <button
              type="button"
              className="btn btn--ghost btn--small btn--danger-text"
              onClick={() => onDelete(artwork)}
            >
              <Icon name="trash" size={16} /> 删除
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
