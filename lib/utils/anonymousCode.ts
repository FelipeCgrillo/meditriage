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
