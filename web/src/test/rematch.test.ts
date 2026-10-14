import { describe, expect, it } from 'vitest'
import { createSimulator } from '@/mock/simulator'
import { rematchGameId } from '@/screens/game/useRematch'

function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function finishedGame() {
  let time = 1_800_000_000_000
  const sim = createSimulator({ now: () => time, random: mulberry32(11), botsInRoom: () => false })
  const ana = sim.authenticate(sim.createPlayer('Ana').token)
  const beto = sim.authenticate(sim.createPlayer('Beto').token)
  const room = sim.createRoom(ana, { rounds: 2 })
  sim.joinRoom(beto, room.code)
  const { gameId } = sim.startGame(ana, room.code)
  sim.dev.goToPhase(gameId, 'QUESTION')
  sim.usePower(ana, gameId, 1, 'SHIELD') // Ana gasta el escudo en la partida 1
  time += 10 * 60 * 1000
  expect(sim.getState(ana, gameId).state.phase).toBe('FINAL')
  return { sim, ana, beto, room, gameId, advance: (ms: number) => (time += ms) }
}

describe('revancha (D13) en el simulador', () => {
  it('el host inicia otra partida desde una sala FINISHED y todo se reinicia', () => {
    const { sim, ana, beto, room, gameId } = finishedGame()
    expect(sim.getRoom(room.code).status).toBe('FINISHED')
    expect(() => sim.startGame(beto, room.code)).toThrowError(expect.objectContaining({ code: 'NOT_HOST' }))

    const second = sim.startGame(ana, room.code)
    expect(second.gameId).not.toBe(gameId)
    expect(sim.getRoom(room.code)).toMatchObject({ status: 'IN_GAME', currentGameId: second.gameId })

    const { me } = sim.getState(ana, second.gameId).state
    expect(me).toMatchObject({ score: 0, lives: 3, status: 'ACTIVE', lastResult: null, activePower: null })
    expect(me.powers.map((p) => p.powerType).sort()).toEqual(['DOUBLE', 'HINT', 'SHIELD'])
  })

  it('con una partida en curso no se puede iniciar otra', () => {
    const { sim, ana, room } = finishedGame()
    sim.startGame(ana, room.code)
    expect(() => sim.startGame(ana, room.code)).toThrowError(expect.objectContaining({ code: 'GAME_ALREADY_STARTED' }))
  })

  it('salir tras la partida conserva la fila (como la API real); en la sala de espera sí la quita', () => {
    const { sim, beto, room } = finishedGame()
    const betoId = sim.getRoom(room.code).participants.find((p) => p.nickname === 'Beto')!.participantId
    sim.leaveRoom(beto, room.code, betoId)
    expect(sim.getRoom(room.code).participants).toHaveLength(2)

    const waiting = sim.createRoom(sim.authenticate(sim.createPlayer('Caro').token))
    const dani = sim.authenticate(sim.createPlayer('Dani').token)
    const joined = sim.joinRoom(dani, waiting.code).body
    sim.leaveRoom(dani, waiting.code, joined.participantId)
    expect(sim.getRoom(waiting.code).participants).toHaveLength(1)
  })

  it('lastResult trae powerUsed: el escudo absorbe el fallo', () => {
    let time = 1_800_000_000_000
    const sim = createSimulator({ now: () => time, random: mulberry32(5), botsInRoom: () => false })
    const ana = sim.authenticate(sim.createPlayer('Ana').token)
    const beto = sim.authenticate(sim.createPlayer('Beto').token)
    const room = sim.createRoom(ana, { rounds: 2 })
    sim.joinRoom(beto, room.code)
    const { gameId } = sim.startGame(ana, room.code)
    sim.dev.goToPhase(gameId, 'QUESTION')
    sim.usePower(ana, gameId, 1, 'SHIELD')
    time += 20000 // timeout con escudo
    const { me } = sim.getState(ana, gameId).state
    expect(me.lastResult).toMatchObject({ livesLost: 0, isCorrect: false, powerUsed: 'SHIELD' })
  })
})

describe('rematchGameId', () => {
  it('solo hay revancha si la sala apunta a otra partida distinta de la que se ve', () => {
    expect(rematchGameId(undefined, 'g1')).toBeNull()
    expect(rematchGameId({ currentGameId: null }, 'g1')).toBeNull()
    expect(rematchGameId({ currentGameId: 'g1' }, 'g1')).toBeNull()
    expect(rematchGameId({ currentGameId: 'g2' }, 'g1')).toBe('g2')
  })
})
