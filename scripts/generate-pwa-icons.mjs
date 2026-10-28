import { chromium } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const svg = await readFile(path.join(root, 'public/favicon.svg'), 'utf8')
const channel = process.env.PW_CHANNEL ?? 'msedge'
const browser = await chromium.launch({ channel })

for (const [size, name, maskable] of [
  [192, 'pwa-192.png', false],
  [512, 'pwa-512.png', false],
  [512, 'maskable-512.png', true],
  [180, 'apple-touch-icon.png', false],
]) {
  const page = await browser.newPage({
    viewport: { width: size, height: size },
    deviceScaleFactor: 1,
  })
  const iconSize = maskable ? Math.round(size * 0.8) : size
  await page.setContent(`<!doctype html><style>
    html,body{margin:0;background:#FBF6EA;overflow:hidden;display:grid;place-items:center}
    svg{display:block;width:${iconSize}px;height:${iconSize}px}
  </style>${svg}`)
  await page.screenshot({ path: path.join(root, 'public', name) })
  await page.close()
  console.log(`wrote public/${name}`)
}

await browser.close()
