import 'server-only'
import type { supabase } from '@repo/supabase'
import { z } from 'zod'
import { LangSchema } from '@repo/schema/library'
import type { EbookImportFolder, EbookImportStore } from './ebook-import'
import { checkedResponse } from './http'
import { createLibraryPreferenceStore } from './library-preference-store'

const folderRows = z.array(z.object({ id: z.string(), name: z.string(), lang: LangSchema }))
const ebookRows = z.array(z.object({ title: z.string() }))
const pageSize = 200

export function ebookImportFolders(database: Pick<typeof supabase, 'from'>): EbookImportStore['folders'] {
    return async (subject, signal) => {
        const archived = new Set(await createLibraryPreferenceStore(database).archived(subject.userId, signal))
        const folders: z.infer<typeof folderRows> = []
        for (let offset = 0; ; offset += pageSize) {
            const { data } = await database
                .from('libraries')
                .select('id,name,lang')
                .eq('owner', subject.userId)
                .eq('shadow', false)
                .order('id')
                .range(offset, offset + pageSize - 1)
                .abortSignal(signal)
                .throwOnError()
            const page = checkedResponse(folderRows, data)
            folders.push(...page.filter((folder) => !archived.has(folder.id)))
            if (page.length < pageSize) break
        }
        const result: EbookImportFolder[] = []
        // Each library gets its own sample, with bounded concurrent database reads.
        for (let start = 0; start < folders.length; start += 8) {
            const batch = await Promise.all(
                folders.slice(start, start + 8).map(async (folder) => {
                    const { data } = await database
                        .from('texts')
                        .select('title')
                        .eq('lib', folder.id)
                        .eq('has_ebook', true)
                        .order('created_at', { ascending: false })
                        .order('id')
                        .limit(6)
                        .abortSignal(signal)
                        .throwOnError()
                    const ebooks = checkedResponse(ebookRows, data)
                    return {
                        id: folder.id,
                        name: folder.name,
                        language: folder.lang,
                        titles: ebooks.map((ebook) => ebook.title.slice(0, 512)),
                    }
                }),
            )
            result.push(...batch)
        }
        return result
    }
}
