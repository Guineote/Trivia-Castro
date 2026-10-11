import { getPrefs } from './prefs'

/**
 * Sonido con WebAudio: bleeps de arcade generados con osciladores (sin archivos de audio).
 * - Nada suena antes del primer gesto del usuario (política de autoplay): el AudioContext se
 *   crea y se reanuda en el primer pointerdown/keydown.
 * - El botón de mute es visible y persistente (lib/prefs.ts).
 */
export type SoundName =
  | 'click'
  | 'select'
  | 'tick'
  | 'ding'
  | 'correct'
  | 'wrong'
  | 'lifeLost'
  | 'power'
  | 'join'
  | 'swoosh'
  | 'double'
  | 'go'
  | 'fanfare'

interface Tone {
  freq: number
  /** Si se indica, la frecuencia se desliza hasta este valor. */
  to?: number
  /** Segundos desde el inicio del sonido. */
  at: number
  dur: number
  type?: OscillatorType
  gain?: number
}

const MASTER_GAIN = 0.14

/** Notas (Hz) para las melodías. */
const N = { C5: 523.25, E5: 659.25, G5: 783.99, C6: 1046.5, E6: 1318.5, A4: 440, F5: 698.46, D5: 587.33 }

const SOUNDS: Record<SoundName, Tone[]> = {
  click: [{ freq: 880, to: 660, at: 0, dur: 0.05, type: 'square', gain: 0.6 }],
  select: [
    { freq: 520, at: 0, dur: 0.06, type: 'square' },
    { freq: 780, at: 0.06, dur: 0.09, type: 'square' },
  ],
  tick: [{ freq: 1500, at: 0, dur: 0.03, type: 'square', gain: 0.5 }],
  ding: [{ freq: 1320, at: 0, dur: 0.09, type: 'triangle' }],
  correct: [
    { freq: N.C5, at: 0, dur: 0.09, type: 'square' },
    { freq: N.E5, at: 0.09, dur: 0.09, type: 'square' },
    { freq: N.G5, at: 0.18, dur: 0.09, type: 'square' },
    { freq: N.C6, at: 0.27, dur: 0.22, type: 'square' },
  ],
  wrong: [
    { freq: 320, to: 110, at: 0, dur: 0.38, type: 'sawtooth', gain: 0.9 },
    { freq: 300, to: 100, at: 0.04, dur: 0.38, type: 'square', gain: 0.4 },
  ],
  lifeLost: [
    { freq: 440, to: 90, at: 0, dur: 0.3, type: 'sawtooth' },
    { freq: 180, to: 60, at: 0.1, dur: 0.3, type: 'square', gain: 0.6 },
  ],
  power: [
    { freq: 300, to: 900, at: 0, dur: 0.18, type: 'square' },
    { freq: 900, to: 1400, at: 0.18, dur: 0.12, type: 'triangle' },
  ],
  join: [{ freq: 420, to: 880, at: 0, dur: 0.12, type: 'triangle' }],
  swoosh: [{ freq: 1200, to: 200, at: 0, dur: 0.22, type: 'sawtooth', gain: 0.25 }],
  double: [
    { freq: N.A4, at: 0, dur: 0.07, type: 'square' },
    { freq: N.D5, at: 0.07, dur: 0.07, type: 'square' },
    { freq: N.A4, at: 0.14, dur: 0.07, type: 'square' },
    { freq: N.E6, at: 0.21, dur: 0.2, type: 'square' },
  ],
  go: [
    { freq: N.G5, at: 0, dur: 0.1, type: 'square' },
    { freq: N.C6, at: 0.1, dur: 0.25, type: 'square' },
  ],
  fanfare: [
    { freq: N.C5, at: 0, dur: 0.14, type: 'square' },
    { freq: N.C5, at: 0.16, dur: 0.14, type: 'square' },
    { freq: N.C5, at: 0.32, dur: 0.14, type: 'square' },
    { freq: N.F5, at: 0.48, dur: 0.3, type: 'square' },
    { freq: N.E5, at: 0.82, dur: 0.14, type: 'square' },
    { freq: N.G5, at: 0.98, dur: 0.14, type: 'square' },
    { freq: N.C6, at: 1.14, dur: 0.6, type: 'square' },
    { freq: N.G5, at: 1.14, dur: 0.6, type: 'triangle', gain: 0.6 },
  ],
}

let ctx: AudioContext | null = null
let master: GainNode | null = null
let unlockInstalled = false

function createContext(): void {
  if (ctx) return
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return
  try {
    ctx = new Ctor()
    master = ctx.createGain()
    master.gain.value = MASTER_GAIN
    master.connect(ctx.destination)
  } catch {
    ctx = null
  }
}

/**
 * Desbloquea el audio en el primer gesto del usuario. Se llama una vez al arrancar la app.
 * Antes de ese gesto `play()` no hace nada (sin autoplay).
 */
export function installAudioUnlock(): void {
  if (unlockInstalled || typeof window === 'undefined') return
  unlockInstalled = true
  const unlock = () => {
    createContext()
    void ctx?.resume()
    if (ctx?.state === 'running') {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }
  window.addEventListener('pointerdown', unlock)
  window.addEventListener('keydown', unlock)
}

export function play(name: SoundName): void {
  if (getPrefs().muted || !ctx || !master || ctx.state !== 'running') return
  const start = ctx.currentTime + 0.005
  for (const tone of SOUNDS[name]) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = tone.type ?? 'square'
    osc.frequency.setValueAtTime(tone.freq, start + tone.at)
    if (tone.to) osc.frequency.exponentialRampToValueAtTime(tone.to, start + tone.at + tone.dur)
    const peak = tone.gain ?? 1
    // Envolvente corta: ataque inmediato y caída para evitar "clicks".
    gain.gain.setValueAtTime(0.0001, start + tone.at)
    gain.gain.exponentialRampToValueAtTime(peak, start + tone.at + 0.008)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + tone.at + tone.dur)
    osc.connect(gain)
    gain.connect(master)
    osc.start(start + tone.at)
    osc.stop(start + tone.at + tone.dur + 0.02)
  }
}
