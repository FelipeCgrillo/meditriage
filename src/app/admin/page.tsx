'use client';

/**
 * Inicio del panel de administración: accesos rápidos a las secciones de
 * gestión (sidebar) y a los otros paneles de la plataforma.
 */

import Link from 'next/link';
import { useAuth } from '@/components/auth/AuthProvider';

const MANAGEMENT = [
    {
        href: '/admin/organizations',
        title: 'Organizaciones',
        desc: 'Crear y gestionar organizaciones (solo admin de plataforma).',
    },
    {
        href: '/admin/users',
        title: 'Usuarios',
        desc: 'Crear cuentas de enfermería, investigación y administración.',
    },
    {
        href: '/admin/dau',
        title: 'Corridas DAU',
        desc: 'Historial de análisis retrospectivos guardados.',
    },
    {
        href: '/admin/records',
        title: 'Registros clínicos',
        desc: 'Triages de pacientes registrados en la plataforma.',
    },
];

const PANELS = [
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

function CardGrid({ items }: { items: typeof MANAGEMENT }) {
    return (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((c) => (
                <Link
                    key={c.href}
                    href={c.href}
                    className="group block rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md"
                >
                    <h3 className="text-base font-semibold text-slate-900 group-hover:text-indigo-700">
                        {c.title}
                    </h3>
                    <p className="mt-1 text-sm leading-relaxed text-slate-500">{c.desc}</p>
                    <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-indigo-600">
                        Abrir
                        <svg className="h-4 w-4 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                        </svg>
                    </span>
                </Link>
            ))}
        </div>
    );
}

export default function AdminHomePage() {
    const { profile } = useAuth();

    return (
        <div className="mx-auto max-w-6xl space-y-8">
            <div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                    Hola{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                    Gestiona organizaciones, usuarios y datos de la plataforma desde el menú lateral.
                </p>
            </div>

            <section className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
                    Gestión
                </h3>
                <CardGrid items={MANAGEMENT} />
            </section>

            <section className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
                    Otros paneles
                </h3>
                <CardGrid items={PANELS} />
            </section>
        </div>
    );
}
