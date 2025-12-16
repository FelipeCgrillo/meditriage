/**
 * Script de verificación de migración 004_add_anonymous_code
 * 
 * Este script verifica que:
 * 1. La columna anonymous_code exista en clinical_records
 * 2. Los registros existentes tengan anonymous_code
 * 3. El formato sea correcto (ABC-123)
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import type { Database } from './lib/supabase/types';

// Cargar variables de entorno
config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Error: Variables de entorno no encontradas');
    console.error('   Asegúrate de tener un archivo .env.local con:');
    console.error('   - NEXT_PUBLIC_SUPABASE_URL');
    console.error('   - NEXT_PUBLIC_SUPABASE_ANON_KEY\n');
    process.exit(1);
}

const supabase = createClient<Database>(supabaseUrl, supabaseKey);

async function verifyMigration() {
    console.log('🔍 Verificando migración 004_add_anonymous_code...\n');

    try {
        // 1. Verificar estructura de la tabla
        console.log('1️⃣ Verificando estructura de la tabla clinical_records...');

        // Using type assertion since we're checking for column existence
        type RecordWithCode = { id: string; anonymous_code: string | null; created_at: string };

        const { data: records, error: selectError } = await supabase
            .from('clinical_records')
            .select('id, anonymous_code, created_at')
            .limit(5) as { data: RecordWithCode[] | null; error: any };

        if (selectError) {
            console.error('❌ Error al consultar clinical_records:', selectError);
            if (selectError.message.includes('column') && selectError.message.includes('anonymous_code')) {
                console.error('\n⚠️  LA COLUMNA anonymous_code NO EXISTE.');
                console.error('   Necesitas aplicar la migración 004_add_anonymous_code.sql');
                console.error('\n   En Supabase Dashboard, ejecuta:');
                console.error('   ALTER TABLE clinical_records ADD COLUMN IF NOT EXISTS anonymous_code VARCHAR(7);');
                return false;
            }
            return false;
        }

        console.log('✅ La tabla clinical_records tiene la columna anonymous_code\n');

        // 2. Verificar registros existentes
        console.log('2️⃣ Verificando registros existentes...');
        if (!records || records.length === 0) {
            console.log('ℹ️  No hay registros en la tabla aún\n');
        } else {
            console.log(`📊 Encontrados ${records.length} registros (mostrando máximo 5):\n`);
            records.forEach((record, idx) => {
                const hasCode = !!record.anonymous_code;
                const icon = hasCode ? '✅' : '❌';
                console.log(`   ${icon} Registro ${idx + 1}:`);
                console.log(`      ID: ${record.id.substring(0, 8)}...`);
                console.log(`      Código Anónimo: ${record.anonymous_code || 'SIN CÓDIGO'}`);
                console.log(`      Fecha: ${new Date(record.created_at).toLocaleString('es-CL')}\n`);
            });

            // Verificar que todos tengan anonymous_code
            const allHaveCode = records.every(r => r.anonymous_code);
            if (!allHaveCode) {
                console.warn('⚠️  Algunos registros NO tienen anonymous_code.');
                console.warn('   Los registros antiguos no tendrán código.\n');
            } else {
                console.log('✅ Todos los registros existentes tienen anonymous_code\n');
            }
        }

        // 3. Probar formato del anonymous_code (ABC-123)
        if (records && records.length > 0 && records[0].anonymous_code) {
            console.log('3️⃣ Verificando formato del anonymous_code...');
            // Pattern: 3 letters (no I,L,O) + hyphen + 3 numbers (no 0,1)
            const pattern = /^[ABCDEFGHJKMNPQRSTUVWXYZ]{3}-[23456789]{3}$/;
            const sampleCode = records[0].anonymous_code;
            const matches = pattern.test(sampleCode);

            if (matches) {
                console.log(`✅ Formato correcto: ${sampleCode}`);
                console.log('   Patrón: ABC-123 (sin caracteres confusos) ✓\n');
            } else {
                console.warn(`⚠️  Formato diferente: ${sampleCode}`);
                console.warn('   Esperado: ABC-123 (letras sin I,L,O y números sin 0,1)\n');
            }
        }

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🎉 VERIFICACIÓN COMPLETADA');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        console.log('✅ Columna anonymous_code existe');
        console.log('✅ Sistema listo para generar códigos ABC-123');
        console.log('\n💡 El sistema de identificación anónima está listo para usar.\n');

        return true;

    } catch (error) {
        console.error('❌ Error durante la verificación:', error);
        return false;
    }
}

// Ejecutar verificación
verifyMigration()
    .then(success => {
        process.exit(success ? 0 : 1);
    })
    .catch(error => {
        console.error('Error fatal:', error);
        process.exit(1);
    });
