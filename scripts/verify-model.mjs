#!/usr/bin/env node
/**
 * Sanity check for the exported browser model.
 *
 * Loads public/model/*, pulls a few fresh 28x28 QuickDraw bitmaps from a row
 * range that the training script never used, and runs the same int8 forward
 * pass the browser uses.
 *
 *   npm run verify:model
 */

import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BASE = 'https://storage.googleapis.com/quickdraw_dataset/full/numpy_bitmap'
const SAMPLE_ROWS = 20
const START_ROW = 6000
const CATEGORIES = ['cat', 'dog', 'fish', 'sun', 'house']

const meta = JSON.parse(
  await readFile(path.join(ROOT, 'public/model/model.json'), 'utf8'),
)
const weightBuffer = await readFile(path.join(ROOT, 'public/model/weights.bin'))
const weights = weightBuffer.buffer.slice(
  weightBuffer.byteOffset,
  weightBuffer.byteOffset + weightBuffer.byteLength,
)

const layers = meta.layers.map((layer) => {
  const quantized = new Int8Array(weights, layer.qOffset, layer.qLength)
  const scales = new Float32Array(weights, layer.scaleOffset, layer.out)
  const bias = new Float32Array(weights, layer.biasOffset, layer.out)
  const weight = new Float32Array(layer.in * layer.out)
  for (let row = 0; row < layer.out; row += 1) {
    const scale = scales[row]
    const offset = row * layer.in
    for (let column = 0; column < layer.in; column += 1) {
      weight[offset + column] = quantized[offset + column] * scale
    }
  }
  return {
    in: layer.in,
    out: layer.out,
    relu: layer.activation === 'relu',
    weight,
    bias,
  }
})

function predict(pixels) {
  let activation = Float32Array.from(pixels, (value) => value / 255)
  for (const layer of layers) {
    const next = new Float32Array(layer.out)
    for (let row = 0; row < layer.out; row += 1) {
      let sum = layer.bias[row]
      const offset = row * layer.in
      for (let column = 0; column < layer.in; column += 1) {
        sum += activation[column] * layer.weight[offset + column]
      }
      next[row] = layer.relu ? Math.max(sum, 0) : sum
    }
    activation = next
  }
  let maximum = -Infinity
  for (const value of activation) maximum = Math.max(maximum, value)
  let total = 0
  for (let index = 0; index < activation.length; index += 1) {
    activation[index] = Math.exp(activation[index] - maximum)
    total += activation[index]
  }
  return Array.from(activation, (value, index) => ({
    id: meta.labels[index],
    confidence: value / total,
  })).sort((left, right) => right.confidence - left.confidence)
}

function parseHeader(buffer) {
  const headerLength = buffer.readUInt16LE(8)
  const header = buffer.toString('latin1', 10, 10 + headerLength)
  const shape = header.match(/shape'?:\s*\((\d+),\s*(\d+)\)/)
  return {
    rows: Number(shape?.[1] ?? 0),
    cols: Number(shape?.[2] ?? 784),
    dataStart: 10 + headerLength,
  }
}

async function fetchCategory(category) {
  const url = `${BASE}/${encodeURIComponent(category)}.npy`
  const headResponse = await fetch(url, {
    headers: { Range: 'bytes=0-2047' },
  })
  if (!headResponse.ok) throw new Error(`${category}: HTTP ${headResponse.status}`)
  const header = Buffer.from(await headResponse.arrayBuffer())
  const info = parseHeader(header)
  if (info.rows < START_ROW + SAMPLE_ROWS) {
    throw new Error(`${category}: only ${info.rows} rows`)
  }
  const start = info.dataStart + START_ROW * info.cols
  const end = start + SAMPLE_ROWS * info.cols - 1
  const response = await fetch(url, {
    headers: { Range: `bytes=${start}-${end}` },
  })
  if (!response.ok) throw new Error(`${category}: HTTP ${response.status}`)
  const body = new Uint8Array(await response.arrayBuffer())
  const samples = []
  for (let index = 0; index < SAMPLE_ROWS; index += 1) {
    const offset = index * info.cols
    samples.push(body.subarray(offset, offset + info.cols))
  }
  return samples
}

let correct1 = 0
let correct5 = 0
let total = 0

for (const category of CATEGORIES) {
  const samples = await fetchCategory(category)
  let categoryCorrect = 0
  const guessed = new Map()

  for (const sample of samples) {
    const predictions = predict(sample)
    const top = predictions.slice(0, 3)
    const hit = top[0].id === category
    const inTop5 = predictions.slice(0, 5).some((item) => item.id === category)
    if (hit) categoryCorrect += 1
    if (hit) correct1 += 1
    if (inTop5) correct5 += 1
    total += 1
    for (const item of top) {
      guessed.set(item.id, (guessed.get(item.id) ?? 0) + 1)
    }
  }

  const common = [...guessed.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([id, count]) => `${id} ×${count}`)
    .join(', ')
  console.log(
    `${category.padEnd(8)} top1 ${categoryCorrect}/${samples.length}  常见猜测: ${common}`,
  )
}

console.log('')
console.log(`model: ${meta.labels.length} classes, ${meta.metrics?.trainedAt ?? meta.trainedAt}`)
console.log(`fresh samples: ${total}`)
console.log(`top1 ${((correct1 / total) * 100).toFixed(1)}%  top5 ${((correct5 / total) * 100).toFixed(1)}%`)
console.log(
  `validation (training): top1 ${((meta.metrics?.top1 ?? 0) * 100).toFixed(1)}%  top5 ${((meta.metrics?.top5 ?? 0) * 100).toFixed(1)}%`,
)
