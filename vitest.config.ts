import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/**
 * Configuración de Vitest para la suite de seguridad clínica.
 *
 * `include` se limita a los tests escritos en formato Vitest (determinismo del
 * motor de reglas, schema del CMD y hash del RUT). Los archivos legacy bajo
 * __tests__/safety/ son scripts standalone (se ejecutan con tsx) y se excluyen
 * para no mezclar runners.
 */
export default defineConfig({
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url)),
        },
    },
    test: {
        environment: 'node',
        include: [
            '__tests__/safety/rule-engine-determinism.test.ts',
            '__tests__/safety/cmd-schema.test.ts',
            '__tests__/safety/rut-hash.test.ts',
            '__tests__/safety/fhir-observation.test.ts',
        ],
    },
});
