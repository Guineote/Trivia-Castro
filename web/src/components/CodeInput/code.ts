export const CODE_LENGTH = 6

/** Solo letras y números, en mayúsculas, máximo 6 (códigos como K7X4QM). */
export const cleanCode = (raw: string): string => raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LENGTH)
