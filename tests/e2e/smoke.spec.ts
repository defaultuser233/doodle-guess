import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

async function drawCircle(page: Page) {
  const canvas = page.locator('canvas[aria-label*="画板"]')
  const box = await canvas.boundingBox()
  if (!box) throw new Error('canvas is not visible')
  const centerX = box.x + box.width / 2
  const centerY = box.y + box.height / 2
  const radius = Math.min(box.width, box.height) * 0.16

  await page.mouse.move(centerX + radius, centerY)
  await page.mouse.down()
  for (let step = 1; step <= 14; step += 1) {
    const angle = (step / 14) * Math.PI * 2
    await page.mouse.move(
      centerX + Math.cos(angle) * radius,
      centerY + Math.sin(angle) * radius,
      { steps: 2 },
    )
  }
  await page.mouse.up()
}

test('draw, guess, save, then close nested dialogs one layer at a time', async ({
  page,
}) => {
  await page.goto('/')

  await page.getByRole('button', { name: '自由画' }).click()
  await expect(page.locator('canvas[aria-label*="画板"]')).toBeVisible()
  await expect(page.locator('.ai-status')).toHaveText('在线')

  await drawCircle(page)

  await page.getByRole('button', { name: /让 AI 猜猜/ }).click()
  await expect(page.locator('.guess-row')).toHaveCount(3)
  await expect(page.getByText('我猜是……')).toBeVisible()

  await page.getByRole('button', { name: '保存这幅' }).click()
  await expect(page.getByRole('button', { name: /已收进画廊/ })).toBeVisible()

  await page.getByRole('button', { name: '画廊', exact: true }).click()
  await expect(page.getByRole('heading', { name: '我的画廊' })).toBeVisible()

  const card = page.getByRole('button', { name: /查看.*的画作/ }).first()
  await expect(card).toBeVisible()
  await card.click()

  const artworkDialog = page.getByRole('dialog')
  await expect(artworkDialog).toBeVisible()
  await page.getByRole('button', { name: '删除' }).click()

  const confirmDialog = page.getByRole('dialog', { name: '删除这幅画？' })
  await expect(confirmDialog).toBeVisible()

  // Escape closes only the confirm; focus goes back to its trigger.
  await page.keyboard.press('Escape')
  await expect(confirmDialog).toBeHidden()
  await expect(artworkDialog).toBeVisible()
  await expect(page.getByRole('button', { name: '删除' })).toBeFocused()

  // A second Escape closes the artwork; focus returns to the gallery card.
  await page.keyboard.press('Escape')
  await expect(artworkDialog).toBeHidden()
  await expect(card).toBeFocused()
})


test('exports, clears, and restores the gallery backup', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '自由画' }).click()
  await expect(page.locator('canvas[aria-label*="画板"]')).toBeVisible()
  await drawCircle(page)

  await page.getByRole('button', { name: '直接保存这幅' }).click()
  await expect(page.getByRole('button', { name: /已收进画廊/ })).toBeVisible()

  await page.getByRole('button', { name: '画廊', exact: true }).click()
  await expect(page.getByRole('heading', { name: '我的画廊' })).toBeVisible()
  await expect(page.getByRole('button', { name: /查看.*的画作/ })).toHaveCount(1)

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: '导出备份' }).click()
  const download = await downloadPromise
  const backupPath = await download.path()
  expect(backupPath).toBeTruthy()

  await page.getByRole('button', { name: '清空', exact: true }).click()
  await page.getByRole('button', { name: '全部清空' }).click()
  await expect(page.getByRole('heading', { name: '画廊还空着' })).toBeVisible()

  await page.setInputFiles('input[type="file"]', backupPath!)
  await expect(page.getByRole('button', { name: /查看.*的画作/ })).toHaveCount(1)
  await expect(page.getByText(/已导入 1 幅/)).toBeVisible()
})
