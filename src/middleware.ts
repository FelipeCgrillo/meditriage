import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request,
    });

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) =>
                        request.cookies.set(name, value)
                    );
                    supabaseResponse = NextResponse.next({
                        request,
                    });
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    );
                },
            },
        }
    );

    // Refresh session if expired
    const {
        data: { user },
    } = await supabase.auth.getUser();

    const pathname = request.nextUrl.pathname;

    // Define protected routes and their required roles
    // El orden importa: se evalúa la coincidencia MÁS específica primero, para
    // que /resultados/dau tome su propia regla antes que /resultados.
    const protectedRoutes: Record<string, string[]> = {
        '/admin': ['admin'],
        '/nurse/dashboard': ['nurse', 'admin'],
        '/nurse': ['nurse', 'admin'],
        '/resultados/dau': ['researcher', 'admin'],
        '/resultados': ['researcher', 'admin'],
    };

    // Check if the current path is protected (más específica primero).
    const matchedRoute = Object.keys(protectedRoutes)
        .sort((a, b) => b.length - a.length)
        .find(route => pathname === route || pathname.startsWith(`${route}/`) || pathname.startsWith(route));

    if (matchedRoute) {
        // User not authenticated - redirect to appropriate login
        if (!user) {
            // /admin y /resultados comparten el login de "resultados"; solo el
            // área de enfermería usa su propio login.
            const loginPath = matchedRoute.startsWith('/nurse')
                ? '/login/nurse'
                : '/login/resultados';

            const url = request.nextUrl.clone();
            url.pathname = loginPath;
            url.searchParams.set('redirect', pathname);
            return NextResponse.redirect(url);
        }

        // Get user's role from profile
        const { data: profile } = await supabase
            .from('user_profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        const allowedRoles = protectedRoutes[matchedRoute];

        if (!profile || !allowedRoles.includes(profile.role)) {
            // User doesn't have the required role
            const url = request.nextUrl.clone();
            url.pathname = '/unauthorized';
            return NextResponse.redirect(url);
        }
    }

    // Redirect authenticated users away from login pages
    if (user && pathname.startsWith('/login')) {
        const url = request.nextUrl.clone();

        // Get user's role to redirect to appropriate dashboard
        const { data: profile } = await supabase
            .from('user_profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        if (profile) {
            // 1) Respetar el destino solicitado (?redirect=...) si el rol tiene
            //    permiso para esa ruta. Así, tras loguearse desde /resultados/dau
            //    el usuario vuelve exactamente ahí.
            const requested = request.nextUrl.searchParams.get('redirect');
            if (requested && requested.startsWith('/')) {
                const target = Object.keys(protectedRoutes)
                    .sort((a, b) => b.length - a.length)
                    .find(
                        route =>
                            requested === route ||
                            requested.startsWith(`${route}/`) ||
                            requested.startsWith(route),
                    );
                const allowed = target ? protectedRoutes[target] : null;
                if (!target || (allowed && allowed.includes(profile.role))) {
                    url.pathname = requested;
                    url.search = '';
                    return NextResponse.redirect(url);
                }
            }

            // 2) Destino por defecto según rol. El admin tiene su propio panel
            //    central; researcher → resultados; nurse → enfermería.
            if (profile.role === 'admin') {
                url.pathname = '/admin';
            } else if (profile.role === 'researcher') {
                url.pathname = '/resultados';
            } else if (profile.role === 'nurse') {
                url.pathname = '/nurse/dashboard';
            } else {
                url.pathname = '/';
            }
            url.search = '';
            return NextResponse.redirect(url);
        }
    }

    return supabaseResponse;
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public routes (/, /paciente, /api, etc.)
         */
        '/((?!_next/static|_next/image|favicon.ico|api|paciente|propuesta-piloto|$).*)',
    ],
};
