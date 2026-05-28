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

    // IMPORTANT: getUser() actually validates the JWT and refreshes the cookie
    // if expired. Do not remove or replace with getSession().
    const {
        data: { user },
    } = await supabase.auth.getUser();

    const pathname = request.nextUrl.pathname;

    // Friendly alias: /nurse -> /nurse/dashboard (there is no page at /nurse).
    if (pathname === '/nurse') {
        const url = request.nextUrl.clone();
        url.pathname = '/nurse/dashboard';
        url.search = '';
        return NextResponse.redirect(url);
    }

    // Define protected routes and their required roles.
    // Order matters: more specific paths must be checked before their parents
    // (so `/nurse/dashboard` matches before `/nurse`). We sort by length desc.
    const protectedRoutes: Record<string, string[]> = {
        '/nurse/dashboard': ['nurse', 'admin'],
        '/nurse': ['nurse', 'admin'],
        '/resultados': ['researcher', 'admin'],
    };

    const matchedRoute = Object.keys(protectedRoutes)
        .sort((a, b) => b.length - a.length)
        .find(route => pathname === route || pathname.startsWith(route + '/'));

    if (matchedRoute) {
        // Not authenticated -> bounce to the right login page, carrying the
        // intended destination in `redirect`.
        if (!user) {
            const loginPath = matchedRoute.startsWith('/nurse')
                ? '/login/nurse'
                : '/login/resultados';

            const url = request.nextUrl.clone();
            url.pathname = loginPath;
            url.search = ''; // strip any pre-existing params
            url.searchParams.set('redirect', pathname);
            return NextResponse.redirect(url);
        }

        // Authenticated -> verify role.
        const { data: profile } = await supabase
            .from('user_profiles')
            .select('role')
            .eq('id', user.id)
            .maybeSingle();

        const allowedRoles = protectedRoutes[matchedRoute];

        if (!profile || !allowedRoles.includes(profile.role)) {
            const url = request.nextUrl.clone();
            url.pathname = '/unauthorized';
            url.search = '';
            return NextResponse.redirect(url);
        }
    }

    // Authenticated users hitting a /login/* page get bounced to the place
    // they were originally going (if it was passed via ?redirect=) or to
    // their role's default dashboard. THIS USED TO IGNORE ?redirect= which
    // caused a redirect loop right after sign-in.
    if (user && pathname.startsWith('/login')) {
        const { data: profile } = await supabase
            .from('user_profiles')
            .select('role')
            .eq('id', user.id)
            .maybeSingle();

        if (profile) {
            // 1) Honor an explicit ?redirect= if it points at a safe internal path.
            const requested = request.nextUrl.searchParams.get('redirect');
            const safeRequested =
                requested && requested.startsWith('/') && !requested.startsWith('//')
                    ? requested
                    : null;

            // 2) Otherwise fall back to the role's default dashboard.
            const fallback =
                profile.role === 'nurse' || profile.role === 'admin'
                    ? '/nurse/dashboard'
                    : profile.role === 'researcher'
                    ? '/resultados'
                    : '/';

            // 3) If we are ALREADY on the destination, do not redirect — that
            //    is the actual cause of the infinite loop right after login.
            const target = safeRequested || fallback;
            if (pathname === target) {
                return supabaseResponse;
            }

            const url = request.nextUrl.clone();
            url.pathname = target;
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
