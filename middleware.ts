import { type NextRequest } from 'next/server'
import { updateSession } from '@/server/client/supabase/middleware'

const PROTECTED_ROUTE_PREFIXES = [
    '/library',
    '/settings',
    '/marketplace',
    '/daily',
    '/fix-your-paper',
    '/admin',
    '/memories'
]
const isProtectedRouteChecker = (path: string) => {
    return PROTECTED_ROUTE_PREFIXES.some(prefix => path.startsWith(prefix))
}

export async function middleware(request: NextRequest) {
    return await updateSession(request, isProtectedRouteChecker)
}

export const config = {
    matcher: [
        // Skip Next.js internals and all static files, unless found in search params
        '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
        // Always run for API routes
        '/(api|trpc)(.*)',
    ]
}
