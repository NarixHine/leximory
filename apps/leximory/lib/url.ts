/**
 * Checks whether a redirect target is safe.
 *
 * Allowed targets are same-origin absolute paths (e.g. `/library`) and absolute
 * URLs whose host is leximory.com, a `.leximory.com` subdomain, or localhost /
 * 127.0.0.0/8 for development. Everything is resolved against a trusted base so
 * protocol-relative (`//evil.com`), backslash (`/\evil.com`), and non-http(s)
 * schemes cannot slip through.
 *
 * @param url - The candidate redirect target.
 * @returns true if the target is a trusted path or host.
 */
function isTrustedPathname(url: string): boolean {
    try {
        const resolved = new URL(url, 'https://leximory.com')
        const protocolOk = resolved.protocol === 'https:' || resolved.protocol === 'http:'
        const hostname = resolved.hostname

        return (
            protocolOk &&
            (hostname === 'leximory.com' ||
                hostname.endsWith('.leximory.com') ||
                hostname === 'localhost' ||
                hostname === '[::1]' ||
                /^127(?:\.\d{1,3}){3}$/.test(hostname))
        )
    } catch {
        return false
    }
}

export { isTrustedPathname }
