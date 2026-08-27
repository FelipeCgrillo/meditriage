'use client';

/**
 * Gestión de usuarios: creación de cuentas con contraseña inicial y listado.
 * El API /api/admin/users fuerza la organización del admin que llama y
 * marca must_change_password=true (PRD I1, RF-12 a RF-14).
 */

import React, { useCallback, useEffect, useState } from 'react';

type Role = 'nurse' | 'researcher' | 'admin';

interface UserProfile {
    id: string;
    email: string;
    role: Role;
    full_name: string | null;
    created_at: string;
}

const ROLE_BADGE: Record<Role, string> = {
    admin: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
    researcher: 'bg-amber-50 text-amber-700 ring-amber-200',
    nurse: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
};

export default function AdminUsersPage() {
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [msg, setMsg] = useState<string | null>(null);

    // Form
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState<Role>('nurse');
    const [fullName, setFullName] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const fetchUsers = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/admin/users');
            const data = await res.json();
            if (res.ok) setUsers(data.users || []);
            else setError(data.error || 'Error al cargar usuarios.');
        } catch {
            setError('Error de red al cargar usuarios.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    async function createUser(e: React.FormEvent) {
        e.preventDefault();
        setSubmitting(true);
        setError(null);
        setMsg(null);
        try {
            const res = await fetch('/api/admin/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, role, fullName }),
            });
            const data = await res.json();
            if (res.ok) {
                setMsg(`Usuario ${email} creado como ${role}.`);
                setEmail('');
                setPassword('');
                setFullName('');
                setRole('nurse');
                fetchUsers();
            } else {
                setError(data.error || 'No se pudo crear el usuario.');
            }
        } catch {
            setError('Error de red al crear usuario.');
        } finally {
            setSubmitting(false);
        }
    }

    async function deleteUser(id: string, userEmail: string) {
        if (!confirm(`¿Eliminar al usuario ${userEmail}? Esta acción no se puede deshacer.`)) return;
        setError(null);
        setMsg(null);
        try {
            const res = await fetch(`/api/admin/users?id=${encodeURIComponent(id)}`, {
                method: 'DELETE',
            });
            const data = await res.json();
            if (res.ok) {
                setMsg(`Usuario ${userEmail} eliminado.`);
                fetchUsers();
            } else {
                setError(data.error || 'No se pudo eliminar el usuario.');
            }
        } catch {
            setError('Error de red al eliminar usuario.');
        }
    }

    const inputClass =
        'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100';

    return (
        <div className="mx-auto max-w-6xl space-y-6">
            {/* Crear usuario */}
            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="mb-1 text-lg font-semibold text-slate-900">Crear usuario</h2>
                <p className="mb-4 text-sm text-slate-500">
                    La cuenta quedará asociada a tu organización y deberá cambiar la contraseña en su primer ingreso.
                </p>
                <form onSubmit={createUser} className="grid gap-4 sm:grid-cols-2">
                    <label className="text-sm">
                        <span className="mb-1 block font-medium text-slate-700">Correo</span>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className={inputClass}
                            placeholder="persona@universidad.cl"
                        />
                    </label>
                    <label className="text-sm">
                        <span className="mb-1 block font-medium text-slate-700">Contraseña inicial</span>
                        <input
                            type="text"
                            required
                            minLength={6}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className={inputClass}
                            placeholder="mínimo 6 caracteres"
                        />
                    </label>
                    <label className="text-sm">
                        <span className="mb-1 block font-medium text-slate-700">Nombre completo</span>
                        <input
                            type="text"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            className={inputClass}
                            placeholder="Opcional"
                        />
                    </label>
                    <label className="text-sm">
                        <span className="mb-1 block font-medium text-slate-700">Rol</span>
                        <select value={role} onChange={(e) => setRole(e.target.value as Role)} className={inputClass}>
                            <option value="nurse">Enfermera (nurse)</option>
                            <option value="researcher">Investigador (researcher)</option>
                            <option value="admin">Administrador (admin)</option>
                        </select>
                    </label>
                    <div className="sm:col-span-2">
                        <button
                            type="submit"
                            disabled={submitting}
                            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:opacity-50"
                        >
                            {submitting ? 'Creando…' : 'Crear usuario'}
                        </button>
                    </div>
                </form>
                {msg && <p className="mt-3 text-sm text-emerald-700">{msg}</p>}
                {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
            </section>

            {/* Lista de usuarios */}
            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-slate-900">Usuarios ({users.length})</h2>
                    <button
                        onClick={fetchUsers}
                        className="rounded-lg px-3 py-1.5 text-sm font-medium text-indigo-600 transition-colors hover:bg-indigo-50"
                    >
                        Actualizar
                    </button>
                </div>
                {loading ? (
                    <p className="text-sm text-slate-500">Cargando…</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200 text-sm">
                            <thead>
                                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                                    <th className="px-3 py-2">Correo</th>
                                    <th className="px-3 py-2">Nombre</th>
                                    <th className="px-3 py-2">Rol</th>
                                    <th className="px-3 py-2">Creado</th>
                                    <th className="px-3 py-2"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {users.map((u) => (
                                    <tr key={u.id} className="transition-colors hover:bg-slate-50">
                                        <td className="px-3 py-2.5 font-medium text-slate-900">{u.email}</td>
                                        <td className="px-3 py-2.5 text-slate-600">{u.full_name || '—'}</td>
                                        <td className="px-3 py-2.5">
                                            <span
                                                className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${ROLE_BADGE[u.role]}`}
                                            >
                                                {u.role}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2.5 text-xs text-slate-500">
                                            {new Date(u.created_at).toLocaleDateString('es-CL')}
                                        </td>
                                        <td className="px-3 py-2.5 text-right">
                                            <button
                                                onClick={() => deleteUser(u.id, u.email)}
                                                className="rounded px-2 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
                                            >
                                                Eliminar
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </div>
    );
}
