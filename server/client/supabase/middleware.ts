import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { SIGN_IN_URL } from '@/lib/config'
import env from '@/lib/env'

const isProtectedRoute = (path: string) => {
    return path.startsWith('/library') || path.startsWith('/settings') || path.startsWith('/marketplace') || path.startsWith('/daily') || path.startsWith('/fix-your-paper')
}

export async function updateSession(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request,
    })

    const supabase = createServerClient(
        env.NEXT_PUBLIC_SUPABASE_URL,
        env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
                    supabaseResponse = NextResponse.next({
                        request,
                    })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (
        !user &&
        isProtectedRoute(request.nextUrl.pathname)
    ) {
        const url = request.nextUrl.clone()
        url.pathname = SIGN_IN_URL
        return NextResponse.redirect(url)
    }

    return supabaseResponse
}
