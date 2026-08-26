/**
 * Página de error del intercambio de código de autenticación.
 *
 * /auth/callback redirige aquí cuando el código del link de correo no se
 * puede canjear (expirado, ya usado o alterado). Antes esta ruta no
 * existía y el usuario caía en un 404 sin explicación.
 */

export default function AuthCodeErrorPage() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100 text-center space-y-4">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-100 rounded-full">
                        <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900">Link no válido</h1>
                    <p className="text-gray-600">
                        El link de acceso expiró o ya fue utilizado. Solicita uno
                        nuevo desde la página de ingreso con la opción
                        &ldquo;¿Olvidaste tu contraseña?&rdquo;.
                    </p>
                    <a
                        href="/login/nurse"
                        className="inline-block w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
                    >
                        Ir a iniciar sesión
                    </a>
                    <a href="/" className="block text-sm font-medium text-gray-500 hover:text-gray-700">
                        Volver al inicio
                    </a>
                </div>
            </div>
        </div>
    );
}
