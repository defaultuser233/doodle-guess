import type { Category } from '../lib/categories'
import type { GameMode } from '../lib/types'
import { Icon } from './Icon'

interface WordCardProps {
  category: Category | null
  mode: GameMode
  onChangeWord: () => void
}

export function WordCard({ category, mode, onChangeWord }: WordCardProps) {
  return (
    <div className="word-card">
      <span className="word-card__tape" aria-hidden="true" />
      <span className="word-card__label">
        {mode === 'challenge' ? '画这个' : '自由画'}
      </span>
      <span className="word-card__emoji" aria-hidden="true">
        {category?.emoji ?? '✏️'}
      </span>
      <span className="word-card__text">
        <strong>{category?.zh ?? '随便画点什么'}</strong>
        <small>{category?.en ?? 'draw anything'}</small>
      </span>
      {mode === 'challenge' ? (
        <button
          type="button"
          className="word-card__shuffle"
          aria-label="换一张词卡"
          title="换一张词卡"
          onClick={onChangeWord}
        >
          <Icon name="refresh" size={18} />
        </button>
      ) : null}
    </div>
  )
}
