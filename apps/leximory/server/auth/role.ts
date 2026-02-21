import 'server-only'
import { ADMIN_UID, LIB_ACCESS_STATUS } from '@repo/env/config'
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
