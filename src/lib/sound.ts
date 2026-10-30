import clickUrl from '../assets/sounds/click.wav'
import failUrl from '../assets/sounds/fail.mp3'
import strokeUrl from '../assets/sounds/stroke.mp3'
import successUrl from '../assets/sounds/success.mp3'
import undoUrl from '../assets/sounds/undo.mp3'

export type SoundName = 'click' | 'stroke' | 'success' | 'fail' | 'undo'

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

let enabled = false
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

export function isSoundEnabled(): boolean {
  return enabled
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
