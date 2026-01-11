/**
 * Checks if the given URL's domain is leximory.com or a subdomain.
 * For relative URLs, returns true as they are considered safe.
 * @param url - The URL string to check
 * @returns true if the domain is safe, false otherwise
 */
function isTrustedPathname(url: string): boolean {
    try {
        const parsed = new URL(url)
        const hostname = parsed.hostname
        return hostname === 'leximory.com' || hostname.endsWith('.leximory.com')
    } catch {
        // Assume relative URLs are safe
        return true
    }
}

export { isTrustedPathname }
