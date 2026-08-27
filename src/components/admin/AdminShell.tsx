'use client';

/**
 * AdminShell: estructura persistente del panel de administración.
 *
 * Sidebar colapsable (PRD I1, feedback de usabilidad): el menú queda siempre
 * visible al navegar entre secciones. El estado colapsado se persiste en
 * localStorage. En pantallas pequeñas el sidebar se vuelve un drawer.
 */

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogoutButton } from '@/components/auth/LogoutButton';
import { useAuth } from '@/components/auth/AuthProvider';

const STORAGE_KEY = 'meditriage.admin.sidebar.collapsed';

interface NavItem {
    href: string;
    label: string;
    icon: React.ReactNode;
    exact?: boolean;
}

const iconClass = 'h-5 w-5 shrink-0';

const NAV_MAIN: NavItem[] = [
    {
        href: '/admin',
        label: 'Inicio',
        exact: true,
        icon: (
            <svg className={iconClass} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75" />
            </svg>
        ),
    },
    {
        href: '/admin/organizations',
        label: 'Organizaciones',
        icon: (
            <svg className={iconClass} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
            </svg>
        ),
    },
    {
        href: '/admin/users',
        label: 'Usuarios',
        icon: (
            <svg className={iconClass} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
        ),
    },
    {
        href: '/admin/dau',
        label: 'Corridas DAU',
        icon: (
            <svg className={iconClass} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
        ),
    },
    {
        href: '/admin/records',
        label: 'Registros clínicos',
        icon: (
            <svg className={iconClass} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 13.5h6m-6 3h4.5" />
            </svg>
        ),
    },
];

const NAV_PANELS: NavItem[] = [
    {
        href: '/resultados',
        label: 'Panel de Resultados',
        icon: (
            <svg className={iconClass} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
            </svg>
        ),
    },
    {
        href: '/resultados/dau',
        label: 'Análisis DAU',
        icon: (
            <svg className={iconClass} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
            </svg>
        ),
    },
    {
        href: '/nurse/dashboard',
        label: 'Panel de Enfermería',
        icon: (
            <svg className={iconClass} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
            </svg>
        ),
    },
];

function NavLink({
    item,
    collapsed,
    active,
}: {
    item: NavItem;
    collapsed: boolean;
    active: boolean;
}) {
    return (
        <Link
            href={item.href}
            title={collapsed ? item.label : undefined}
            className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                active
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            } ${collapsed ? 'justify-center px-2' : ''}`}
        >
            {item.icon}
            {!collapsed && <span className="truncate">{item.label}</span>}
        </Link>
    );
}

const TITLES: Record<string, string> = {
    '/admin': 'Inicio',
    '/admin/organizations': 'Organizaciones',
    '/admin/users': 'Usuarios',
    '/admin/dau': 'Corridas DAU',
    '/admin/records': 'Registros clínicos',
};

export default function AdminShell({
    title,
    children,
}: {
    title?: string;
    children: React.ReactNode;
}) {
    const { profile, loading: authLoading } = useAuth();
    const pathname = usePathname();
    const [collapsed, setCollapsed] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);

    // Restaura preferencia del sidebar.
    useEffect(() => {
        try {
            setCollapsed(localStorage.getItem(STORAGE_KEY) === '1');
        } catch {
            /* sin localStorage */
        }
    }, []);

    function toggleCollapsed() {
        setCollapsed((c) => {
            try {
                localStorage.setItem(STORAGE_KEY, c ? '0' : '1');
            } catch {
                /* sin localStorage */
            }
            return !c;
        });
    }

    // Cierra el drawer móvil al navegar.
    useEffect(() => {
        setMobileOpen(false);
    }, [pathname]);

    const isActive = (item: NavItem) =>
        item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);

    const sidebarContent = (
        <div className="flex h-full flex-col">
            {/* Marca */}
            <div className={`flex items-center gap-3 px-4 py-5 ${collapsed ? 'justify-center px-2' : ''}`}>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                    </svg>
                </div>
                {!collapsed && (
                    <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-white">MediTriage</p>
                        <p className="truncate text-xs text-slate-400">Administración</p>
                    </div>
                )}
            </div>

            {/* Navegación principal */}
            <nav className="flex-1 space-y-1 overflow-y-auto px-3">
                {NAV_MAIN.map((item) => (
                    <NavLink key={item.href} item={item} collapsed={collapsed} active={isActive(item)} />
                ))}

                <div className={`pb-1 pt-5 ${collapsed ? 'px-0' : 'px-3'}`}>
                    {collapsed ? (
                        <div className="mx-auto h-px w-6 bg-slate-700" />
                    ) : (
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                            Otros paneles
                        </p>
                    )}
                </div>
                {NAV_PANELS.map((item) => (
                    <NavLink key={item.href} item={item} collapsed={collapsed} active={isActive(item)} />
                ))}
            </nav>

            {/* Usuario + salir */}
            <div className={`border-t border-slate-800 p-3 ${collapsed ? 'flex flex-col items-center gap-2' : ''}`}>
                {!collapsed && (
                    <p className="mb-2 truncate px-1 text-xs text-slate-400" title={profile?.email || ''}>
                        {profile?.full_name || profile?.email || 'Administrador'}
                    </p>
                )}
                <LogoutButton />
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-100">
            {/* Sidebar escritorio */}
            <aside
                className={`fixed inset-y-0 left-0 z-30 hidden bg-slate-900 transition-all duration-200 lg:block ${
                    collapsed ? 'w-16' : 'w-64'
                }`}
            >
                {sidebarContent}
            </aside>

            {/* Drawer móvil */}
            {mobileOpen && (
                <div className="fixed inset-0 z-40 lg:hidden">
                    <div
                        className="absolute inset-0 bg-black/50"
                        onClick={() => setMobileOpen(false)}
                        aria-hidden
                    />
                    <aside className="absolute inset-y-0 left-0 w-64 bg-slate-900 shadow-xl">
                        {sidebarContent}
                    </aside>
                </div>
            )}

            {/* Contenido */}
            <div className={`transition-all duration-200 ${collapsed ? 'lg:pl-16' : 'lg:pl-64'}`}>
                {/* Barra superior */}
                <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur sm:px-6">
                    {/* Toggle móvil */}
                    <button
                        onClick={() => setMobileOpen(true)}
                        className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
                        aria-label="Abrir menú"
                    >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                        </svg>
                    </button>
                    {/* Toggle escritorio */}
                    <button
                        onClick={toggleCollapsed}
                        className="hidden rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:block"
                        aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
                        title={collapsed ? 'Expandir menú' : 'Colapsar menú'}
                    >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            {collapsed ? (
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                            ) : (
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                            )}
                        </svg>
                    </button>
                    <h1 className="truncate text-base font-semibold text-slate-900">
                        {title || TITLES[pathname] || 'Panel de Administración'}
                    </h1>
                </header>

                {/* Aviso defensa en profundidad si no es admin */}
                {!authLoading && profile && profile.role !== 'admin' && (
                    <div className="px-4 pt-6 sm:px-6">
                        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                            Esta sección es solo para administradores.
                        </div>
                    </div>
                )}

                <main className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>
            </div>
        </div>
    );
}
