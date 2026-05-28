import { redirect } from 'next/navigation';

/**
 * Alias: /nurse → /nurse/dashboard.
 * Algunos links históricos apuntan al índice; redirigimos al dashboard real.
 * El middleware ya valida el rol antes de permitir la entrada.
 */
export default function NurseIndexPage() {
    redirect('/nurse/dashboard');
}
