import { useRef, type ClipboardEvent, type KeyboardEvent } from 'react'
import { CODE_LENGTH, cleanCode } from './code'
import styles from './CodeInput.module.css'

interface CodeInputProps {
  value: string
  onChange: (value: string) => void
  /** Enter con el código completo. */
  onSubmit?: () => void
  invalid?: boolean
  autoFocus?: boolean
  disabled?: boolean
}

/** 6 casillas con auto-avance, retroceso con Backspace, flechas y pegado de código completo. */
export function CodeInput({ value, onChange, onSubmit, invalid = false, autoFocus = false, disabled = false }: CodeInputProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([])
  const focusAt = (index: number) => refs.current[Math.max(0, Math.min(CODE_LENGTH - 1, index))]?.focus()

  function type(index: number, raw: string) {
    const typed = cleanCode(raw)
    if (!typed) return
    // Se escribe siempre pegado al final: no se dejan huecos en el código.
    const at = Math.min(index, value.length)
    const next = cleanCode(value.slice(0, at) + typed + value.slice(at + typed.length))
    onChange(next)
    focusAt(Math.min(at + typed.length, CODE_LENGTH - 1))
  }

  function onKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Backspace') {
      event.preventDefault()
      if (value[index]) onChange(value.slice(0, index) + value.slice(index + 1))
      else if (index > 0) {
        onChange(value.slice(0, index - 1) + value.slice(index))
        focusAt(index - 1)
      }
    } else if (event.key === 'ArrowLeft') {
      focusAt(index - 1)
    } else if (event.key === 'ArrowRight') {
      focusAt(index + 1)
    } else if (event.key === 'Enter' && value.length === CODE_LENGTH) {
      onSubmit?.()
    }
  }

  function onPaste(event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault()
    const pasted = cleanCode(event.clipboardData.getData('text'))
    if (!pasted) return
    onChange(pasted)
    focusAt(pasted.length)
  }

  return (
    <div className={[styles.row, invalid ? styles.invalid : ''].filter(Boolean).join(' ')} role="group" aria-label="Código de sala">
      {Array.from({ length: CODE_LENGTH }, (_, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el
          }}
          className={styles.cell}
          value={value[i] ?? ''}
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          maxLength={CODE_LENGTH}
          disabled={disabled}
          // Solo al montar: enfoca la primera casilla vacía.
          autoFocus={autoFocus && i === Math.min(value.length, CODE_LENGTH - 1)}
          aria-label={`Carácter ${i + 1} de ${CODE_LENGTH}`}
          aria-invalid={invalid ? true : undefined}
          // Si la casilla ya tenía un carácter, el navegador devuelve dos: vale el último que se tecleó.
          onChange={(event) => type(i, event.target.value.length > 1 && value[i] ? event.target.value.slice(-1) : event.target.value)}
          onKeyDown={(event) => onKeyDown(i, event)}
          onPaste={onPaste}
          onFocus={(event) => event.target.select()}
        />
      ))}
    </div>
  )
}
