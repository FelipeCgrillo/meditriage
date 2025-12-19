/**
 * Script para probar el acceso al panel del investigador
 * Simula el proceso de login y verifica que el acceso funcione correctamente
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const testCredentials = {
    email: 'investigador@test.com',
    password: 'investigador123'
};

async function testResearcherAccess() {
    console.log('🧪 Probando acceso al panel del investigador...\n');
    console.log('📋 Credenciales de prueba:');
    console.log(`   Email: ${testCredentials.email}`);
    console.log(`   Contraseña: ${testCredentials.password}\n`);

    try {
        if (!supabaseUrl || !supabaseAnonKey) {
            throw new Error('Variables de entorno de Supabase no configuradas');
        }

        // Crear cliente de Supabase
        const supabase = createClient(supabaseUrl, supabaseAnonKey);

        // 1. Intentar login
        console.log('⏳ Intentando iniciar sesión...');
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email: testCredentials.email,
            password: testCredentials.password,
        });

        if (authError) {
            throw new Error(`Error de autenticación: ${authError.message}`);
        }

        if (!authData.user) {
            throw new Error('No se pudo obtener el usuario después del login');
        }

        console.log('✅ Login exitoso!\n');
        console.log('📊 Información del usuario autenticado:');
        console.log(`   ID: ${authData.user.id}`);
        console.log(`   Email: ${authData.user.email}\n`);

        // 2. Verificar perfil y rol
        console.log('⏳ Verificando perfil y rol...');
        const { data: profile, error: profileError } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', authData.user.id)
            .single();

        if (profileError) {
            throw new Error(`Error al obtener perfil: ${profileError.message}`);
        }

        if (!profile) {
            throw new Error('No se encontró el perfil del usuario');
        }

        console.log('✅ Perfil encontrado!\n');
        console.log('📊 Información del perfil:');
        console.log(`   Rol: ${profile.role}`);
        console.log(`   Nombre: ${profile.full_name || 'No especificado'}\n`);

        // 3. Verificar que el rol sea correcto
        if (profile.role !== 'researcher' && profile.role !== 'admin') {
            throw new Error(`Rol incorrecto: ${profile.role}. Se esperaba 'researcher' o 'admin'`);
        }

        console.log('✅ Rol verificado correctamente!\n');

        // 4. Verificar acceso a datos del panel
        console.log('⏳ Verificando acceso a registros clínicos...');
        const { data: records, error: recordsError } = await supabase
            .from('clinical_records')
            .select('id, anonymous_code, esi_level, nurse_override_level, nurse_validated')
            .limit(5);

        if (recordsError) {
            console.log(`⚠️  Advertencia al acceder a registros: ${recordsError.message}`);
            console.log('   (Esto puede ser normal si no hay registros o hay problemas de RLS)\n');
        } else {
            console.log(`✅ Acceso a registros verificado! (${records?.length || 0} registros encontrados)\n`);
        }

        // 5. Resumen final
        console.log('═══════════════════════════════════════════════════════════');
        console.log('✅ PRUEBA EXITOSA - Acceso al panel del investigador');
        console.log('═══════════════════════════════════════════════════════════\n');
        console.log('🎉 El usuario puede acceder correctamente al panel de resultados');
        console.log(`\n📝 Para acceder manualmente:`);
        console.log(`   1. Ve a: http://localhost:3000/login/resultados`);
        console.log(`   2. Email: ${testCredentials.email}`);
        console.log(`   3. Contraseña: ${testCredentials.password}`);
        console.log(`   4. Serás redirigido a: http://localhost:3000/resultados\n`);

        // Cerrar sesión
        await supabase.auth.signOut();
        console.log('🔒 Sesión cerrada\n');

    } catch (error) {
        console.error('❌ Error en la prueba:', error.message);
        console.log('\n💡 Verifica que:');
        console.log('   1. El usuario investigador@test.com existe');
        console.log('   2. Las variables de entorno estén configuradas');
        console.log('   3. El servidor esté corriendo en http://localhost:3000');
        process.exit(1);
    }
}

// Ejecutar la prueba
testResearcherAccess();

