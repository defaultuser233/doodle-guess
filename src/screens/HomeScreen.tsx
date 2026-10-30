import { Icon } from '../components/Icon'
import { ThemeToggle } from '../components/ThemeToggle'
import type { Theme } from '../lib/theme'
import type { GameMode, Stats } from '../lib/types'
import { successRate } from '../lib/stats'

interface HomeScreenProps {
  stats: Stats
  galleryCount: number
  soundOn: boolean
  theme: Theme
  onStart: (mode: GameMode) => void
  onGallery: () => void
  onToggleSound: () => void
  onToggleTheme: () => void
}

export function HomeScreen({
  stats,
  galleryCount,
  soundOn,
  theme,
  onStart,
  onGallery,
  onToggleSound,
  onToggleTheme,
}: HomeScreenProps) {
  return (
    <main className="home screen">
      <header className="home__nav">
        <div className="brand">
          <span className="brand__mark" aria-hidden="true">
            <Icon name="cat" size={22} />
          </span>
          <span className="brand__name">画个啥</span>
          <span className="brand__tag">DoodleGuess</span>
        </div>
        <nav className="home__nav-actions" aria-label="页面导航">
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
          <button
            type="button"
            className="icon-button"
            aria-label={soundOn ? '关闭音效' : '开启音效'}
            title={soundOn ? '关闭音效' : '开启音效'}
            onClick={onToggleSound}
          >
            <Icon name={soundOn ? 'sound-on' : 'sound-off'} size={20} />
          </button>
          <button type="button" className="btn btn--paper btn--nav" onClick={onGallery}>
            <Icon name="gallery" size={18} />
            我的画廊
            <span className="count-badge">{galleryCount}</span>
          </button>
        </nav>
      </header>

      <section className="hero">
        <div className="hero__copy">
          <p className="eyebrow">
            <span className="eyebrow__dash" aria-hidden="true" />
            QuickDraw · 你画我猜
          </p>
          <h1 className="hero__title">
            你画，
            <span className="hero__accent">
              我猜
              <svg
                className="hero__underline"
                viewBox="0 0 220 24"
                aria-hidden="true"
              >
                <path d="M6 16.5c26-8.4 51-10 74-6 25 4.4 47 3 69-3 25-6.7 47-5.6 66 2.3" />
                <path d="M28 21.5c33-4.9 68-4.6 100-.4 22 3 45 2.4 68-1.5" />
              </svg>
            </span>
          </h1>
          <p className="hero__lead">
            抽一张词卡，随手画两笔。
            <br />
            小猜会从 100 个词里，认真给你一个答案。
          </p>

          <div className="hero__actions">
            <button
              type="button"
              className="btn btn--primary btn--hero"
              onClick={() => onStart('challenge')}
            >
              <Icon name="pencil" size={22} />
              开始画画
              <Icon name="arrow-right" size={20} />
            </button>
            <button
              type="button"
              className="btn btn--ghost btn--hero"
              onClick={() => onStart('free')}
            >
              <Icon name="magic" size={20} />
              自由画
            </button>
          </div>

          <dl className="hero__facts" aria-label="游戏统计">
            <div>
              <dt title="小猜被考的次数，自由画不计">总计</dt>
              <dd>{stats.guesses}</dd>
            </div>
            <div>
              <dt>猜中</dt>
              <dd>{stats.wins}</dd>
            </div>
            <div>
              <dt>连中</dt>
              <dd>{stats.streak}</dd>
            </div>
            <div>
              <dt title="按每次猜测计算">命中率</dt>
              <dd>{stats.guesses > 0 ? `${successRate(stats)}%` : '—'}</dd>
            </div>
          </dl>
          {stats.guesses === 0 ? (
            <p className="hero__facts-note">还没有过招，去画一张试试。</p>
          ) : null}
        </div>

        <div className="hero__art">
          <span className="hero__blob" aria-hidden="true" />
          <div className="sketch-card">
            <span className="sketch-card__tape" aria-hidden="true" />
            <div className="sketch-card__frame">
              <Icon name="fish" size={196} className="sketch-card__drawing" />
              <span className="sketch-card__bubble">
                我猜是……鲸鱼？
                <Icon name="sparkle" size={15} />
              </span>
              <span className="sketch-card__caption">今日灵魂画作</span>
            </div>
          </div>
          <span className="hero__sticker">
            <Icon name="star" size={16} />
            100 个词
          </span>
          <span className="hero__sparkle" aria-hidden="true">
            <Icon name="sparkle" size={30} />
          </span>
        </div>
      </section>

      <section className="how" aria-labelledby="how-title">
        <div className="how__head">
          <h2 id="how-title">怎么玩？</h2>
          <p>三步，不用看说明书。</p>
        </div>
        <ol className="how__steps">
          <li>
            <span className="how__icon how__icon--mustard" aria-hidden="true">
              <Icon name="palette" size={28} />
            </span>
            <span className="how__step">01</span>
            <strong>抽张词卡</strong>
            <p>猫、披萨、热气球……100 个词随机出现。</p>
          </li>
          <li>
            <span className="how__icon how__icon--coral" aria-hidden="true">
              <Icon name="pencil" size={28} />
            </span>
            <span className="how__step">02</span>
            <strong>画出来</strong>
            <p>几根线条就够。画得像不像，AI 都认真看。</p>
          </li>
          <li>
            <span className="how__icon how__icon--sage" aria-hidden="true">
              <Icon name="eye" size={28} />
            </span>
            <span className="how__step">03</span>
            <strong>让小猜猜</strong>
            <p>Top-3 答案和把握度，猜中自动收进画廊。</p>
          </li>
        </ol>
      </section>

      <footer className="home__footer">
        <p>
          <Icon name="check" size={16} />
          识别在本地完成，画作不会离开你的浏览器
        </p>
        <p>
          模型由 Google QuickDraw 数据集训练 · 字体 ZCOOL KuaiLe · 数据 CC BY 4.0
        </p>
      </footer>
    </main>
  )
}
