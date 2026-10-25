export interface Prediction {
  id: string
  confidence: number
}

interface LayerMeta {
  in: number
  out: number
  activation: 'relu' | 'linear'
  qOffset: number
  qLength: number
  biasOffset: number
  scaleOffset: number
}

interface ModelMeta {
  version: number
  input: number
  imageSize: number
  labels: string[]
  layers: LayerMeta[]
  metrics?: {
    top1?: number
    top5?: number
    classes?: number
    trainSamples?: number
  }
}

interface RuntimeLayer {
  in: number
  out: number
  relu: boolean
  weight: Float32Array
  bias: Float32Array
}

export interface Classifier {
  labels: string[]
  metrics: ModelMeta['metrics']
  predict: (sketch: Float32Array) => Prediction[]
}

class QuickDrawClassifier implements Classifier {
  readonly labels: string[]
  readonly metrics: ModelMeta['metrics']
  private readonly layers: RuntimeLayer[]

  constructor(meta: ModelMeta, buffer: ArrayBuffer) {
    this.labels = meta.labels
    this.metrics = meta.metrics
    this.layers = meta.layers.map((layer) => {
      const quantized = new Int8Array(buffer, layer.qOffset, layer.qLength)
      const scales = new Float32Array(buffer, layer.scaleOffset, layer.out)
      const bias = new Float32Array(buffer, layer.biasOffset, layer.out)
      const weight = new Float32Array(layer.in * layer.out)
      for (let row = 0; row < layer.out; row += 1) {
        const scale = scales[row]
        const base = row * layer.in
        for (let column = 0; column < layer.in; column += 1) {
          weight[base + column] = quantized[base + column] * scale
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
  }

  predict(sketch: Float32Array): Prediction[] {
    if (sketch.length !== 784) {
      throw new Error('sketch must be 28x28')
    }

    let activation = new Float32Array(sketch.length)
    for (let index = 0; index < sketch.length; index += 1) {
      activation[index] = sketch[index] / 255
    }

    for (const layer of this.layers) {
      const next = new Float32Array(layer.out)
      for (let row = 0; row < layer.out; row += 1) {
        let sum = layer.bias[row]
        const base = row * layer.in
        for (let column = 0; column < layer.in; column += 1) {
          sum += activation[column] * layer.weight[base + column]
        }
        next[row] = layer.relu ? (sum > 0 ? sum : 0) : sum
      }
      activation = next
    }

    let maximum = Number.NEGATIVE_INFINITY
    for (const value of activation) {
      if (value > maximum) maximum = value
    }
    let total = 0
    for (let index = 0; index < activation.length; index += 1) {
      activation[index] = Math.exp(activation[index] - maximum)
      total += activation[index]
    }

    const ranked = Array.from(activation, (value, index) => ({
      id: this.labels[index],
      confidence: value / total,
    }))
    ranked.sort((left, right) => right.confidence - left.confidence)
    return ranked.slice(0, 5)
  }
}

let classifierPromise: Promise<QuickDrawClassifier> | null = null
let loadedClassifier: QuickDrawClassifier | null = null

async function initialize(): Promise<QuickDrawClassifier> {
  const base = import.meta.env.BASE_URL
  const [metaResponse, weightsResponse] = await Promise.all([
    fetch(`${base}model/model.json`),
    fetch(`${base}model/weights.bin`),
  ])

  if (!metaResponse.ok) {
    throw new Error(`model.json ${metaResponse.status}`)
  }
  if (!weightsResponse.ok) {
    throw new Error(`weights.bin ${weightsResponse.status}`)
  }

  const meta = (await metaResponse.json()) as ModelMeta
  const weights = await weightsResponse.arrayBuffer()
  if (!meta.labels?.length || !meta.layers?.length) {
    throw new Error('invalid model metadata')
  }

  loadedClassifier = new QuickDrawClassifier(meta, weights)
  return loadedClassifier
}

export function loadClassifier(): Promise<QuickDrawClassifier> {
  if (!classifierPromise) {
    classifierPromise = initialize().catch((error: unknown) => {
      classifierPromise = null
      throw error
    })
  }
  return classifierPromise
}

export function getLoadedClassifier(): QuickDrawClassifier | null {
  return loadedClassifier
}
