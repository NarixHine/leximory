import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const isProtectedRoute = (path: string) => {
    return path.startsWith('/library') || path.startsWith('/settings') || path.startsWith('/marketplace') || path.startsWith('/daily') || path.startsWith('/fix-your-paper')
}

export async function updateSession(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request,
    })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
        url.pathname = '/auth/login'
        return NextResponse.redirect(url)
    }

    return supabaseResponse
}
