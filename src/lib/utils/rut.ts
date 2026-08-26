/**
 * Validación de RUT chileno (PRD D1, RF-29).
 *
 * Módulo PURO. Verifica el dígito verificador con el algoritmo módulo 11, de
 * modo que un RUT mal tipeado se rechace ANTES de crear la cita y no llegue al
 * centro un paciente que no existe.
 *
 * No confundir con `hashRut` de anonymousCode.ts, que deriva el código de
 * seguimiento. Aquí solo se valida la forma.
 */

/** Quita puntos, guiones y espacios, y normaliza el dígito verificador. */
export function normalizeRut(rut: string): string {
    return (rut ?? '').replace(/[.\-\s]/g, '').toUpperCase();
}

/**
 * Valida un RUT chileno completo (cuerpo + dígito verificador).
 *
 * Acepta cualquier formato habitual: con puntos, sin puntos, con o sin guion,
 * con la K en mayúscula o minúscula.
 */
export function isValidRut(rut: string | null | undefined): boolean {
    const normalized = normalizeRut(rut ?? '');
    // Cuerpo de 7 u 8 dígitos + 1 verificador.
    if (!/^\d{7,8}[\dK]$/.test(normalized)) return false;

    const body = normalized.slice(0, -1);
    const checkDigit = normalized.slice(-1);

    // Módulo 11 con serie de multiplicadores 2..7 recorriendo de derecha a izquierda.
    let sum = 0;
    let multiplier = 2;
    for (let i = body.length - 1; i >= 0; i--) {
        sum += Number(body[i]) * multiplier;
        multiplier = multiplier === 7 ? 2 : multiplier + 1;
    }

    const remainder = 11 - (sum % 11);
    const expected = remainder === 11 ? '0' : remainder === 10 ? 'K' : String(remainder);

    return expected === checkDigit;
}

/** Formato de presentación 12.345.678-5. Devuelve la entrada si no es válido. */
export function formatRut(rut: string): string {
    const normalized = normalizeRut(rut);
    if (!/^\d{7,8}[\dK]$/.test(normalized)) return rut;
    const body = normalized.slice(0, -1);
    const checkDigit = normalized.slice(-1);
    const withDots = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `${withDots}-${checkDigit}`;
}
