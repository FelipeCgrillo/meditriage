'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

function NurseLoginForm() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    // Flujo "olvidé mi contraseña" (PRD mejoras UX RF-13).
    const [resetMode, setResetMode] = useState(false);
    const [resetSent, setResetSent] = useState(false);
    const router = useRouter();
    const searchParams = useSearchParams();
    const redirectTo = searchParams.get('redirect') || '/nurse/dashboard';

    async function handleResetRequest(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        setLoading(true);
        try {
            await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/auth/callback?next=/account/reset-password`,
            });
        } catch (err) {
            console.error('Reset password error:', err);
        }
        // Siempre confirmamos el envío sin revelar si el correo existe.
        setResetSent(true);
        setLoading(false);
    }

    async function handleLogin(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            const { data, error: signInError } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (signInError || !data.user) {
                setError('Credenciales incorrectas. Verifica tu email y contraseña.');
                setLoading(false);
                return;
            }

            // Verifica rol nurse/admin
            const { data: profile, error: profileError } = await supabase
                .from('user_profiles')
                .select('role')
                .eq('id', data.user.id)
                .maybeSingle();

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

            // Hard navigation para que el middleware vea las cookies recién escritas
            // por @supabase/ssr (evita race condition con router.push).
            window.location.assign(redirectTo);
        } catch (err) {
            console.error('Login error:', err);
            setError('Error inesperado. Intenta nuevamente.');
            setLoading(false);
        }
    }

    return (
        <div className="w-full max-w-md">
            <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-100 rounded-full mb-4">
                    <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                </div>
                <h1 className="text-2xl font-bold text-gray-900">Panel de Enfermería</h1>
                <p className="text-gray-600 mt-2">Acceso para personal clínico</p>
            </div>

            <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
                {resetMode ? (
                    resetSent ? (
                        <div className="text-center space-y-4">
                            <h2 className="text-lg font-bold text-gray-900">Revisa tu correo</h2>
                            <p className="text-sm text-gray-600">
                                Si la dirección está registrada, enviamos un link para
                                restablecer tu contraseña.
                            </p>
                            <button
                                type="button"
                                onClick={() => {
                                    setResetMode(false);
                                    setResetSent(false);
                                }}
                                className="text-sm font-medium text-emerald-600 hover:text-emerald-700"
                            >
                                Volver a iniciar sesión
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleResetRequest} className="space-y-6">
                            <div>
                                <label htmlFor="reset-email" className="block text-sm font-medium text-gray-700 mb-2">
                                    Correo electrónico
                                </label>
                                <input
                                    id="reset-email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    autoComplete="username"
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                                    placeholder="enfermera@hospital.cl"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? 'Enviando...' : 'Enviar link de recuperación'}
                            </button>
                            <button
                                type="button"
                                onClick={() => setResetMode(false)}
                                className="w-full text-sm font-medium text-gray-500 hover:text-gray-700"
                            >
                                Volver a iniciar sesión
                            </button>
                        </form>
                    )
                ) : (
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
                            autoComplete="username"
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                            placeholder="enfermera@hospital.cl"
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
                            autoComplete="current-password"
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                            placeholder="••••••••"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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

                    <button
                        type="button"
                        onClick={() => {
                            setError(null);
                            setResetMode(true);
                        }}
                        className="w-full text-sm font-medium text-emerald-600 hover:text-emerald-700"
                    >
                        ¿Olvidaste tu contraseña?
                    </button>
                </form>
                )}
            </div>

            <p className="text-center text-gray-500 text-sm mt-6">
                Sistema de Triage Asistido por IA
            </p>
        </div>
    );
}

export default function NurseLoginPage() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 flex items-center justify-center p-4">
            <Suspense fallback={
                <div className="w-full max-w-md text-center">
                    <div className="animate-spin w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full mx-auto"></div>
                </div>
            }>
                <NurseLoginForm />
            </Suspense>
        </div>
    );
}
