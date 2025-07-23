import { NextResponse } from 'next/server'
import { createClient } from '@/server/client/supabase/server'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')
    const cookieStore = await cookies()
    let next = cookieStore.get('next')?.value ?? '/'
    if (!next.startsWith('/')) {
        next = '/'
    }
    if (code) {
        const supabase = await createClient()
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (!error) {
            const response = NextResponse.redirect(`${origin}${next}`)
            // Clear the cookie on the response
            response.cookies.set('next', '', { maxAge: 0 })
            return response
        }
    }

    // return the user to an error page with instructions
    return NextResponse.redirect(`${origin}/callback-error`)
}
