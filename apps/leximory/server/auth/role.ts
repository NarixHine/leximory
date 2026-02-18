import 'server-only'
import { ADMIN_UID, Lang, LIB_ACCESS_STATUS } from '@repo/env/config'
import { supabase } from '@repo/supabase'
import { getUserOrThrow } from '@repo/user'

/**
 * Role-based access control utilities for Leximory application.
 * Provides authentication and authorization functions for admin access,
 * library operations, and text content management.
 */

// =============================================================================
// Admin Access Control
// =============================================================================

/**
 * Ensures the current user has admin privileges.
 * @throws {Error} If user is not authenticated or not an admin
 * @example
 * ```typescript
 * await requireAdmin(); // Throws if not admin
 * ```
 */
export async function requireAdmin() {
    const user = await getUserOrThrow()
    if (user.userId !== ADMIN_UID) {
        throw new Error('Unauthorized')
    }
}

// =============================================================================
// Library Access Control
// =============================================================================

/**
 * Authorizes write access to a library and returns library metadata.
 * Only the library owner can perform write operations.
 * 
 * @deprecated Use `Kilpi.libraries.write()` from `@repo/service/kilpi` instead.
 * @param lib - The library ID to check access for
 * @param explicitUserId - Optional user ID to check (defaults to current user)
 * @returns Promise resolving to library language configuration
 * @throws {Error} If library not found or user lacks write access
 */
export const authWriteToLib = async (lib: string, explicitUserId?: string) => {
    const { userId } = explicitUserId ? { userId: explicitUserId } : await getUserOrThrow()

    const { data: rec, error } = await supabase
        .from('libraries')
        .select('lang')
        .eq('id', lib)
        .eq('owner', userId)
        .single()

    if (error || !rec) {
        throw new Error('Library not found or access denied')
    }

    return { lang: rec.lang as Lang }
}

/**
 * Authorizes read access to a library and returns comprehensive metadata.
 * Access is granted to:
 * - Library owner (full access)
 * - Users who have starred public libraries (read-only)
 * 
 * @deprecated Use `Kilpi.libraries.read()` from `@repo/service/kilpi` instead.
 * @param lib - The library ID to check access for
 * @returns Promise resolving to library metadata with access information
 * @throws {Error} If library not found or user lacks read access
 */
export const authReadToLib = async (lib: string) => {
    const { userId } = await getUserOrThrow()

    const { data: rec, error } = await supabase
        .from('libraries')
        .select('owner, lang, name, starred_by, price, access')
        .eq('id', lib)
        .or(`owner.eq.${userId},and(access.eq.${LIB_ACCESS_STATUS.public},starred_by.cs.{"${userId}"})`)
        .single()

    if (error || !rec) {
        throw new Error('Library not found or access denied')
    }

    const isReadOnly = rec.owner !== userId
    const isOwner = rec.owner === userId
    const { lang } = rec
    return {
        isReadOnly,
        isOwner,
        owner: rec.owner,
        lang: lang as Lang,
        name: rec.name,
        starredBy: rec.starred_by,
        price: rec.price,
        access: rec.access
    }
}

/**
 * Retrieves library metadata without throwing on access denial.
 * This is a non-throwing variant that returns data even if user lacks access.
 * Useful for displaying library information in UI contexts.
 * 
 * @deprecated Use `Kilpi.libraries.read()` from `@repo/service/kilpi` instead.
 * @param lib - The library ID to retrieve data for
 * @returns Promise resolving to library metadata with star status
 * @throws {Error} Only on database errors, not access issues
 */
export const authReadToLibWithoutThrowing = async (lib: string) => {
    const { userId } = await getUserOrThrow()

    const { data: rec } = await supabase
        .from('libraries')
        .select('owner, lang, name, starred_by, price, access')
        .eq('id', lib)
        .single()
        .throwOnError()

    const isReadOnly = rec.owner !== userId
    const isOwner = rec.owner === userId
    const { lang } = rec
    return {
        isReadOnly,
        isOwner,
        owner: rec.owner,
        lang: lang as Lang,
        name: rec.name,
        starredBy: rec.starred_by,
        price: rec.price,
        access: rec.access,
        isStarred: Boolean(rec.starred_by?.includes(userId))
    }
}

// =============================================================================
// Text Access Control
// =============================================================================

/**
 * Authorizes write access to a text item and returns full text data.
 * Only the owner of the parent library can modify text content.
 * 
 * @deprecated Use `Kilpi.texts.write()` from `@repo/service/kilpi` instead.
 * @param text - The text ID to check access for
 * @returns Promise resolving to text record with library information
 * @throws {Error} If text not found or user lacks write access
 */
export const authWriteToText = async (text: string) => {
    const { userId } = await getUserOrThrow()

    const { data: rec, error } = await supabase
        .from('texts')
        .select(`
            *,
            lib:libraries!inner (
                id,
                owner,
                access
            )
        `)
        .eq('id', text)
        .eq('lib.owner', userId)
        .single()

    if (error || !rec) {
        throw new Error('Text not found or access denied')
    }

    return rec
}

/**
 * Authorizes read access to a text item and returns full text data.
 * Access is granted to:
 * - Library owner (full access)
 * - Any user if the parent library is public
 * 
 * @deprecated Use `Kilpi.texts.read()` from `@repo/service/kilpi` instead.
 * @param text - The text ID to check access for
 * @returns Promise resolving to text record with library information
 * @throws {Error} If text not found or user lacks read access
 */
export const authReadToText = async (text: string) => {
    const { userId } = await getUserOrThrow()

    const { data: rec, error } = await supabase
        .from('texts')
        .select(`
            *,
            lib:libraries!inner (
                id,
                owner,
                access
            )
        `)
        .eq('id', text)
        .or(`owner.eq.${userId},access.eq.${LIB_ACCESS_STATUS.public}`, { referencedTable: 'libraries' })
        .single()

    if (error || !rec) {
        throw new Error('Text not found or access denied')
    }

    return rec
}

// =============================================================================
// Query Filter Helpers
// =============================================================================

/**
 * Type representing an OR filter configuration for database queries.
 * Used to build complex access control queries.
 */
export type OrFilter = Awaited<ReturnType<typeof isListedFilter>>

/**
 * Generates filter configuration for listing libraries accessible to current user.
 * Returns filters that match:
 * - Libraries owned by the user
 * - Public libraries that the user has starred
 * 
 * @returns Promise resolving to filter configuration object
 * @example
 * ```typescript
 * const { filters, options } = await isListedFilter();
 * // Use in supabase query: .or(filters, options)
 * ```
 */
export const isListedFilter = async () => {
    const { userId } = await getUserOrThrow()
    return {
        filters: `owner.eq.${userId},and(starred_by.cs.{"${userId}"},access.eq.${LIB_ACCESS_STATUS.public})`,
        options: { referencedTable: 'libraries' }
    }
}
