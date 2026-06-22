import { describe, it, expect } from 'vitest';
import { hashRut, isValidAnonymousCode } from '@/lib/utils/anonymousCode';

/**
 * Tests del hash determinista del RUT (anonimización en cliente).
 *
 * Propiedades verificadas:
 *  - DETERMINISMO: mismo RUT → mismo código, en cualquier formato.
 *  - FORMATO: el código derivado cumple el formato ABC-123 ya usado en la UI.
 *  - SEPARACIÓN: distintos RUTs (o distinto salt) producen códigos distintos.
 *
 * Nota: el RUT se hashea con SHA-256 (Web Crypto) y nunca se almacena en claro.
 */

describe('hashRut — anonimización determinista', () => {
    it('es determinista: el mismo RUT produce el mismo código', async () => {
        const a = await hashRut('12.345.678-5');
        const b = await hashRut('12.345.678-5');
        expect(a).toBe(b);
    });

    it('normaliza el formato: con o sin puntos/guion da el mismo código', async () => {
        const conFormato = await hashRut('12.345.678-5');
        const sinFormato = await hashRut('123456785');
        const conGuion = await hashRut('12345678-5');
        expect(conFormato).toBe(sinFormato);
        expect(conFormato).toBe(conGuion);
    });

    it('normaliza el dígito verificador k/K', async () => {
        const minus = await hashRut('11.111.111-k');
        const mayus = await hashRut('11.111.111-K');
        expect(minus).toBe(mayus);
    });

    it('produce un código con el formato ABC-123 válido', async () => {
        const code = await hashRut('5.126.663-3');
        expect(isValidAnonymousCode(code)).toBe(true);
    });

    it('RUTs distintos producen (con altísima probabilidad) códigos distintos', async () => {
        const a = await hashRut('12.345.678-5');
        const b = await hashRut('98.765.432-1');
        expect(a).not.toBe(b);
    });

    it('el salt separa dominios: mismo RUT con distinto salt difiere', async () => {
        const sinSalt = await hashRut('12.345.678-5');
        const conSalt = await hashRut('12.345.678-5', 'estudio-A');
        expect(sinSalt).not.toBe(conSalt);
    });
});
