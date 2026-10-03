import { LIB_ACCESS_STATUS } from '@repo/env/access'
import type { Tables } from '@repo/supabase/types'

export type AccessSubject = Readonly<{ userId: string }>
type Library = Tables<'libraries'>
export type LibraryReadAccess = Readonly<Pick<Library, 'owner' | 'access' | 'starred_by'>>
export type LibraryWriteAccess = Readonly<Pick<Library, 'owner'>>

export function canReadLibrary(subject: AccessSubject | null, library: LibraryReadAccess | null): boolean {
    if (!subject || !library) return false
    if (library.owner === subject.userId) return true
    return library.access === LIB_ACCESS_STATUS.public && library.starred_by?.includes(subject.userId) === true
}

export function canWriteLibrary(subject: AccessSubject | null, library: LibraryWriteAccess | null): boolean {
    return subject !== null && library !== null && library.owner === subject.userId
}
