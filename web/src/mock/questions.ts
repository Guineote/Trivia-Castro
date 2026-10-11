import type { Category, Difficulty } from '@/api/types'

/**
 * Banco de preguntas SOLO para el modo mock. Las categorías reales las define el seed
 * de Jared (10 categorías, el contrato solo da "c1 = Videojuegos" en los ejemplos);
 * los nombres de c2–c10 son inventados para desarrollar.
 */
export const MOCK_CATEGORIES: Category[] = [
  { id: 'c1', name: 'Videojuegos' },
  { id: 'c2', name: 'Cine' },
  { id: 'c3', name: 'Música' },
  { id: 'c4', name: 'Ciencia' },
  { id: 'c5', name: 'Historia' },
  { id: 'c6', name: 'Geografía' },
  { id: 'c7', name: 'Deportes' },
  { id: 'c8', name: 'Arte' },
  { id: 'c9', name: 'Tecnología' },
  { id: 'c10', name: 'Cultura general' },
]

export interface BankQuestion {
  id: string
  text: string
  categoryId: string
  difficulty: Difficulty
  /** Siempre 4 opciones (D4). */
  options: string[]
  /** Índice (0–3) de la opción correcta. */
  correct: number
}

export const QUESTION_BANK: BankQuestion[] = [
  { id: 'q27', text: '¿Año del primer PlayStation?', categoryId: 'c1', difficulty: 'MEDIUM', options: ['1992', '1994', '1996', '1998'], correct: 1 },
  { id: 'q1', text: '¿Cómo se llama el hermano de Mario?', categoryId: 'c1', difficulty: 'EASY', options: ['Wario', 'Toad', 'Luigi', 'Yoshi'], correct: 2 },
  { id: 'q2', text: '¿En qué película un pez payaso llamado Marlin busca a su hijo?', categoryId: 'c2', difficulty: 'EASY', options: ['Shrek', 'Buscando a Nemo', 'Cars', 'Up'], correct: 1 },
  { id: 'q3', text: '¿Cuántas cuerdas tiene una guitarra estándar?', categoryId: 'c3', difficulty: 'EASY', options: ['4', '5', '6', '7'], correct: 2 },
  { id: 'q4', text: '¿Qué planeta se conoce como el planeta rojo?', categoryId: 'c4', difficulty: 'EASY', options: ['Venus', 'Marte', 'Júpiter', 'Mercurio'], correct: 1 },
  { id: 'q5', text: '¿Cuál es el símbolo químico del oro?', categoryId: 'c4', difficulty: 'MEDIUM', options: ['Ag', 'Go', 'Au', 'Or'], correct: 2 },
  { id: 'q6', text: '¿En qué año llegó el ser humano a la Luna por primera vez?', categoryId: 'c5', difficulty: 'MEDIUM', options: ['1965', '1969', '1972', '1975'], correct: 1 },
  { id: 'q7', text: '¿Cuál es la capital de Japón?', categoryId: 'c6', difficulty: 'EASY', options: ['Seúl', 'Pekín', 'Bangkok', 'Tokio'], correct: 3 },
  { id: 'q8', text: '¿Cuál es el río más caudaloso de Sudamérica?', categoryId: 'c6', difficulty: 'MEDIUM', options: ['Amazonas', 'Orinoco', 'Paraná', 'Magdalena'], correct: 0 },
  { id: 'q9', text: '¿Cuántos jugadores de un equipo de fútbol están en la cancha?', categoryId: 'c7', difficulty: 'EASY', options: ['9', '10', '11', '12'], correct: 2 },
  { id: 'q10', text: '¿Quién pintó "La noche estrellada"?', categoryId: 'c8', difficulty: 'MEDIUM', options: ['Monet', 'Van Gogh', 'Picasso', 'Dalí'], correct: 1 },
  { id: 'q11', text: '¿Qué lenguaje ejecutan de forma nativa los navegadores web?', categoryId: 'c9', difficulty: 'EASY', options: ['Python', 'C++', 'Java', 'JavaScript'], correct: 3 },
  { id: 'q12', text: '¿Cuántos huesos tiene el cuerpo humano adulto?', categoryId: 'c10', difficulty: 'HARD', options: ['186', '206', '226', '256'], correct: 1 },
  { id: 'q13', text: '¿En qué año cayó el Muro de Berlín?', categoryId: 'c5', difficulty: 'HARD', options: ['1985', '1987', '1989', '1991'], correct: 2 },
  { id: 'q14', text: '¿En qué país se celebraron los Juegos Olímpicos de 2016?', categoryId: 'c7', difficulty: 'MEDIUM', options: ['Reino Unido', 'China', 'Brasil', 'Japón'], correct: 2 },
]
