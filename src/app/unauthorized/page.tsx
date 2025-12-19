import Link from 'next/link';

export default function UnauthorizedPage() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-orange-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md text-center">
                {/* Icon */}
                <div className="inline-flex items-center justify-center w-20 h-20 bg-red-100 rounded-full mb-6">
                    <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                </div>

                {/* Message */}
                <h1 className="text-2xl font-bold text-gray-900 mb-3">
                    Acceso No Autorizado
                </h1>
                <p className="text-gray-600 mb-8">
                    No tienes los permisos necesarios para acceder a esta sección.
                    Si crees que esto es un error, contacta al administrador del sistema.
                </p>

                {/* Actions */}
                <div className="space-y-3">
                    <Link
                        href="/"
                        className="block w-full bg-gray-900 hover:bg-gray-800 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
                    >
                        Volver al Inicio
                    </Link>
                    <Link
                        href="/login/nurse"
                        className="block w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
                    >
                        Login Enfermería
                    </Link>
                    <Link
                        href="/login/resultados"
                        className="block w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
                    >
                        Login Resultados
                    </Link>
                </div>

                {/* Footer */}
                <p className="text-gray-400 text-sm mt-8">
                    Error 403 - Acceso Prohibido
                </p>
            </div>
        </div>
    );
}
