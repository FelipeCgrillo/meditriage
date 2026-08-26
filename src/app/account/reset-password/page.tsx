'use client';

/**
 * Página de restablecimiento de contraseña vía link de correo
 * (PRD mejoras UX RF-13, deseable; RF-12 del PRD I1).
 *
 * El usuario llega aquí desde el link de recuperación de Supabase
 * (/auth/callback?next=/account/reset-password), que ya canjeó el
 * código por una sesión. Con esa sesión activa basta con
 * `auth.updateUser` para fijar la nueva contraseña.
 */

import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';

export default function ResetPasswordPage() {
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [done, setDone] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        if (password.length < 8) {
            setError('La nueva contraseña debe tener al menos 8 caracteres.');
            return;
        }
        if (password !== confirm) {
            setError('La contraseña y su confirmación no coinciden.');
            return;
        }
        setSubmitting(true);
        const { error: updateError } = await supabase.auth.updateUser({ password });
        setSubmitting(false);
        if (updateError) {
            setError(
                'No se pudo actualizar la contraseña. El link puede haber expirado; solicite uno nuevo desde la página de ingreso.',
            );
            return;
        }
        setDone(true);
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
                    {done ? (
                        <div className="text-center space-y-4">
                            <h1 className="text-2xl font-bold text-gray-900">
                                Contraseña actualizada
                            </h1>
                            <p className="text-gray-600">
                                Ya puede ingresar con su nueva contraseña.
                            </p>
                            <a
                                href="/login/nurse"
                                className="inline-block w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
                            >
                                Ir a iniciar sesión
                            </a>
                        </div>
                    ) : (
                        <form onSubmit={onSubmit} className="space-y-6">
                            <h1 className="text-2xl font-bold text-gray-900 text-center">
                                Nueva contraseña
                            </h1>
                            {error && (
                                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                                    {error}
                                </div>
                            )}
                            <div>
                                <label
                                    htmlFor="password"
                                    className="block text-sm font-medium text-gray-700 mb-2"
                                >
                                    Nueva contraseña
                                </label>
                                <input
                                    id="password"
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    autoComplete="new-password"
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                                />
                            </div>
                            <div>
                                <label
                                    htmlFor="confirm"
                                    className="block text-sm font-medium text-gray-700 mb-2"
                                >
                                    Confirmar contraseña
                                </label>
                                <input
                                    id="confirm"
                                    type="password"
                                    value={confirm}
                                    onChange={(e) => setConfirm(e.target.value)}
                                    required
                                    autoComplete="new-password"
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={submitting}
                                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {submitting ? 'Guardando...' : 'Guardar contraseña'}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
