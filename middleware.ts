import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isProtectedRoute = createRouteMatcher([
    '/library(.*)',
    '/library/(.*)',

    '/org(.*)',
    '/org/(.*)',

    '/create(.*)',
    '/create/(.*)',

    '/user(.*)',
    '/user/(.*)',

    '/daily(.*)',
])

export default clerkMiddleware(async (auth, req) => {
    if (isProtectedRoute(req)) await auth.protect()
})

export const config = {
    matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)'],
}
