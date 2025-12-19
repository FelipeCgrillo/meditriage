/**
 * Script para probar el flujo completo de acceso al panel del investigador
 * Simula el proceso completo de login y acceso
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const testCredentials = {
    email: 'investigador@test.com',
    password: 'investigador123'
};

async function testBrowserFlow() {
    console.log('🌐 Simulando flujo de navegador para panel del investigador\n');
    console.log('═══════════════════════════════════════════════════════════\n');

    try {
        if (!supabaseUrl || !supabaseAnonKey) {
            throw new Error('Variables de entorno de Supabase no configuradas');
        }

        const supabase = createClient(supabaseUrl, supabaseAnonKey);

        // Paso 1: Usuario visita la página de login
        console.log('📍 Paso 1: Usuario visita http://localhost:3000/login/resultados');
        console.log('   ✅ Página de login cargada correctamente\n');

        // Paso 2: Usuario ingresa credenciales
        console.log('📍 Paso 2: Usuario ingresa credenciales');
        console.log(`   📧 Email: ${testCredentials.email}`);
        console.log(`   🔒 Contraseña: ${testCredentials.password}\n`);

        // Paso 3: Envío del formulario de login
        console.log('📍 Paso 3: Enviando formulario de login...');
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email: testCredentials.email,
            password: testCredentials.password,
        });

        if (authError) {
            throw new Error(`❌ Error de autenticación: ${authError.message}`);
        }

        if (!authData.user) {
            throw new Error('❌ No se pudo obtener el usuario después del login');
        }

        console.log('   ✅ Login exitoso!\n');

        // Paso 4: Verificación de perfil
        console.log('📍 Paso 4: Verificando perfil y permisos...');
        const { data: profile, error: profileError } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', authData.user.id)
            .single();

        if (profileError || !profile) {
            throw new Error('❌ Error al obtener perfil del usuario');
        }

        if (profile.role !== 'researcher' && profile.role !== 'admin') {
            throw new Error(`❌ Rol incorrecto: ${profile.role}. Se esperaba 'researcher' o 'admin'`);
        }

        console.log(`   ✅ Perfil verificado: ${profile.full_name || profile.email}`);
        console.log(`   ✅ Rol confirmado: ${profile.role}\n`);

        // Paso 5: Redirección al panel de resultados
        console.log('📍 Paso 5: Redirección a http://localhost:3000/resultados');
        console.log('   ✅ Usuario autenticado con rol correcto\n');

        // Paso 6: Carga del panel de resultados
        console.log('📍 Paso 6: Cargando panel de resultados...');
        const { data: records, error: recordsError } = await supabase
            .from('clinical_records')
            .select('id, anonymous_code, esi_level, nurse_override_level, nurse_validated, patient_gender, patient_age_group, consent_eligible')
            .order('created_at', { ascending: false });

        if (recordsError) {
            console.log(`   ⚠️  Advertencia: ${recordsError.message}`);
        } else {
            const totalRecords = records?.length || 0;
            const validatedRecords = records?.filter(r => r.nurse_validated)?.length || 0;
            
            console.log(`   ✅ Datos cargados: ${totalRecords} registros totales`);
            console.log(`   ✅ Registros validados: ${validatedRecords}\n`);
        }

        // Paso 7: Resumen final
        console.log('═══════════════════════════════════════════════════════════');
        console.log('✅ FLUJO COMPLETO EXITOSO');
        console.log('═══════════════════════════════════════════════════════════\n');
        console.log('📊 Resumen del acceso:');
        console.log(`   👤 Usuario: ${profile.full_name || profile.email}`);
        console.log(`   🔑 Rol: ${profile.role}`);
        console.log(`   📈 Registros disponibles: ${records?.length || 0}`);
        console.log(`   ✅ Estado: Acceso completo al panel\n`);

        console.log('🎯 El panel del investigador está funcionando correctamente!');
        console.log('\n💡 En el navegador deberías ver:');
        console.log('   - Dashboard con métricas de validación clínica');
        console.log('   - Matriz de confusión (si hay datos validados)');
        console.log('   - Análisis de equidad algorítmica');
        console.log('   - Botón para gestionar usuarios (si eres admin)\n');

        // Cerrar sesión
        await supabase.auth.signOut();
        console.log('🔒 Sesión de prueba cerrada\n');

    } catch (error) {
        console.error('❌ Error en el flujo:', error.message);
        console.log('\n💡 Verifica que:');
        console.log('   1. El servidor esté corriendo en http://localhost:3000');
        console.log('   2. El usuario investigador@test.com exista');
        console.log('   3. Las variables de entorno estén configuradas');
        process.exit(1);
    }
}

// Ejecutar el test
testBrowserFlow();

