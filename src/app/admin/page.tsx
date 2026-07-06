'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { LogoutButton } from '@/components/auth/LogoutButton';
import { useAuth } from '@/components/auth/AuthProvider';

// =============================================================================
// TIPOS
// =============================================================================

type Role = 'nurse' | 'researcher' | 'admin';

interface UserProfile {
    id: string;
    email: string;
    role: Role;
    full_name: string | null;
    created_at: string;
}

interface DauRunRow {
    id: string;
    file_name: string | null;
    total: number;
    classified: number;
    needs_info: number;
    comparable: number;
    agreements: number;
    simple_agreement: number | null;
    created_at: string;
}

interface ClinicalRecordRow {
    id: string;
    anonymous_code: string | null;
    symptoms_text: string | null;
    esi_level: number;
    nurse_override_level: number | null;
    nurse_validated: boolean;
    patient_gender: string | null;
    patient_age_group: string | null;
    created_at: string;
}

type Tab = 'usuarios' | 'dau' | 'clinicos' | 'accesos';

// =============================================================================
// PÁGINA ADMIN
// =============================================================================

export default function AdminPage() {
    const { profile, loading: authLoading } = useAuth();
    const [tab, setTab] = useState<Tab>('accesos');

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="border-b border-gray-200 bg-white">
                <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-indigo-700">
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">Panel de Administración</h1>
                            <p className="text-sm text-gray-500">
                                {profile?.full_name || profile?.email || 'Administrador'}
                            </p>
                        </div>
                    </div>
                    <LogoutButton />
                </div>
            </header>

            {/* Aviso si el usuario no es admin (defensa en profundidad; el
                middleware ya bloquea, pero esto evita mostrar datos si algo
                falla en la capa de red). */}
            {!authLoading && profile && profile.role !== 'admin' && (
                <div className="mx-auto mt-6 max-w-6xl px-6">
                    <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                        Esta sección es solo para administradores.
                    </div>
                </div>
            )}

            <main className="mx-auto max-w-6xl px-6 py-6">
                {/* Tabs */}
                <div className="mb-6 flex flex-wrap gap-2 border-b border-gray-200">
                    <TabButton active={tab === 'accesos'} onClick={() => setTab('accesos')}>
                        Accesos
                    </TabButton>
                    <TabButton active={tab === 'usuarios'} onClick={() => setTab('usuarios')}>
                        Usuarios
                    </TabButton>
                    <TabButton active={tab === 'dau'} onClick={() => setTab('dau')}>
                        Corridas DAU
                    </TabButton>
                    <TabButton active={tab === 'clinicos'} onClick={() => setTab('clinicos')}>
                        Registros clínicos
                    </TabButton>
                </div>

                {tab === 'accesos' && <AccessTab />}
                {tab === 'usuarios' && <UsersTab />}
                {tab === 'dau' && <DauRunsTab />}
                {tab === 'clinicos' && <ClinicalRecordsTab />}
            </main>
        </div>
    );
}

function TabButton({
    active,
    onClick,
    children,
}: {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            onClick={onClick}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold transition-colors ${
                active
                    ? 'border-indigo-600 text-indigo-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
        >
            {children}
        </button>
    );
}

// =============================================================================
// TAB: ACCESOS
// =============================================================================

function AccessTab() {
    const cards = [
        {
            href: '/resultados',
            title: 'Panel de Resultados',
            desc: 'Métricas del estudio, Kappa y matriz de confusión (investigador).',
        },
        {
            href: '/resultados/dau',
            title: 'Análisis DAU',
            desc: 'Análisis retrospectivo de los CSV del hospital (reglas + IA).',
        },
        {
            href: '/nurse/dashboard',
            title: 'Panel de Enfermería',
            desc: 'Clasificación ciega de casos por el personal de triage.',
        },
    ];
    return (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((c) => (
                <Link
                    key={c.href}
                    href={c.href}
                    className="block rounded-lg border border-gray-200 bg-white p-5 transition-shadow hover:shadow-md"
                >
                    <h3 className="text-base font-semibold text-gray-900">{c.title}</h3>
                    <p className="mt-1 text-sm text-gray-500">{c.desc}</p>
                    <span className="mt-3 inline-block text-sm font-medium text-indigo-600">Abrir →</span>
                </Link>
            ))}
        </div>
    );
}

// =============================================================================
// TAB: USUARIOS
// =============================================================================

function UsersTab() {
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

    return (
        <div className="space-y-6">
            {/* Crear usuario */}
            <section className="rounded-lg border border-gray-200 bg-white p-5">
                <h2 className="mb-4 text-lg font-semibold text-gray-900">Crear usuario</h2>
                <form onSubmit={createUser} className="grid gap-4 sm:grid-cols-2">
                    <label className="text-sm">
                        <span className="mb-1 block font-medium text-gray-700">Correo</span>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full rounded-md border border-gray-300 px-3 py-2"
                            placeholder="persona@universidad.cl"
                        />
                    </label>
                    <label className="text-sm">
                        <span className="mb-1 block font-medium text-gray-700">Contraseña</span>
                        <input
                            type="text"
                            required
                            minLength={6}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full rounded-md border border-gray-300 px-3 py-2"
                            placeholder="mínimo 6 caracteres"
                        />
                    </label>
                    <label className="text-sm">
                        <span className="mb-1 block font-medium text-gray-700">Nombre completo</span>
                        <input
                            type="text"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            className="w-full rounded-md border border-gray-300 px-3 py-2"
                            placeholder="Opcional"
                        />
                    </label>
                    <label className="text-sm">
                        <span className="mb-1 block font-medium text-gray-700">Rol</span>
                        <select
                            value={role}
                            onChange={(e) => setRole(e.target.value as Role)}
                            className="w-full rounded-md border border-gray-300 px-3 py-2"
                        >
                            <option value="nurse">Enfermera (nurse)</option>
                            <option value="researcher">Investigador (researcher)</option>
                            <option value="admin">Administrador (admin)</option>
                        </select>
                    </label>
                    <div className="sm:col-span-2">
                        <button
                            type="submit"
                            disabled={submitting}
                            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                        >
                            {submitting ? 'Creando…' : 'Crear usuario'}
                        </button>
                    </div>
                </form>
                {msg && <p className="mt-3 text-sm text-green-700">{msg}</p>}
                {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
            </section>

            {/* Lista de usuarios */}
            <section className="rounded-lg border border-gray-200 bg-white p-5">
                <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-gray-900">
                        Usuarios ({users.length})
                    </h2>
                    <button
                        onClick={fetchUsers}
                        className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
                    >
                        Actualizar
                    </button>
                </div>
                {loading ? (
                    <p className="text-sm text-gray-500">Cargando…</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 text-sm">
                            <thead>
                                <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                                    <th className="px-3 py-2">Correo</th>
                                    <th className="px-3 py-2">Nombre</th>
                                    <th className="px-3 py-2">Rol</th>
                                    <th className="px-3 py-2">Creado</th>
                                    <th className="px-3 py-2"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {users.map((u) => (
                                    <tr key={u.id}>
                                        <td className="px-3 py-2 font-medium text-gray-900">{u.email}</td>
                                        <td className="px-3 py-2 text-gray-600">{u.full_name || '—'}</td>
                                        <td className="px-3 py-2">
                                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                                                {u.role}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2 text-xs text-gray-500">
                                            {new Date(u.created_at).toLocaleDateString('es-CL')}
                                        </td>
                                        <td className="px-3 py-2 text-right">
                                            <button
                                                onClick={() => deleteUser(u.id, u.email)}
                                                className="text-xs font-medium text-red-600 hover:text-red-700"
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

// =============================================================================
// TAB: CORRIDAS DAU
// =============================================================================

function DauRunsTab() {
    const [runs, setRuns] = useState<DauRunRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await fetch('/api/dau/runs');
                const data = await res.json();
                if (res.ok) setRuns(data.runs || []);
                else setError(data.error || 'Error al cargar corridas.');
            } catch {
                setError('Error de red al cargar corridas.');
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    return (
        <section className="rounded-lg border border-gray-200 bg-white p-5">
            <h2 className="mb-3 text-lg font-semibold text-gray-900">Corridas de análisis DAU</h2>
            {loading ? (
                <p className="text-sm text-gray-500">Cargando…</p>
            ) : error ? (
                <p className="text-sm text-red-700">{error}</p>
            ) : runs.length === 0 ? (
                <p className="text-sm text-gray-500">
                    Aún no hay corridas guardadas. Analiza un CSV en el{' '}
                    <Link href="/resultados/dau" className="text-indigo-600 hover:underline">
                        análisis DAU
                    </Link>{' '}
                    y se guardará automáticamente.
                </p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                        <thead>
                            <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                                <th className="px-3 py-2">Archivo</th>
                                <th className="px-3 py-2">Fecha</th>
                                <th className="px-3 py-2">Total</th>
                                <th className="px-3 py-2">Comparables</th>
                                <th className="px-3 py-2">Concordancia</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {runs.map((r) => (
                                <tr key={r.id}>
                                    <td className="px-3 py-2 font-medium text-gray-900">
                                        {r.file_name || '(sin nombre)'}
                                    </td>
                                    <td className="px-3 py-2 text-xs text-gray-500">
                                        {new Date(r.created_at).toLocaleString('es-CL')}
                                    </td>
                                    <td className="px-3 py-2">{r.total}</td>
                                    <td className="px-3 py-2">{r.comparable}</td>
                                    <td className="px-3 py-2">
                                        {r.simple_agreement == null
                                            ? '—'
                                            : `${(r.simple_agreement * 100).toFixed(1)}%`}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
}

// =============================================================================
// TAB: REGISTROS CLÍNICOS
// =============================================================================

function ClinicalRecordsTab() {
    const [records, setRecords] = useState<ClinicalRecordRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await fetch('/api/admin/clinical-records');
                const data = await res.json();
                if (res.ok) setRecords(data.records || []);
                else setError(data.error || 'Error al cargar registros.');
            } catch {
                setError('Error de red al cargar registros.');
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    return (
        <section className="rounded-lg border border-gray-200 bg-white p-5">
            <h2 className="mb-3 text-lg font-semibold text-gray-900">
                Registros clínicos (triages de pacientes)
            </h2>
            {loading ? (
                <p className="text-sm text-gray-500">Cargando…</p>
            ) : error ? (
                <p className="text-sm text-red-700">{error}</p>
            ) : records.length === 0 ? (
                <p className="text-sm text-gray-500">No hay registros clínicos.</p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                        <thead>
                            <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                                <th className="px-3 py-2">Código</th>
                                <th className="px-3 py-2">Síntomas</th>
                                <th className="px-3 py-2">ESI IA</th>
                                <th className="px-3 py-2">ESI Enf.</th>
                                <th className="px-3 py-2">Validado</th>
                                <th className="px-3 py-2">Sexo</th>
                                <th className="px-3 py-2">Grupo etario</th>
                                <th className="px-3 py-2">Fecha</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {records.map((r) => (
                                <tr key={r.id}>
                                    <td className="px-3 py-2 font-mono text-xs">
                                        {r.anonymous_code || r.id.slice(0, 8)}
                                    </td>
                                    <td className="max-w-xs truncate px-3 py-2 text-gray-600" title={r.symptoms_text || ''}>
                                        {r.symptoms_text || '—'}
                                    </td>
                                    <td className="px-3 py-2">{r.esi_level}</td>
                                    <td className="px-3 py-2">{r.nurse_override_level ?? '—'}</td>
                                    <td className="px-3 py-2">
                                        {r.nurse_validated ? (
                                            <span className="text-green-700">sí</span>
                                        ) : (
                                            <span className="text-gray-400">no</span>
                                        )}
                                    </td>
                                    <td className="px-3 py-2">{r.patient_gender || '—'}</td>
                                    <td className="px-3 py-2">{r.patient_age_group || '—'}</td>
                                    <td className="px-3 py-2 text-xs text-gray-500">
                                        {new Date(r.created_at).toLocaleDateString('es-CL')}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
}
