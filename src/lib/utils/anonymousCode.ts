/**
 * Anonymous Patient Code Generator
 * 
 * Generates a unique, human-readable code for patient identification
 * Format: ABC-123 (3 letters + hyphen + 3 numbers)
 * 
 * Uses characters that are easy to read and communicate verbally:
 * - Excludes confusing letters: I, L, O (look like 1, 1, 0)
 * - Excludes confusing numbers: 0, 1 (look like O, I/L)
 */

// Allowed characters (excluding confusing ones)
const ALLOWED_LETTERS = 'ABCDEFGHJKMNPQRSTUVWXYZ'; // 22 letters (no I, L, O)
const ALLOWED_NUMBERS = '23456789'; // 7 numbers (no 0, 1)

/**
 * Generates a random anonymous code in format ABC-123
 * @returns A 7-character code like "XYZ-456"
 */
export function generateAnonymousCode(): string {
    let code = '';

    // Generate 3 random letters
    for (let i = 0; i < 3; i++) {
        const randomIndex = Math.floor(Math.random() * ALLOWED_LETTERS.length);
        code += ALLOWED_LETTERS.charAt(randomIndex);
    }

    // Add separator
    code += '-';

    // Generate 3 random numbers
    for (let i = 0; i < 3; i++) {
        const randomIndex = Math.floor(Math.random() * ALLOWED_NUMBERS.length);
        code += ALLOWED_NUMBERS.charAt(randomIndex);
    }

    return code;
}

/**
 * Normaliza un RUT chileno para hashing determinista.
 * Quita puntos, guiones y espacios, y pasa el dígito verificador a mayúscula.
 * Así "12.345.678-k", "12345678-K" y "123456 78k" producen el mismo hash.
 */
function normalizeRut(rut: string): string {
    return rut.replace(/[.\-\s]/g, '').toUpperCase();
}

/**
 * Deriva un código anónimo DETERMINISTA en formato ABC-123 a partir de un
 * RUT, usando SHA-256 (Web Crypto API, disponible en edge y en el navegador).
 *
 * Propiedades:
 *  - DETERMINISTA: el mismo RUT (con el mismo salt) produce SIEMPRE el mismo
 *    código. Esto permite vincular registros del mismo paciente sin almacenar
 *    el RUT.
 *  - El RUT se hashea EN CLIENTE y NUNCA se envía ni se almacena en claro
 *    (coherente con el filtro PII y la Ley 19.628). Solo viaja/persiste el
 *    código derivado.
 *  - El salt opcional permite separar dominios (p. ej. por estudio) sin
 *    cambiar el algoritmo.
 *
 * El hash hex se mapea al alfabeto legible (sin I/L/O ni 0/1) para mantener
 * el formato ABC-123 ya usado en la UI.
 *
 * @param rut  RUT del paciente (cualquier formato chileno habitual).
 * @param salt Salt opcional para separar dominios de identificación.
 * @returns    Código determinista en formato ABC-123.
 */
export async function hashRut(rut: string, salt: string = ''): Promise<string> {
    const normalized = normalizeRut(rut);
    const data = new TextEncoder().encode(`${salt}:${normalized}`);
    const digest = await crypto.subtle.digest('SHA-256', data);
    const bytes = new Uint8Array(digest);

    let code = '';
    // 3 letras del alfabeto permitido, derivadas de los primeros 3 bytes.
    for (let i = 0; i < 3; i++) {
        code += ALLOWED_LETTERS.charAt(bytes[i] % ALLOWED_LETTERS.length);
    }
    code += '-';
    // 3 números del alfabeto permitido, derivados de los 3 bytes siguientes.
    for (let i = 0; i < 3; i++) {
        code += ALLOWED_NUMBERS.charAt(bytes[i + 3] % ALLOWED_NUMBERS.length);
    }

    return code;
}

/**
 * Validates that a code matches the expected format
 * @param code - The code to validate
 * @returns true if valid, false otherwise
 */
export function isValidAnonymousCode(code: string): boolean {
    if (!code || typeof code !== 'string') return false;

    // Pattern: 3 allowed letters, hyphen, 3 allowed numbers
    const pattern = new RegExp(`^[${ALLOWED_LETTERS}]{3}-[${ALLOWED_NUMBERS}]{3}$`);
    return pattern.test(code);
}
