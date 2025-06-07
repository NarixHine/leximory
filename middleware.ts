import { type NextRequest } from 'next/server'
import { protect, updateSession } from '@/server/client/supabase/middleware'

const isProtectedRoute = (path: string) => {
    return path.startsWith('/library') || path.startsWith('/settings') || path.startsWith('/marketplace') || path.startsWith('/daily') || path.startsWith('/fix-your-paper')
}

export async function middleware(request: NextRequest) {
    if (isProtectedRoute(request.nextUrl.pathname)) {
        await protect(request)
    }

    return await updateSession(request)
}

export const config = {
    matcher: [
        // Skip Next.js internals and all static files, unless found in search params
        '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
        // Always run for API routes
        '/(api|trpc)(.*)',
    ]
}
