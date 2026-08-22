'use client';

/**
 * Página de cambio de contraseña forzado (PRD I1 CA-14).
 *
 * El middleware redirige aquí a cualquier usuario cuyo perfil tenga
 * `must_change_password = true`. Al enviar el formulario se llama al
 * endpoint /api/account/change-password, que valida la sesión, cambia
 * la contraseña en auth.users y baja el flag en user_profiles.
 */

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function ChangePasswordPage() {
    return (
        <Suspense fallback={null}>
            <ChangePasswordInner />
        </Suspense>
    );
}

function ChangePasswordInner() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const redirect = searchParams?.get('redirect') || '/';

    const [current, setCurrent] = useState('');
    const [next, setNext] = useState('');
    const [confirm, setConfirm] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        if (next.length < 8) {
            setError('La nueva contraseña debe tener al menos 8 caracteres.');
            return;
        }
        if (next !== confirm) {
            setError('La nueva contraseña y su confirmación no coinciden.');
            return;
        }
        if (next === current) {
            setError('La nueva contraseña debe ser distinta de la actual.');
            return;
        }
        setSubmitting(true);
        try {
            const res = await fetch('/api/account/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentPassword: current, newPassword: next }),
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) {
                setError(json?.error || 'No se pudo cambiar la contraseña.');
                return;
            }
            router.replace(redirect.startsWith('/') ? redirect : '/');
        } catch (err) {
            setError('Error de red. Intente nuevamente.');
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
                <h1 className="text-xl font-bold text-gray-900 mb-2">Cambio de contraseña</h1>
                <p className="text-sm text-gray-600 mb-6">
                    Por seguridad, debe cambiar la contraseña temporal antes de continuar.
                </p>
                <form onSubmit={onSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña actual</label>
                        <input
                            type="password"
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                            value={current}
                            onChange={(e) => setCurrent(e.target.value)}
                            required
                            autoComplete="current-password"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nueva contraseña</label>
                        <input
                            type="password"
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                            value={next}
                            onChange={(e) => setNext(e.target.value)}
                            required
                            minLength={8}
                            autoComplete="new-password"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar nueva contraseña</label>
                        <input
                            type="password"
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                            value={confirm}
                            onChange={(e) => setConfirm(e.target.value)}
                            required
                            minLength={8}
                            autoComplete="new-password"
                        />
                    </div>
                    {error ? (
                        <p className="text-sm text-red-600" role="alert">{error}</p>
                    ) : null}
                    <button
                        type="submit"
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg py-2 disabled:opacity-60"
                        disabled={submitting}
                    >
                        {submitting ? 'Guardando...' : 'Guardar y continuar'}
                    </button>
                </form>
            </div>
        </main>
    );
}
