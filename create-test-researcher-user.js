/**
 * Script para crear un usuario de prueba para el panel de investigador
 * Usa directamente el cliente de Supabase (no requiere servidor corriendo)
 * 
 * Uso: node create-test-researcher-user.js
 * 
 * Requiere que las variables de entorno estén configuradas en .env.local:
 * - NEXT_PUBLIC_SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function createTestResearcherUser() {
    const testUser = {
        email: 'investigador@test.com',
        password: 'investigador123',
        role: 'researcher',
        fullName: 'Investigador de Prueba'
    };

    console.log('🔐 Creando usuario de prueba para panel de investigador...\n');
    console.log('📋 Detalles del usuario:');
    console.log(`   Email: ${testUser.email}`);
    console.log(`   Contraseña: ${testUser.password}`);
    console.log(`   Rol: ${testUser.role}`);
    console.log(`   Nombre: ${testUser.fullName}\n`);

    try {
        // Verificar que las variables de entorno estén configuradas
        if (!supabaseUrl) {
            throw new Error('NEXT_PUBLIC_SUPABASE_URL no está configurada en .env.local');
        }

        if (!supabaseServiceKey) {
            throw new Error('SUPABASE_SERVICE_ROLE_KEY no está configurada en .env.local');
        }

        // Crear cliente de Supabase con service role key
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        });

        // Crear usuario en Supabase Auth
        console.log('⏳ Creando usuario en Supabase Auth...');
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: testUser.email,
            password: testUser.password,
            email_confirm: true, // Auto-confirmar email
        });

        if (authError) {
            if (authError.message.includes('already registered')) {
                console.log('⚠️  El usuario ya existe. Obteniendo información del usuario existente...\n');
                
                // Intentar obtener el usuario existente
                const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
                const existingUser = existingUsers?.users?.find(u => u.email === testUser.email);
                
                if (existingUser) {
                    // Verificar si tiene perfil
                    const { data: profile } = await supabaseAdmin
                        .from('user_profiles')
                        .select('*')
                        .eq('id', existingUser.id)
                        .single();

                    if (!profile) {
                        console.log('⏳ Creando perfil para usuario existente...');
                        const { error: profileError } = await supabaseAdmin
                            .from('user_profiles')
                            .insert({
                                id: existingUser.id,
                                email: testUser.email,
                                role: testUser.role,
                                full_name: testUser.fullName,
                            });

                        if (profileError) {
                            throw new Error(`Error al crear perfil: ${profileError.message}`);
                        }
                    } else {
                        // Actualizar el rol si es necesario
                        if (profile.role !== testUser.role) {
                            console.log('⏳ Actualizando rol del usuario...');
                            const { error: updateError } = await supabaseAdmin
                                .from('user_profiles')
                                .update({ role: testUser.role, full_name: testUser.fullName })
                                .eq('id', existingUser.id);

                            if (updateError) {
                                throw new Error(`Error al actualizar perfil: ${updateError.message}`);
                            }
                        }
                    }

                    console.log('✅ Usuario encontrado y perfil actualizado!\n');
                    console.log('📊 Información del usuario:');
                    console.log(`   ID: ${existingUser.id}`);
                    console.log(`   Email: ${existingUser.email}`);
                    console.log(`   Rol: ${testUser.role}`);
                    console.log(`   Nombre: ${testUser.fullName}\n`);
                    console.log('🎉 Puedes iniciar sesión con:');
                    console.log(`   Email: ${testUser.email}`);
                    console.log(`   Contraseña: ${testUser.password}\n`);
                    return;
                }
            }
            throw authError;
        }

        if (!authData.user) {
            throw new Error('No se pudo crear el usuario');
        }

        console.log('✅ Usuario creado en Auth. Creando perfil...');

        // Crear perfil de usuario con rol
        const { error: profileError } = await supabaseAdmin
            .from('user_profiles')
            .insert({
                id: authData.user.id,
                email: testUser.email,
                role: testUser.role,
                full_name: testUser.fullName,
            });

        if (profileError) {
            console.error('⚠️  Error al crear perfil:', profileError.message);
            // Intentar eliminar el usuario de auth si falla la creación del perfil
            await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
            throw new Error(`Error al crear perfil: ${profileError.message}`);
        }

        console.log('✅ Usuario creado exitosamente!\n');
        console.log('📊 Información del usuario creado:');
        console.log(`   ID: ${authData.user.id}`);
        console.log(`   Email: ${authData.user.email}`);
        console.log(`   Rol: ${testUser.role}`);
        console.log(`   Nombre: ${testUser.fullName}\n`);
        console.log('🎉 Puedes iniciar sesión en:');
        console.log(`   http://localhost:3000/login/resultados`);
        console.log(`   Email: ${testUser.email}`);
        console.log(`   Contraseña: ${testUser.password}\n`);

    } catch (error) {
        console.error('❌ Error al crear usuario:', error.message);
        console.log('\n💡 Verifica que:');
        console.log('   1. Las variables de entorno estén configuradas en .env.local');
        console.log('   2. NEXT_PUBLIC_SUPABASE_URL apunte a tu proyecto de Supabase');
        console.log('   3. SUPABASE_SERVICE_ROLE_KEY sea la clave de servicio correcta');
        process.exit(1);
    }
}

// Ejecutar el script
createTestResearcherUser();

