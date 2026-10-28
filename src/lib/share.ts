import { PAPER_COLOR } from './drawing'
import type { Artwork } from './types'

const INK = '#2E2A26'
const TOMATO = '#E4572E'
const MUSTARD = '#F2B134'
const CORAL = '#F28C6B'
const SAGE = '#8FBF9F'
const SKY = '#7FB3D5'

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
  confidence: number | null
  seconds: number
  status: ShareStatus
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
    [130, 120, 330, CORAL],
    [980, 230, 300, MUSTARD],
    [920, 1210, 360, SAGE],
    [120, 1180, 300, SKY],
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

export async function createShareCard({
  image,
  emoji,
  title,
  confidence,
  seconds,
  status,
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

  const width = 1080
  const height = 1350
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) return null

  context.fillStyle = PAPER_COLOR
  context.fillRect(0, 0, width, height)
  drawWash(context)

  context.strokeStyle = INK
  context.lineWidth = 4
  roundedPath(context, 36, 36, width - 72, height - 72, 26)
  context.stroke()

  context.save()
  context.strokeStyle = 'rgba(46, 42, 38, 0.16)'
  context.lineWidth = 2
  context.setLineDash([10, 10])
  roundedPath(context, 58, 58, width - 116, height - 116, 18)
  context.stroke()
  context.restore()

  // Tape on the top edge.
  context.save()
  context.translate(width / 2, 76)
  context.rotate(-0.035)
  context.fillStyle = 'rgba(242, 177, 52, 0.6)'
  context.fillRect(-120, -27, 240, 54)
  context.strokeStyle = 'rgba(46, 42, 38, 0.2)'
  context.lineWidth = 1.5
  context.setLineDash([5, 4])
  context.beginPath()
  context.moveTo(-120, -27)
  context.lineTo(120, -27)
  context.moveTo(-120, 27)
  context.lineTo(120, 27)
  context.stroke()
  context.restore()

  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillStyle = 'rgba(46, 42, 38, 0.62)'
  context.font = '600 22px "PingFang SC", "Microsoft YaHei", sans-serif'
  context.fillText('D O O D L E G U E S S', width / 2, 165)

  // Paper frame around the drawing.
  context.save()
  context.fillStyle = 'rgba(46, 42, 38, 0.12)'
  roundedPath(context, 160, 222, 780, 780, 12)
  context.fill()
  context.fillStyle = '#FFFDF8'
  roundedPath(context, 150, 210, 780, 780, 12)
  context.fill()
  context.strokeStyle = INK
  context.lineWidth = 4
  context.stroke()
  context.beginPath()
  roundedPath(context, 180, 240, 720, 720, 6)
  context.clip()
  context.drawImage(picture, 180, 240, 720, 720)
  context.restore()

  // Stamp only when the claim is true.
  const stamp =
    status === 'success'
      ? { label: '猜中!', color: TOMATO }
      : status === 'near'
        ? { label: '差一点', color: MUSTARD }
        : null
  if (stamp) {
    context.save()
    context.translate(900, 178)
    context.rotate(-0.16)
    context.strokeStyle = stamp.color
    context.lineWidth = 4
    roundedPath(context, -66, -34, 132, 68, 6)
    context.stroke()
    context.fillStyle = stamp.color
    context.font = '400 34px "ZCOOL KuaiLe", "PingFang SC", sans-serif'
    context.fillText(stamp.label, 0, 2)
    context.restore()
  }

  context.fillStyle = INK
  context.font = '400 58px "ZCOOL KuaiLe", "PingFang SC", sans-serif'
  context.fillText(`${emoji} ${title}`, width / 2, 1085)

  context.fillStyle = 'rgba(46, 42, 38, 0.66)'
  context.font = '600 28px "PingFang SC", "Microsoft YaHei", sans-serif'
  const confidenceText =
    status === 'success'
      ? confidence === null
        ? '小猜猜中了'
        : `AI 的把握 ${Math.round(confidence * 100)}%`
      : status === 'near'
        ? 'AI 差一点就猜中'
        : status === 'miss'
          ? '这次没猜中'
          : '自由画'
  context.fillText(
    `${confidenceText} · 用时 ${Math.max(1, Math.round(seconds))} 秒`,
    width / 2,
    1155,
  )

  context.fillStyle = 'rgba(46, 42, 38, 0.4)'
  context.font = '500 20px "PingFang SC", "Microsoft YaHei", sans-serif'
  context.fillText('识别在本地完成 · 画作不上传', width / 2, 1262)

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

export async function shareArtwork(artwork: Artwork): Promise<ShareOutcome> {
  const near =
    artwork.targetId !== null &&
    artwork.guesses.some((guess) => guess.id === artwork.targetId)
  const status: ShareStatus =
    artwork.mode === 'free'
      ? 'free'
      : artwork.success
        ? 'success'
        : near
          ? 'near'
          : 'miss'
  const blob = await createShareCard({
    image: artwork.image,
    emoji: artwork.targetEmoji,
    title: artwork.targetZh,
    confidence: artwork.success ? (artwork.guesses[0]?.confidence ?? null) : null,
    seconds: artwork.durationMs / 1000,
    status,
  })
  if (!blob) return 'failed'
  return shareImage(blob, `doodle-${artwork.targetId ?? 'free'}.png`)
}
