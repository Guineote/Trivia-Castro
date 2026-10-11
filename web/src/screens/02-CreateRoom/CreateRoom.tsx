import { useMutation, useQuery } from '@tanstack/react-query'
import { motion } from 'motion/react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { api } from '@/api/endpoints'
import { messageFromError } from '@/api/errors'
import { updateSession } from '@/api/session'
import { Panel } from '@/components/Panel/Panel'
import { PixelButton } from '@/components/PixelButton/PixelButton'
import { PixelSlider } from '@/components/PixelSlider/PixelSlider'
import { glitchIn } from '@/lib/motion'
import { DEFAULT_SETTINGS, SETTINGS_RANGES } from '@/lib/settingsRanges'
import styles from './CreateRoom.module.css'

/** 02 · Crear sala: ajustes y POST /rooms. El creador queda como host y primer participante (D2). */
export default function CreateRoom() {
  const navigate = useNavigate()
  const [maxPlayers, setMaxPlayers] = useState(DEFAULT_SETTINGS.maxPlayers)
  const [rounds, setRounds] = useState(DEFAULT_SETTINGS.rounds)
  const [lives, setLives] = useState(DEFAULT_SETTINGS.lives)
  const [categoryIds, setCategoryIds] = useState<string[]>([])

  const categories = useQuery({ queryKey: ['categories'], queryFn: () => api.getCategories(), staleTime: Infinity, retry: false })

  const create = useMutation({
    mutationFn: () => api.createRoom({ maxPlayers, rounds, lives, categoryIds }),
    onSuccess: (room) => {
      updateSession({ participantId: room.participantId, roomCode: room.code })
      navigate(`/sala/${room.code}`)
    },
  })

  const toggle = (id: string) =>
    setCategoryIds((current) => (current.includes(id) ? current.filter((c) => c !== id) : [...current, id]))

  return (
    <main className={styles.page}>
      <motion.div className={styles.wrap} {...glitchIn('bottom')}>
        <Panel title="CREAR SALA" tilt={-0.5}>
          <form
            className={styles.form}
            onSubmit={(event) => {
              event.preventDefault()
              create.mutate()
            }}
          >
            <PixelSlider label="JUGADORES MAXIMO" value={maxPlayers} onChange={setMaxPlayers} {...SETTINGS_RANGES.maxPlayers} />
            <PixelSlider label="RONDAS" value={rounds} onChange={setRounds} {...SETTINGS_RANGES.rounds} />
            <PixelSlider label="VIDAS" value={lives} onChange={setLives} {...SETTINGS_RANGES.lives} />

            <fieldset className={styles.categories}>
              <legend className={styles.legend}>CATEGORIAS {categoryIds.length === 0 ? '(TODAS)' : `(${categoryIds.length})`}</legend>
              {categories.isPending ? <p className={styles.hint}>Cargando categorías...</p> : null}
              {categories.isError ? <p className={styles.hint}>No se pudieron cargar: se usarán todas.</p> : null}
              <ul className={styles.chips}>
                {categories.data?.items.map((category) => {
                  const on = categoryIds.includes(category.id)
                  return (
                    <li key={category.id}>
                      <button
                        type="button"
                        className={[styles.chip, on ? styles.on : ''].filter(Boolean).join(' ')}
                        aria-pressed={on}
                        onClick={() => toggle(category.id)}
                      >
                        {category.name}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </fieldset>

            <p className={styles.error} role="alert">
              {create.isError ? messageFromError(create.error) : ''}
            </p>

            <div className={styles.actions}>
              <PixelButton type="submit" size="lg" color="magenta" block disabled={create.isPending}>
                {create.isPending ? '...' : 'CREAR SALA'}
              </PixelButton>
              <PixelButton color="ghost" block onClick={() => navigate('/')}>
                VOLVER
              </PixelButton>
            </div>
          </form>
        </Panel>
      </motion.div>
    </main>
  )
}
