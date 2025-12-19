/**
 * Script para crear un usuario de prueba para el panel de enfermera
 * 
 * Uso: node create-test-nurse-user.js
 * 
 * Requiere que las variables de entorno estén configuradas:
 * - NEXT_PUBLIC_SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 */

require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const API_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '') || 'http://localhost:3000';

async function createTestNurseUser() {
    const testUser = {
        email: 'enfermera@test.com',
        password: 'enfermera123',
        role: 'nurse',
        fullName: 'Enfermera de Prueba'
    };

    console.log('🔐 Creando usuario de prueba para panel de enfermera...\n');
    console.log('📋 Detalles del usuario:');
    console.log(`   Email: ${testUser.email}`);
    console.log(`   Contraseña: ${testUser.password}`);
    console.log(`   Rol: ${testUser.role}`);
    console.log(`   Nombre: ${testUser.fullName}\n`);

    try {
        // Verificar que las variables de entorno estén configuradas
        if (!SUPABASE_URL) {
            throw new Error('NEXT_PUBLIC_SUPABASE_URL no está configurada en .env.local');
        }

        if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
            throw new Error('SUPABASE_SERVICE_ROLE_KEY no está configurada en .env.local');
        }

        // Llamar a la API de creación de usuarios
        const response = await fetch(`${API_URL}/api/admin/users`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(testUser),
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || `Error HTTP: ${response.status}`);
        }

        console.log('✅ Usuario creado exitosamente!\n');
        console.log('📊 Información del usuario creado:');
        console.log(`   ID: ${result.user.id}`);
        console.log(`   Email: ${result.user.email}`);
        console.log(`   Rol: ${result.user.role}`);
        console.log(`   Nombre: ${result.user.fullName}\n`);
        console.log('🎉 Puedes iniciar sesión en:');
        console.log(`   ${API_URL}/login/nurse`);
        console.log(`   Email: ${testUser.email}`);
        console.log(`   Contraseña: ${testUser.password}\n`);

    } catch (error) {
        console.error('❌ Error al crear usuario:', error.message);
        
        if (error.message.includes('already registered')) {
            console.log('\n💡 El usuario ya existe. Puedes usar estas credenciales para iniciar sesión:');
            console.log(`   Email: ${testUser.email}`);
            console.log(`   Contraseña: ${testUser.password}`);
        } else {
            console.log('\n💡 Verifica que:');
            console.log('   1. Las variables de entorno estén configuradas en .env.local');
            console.log('   2. El servidor de desarrollo esté corriendo (npm run dev)');
            console.log('   3. La API /api/admin/users esté funcionando correctamente');
        }
        
        process.exit(1);
    }
}

// Ejecutar el script
createTestNurseUser();

