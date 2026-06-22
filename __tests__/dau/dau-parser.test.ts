import { describe, it, expect } from 'vitest';
import {
    parseDAUJson,
    parseDAUCsv,
    parseDAUFile,
    ageGroupFromYears,
} from '@/lib/dau/parser';

describe('parseDAUJson', () => {
    it('parsea un arreglo directo con claves canónicas', () => {
        const { records, errors } = parseDAUJson([
            {
                record_id: 'A1',
                chief_complaint: 'dolor de pecho',
                reported_symptoms: 'desde hace 2 horas',
                sex: 'M',
                age_years: 60,
                nurse_esi: 2,
            },
        ]);
        expect(errors).toHaveLength(0);
        expect(records).toHaveLength(1);
        expect(records[0]).toMatchObject({
            record_id: 'A1',
            chief_complaint: 'dolor de pecho',
            sex: 'M',
            age_years: 60,
            nurse_esi: 2,
        });
    });

    it('acepta { records: [...] }', () => {
        const { records } = parseDAUJson({
            records: [{ chief_complaint: 'cefalea' }],
        });
        expect(records).toHaveLength(1);
        expect(records[0].chief_complaint).toBe('cefalea');
    });

    it('remapea claves en español vía alias', () => {
        const { records } = parseDAUJson([
            {
                folio: 'X9',
                motivo_consulta: 'fiebre',
                sintomas: 'tos seca',
                sexo: 'femenino',
                edad: 30,
                esi_enfermera: 'C3',
            },
        ]);
        expect(records[0]).toMatchObject({
            record_id: 'X9',
            chief_complaint: 'fiebre',
            reported_symptoms: 'tos seca',
            sex: 'F',
            age_years: 30,
            nurse_esi: 3,
        });
    });

    it('descarta filas sin chief_complaint y registra el error', () => {
        const { records, errors } = parseDAUJson([
            { chief_complaint: 'ok' },
            { reported_symptoms: 'sin motivo' },
        ]);
        expect(records).toHaveLength(1);
        expect(errors).toHaveLength(1);
        expect(errors[0].row).toBe(2);
    });

    it('deriva age_group desde age_years cuando falta', () => {
        const { records } = parseDAUJson([
            { chief_complaint: 'x', age_years: 10 },
            { chief_complaint: 'y', age_years: 40 },
            { chief_complaint: 'z', age_years: 70 },
        ]);
        expect(records[0].age_group).toBe('Pediatric');
        expect(records[1].age_group).toBe('Adult');
        expect(records[2].age_group).toBe('Geriatric');
    });

    it('NUNCA expone columnas de signos vitales instrumentados', () => {
        const { records } = parseDAUJson([
            {
                chief_complaint: 'disnea',
                presion_arterial: '180/110',
                frecuencia_cardiaca: 130,
                saturacion: 88,
                temperatura: 39.5,
            },
        ]);
        // El record solo tiene los campos del contrato DAU; ninguna vital instrumentada.
        expect(Object.keys(records[0]).sort()).toEqual(
            [
                'record_id',
                'age_years',
                'age_group',
                'sex',
                'admission_datetime',
                'chief_complaint',
                'reported_symptoms',
                'nurse_esi',
            ].sort(),
        );
        // Cualquier serialización del record no contiene los valores instrumentados.
        const serialized = JSON.stringify(records[0]);
        expect(serialized).not.toContain('180/110');
        expect(serialized).not.toContain('130');
        expect(serialized).not.toContain('88');
        expect(serialized).not.toContain('39.5');
    });

    it('rechaza nurse_esi fuera de rango 1..5', () => {
        const { records } = parseDAUJson([
            { chief_complaint: 'a', esi_enfermera: 0 },
            { chief_complaint: 'b', esi_enfermera: 6 },
            { chief_complaint: 'c', esi_enfermera: 'foo' },
        ]);
        expect(records.every((r) => r.nurse_esi === null)).toBe(true);
    });
});

describe('parseDAUCsv', () => {
    it('parsea CSV con cabeceras en español y delimitador coma', () => {
        const csv = [
            'folio,motivo_consulta,sintomas,sexo,edad,esi_enfermera',
            'A1,dolor toracico,opresion,M,55,2',
            'A2,cefalea,leve,F,30,4',
        ].join('\n');
        const { records, errors } = parseDAUCsv(csv);
        expect(errors).toHaveLength(0);
        expect(records).toHaveLength(2);
        expect(records[0]).toMatchObject({ chief_complaint: 'dolor toracico', nurse_esi: 2, sex: 'M' });
        expect(records[1]).toMatchObject({ chief_complaint: 'cefalea', nurse_esi: 4, sex: 'F' });
    });

    it('soporta delimitador punto y coma y comillas con comas internas', () => {
        const csv = [
            'motivo_consulta;sintomas',
            '"dolor, intenso";"nausea, vomito"',
        ].join('\n');
        const { records } = parseDAUCsv(csv);
        expect(records[0].chief_complaint).toBe('dolor, intenso');
        expect(records[0].reported_symptoms).toBe('nausea, vomito');
    });

    it('falla si no hay columna de motivo de consulta', () => {
        const csv = 'sintomas,edad\ntos,40';
        const { records, errors } = parseDAUCsv(csv);
        expect(records).toHaveLength(0);
        expect(errors[0].reason).toMatch(/motivo de consulta/i);
    });

    it('ignora columnas de signos vitales instrumentados en CSV', () => {
        const csv = [
            'motivo_consulta,presion_arterial,frecuencia_cardiaca,saturacion',
            'disnea,180/110,130,88',
        ].join('\n');
        const { records } = parseDAUCsv(csv);
        const serialized = JSON.stringify(records[0]);
        expect(serialized).not.toContain('180/110');
        expect(serialized).not.toContain('130');
        expect(serialized).not.toContain('88');
    });
});

describe('parseDAUFile', () => {
    it('detecta JSON por el primer carácter', () => {
        const { records } = parseDAUFile('[{"motivo_consulta":"x"}]');
        expect(records).toHaveLength(1);
    });

    it('detecta CSV cuando no empieza con { o [', () => {
        const { records } = parseDAUFile('motivo_consulta\nx');
        expect(records).toHaveLength(1);
    });

    it('reporta JSON inválido como error no fatal', () => {
        const { records, errors } = parseDAUFile('[{ malformado ');
        expect(records).toHaveLength(0);
        expect(errors[0].reason).toMatch(/JSON inválido/i);
    });
});

describe('ageGroupFromYears', () => {
    it('clasifica los límites correctamente', () => {
        expect(ageGroupFromYears(0)).toBe('Pediatric');
        expect(ageGroupFromYears(17)).toBe('Pediatric');
        expect(ageGroupFromYears(18)).toBe('Adult');
        expect(ageGroupFromYears(64)).toBe('Adult');
        expect(ageGroupFromYears(65)).toBe('Geriatric');
    });
});
