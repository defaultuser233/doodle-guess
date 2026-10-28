import { useEffect, useState } from 'react'
import type { RefObject } from 'react'
import { findCategory, type Category } from '../lib/categories'
import type { GuessRecord } from '../lib/types'
import { Icon } from './Icon'

export type GuessPhase = 'idle' | 'thinking' | 'done' | 'error'
export type GuessResult = 'success' | 'near' | 'miss' | null
export type ModelState = 'loading' | 'ready' | 'error'

interface GuessPanelProps {
  phase: GuessPhase
  guesses: GuessRecord[]
  target: Category | null
  result: GuessResult
  canGuess: boolean
  modelState: ModelState
  saved: boolean
  penStrokeCount: number
  showDirectSave?: boolean
  panelRef?: RefObject<HTMLElement | null>
  onGuess: () => void
  onRetryModel: () => void
  onSave: () => void
  onSaveAsChallenge?: () => void
  onContinue: () => void
}

const THINKING_LINES = [
  '让我眯着眼看看…',
  '这个轮廓，有点意思…',
  '先别动，我在认…',
  '嗯……有点像，又不太像…',
]

function ThinkingState() {
  const [index, setIndex] = useState(0)
  useEffect(() => {
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % THINKING_LINES.length)
    }, 900)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <div className="thinking">
      <div className="thinking__scan" aria-hidden="true">
        <div className="thinking__paper">
          <Icon name="squiggle" size={64} />
          <span className="thinking__line" />
          <span className="thinking__line thinking__line--short" />
          <span className="thinking__line" />
        </div>
        <Icon name="scan" size={26} className="thinking__scan-icon" />
      </div>
      <p className="thinking__text">{THINKING_LINES[index]}</p>
      <span className="thinking__dots" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
    </div>
  )
}

function ResultMessage({
  result,
  targetRank,
  target,
}: {
  result: GuessResult
  targetRank: number
  target: Category | null
}) {
  if (result === 'success') {
    return (
      <p className="guess-message is-success">
        <Icon name="check" size={18} /> 猜中啦！就是「{target?.zh}」。
      </p>
    )
  }
  if (result === 'near') {
    return (
      <p className="guess-message is-near">
        差一点！「{target?.zh}」排在第 {targetRank} 位。
      </p>
    )
  }
  if (result === 'miss') {
    return (
      <p className="guess-message is-miss">
        唔……这次没猜中。补两笔，或者换个角度试试？
      </p>
    )
  }
  return null
}

export function GuessPanel({
  phase,
  guesses,
  target,
  result,
  canGuess,
  modelState,
  saved,
  penStrokeCount,
  showDirectSave = false,
  panelRef,
  onGuess,
  onRetryModel,
  onSave,
  onSaveAsChallenge,
  onContinue,
}: GuessPanelProps) {
  const topConfidence = guesses[0]?.confidence ?? 1
  const targetRank = target
    ? guesses.findIndex((guess) => guess.id === target.id) + 1
    : 0

  let hint = '按住画板，开始你的灵魂创作'
  if (modelState === 'loading') hint = 'AI 正在热手…'
  if (modelState === 'error') hint = '识别模型没加载出来'
  if (modelState === 'ready' && !canGuess) {
    hint =
      penStrokeCount > 0
        ? `已画 ${penStrokeCount} 笔 · 再补几笔，AI 才看得清`
        : '多画几笔，AI 才看得清'
  }
  if (phase === 'done') hint = '补两笔，再猜一次'
  if (phase === 'thinking') hint = '别急，我在看…'
  if (phase === 'idle' && modelState === 'ready' && canGuess) hint = '画好了？让小猜看看'

  return (
    <aside ref={panelRef} className="guess-panel" aria-label="AI 猜测面板">
      <header className="guess-panel__head">
        <span className="ai-avatar" aria-hidden="true">
          <Icon name="eye" size={24} />
        </span>
        <span className="ai-meta">
          <strong>小猜</strong>
          <small>本地 AI · 不上传画作</small>
        </span>
        <span className={`ai-status${modelState === 'ready' ? ' is-online' : ''}`}>
          {modelState === 'ready' ? '在线' : modelState === 'loading' ? '热身' : '离线'}
        </span>
      </header>

      <div className="guess-panel__body">
        <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {phase === 'thinking'
            ? '小猜正在看你的画。'
            : phase === 'done' && guesses.length > 0
              ? `我猜是${guesses
                  .map(
                    (guess, index) =>
                      `${index === 0 ? '，最像' : '，其次'}${guess.zh}，把握 ${Math.round(guess.confidence * 100)}%`,
                  )
                  .join('')}。${
                  result === 'success'
                    ? '猜中了。'
                    : result === 'near'
                      ? `目标词排在第 ${targetRank} 位。`
                      : result === 'miss'
                        ? '这次没猜中。'
                        : ''
                }`
              : ''}
        </p>
        {phase === 'idle' && modelState !== 'error' ? (
          <div className="guess-idle">
            <div className="guess-idle__doodle" aria-hidden="true">
              <Icon name="cat" size={92} />
              <span className="guess-idle__bubble">画好了吗？</span>
            </div>
            <p>我准备好了。</p>
            <small>你画你的，我负责认真猜。</small>
            {showDirectSave && penStrokeCount > 0 ? (
              <button
                type="button"
                className="btn btn--paper btn--small guess-idle__save"
                onClick={onSave}
                disabled={saved}
              >
                {saved ? '已收进画廊 ✓' : '直接保存这幅'}
              </button>
            ) : null}
          </div>
        ) : null}

        {phase === 'thinking' ? <ThinkingState /> : null}

        {phase === 'done' ? (
          <div className="guess-results">
            <p className="guess-results__lead">我猜是……</p>
            <ol className="guess-list">
              {guesses.map((guess, index) => {
                const category = findCategory(guess.id)
                const isTarget = category?.id === target?.id
                const width = Math.max(
                  8,
                  Math.round((guess.confidence / Math.max(topConfidence, 0.001)) * 100),
                )
                return (
                  <li
                    key={guess.id}
                    className={`guess-row${index === 0 ? ' is-top' : ''}${
                      isTarget ? ' is-target' : ''
                    }`}
                    style={{ animationDelay: `${index * 80}ms` }}
                  >
                    <span className="guess-row__rank" aria-hidden="true">
                      {index === 0 ? <Icon name="crown" size={16} /> : index + 1}
                    </span>
                    <span className="guess-row__emoji" aria-hidden="true">
                      {guess.emoji}
                    </span>
                    <span className="guess-row__name">
                      <strong>{guess.zh}</strong>
                      <small>{category?.en ?? guess.id}</small>
                    </span>
                    <span className="guess-row__score">
                      {guess.confidence < 0.05
                        ? '瞎猜的'
                        : `${Math.round(guess.confidence * 100)}%`}
                    </span>
                    <span className="guess-row__bar" aria-hidden="true">
                      <i style={{ width: `${width}%` }} />
                    </span>
                  </li>
                )
              })}
            </ol>
            <ResultMessage
              result={result}
              targetRank={targetRank}
              target={target}
            />
            {phase === 'done' && result !== 'success' ? (
              <div className="guess-actions">
                <button type="button" className="btn btn--small btn--ghost" onClick={onContinue}>
                  继续画
                </button>
                <button
                  type="button"
                  className="btn btn--small btn--paper"
                  onClick={onSave}
                  disabled={saved}
                >
                  {saved ? '已收进画廊 ✓' : '保存这幅'}
                </button>
                {onSaveAsChallenge ? (
                  <button
                    type="button"
                    className="btn btn--small btn--ghost"
                    onClick={onSaveAsChallenge}
                    disabled={saved}
                  >
                    <Icon name="sparkle" size={14} />
                    存为挑战
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {phase === 'error' || modelState === 'error' ? (
          <div className="guess-error">
            <Icon name="cloud" size={70} />
            <p>哎呀，模型没加载出来。</p>
            <small>检查一下网络或刷新页面，画作不会丢。</small>
            <button type="button" className="btn btn--small btn--paper" onClick={onRetryModel}>
              <Icon name="refresh" size={16} /> 重试
            </button>
          </div>
        ) : null}
      </div>

      <footer className="guess-panel__footer">
        <button
          type="button"
          className="btn btn--guess"
          onClick={onGuess}
          disabled={
            phase === 'thinking' || !canGuess || modelState !== 'ready'
          }
        >
          <Icon name="sparkle" size={20} />
          {phase === 'done' ? '再猜一次' : '让 AI 猜猜'}
          <span className="btn__key" aria-hidden="true">
            Enter
          </span>
        </button>
        <p className="guess-panel__hint">{hint}</p>
      </footer>
    </aside>
  )
}
