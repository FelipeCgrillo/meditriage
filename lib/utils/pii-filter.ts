/**
 * PII Filter Utility
 * 
 * This utility provides functions to sanitize text before sending it to AI models.
 * It targets personally identifiable information (PII) relevant to the Chilean context.
 * Complies with Law 19.628 on private life protection.
 */

// REGEX PATTERNS
// 1. Chilean RUT: supports formats like 12345678-9, 12.345.678-9, 12,345,678-k
const RUT_REGEX = /\b(\d{1,2}(?:\.?\d{3}){2}-?[\dkK])\b/g;

// 2. Email addresses
const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;

// 3. Phone numbers (Chilean and general formats)
// Supports +56 9 1234 5678, 912345678, +56912345678, etc.
const PHONE_REGEX = /(\+?56\s?9?\s?\d{4}\s?\d{4})|(\b9\d{8}\b)|(\b\d{8}\b)/g;

/**
 * Sanitizes text by replacing PII with placeholders.
 * 
 * @param text The clinical text to sanitize
 * @returns The sanitized text
 */
export function sanitizeForAI(text: string): string {
    if (!text) return text;

    let sanitized = text;

    // Replace RUTs
    sanitized = sanitized.replace(RUT_REGEX, '[RUT REDACTADO]');

    // Replace Emails
    sanitized = sanitized.replace(EMAIL_REGEX, '[EMAIL REDACTADO]');

    // Replace Phones
    sanitized = sanitized.replace(PHONE_REGEX, '[TELÉFONO REDACTADO]');

    return sanitized;
}

/**
 * Helper to check if text contains PII
 */
export function hasPII(text: string): boolean {
    return RUT_REGEX.test(text) || EMAIL_REGEX.test(text) || PHONE_REGEX.test(text);
}
