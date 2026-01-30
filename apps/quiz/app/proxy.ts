import { updateSession, type NextRequest } from '@repo/supabase/proxy'

const PROTECTED_ROUTE_PREFIXES = [
    '/quiz',
]
const isProtectedRouteChecker = (path: string) => {
    return PROTECTED_ROUTE_PREFIXES.some(prefix => path.startsWith(prefix))
}

export async function proxy(request: NextRequest) {
    return await updateSession(request, isProtectedRouteChecker, '/')
}

export const config = {
    matcher: [
        // Skip Next.js internals and all static files, unless found in search params
        '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
        // Always run for API routes
        '/(api|trpc)(.*)',
    ]
}
