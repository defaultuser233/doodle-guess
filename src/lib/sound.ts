// 音效暂时关闭：录好的 CC0 样片还留在 src/assets/sounds/，等找到更合适的素材再恢复。
// 恢复步骤：
// 1. 取消本文件下面整段注释，并删掉文件末尾的空实现；
// 2. 把 src/lib/sound.test.ts 的 describe.skip 改回 describe；
// 3. 取消 HomeScreen / DrawScreen 中音效按钮及其 props 解构的注释。

export type SoundName = 'click' | 'stroke' | 'success' | 'fail' | 'undo'

let enabled = false

export function setSoundEnabled(value: boolean): void {
  enabled = value
}

export function isSoundEnabled(): boolean {
  return enabled
}

export function playSound(_name: SoundName): void {
  // 音效暂时关闭，不播放任何声音。
}

/* 原始实现，恢复时取消注释：
import clickUrl from '../assets/sounds/click.wav'
import failUrl from '../assets/sounds/fail.mp3'
import strokeUrl from '../assets/sounds/stroke.mp3'
import successUrl from '../assets/sounds/success.mp3'
import undoUrl from '../assets/sounds/undo.mp3'

// Recorded samples (CC0, see docs/CREDITS.md), decoded once and replayed
// through Web Audio so overlapping strokes do not restart each other.
const SOUND_SOURCES: Record<SoundName, string> = {
  click: clickUrl,
  stroke: strokeUrl,
  success: successUrl,
  fail: failUrl,
  undo: undoUrl,
}

const SOUND_GAINS: Record<SoundName, number> = {
  click: 0.45,
  stroke: 0.4,
  undo: 0.45,
  success: 0.65,
  fail: 0.5,
}

const SOUND_NAMES = Object.keys(SOUND_SOURCES) as SoundName[]

let context: AudioContext | null = null

const buffers = new Map<SoundName, AudioBuffer>()
const pending = new Map<SoundName, Promise<AudioBuffer | null>>()

function ensureContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!context) {
    const AudioContextClass =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext
    if (!AudioContextClass) return null
    try {
      context = new AudioContextClass()
    } catch {
      return null
    }
  }
  if (context.state === 'suspended') {
    void context.resume()
  }
  return context
}

function decode(audio: AudioContext, data: ArrayBuffer): Promise<AudioBuffer> {
  return new Promise((resolve, reject) => {
    audio.decodeAudioData(data, resolve, reject)
  })
}

function loadSound(name: SoundName, audio: AudioContext): Promise<AudioBuffer | null> {
  const cached = buffers.get(name)
  if (cached) return Promise.resolve(cached)
  const inFlight = pending.get(name)
  if (inFlight) return inFlight

  const task = fetch(SOUND_SOURCES[name])
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return response.arrayBuffer()
    })
    .then((data) => decode(audio, data))
    .then((buffer) => {
      buffers.set(name, buffer)
      return buffer
    })
    .catch(() => null)
    .finally(() => {
      pending.delete(name)
    })

  pending.set(name, task)
  return task
}

function playBuffer(audio: AudioContext, name: SoundName, buffer: AudioBuffer): void {
  const source = audio.createBufferSource()
  const gain = audio.createGain()
  source.buffer = buffer
  gain.gain.setValueAtTime(SOUND_GAINS[name], audio.currentTime)
  source.connect(gain).connect(audio.destination)
  source.start()
}

export function setSoundEnabled(value: boolean): void {
  enabled = value
  if (!value) return
  const audio = ensureContext()
  if (!audio) return
  for (const name of SOUND_NAMES) {
    void loadSound(name, audio)
  }
}

export function playSound(name: SoundName): void {
  if (!enabled) return
  const audio = ensureContext()
  if (!audio) return
  const buffer = buffers.get(name)
  if (!buffer) {
    void loadSound(name, audio)
    return
  }
  playBuffer(audio, name, buffer)
}
*/
