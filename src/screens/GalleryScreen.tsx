import { useCallback, useEffect, useState } from 'react'
import { ArtworkModal } from '../components/ArtworkModal'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { GalleryCard } from '../components/GalleryCard'
import { Icon } from '../components/Icon'
import { ThemeToggle } from '../components/ThemeToggle'
import { Toast } from '../components/Toast'
import { useToast } from '../hooks/useToast'
import { downloadArtwork } from '../lib/download'
import { SHARE_MESSAGES, shareArtwork } from '../lib/share'
import {
  clearArtworks,
  deleteArtwork,
  listArtworks,
} from '../lib/storage'
import type { Theme } from '../lib/theme'
import type { Artwork } from '../lib/types'

interface GalleryScreenProps {
  theme: Theme
  onBack: () => void
  onStart: () => void
  onCountChange: (count: number) => void
  onToggleTheme: () => void
}

export function GalleryScreen({
  theme,
  onBack,
  onStart,
  onCountChange,
  onToggleTheme,
}: GalleryScreenProps) {
  const [artworks, setArtworks] = useState<Artwork[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Artwork | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Artwork | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const { toast, showToast } = useToast()

  const refresh = useCallback(async () => {
    const list = await listArtworks()
    setArtworks(list)
    onCountChange(list.length)
  }, [onCountChange])

  useEffect(() => {
    let alive = true
    const load = async () => {
      const list = await listArtworks()
      if (!alive) return
      setArtworks(list)
      onCountChange(list.length)
      setLoading(false)
    }
    void load()
    return () => {
      alive = false
    }
  }, [onCountChange])

  const handleOpen = useCallback((artwork: Artwork) => {
    setSelected(artwork)
  }, [])

  const handleDownload = (artwork: Artwork) => {
    const created = new Date(artwork.createdAt)
    const stamp = `${created.getFullYear()}${String(created.getMonth() + 1).padStart(2, '0')}${String(created.getDate()).padStart(2, '0')}`
    void downloadArtwork(
      artwork.image,
      `doodle-${artwork.targetId ?? 'free'}-${stamp}.png`,
    )
    showToast('图片已开始下载')
  }

  const handleShare = async (artwork: Artwork) => {
    showToast('正在生成分享图…')
    try {
      const outcome = await shareArtwork(artwork)
      showToast(SHARE_MESSAGES[outcome])
    } catch {
      showToast('分享图生成失败，请再试一次')
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    await deleteArtwork(deleteTarget.id)
    setDeleteTarget(null)
    setSelected(null)
    await refresh()
    showToast('已从画廊删除')
  }

  const confirmClearAll = async () => {
    await clearArtworks()
    setConfirmClear(false)
    setSelected(null)
    await refresh()
    showToast('画廊已清空')
  }

  return (
    <main className="gallery-screen screen">
      <header className="gallery-top">
        <div className="gallery-top__left">
          <button
            type="button"
            className="icon-button"
            aria-label="返回首页"
            onClick={onBack}
          >
            <Icon name="arrow-left" size={22} />
          </button>
          <div>
            <p className="eyebrow">你的收藏</p>
            <h1>我的画廊</h1>
          </div>
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        </div>
        <div className="gallery-top__actions">
          {artworks.length > 0 ? (
            <button
              type="button"
              className="btn btn--ghost btn--small btn--danger-text"
              onClick={() => setConfirmClear(true)}
            >
              <Icon name="trash" size={16} />
              清空
            </button>
          ) : null}
          <button
            type="button"
            className="btn btn--primary btn--small"
            onClick={onStart}
          >
            <Icon name="pencil" size={17} />
            画一张
          </button>
        </div>
      </header>

      <p className="gallery-toolbar">
        <span>
          {loading ? '正在翻画册…' : `${artworks.length} 幅作品`}
          {artworks.length > 0 ? ' · 全部存在这台设备上' : ''}
        </span>
        <span className="gallery-toolbar__line" aria-hidden="true" />
      </p>

      {loading ? (
        <div className="gallery-loading" role="status">
          <span className="gallery-loading__spinner" aria-hidden="true" />
          正在翻画册…
        </div>
      ) : artworks.length === 0 ? (
        <section className="gallery-empty">
          <div className="gallery-empty__frame">
            <span className="gallery-empty__tape" aria-hidden="true" />
            <Icon name="fish" size={126} />
            <span className="gallery-empty__caption">空白的画框</span>
          </div>
          <h2>画廊还空着</h2>
          <p>第一幅画，从一只猫开始？</p>
          <button type="button" className="btn btn--primary" onClick={onStart}>
            <Icon name="pencil" size={19} /> 去画第一张
          </button>
        </section>
      ) : (
        <section className="gallery-grid" aria-label="作品列表">
          {artworks.map((artwork, index) => (
            <GalleryCard
              key={artwork.id}
              artwork={artwork}
              index={index}
              onOpen={handleOpen}
            />
          ))}
        </section>
      )}

      <footer className="gallery-footer">
        <p>
          <Icon name="heart" size={15} />
          画作只保存在这台设备的 IndexedDB 里，清缓存会一起消失。
        </p>
      </footer>

      <ArtworkModal
        artwork={selected}
        onClose={() => setSelected(null)}
        onDownload={handleDownload}
        onShare={(artwork) => void handleShare(artwork)}
        onDelete={(artwork) => setDeleteTarget(artwork)}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title="删除这幅画？"
        description="删除后无法恢复，画廊里就再也找不到它了。"
        confirmLabel="删除"
        cancelLabel="留着"
        danger
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmDialog
        open={confirmClear}
        title="清空整个画廊？"
        description={`这 ${artworks.length} 幅画都会被删除，无法恢复。`}
        confirmLabel="全部清空"
        cancelLabel="再想想"
        danger
        onConfirm={() => void confirmClearAll()}
        onCancel={() => setConfirmClear(false)}
      />

      <Toast message={toast} />
    </main>
  )
}
