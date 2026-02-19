'use server'

/**
 * @deprecated Import directly from `@/service/library` instead.
 * Thin wrapper functions kept for backward compatibility.
 */

import * as libraryService from '@/service/library'

export async function save(data: Parameters<typeof libraryService.save>[0]) {
    return libraryService.save(data)
}

export async function create(data: Parameters<typeof libraryService.create>[0]) {
    return libraryService.create(data)
}

export async function remove({ id }: { id: string }) {
    return libraryService.remove({ id })
}

export async function archive({ id }: { id: string }) {
    return libraryService.archive({ id })
}

export async function unarchive({ id }: { id: string }) {
    return libraryService.unarchive({ id })
}

export async function unstar({ id }: { id: string }) {
    return libraryService.unstar({ id })
}
