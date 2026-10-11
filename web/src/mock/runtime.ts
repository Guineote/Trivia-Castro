import type { Simulator } from './simulator'

let simulator: Simulator | null = null

/** Simulador activo (null si no se está en modo mock). Lo usa el DevPanel. */
export function getSimulator(): Simulator | null {
  return simulator
}

export function setSimulator(next: Simulator | null): void {
  simulator = next
}

export function isMockEnabled(): boolean {
  return import.meta.env.VITE_USE_MOCK === 'true'
}
