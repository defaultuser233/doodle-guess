import { PAPER_COLOR } from './drawing'
import type { Artwork, GuessRecord } from './types'

const INK = '#2E2A26'
const MUSTARD = '#F2B134'
const CORAL = '#F28C6B'
const SAGE = '#8FBF9F'
const SKY = '#7FB3D5'
const CREAM = '#FBF4E4'

const BODY_FONT = '"PingFang SC", "Microsoft YaHei", sans-serif'
const DISPLAY_FONT = '"ZCOOL KuaiLe", "PingFang SC", sans-serif'
const EMOJI_FONT = '"Segoe UI Emoji", "Apple Color Emoji", sans-serif'

export type ShareOutcome =
  | 'shared'
  | 'copied'
  | 'downloaded'
  | 'cancelled'
  | 'failed'

export type ShareStatus = 'success' | 'near' | 'miss' | 'free'

export const SHARE_MESSAGES: Record<ShareOutcome, string> = {
  shared: '已打开分享',
  copied: '分享图已复制，去粘贴吧',
  downloaded: '分享图已下载',
  cancelled: '已取消分享',
  failed: '这次没有分享成功',
}

export interface ShareCardOptions {
  image: string
  emoji: string
  title: string
  guesses: GuessRecord[]
  seconds: number
  status: ShareStatus
  createdAt?: number
  kind?: 'challenge' | 'free'
}

function roundedPath(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.min(radius, width / 2, height / 2)
  context.beginPath()
  context.moveTo(x + r, y)
  context.lineTo(x + width - r, y)
  context.quadraticCurveTo(x + width, y, x + width, y + r)
  context.lineTo(x + width, y + height - r)
  context.quadraticCurveTo(x + width, y + height, x + width - r, y + height)
  context.lineTo(x + r, y + height)
  context.quadraticCurveTo(x, y + height, x, y + height - r)
  context.lineTo(x, y + r)
  context.quadraticCurveTo(x, y, x + r, y)
  context.closePath()
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('image load failed'))
    image.src = source
  })
}

function drawWash(context: CanvasRenderingContext2D): void {
  const washes: Array<[number, number, number, string]> = [
    [180, 150, 430, CORAL],
    [900, 780, 380, SAGE],
    [740, 90, 300, MUSTARD],
    [950, 430, 260, SKY],
  ]
  context.save()
  context.globalAlpha = 0.2
  for (const [x, y, radius, color] of washes) {
    const gradient = context.createRadialGradient(x, y, 0, x, y, radius)
    gradient.addColorStop(0, color)
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
    context.fillStyle = gradient
    context.fillRect(x - radius, y - radius, radius * 2, radius * 2)
  }
  context.restore()
}

function formatDateTime(timestamp: number): string {
  const date = new Date(timestamp)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function drawCrown(
  context: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  size: number,
): void {
  const half = size / 2
  const height = size * 0.58
  context.save()
  context.translate(centerX, centerY)
  context.strokeStyle = 'rgba(46, 42, 38, 0.62)'
  context.lineWidth = 2.4
  context.lineJoin = 'round'
  context.beginPath()
  context.moveTo(-half, height / 2)
  context.lineTo(-half, -height / 2)
  context.lineTo(-half / 3, 0)
  context.lineTo(0, -height / 2)
  context.lineTo(half / 3, 0)
  context.lineTo(half, -height / 2)
  context.lineTo(half, height / 2)
  context.closePath()
  context.stroke()
  context.restore()
}

function fitTitle(
  context: CanvasRenderingContext2D,
  title: string,
  maxWidth: number,
): string {
  let size = 62
  let font = `400 ${size}px ${DISPLAY_FONT}`
  context.font = font
  while (context.measureText(title).width > maxWidth && size > 34) {
    size -= 2
    font = `400 ${size}px ${DISPLAY_FONT}`
    context.font = font
  }
  return font
}

export async function createShareCard({
  image,
  emoji,
  title,
  guesses,
  seconds,
  status,
  createdAt = Date.now(),
  kind = 'challenge',
}: ShareCardOptions): Promise<Blob | null> {
  if (typeof document === 'undefined') return null
  if (document.fonts?.ready) {
    await Promise.race([
      document.fonts.ready.catch(() => undefined),
      new Promise((resolve) => window.setTimeout(resolve, 1000)),
    ])
  }

  const picture = await loadImage(image).catch(() => null)
  if (!picture) return null

  const width = 1600
  const height = 900
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) return null

  context.fillStyle = PAPER_COLOR
  context.fillRect(0, 0, width, height)
  drawWash(context)

  // Right hand info panel.
  context.save()
  roundedPath(context, 40, 40, width - 80, height - 80, 30)
  context.clip()
  context.fillStyle = CREAM
  context.fillRect(1000, 40, width - 1040, height - 80)
  context.restore()

  context.strokeStyle = INK
  context.lineWidth = 4
  roundedPath(context, 40, 40, width - 80, height - 80, 30)
  context.stroke()

  context.strokeStyle = 'rgba(46, 42, 38, 0.14)'
  context.lineWidth = 2
  context.beginPath()
  context.moveTo(1000, 70)
  context.lineTo(1000, height - 70)
  context.stroke()

  // Drawing on the left.
  const frameX = 150
  const frameY = 80
  const frameSize = 740
  context.fillStyle = '#FFFDF8'
  roundedPath(context, frameX, frameY, frameSize, frameSize, 14)
  context.fill()
  context.strokeStyle = INK
  context.lineWidth = 4
  context.stroke()

  context.save()
  roundedPath(context, frameX + 10, frameY + 10, frameSize - 20, frameSize - 20, 8)
  context.clip()
  context.drawImage(
    picture,
    frameX + 10,
    frameY + 10,
    frameSize - 20,
    frameSize - 20,
  )
  context.restore()

  // Info column.
  const left = 1050
  const right = width - 80

  context.textAlign = 'left'
  context.textBaseline = 'middle'
  context.fillStyle = 'rgba(46, 42, 38, 0.52)'
  context.font = `600 24px ${BODY_FONT}`
  context.fillText('画廊藏品', left, 118)

  context.fillStyle = INK
  context.font = `36px ${EMOJI_FONT}`
  context.fillText(emoji, left, 202)

  context.font = fitTitle(context, title, right - left - 110)
  context.fillText(title, left + 82, 202)

  const statusWord =
    status === 'success'
      ? '猜中'
      : status === 'near'
        ? '差一点'
        : status === 'miss'
          ? '没猜中'
          : null
  const kindWord = kind === 'free' ? '自由画' : '挑战作品'
  const timeLine = `${formatDateTime(createdAt)} · 用时 ${Math.max(1, Math.round(seconds))} 秒`
  const kindLine = statusWord ? `${kindWord} · ${statusWord}` : kindWord

  context.fillStyle = 'rgba(46, 42, 38, 0.62)'
  context.font = `500 24px ${BODY_FONT}`
  context.fillText(timeLine, left, 264)

  context.fillStyle = 'rgba(46, 42, 38, 0.5)'
  context.font = `500 22px ${BODY_FONT}`
  context.fillText(kindLine, left, 300)

  const rows = guesses.slice(0, 3)
  const rowTop = 378
  const rowHeight = 112

  if (rows.length === 0) {
    context.fillStyle = 'rgba(46, 42, 38, 0.5)'
    context.font = `500 28px ${BODY_FONT}`
    context.fillText('还没有让小猜看过', left, rowTop + 40)
  }

  rows.forEach((guess, index) => {
    const centerY = rowTop + index * rowHeight + 40

    if (index === 0) {
      drawCrown(context, left + 16, centerY, 30)
    } else {
      context.fillStyle = 'rgba(46, 42, 38, 0.55)'
      context.font = `600 26px ${BODY_FONT}`
      context.textAlign = 'center'
      context.fillText(String(index + 1), left + 16, centerY)
      context.textAlign = 'left'
    }

    context.fillStyle = INK
    context.font = `32px ${EMOJI_FONT}`
    context.fillText(guess.emoji, left + 52, centerY)

    context.font = `600 30px ${BODY_FONT}`
    context.fillText(guess.zh, left + 104, centerY)

    context.textAlign = 'right'
    context.font = `600 30px ${BODY_FONT}`
    context.fillStyle = index === 0 ? INK : 'rgba(46, 42, 38, 0.7)'
    context.fillText(`${Math.round(guess.confidence * 100)}%`, right, centerY)
    context.textAlign = 'left'

    context.save()
    context.strokeStyle = 'rgba(46, 42, 38, 0.16)'
    context.lineWidth = 1.5
    context.setLineDash([7, 7])
    context.beginPath()
    context.moveTo(left, centerY + 58)
    context.lineTo(right, centerY + 58)
    context.stroke()
    context.restore()
  })

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png')
  })
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 4000)
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

export async function shareImage(
  blob: Blob,
  filename: string,
): Promise<ShareOutcome> {
  const file =
    typeof File === 'undefined'
      ? null
      : new File([blob], filename, { type: 'image/png' })

  if (
    file &&
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function'
  ) {
    let canShareFiles = false
    try {
      canShareFiles = navigator.canShare({ files: [file] })
    } catch {
      canShareFiles = false
    }
    if (canShareFiles) {
      try {
        await navigator.share({
          files: [file],
          title: '画个啥 · 猜中啦',
          text: '看看我画的，小猜猜中了！',
        })
        return 'shared'
      } catch (error) {
        if (isAbort(error)) return 'cancelled'
      }
    }
  }

  if (
    typeof navigator.clipboard?.write === 'function' &&
    typeof ClipboardItem !== 'undefined'
  ) {
    try {
      const copied = navigator.clipboard
        .write([new ClipboardItem({ 'image/png': blob })])
        .then(() => 'copied' as const)
        .catch(() => 'failed' as const)
      const outcome = await Promise.race([
        copied,
        new Promise<'timeout'>((resolve) => {
          window.setTimeout(() => resolve('timeout'), 1800)
        }),
      ])
      if (outcome === 'copied') return 'copied'
      // A permission prompt can stay open indefinitely; fall through so the
      // user still gets the image instead of a button that appears dead.
    } catch {
      // Clipboard needs permission / a secure context; fall through to download.
    }
  }

  try {
    downloadBlob(blob, filename)
    return 'downloaded'
  } catch {
    return 'failed'
  }
}

export function artworkStatus(artwork: Artwork): ShareStatus {
  if (artwork.mode === 'free') return 'free'
  if (artwork.success) return 'success'
  const near =
    artwork.targetId !== null &&
    artwork.guesses.some((guess) => guess.id === artwork.targetId)
  return near ? 'near' : 'miss'
}

export function createArtworkCard(artwork: Artwork): Promise<Blob | null> {
  return createShareCard({
    image: artwork.image,
    emoji: artwork.targetEmoji,
    title: artwork.targetZh,
    guesses: artwork.guesses.slice(0, 3),
    seconds: artwork.durationMs / 1000,
    status: artworkStatus(artwork),
    createdAt: artwork.createdAt,
    kind: artwork.mode === 'free' ? 'free' : 'challenge',
  })
}

export async function shareArtwork(artwork: Artwork): Promise<ShareOutcome> {
  const blob = await createArtworkCard(artwork)
  if (!blob) return 'failed'
  return shareImage(blob, `doodle-${artwork.targetId ?? 'free'}.png`)
}
