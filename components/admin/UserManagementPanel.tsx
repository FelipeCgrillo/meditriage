'use client';

import { useState, useEffect } from 'react';

interface UserProfile {
    id: string;
    email: string;
    role: 'nurse' | 'researcher' | 'admin';
    full_name: string | null;
    created_at: string;
}

interface UserManagementPanelProps {
    isOpen: boolean;
    onClose: () => void;
}

export function UserManagementPanel({ isOpen, onClose }: UserManagementPanelProps) {
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Form state
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState<'nurse' | 'researcher' | 'admin'>('nurse');
    const [fullName, setFullName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchUsers();
        }
    }, [isOpen]);

    async function fetchUsers() {
        setLoading(true);
        try {
            const response = await fetch('/api/admin/users');
            const data = await response.json();

            if (response.ok) {
                setUsers(data.users || []);
            } else {
                setError(data.error);
            }
        } catch (err) {
            setError('Error al cargar usuarios');
        } finally {
            setLoading(false);
        }
    }

    async function handleCreateUser(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        setSuccess(null);
        setIsSubmitting(true);

        try {
            const response = await fetch('/api/admin/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email,
                    password,
                    role,
                    fullName: fullName || undefined,
                }),
            });

            const data = await response.json();

            if (response.ok) {
                setSuccess(`Usuario ${email} creado exitosamente con rol ${role}`);
                setEmail('');
                setPassword('');
                setFullName('');
                fetchUsers();
            } else {
                setError(data.error);
            }
        } catch (err) {
            setError('Error al crear usuario');
        } finally {
            setIsSubmitting(false);
        }
    }

    async function handleDeleteUser(userId: string, userEmail: string) {
        if (!confirm(`¿Estás seguro de eliminar al usuario ${userEmail}?`)) {
            return;
        }

        try {
            const response = await fetch(`/api/admin/users?id=${userId}`, {
                method: 'DELETE',
            });

            const data = await response.json();

            if (response.ok) {
                setSuccess(`Usuario ${userEmail} eliminado`);
                fetchUsers();
            } else {
                setError(data.error);
            }
        } catch (err) {
            setError('Error al eliminar usuario');
        }
    }

    function getRoleBadge(role: string) {
        const styles: Record<string, string> = {
            nurse: 'bg-teal-100 text-teal-800',
            researcher: 'bg-indigo-100 text-indigo-800',
            admin: 'bg-amber-100 text-amber-800',
        };
        const labels: Record<string, string> = {
            nurse: 'Enfermera',
            researcher: 'Investigador',
            admin: 'Administrador',
        };
        return (
            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${styles[role] || 'bg-gray-100 text-gray-800'}`}>
                {labels[role] || role}
            </span>
        );
    }

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold text-white">Gestión de Usuarios</h2>
                        <p className="text-indigo-200 text-sm">Crear y administrar usuarios del sistema</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-white/80 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
                    {/* Messages */}
                    {error && (
                        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                            {error}
                        </div>
                    )}
                    {success && (
                        <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
                            {success}
                        </div>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Create User Form */}
                        <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                                </svg>
                                Crear Nuevo Usuario
                            </h3>

                            <form onSubmit={handleCreateUser} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Correo Electrónico *
                                    </label>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                        placeholder="usuario@email.com"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Contraseña *
                                    </label>
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        minLength={6}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                        placeholder="Mínimo 6 caracteres"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Nombre Completo
                                    </label>
                                    <input
                                        type="text"
                                        value={fullName}
                                        onChange={(e) => setFullName(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                        placeholder="Juan Pérez"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Rol *
                                    </label>
                                    <select
                                        value={role}
                                        onChange={(e) => setRole(e.target.value as 'nurse' | 'researcher' | 'admin')}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                    >
                                        <option value="nurse">🩺 Enfermera - Acceso a /nurse</option>
                                        <option value="researcher">📊 Investigador - Acceso a /resultados</option>
                                        <option value="admin">👑 Administrador - Acceso completo</option>
                                    </select>
                                </div>

                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                            </svg>
                                            <span>Creando...</span>
                                        </>
                                    ) : (
                                        <>
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                            </svg>
                                            <span>Crear Usuario</span>
                                        </>
                                    )}
                                </button>
                            </form>
                        </div>

                        {/* Users List */}
                        <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                    <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                    Usuarios ({users.length})
                                </h3>
                                <button
                                    onClick={fetchUsers}
                                    className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                    title="Actualizar"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                </button>
                            </div>

                            {loading ? (
                                <div className="text-center py-8">
                                    <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto"></div>
                                    <p className="text-gray-500 mt-2">Cargando...</p>
                                </div>
                            ) : users.length === 0 ? (
                                <div className="text-center py-8 text-gray-500">
                                    <svg className="w-12 h-12 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                    <p>No hay usuarios registrados</p>
                                </div>
                            ) : (
                                <div className="space-y-3 max-h-80 overflow-y-auto">
                                    {users.map((user) => (
                                        <div
                                            key={user.id}
                                            className="bg-white rounded-lg p-3 border border-gray-200 flex justify-between items-center"
                                        >
                                            <div>
                                                <p className="font-medium text-gray-900">{user.full_name || user.email}</p>
                                                {user.full_name && (
                                                    <p className="text-sm text-gray-500">{user.email}</p>
                                                )}
                                                <div className="mt-1">{getRoleBadge(user.role)}</div>
                                            </div>
                                            <button
                                                onClick={() => handleDeleteUser(user.id, user.email)}
                                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                title="Eliminar usuario"
                                            >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
