import { NextResponse } from 'next/server'
import { createClient } from '@repo/supabase/server'
import { isTrustedPathname } from '@/lib/url'

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')
    const nextParam = searchParams.get('next') || '/'
    const next = isTrustedPathname(nextParam) ? nextParam : '/'
    if (code) {
        const supabase = await createClient()
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (!error) {
            const response = NextResponse.redirect(`${origin}${next}`)
            return response
        }
    }

    // return the user to an error page with instructions
    return NextResponse.redirect(`${origin}/callback-error`)
}
