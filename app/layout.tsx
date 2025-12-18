import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/components/auth/AuthProvider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
    title: 'Sistema de Auto-Triage - CESFAM',
    description: 'Sistema de triaje asistido por inteligencia artificial para centros de atención primaria de salud',
    keywords: ['triaje', 'ESI', 'salud', 'CESFAM', 'inteligencia artificial'],
    authors: [{ name: 'CESFAM Research Team' }],
    robots: 'noindex, nofollow', // Privacy: Don't index medical application
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="es">
            <body className={inter.className}>
                <AuthProvider>
                    {children}
                </AuthProvider>
            </body>
        </html>
    );
}

