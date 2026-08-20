'use client';

/**
 * P\u00e1gina de administraci\u00f3n de organizaciones (PRD I1 RF-02).
 *
 * Un admin de plataforma la usa para crear tenants nuevos. El admin de
 * tenant solo ve su propia organizaci\u00f3n. La UI es minimalista a prop\u00f3sito:
 * el objetivo del I1 es habilitar el piloto controlado, no un panel completo.
 */

import { useEffect, useState } from 'react';

interface Org {
    id: string;
    slug: string;
    name: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export default function OrganizationsAdminPage() {
    const [orgs, setOrgs] = useState<Org[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [slug, setSlug] = useState('');
    const [name, setName] = useState('');
    const [creating, setCreating] = useState(false);
    const [ok, setOk] = useState<string | null>(null);

    async function load() {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/organizations');
            const json = await res.json();
            if (!res.ok) throw new Error(json?.error || 'Error cargando organizaciones.');
            setOrgs(json.organizations as Org[]);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Error cargando organizaciones.');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        load();
    }, []);

    async function onCreate(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        setOk(null);
        setCreating(true);
        try {
            const res = await fetch('/api/admin/organizations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ slug, name }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json?.error || 'No se pudo crear.');
            setOk(`Organizaci\u00f3n creada: ${json.organization.name}`);
            setSlug('');
            setName('');
            await load();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'No se pudo crear.');
        } finally {
            setCreating(false);
        }
    }

    return (
        <main className="min-h-screen bg-slate-50 p-8">
            <div className="max-w-3xl mx-auto space-y-8">
                <header>
                    <h1 className="text-2xl font-bold text-gray-900">Organizaciones</h1>
                    <p className="text-sm text-gray-600 mt-1">
                        Solo el administrador de plataforma puede crear organizaciones nuevas.
                    </p>
                </header>

                <section className="bg-white rounded-2xl shadow p-6">
                    <h2 className="font-semibold text-gray-900 mb-4">Crear organizaci\u00f3n</h2>
                    <form onSubmit={onCreate} className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="md:col-span-1">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
                            <input
                                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                                value={slug}
                                onChange={(e) => setSlug(e.target.value)}
                                placeholder="cesfam-lo-hermida"
                                required
                                pattern="^[a-z0-9]+(-[a-z0-9]+)*$"
                                minLength={3}
                                maxLength={60}
                            />
                            <p className="text-xs text-gray-500 mt-1">Aparece en el link del paciente.</p>
                        </div>
                        <div className="md:col-span-1">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                            <input
                                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="CESFAM Lo Hermida"
                                required
                                maxLength={200}
                            />
                        </div>
                        <div className="md:col-span-1 flex items-end">
                            <button
                                type="submit"
                                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg py-2 disabled:opacity-60"
                                disabled={creating}
                            >
                                {creating ? 'Creando...' : 'Crear'}
                            </button>
                        </div>
                    </form>
                    {error ? <p className="text-sm text-red-600 mt-3">{error}</p> : null}
                    {ok ? <p className="text-sm text-green-600 mt-3">{ok}</p> : null}
                </section>

                <section className="bg-white rounded-2xl shadow p-6">
                    <h2 className="font-semibold text-gray-900 mb-4">Organizaciones existentes</h2>
                    {loading ? (
                        <p className="text-sm text-gray-500">Cargando...</p>
                    ) : orgs.length === 0 ? (
                        <p className="text-sm text-gray-500">Todav\u00eda no hay organizaciones.</p>
                    ) : (
                        <ul className="divide-y divide-gray-100">
                            {orgs.map((o) => (
                                <li key={o.id} className="py-3 flex items-center justify-between">
                                    <div>
                                        <p className="font-medium text-gray-900">{o.name}</p>
                                        <p className="text-xs text-gray-500">
                                            slug: <code className="font-mono">{o.slug}</code>
                                        </p>
                                    </div>
                                    <span
                                        className={
                                            'text-xs font-medium px-2 py-1 rounded ' +
                                            (o.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600')
                                        }
                                    >
                                        {o.is_active ? 'Activa' : 'Inactiva'}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </div>
        </main>
    );
}
