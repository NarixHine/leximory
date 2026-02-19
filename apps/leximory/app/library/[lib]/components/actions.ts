'use server'

/**
 * @deprecated Import directly from `@/service/library` instead.
 * Thin wrapper functions kept for backward compatibility.
 */

import * as libraryService from '@/service/library'

export async function star(lib: string) {
    return libraryService.star(lib)
}
