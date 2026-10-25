let enabled = false
let context: AudioContext | null = null

function ensureContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!context) {
    const AudioContextClass =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext
    if (!AudioContextClass) return null
    context = new AudioContextClass()
  }
  if (context.state === 'suspended') {
    void context.resume()
  }
  return context
}

function tone(
  frequency: number,
  duration: number,
  type: OscillatorType,
  volume: number,
  delay = 0,
  slideTo?: number,
): void {
  const audio = ensureContext()
  if (!audio) return
  const start = audio.currentTime + delay
  const oscillator = audio.createOscillator()
  const gain = audio.createGain()
  oscillator.type = type
  oscillator.frequency.setValueAtTime(frequency, start)
  if (slideTo) {
    oscillator.frequency.exponentialRampToValueAtTime(slideTo, start + duration)
  }
  gain.gain.setValueAtTime(0, start)
  gain.gain.linearRampToValueAtTime(volume, start + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  oscillator.connect(gain).connect(audio.destination)
  oscillator.start(start)
  oscillator.stop(start + duration + 0.02)
}

function brushNoise(volume: number): void {
  const audio = ensureContext()
  if (!audio) return
  const duration = 0.09
  const buffer = audio.createBuffer(1, Math.floor(audio.sampleRate * duration), audio.sampleRate)
  const data = buffer.getChannelData(0)
  for (let index = 0; index < data.length; index += 1) {
    data[index] = (Math.random() * 2 - 1) * (1 - index / data.length)
  }
  const source = audio.createBufferSource()
  source.buffer = buffer
  const filter = audio.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = 2100
  filter.Q.value = 0.8
  const gain = audio.createGain()
  gain.gain.value = volume
  source.connect(filter).connect(gain).connect(audio.destination)
  source.start()
}

export function setSoundEnabled(value: boolean): void {
  enabled = value
  if (value) ensureContext()
}

export function isSoundEnabled(): boolean {
  return enabled
}

export type SoundName = 'click' | 'stroke' | 'success' | 'fail' | 'undo'

export function playSound(name: SoundName): void {
  if (!enabled) return
  switch (name) {
    case 'click':
      tone(600, 0.045, 'triangle', 0.025)
      break
    case 'stroke':
      brushNoise(0.022)
      break
    case 'undo':
      tone(420, 0.06, 'sine', 0.02, 0, 320)
      break
    case 'success':
      tone(523.25, 0.16, 'triangle', 0.05, 0)
      tone(659.25, 0.16, 'triangle', 0.05, 0.11)
      tone(783.99, 0.26, 'triangle', 0.05, 0.22)
      tone(1046.5, 0.3, 'sine', 0.035, 0.34)
      break
    case 'fail':
      tone(330, 0.15, 'sine', 0.035, 0)
      tone(247, 0.24, 'sine', 0.035, 0.14)
      break
  }
}
