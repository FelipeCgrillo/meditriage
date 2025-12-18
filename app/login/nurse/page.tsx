'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

function NurseLoginForm() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const searchParams = useSearchParams();
    const redirectTo = searchParams.get('redirect') || '/nurse';

    async function handleLogin(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            const { data, error: signInError } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (signInError) {
                setError('Credenciales incorrectas. Verifica tu email y contraseña.');
                setLoading(false);
                return;
            }

            if (!data.user) {
                setError('No se pudo iniciar sesión. Intenta nuevamente.');
                setLoading(false);
                return;
            }

            // Verify user has nurse role
            const { data: profile, error: profileError } = await supabase
                .from('user_profiles')
                .select('role')
                .eq('id', data.user.id)
                .single();

            if (profileError || !profile) {
                setError('Tu cuenta no tiene un perfil configurado. Contacta al administrador.');
                await supabase.auth.signOut();
                setLoading(false);
                return;
            }

            if (profile.role !== 'nurse' && profile.role !== 'admin') {
                setError('No tienes permisos para acceder al panel de enfermería.');
                await supabase.auth.signOut();
                setLoading(false);
                return;
            }

            // Success - redirect to nurse dashboard
            router.push(redirectTo);
            router.refresh();
        } catch (err) {
            setError('Error inesperado. Intenta nuevamente.');
            setLoading(false);
        }
    }

    return (
        <div className="w-full max-w-md">
            {/* Header */}
            <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-teal-100 rounded-full mb-4">
                    <svg className="w-8 h-8 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                </div>
                <h1 className="text-2xl font-bold text-gray-900">Panel de Enfermería</h1>
                <p className="text-gray-600 mt-2">Ingresa tus credenciales para acceder</p>
            </div>

            {/* Login Form */}
            <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
                <form onSubmit={handleLogin} className="space-y-6">
                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                            {error}
                        </div>
                    )}

                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                            Correo electrónico
                        </label>
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors"
                            placeholder="enfermera@cesfam.cl"
                        />
                    </div>

                    <div>
                        <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                            Contraseña
                        </label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors"
                            placeholder="••••••••"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <>
                                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                <span>Ingresando...</span>
                            </>
                        ) : (
                            'Ingresar'
                        )}
                    </button>
                </form>
            </div>

            {/* Footer */}
            <p className="text-center text-gray-500 text-sm mt-6">
                Sistema de Triaje ESI - Acceso restringido
            </p>
        </div>
    );
}

export default function NurseLoginPage() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-cyan-50 flex items-center justify-center p-4">
            <Suspense fallback={
                <div className="w-full max-w-md text-center">
                    <div className="animate-spin w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full mx-auto"></div>
                </div>
            }>
                <NurseLoginForm />
            </Suspense>
        </div>
    );
}
