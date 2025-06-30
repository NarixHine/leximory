// utils/getSubdomain.ts

import { headers } from 'next/headers'

/**
 * Retrieves the subdomain from the request host on the server-side.
 * @returns {Promise<string | null>} The subdomain if found, otherwise null.
 */
export async function getSubdomain(): Promise<string | null> {
    const headersList = await headers()
    const host = headersList.get('host')

    if (!host) {
        return null
    }

    const subdomain = host.split('.')[0]

    return subdomain
}

/**
 * Checks if the current subdomain is 'read'.
 * @returns {Promise<boolean>} True if the subdomain is 'read', otherwise false.
 */
export async function isAtRead(): Promise<boolean> {
    const subdomain = await getSubdomain()
    return subdomain === 'read'
}
