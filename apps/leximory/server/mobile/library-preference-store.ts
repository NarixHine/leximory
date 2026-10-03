import 'server-only'
import { supabase } from '@repo/supabase'
import { z } from 'zod'
import { MobileError } from './errors'

export async function setLibraryArchived(userId: string, libraryId: string, archived: boolean, signal: AbortSignal) {
    for (let attempt = 0; attempt < 3; attempt++) {
        const { data: user } = await supabase.from('users').select('archived_libs').eq('id', userId).abortSignal(signal).maybeSingle().throwOnError()
        if (!user) throw new MobileError('inaccessible')
        const current = z.array(z.string()).nullable().parse(user.archived_libs)
        const ids = current ?? []
        if (ids.includes(libraryId) === archived) return
        const updated = archived ? [...ids, libraryId] : ids.filter(id => id !== libraryId)
        let query = supabase.from('users').update({ archived_libs: updated }).eq('id', userId)
        query = current === null ? query.is('archived_libs', null) : query.filter('archived_libs', 'eq', `{${current.map(id => JSON.stringify(id)).join(',')}}`)
        const { data } = await query.select('id').abortSignal(signal).throwOnError()
        if (data.length) return
    }
    throw new MobileError('service_unavailable')
}
