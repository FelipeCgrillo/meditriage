import AdminShell from '@/components/admin/AdminShell';

/**
 * Layout del área de administración: envuelve todas las rutas /admin/* con
 * el sidebar colapsable persistente. El middleware ya restringe el acceso
 * a usuarios con rol admin.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
    return <AdminShell>{children}</AdminShell>;
}
