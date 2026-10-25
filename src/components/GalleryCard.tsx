import { memo, type CSSProperties } from 'react'
import type { Artwork } from '../lib/types'

interface GalleryCardProps {
  artwork: Artwork
  index: number
  onOpen: (artwork: Artwork) => void
}

const dateFormatter = new Intl.DateTimeFormat('zh-CN', {
  month: 'numeric',
  day: 'numeric',
})

export const GalleryCard = memo(function GalleryCard({
  artwork,
  index,
  onOpen,
}: GalleryCardProps) {
  const rotation = ((index % 5) - 2) * 0.65
  const topGuess = artwork.guesses[0]
  const isFree = artwork.origin === 'free' || artwork.mode === 'free'

  return (
    <button
      type="button"
      className="gallery-card"
      style={{ '--rotate': `${rotation}deg` } as CSSProperties}
      onClick={() => onOpen(artwork)}
      aria-label={`查看${artwork.targetZh}的画作`}
    >
      <span className="gallery-card__tape" aria-hidden="true" />
      <span className="gallery-card__image">
        <img
          src={artwork.image}
          alt={`${artwork.targetZh}的涂鸦`}
          loading="lazy"
          decoding="async"
        />
      </span>
      <span className="gallery-card__body">
        <span className="gallery-card__target">
          <strong>
            {artwork.targetEmoji} {artwork.targetZh}
          </strong>
          <small>{dateFormatter.format(artwork.createdAt)}</small>
        </span>
        <span className="gallery-card__guess">
          {isFree ? '自由画 · ' : ''}
          {topGuess
            ? `AI 猜：${topGuess.zh} ${Math.round(topGuess.confidence * 100)}%`
            : '还没让小猜看'}
        </span>
      </span>
      {artwork.success ? (
        <span className="gallery-card__stamp" aria-label="猜中">
          猜中
        </span>
      ) : null}
    </button>
  )
})
