import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@repo/supabase/types'
import { z } from 'zod'
import { checkedResponse } from './http'
import { articleAudioID, articleSpeech } from './article-speech'
import { renderDocument } from './render-document'

export const deletionManifestSchema = z
    .object({
        libraries: z.array(z.string()),
        texts: z.array(z.string()),
        papers: z.array(z.number()),
        files: z.array(z.string()),
        audio: z.array(z.string()),
    })
    .strict()
export type DeletionManifest = z.infer<typeof deletionManifestSchema>
type DatabaseClient = Pick<SupabaseClient<Database>, 'from' | 'storage' | 'auth'>
const chunks = <T>(items: T[], size = 100) =>
    Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, (i + 1) * size))

export function createAccountDeletionPersistence(database: DatabaseClient) {
    async function listFiles(prefix: string): Promise<string[]> {
        const paths: string[] = []
        for (let offset = 0; ; offset += 1000) {
            const { data, error } = await database.storage
                .from('user-files')
                .list(prefix, { limit: 1000, offset, sortBy: { column: 'name', order: 'asc' } })
            if (error) throw error
            for (const file of data) {
                const path = `${prefix}/${file.name}`
                if (file.id) paths.push(path)
                else paths.push(...(await listFiles(path)))
            }
            if (data.length < 1000) return paths
        }
    }
    return {
        async freeze(userId: string, requestId: string) {
            const profile = await database.auth.admin.getUserById(userId)
            if (profile.error) {
                if (profile.error.status === 404 || profile.error.code === 'user_not_found') return
                throw profile.error
            }
            if (
                profile.data.user.app_metadata.account_deletion &&
                profile.data.user.app_metadata.account_deletion !== requestId
            )
                throw new Error('Another account deletion is already active')
            const { error } = await database.auth.admin.updateUserById(userId, {
                app_metadata: { ...profile.data.user.app_metadata, account_deletion: requestId },
                ban_duration: '876000h',
            })
            if (error) throw error
            await database.from('users').update({ token: null }).eq('id', userId).throwOnError()
        },
        async inventory(userId: string): Promise<DeletionManifest> {
            const libraries: string[] = []
            const texts: string[] = []
            const papers: number[] = []
            const files = new Set<string>()
            const audio = new Set<string>()
            for (let offset = 0; ; offset += 200) {
                const { data } = await database
                    .from('libraries')
                    .select('id')
                    .eq('owner', userId)
                    .order('id')
                    .range(offset, offset + 199)
                    .throwOnError()
                libraries.push(...data.map((row) => row.id))
                if (data.length < 200) break
            }
            for (const group of chunks(libraries)) {
                for (let offset = 0; ; offset += 200) {
                    const { data } = await database
                        .from('texts')
                        .select('id,content')
                        .in('lib', group)
                        .order('id')
                        .range(offset, offset + 199)
                        .throwOnError()
                    for (const text of data) {
                        texts.push(text.id)
                        files.add(`ebooks/${text.id}.pdf`)
                        files.add(`ebooks/${text.id}.epub`)
                        for (const path of await listFiles(`pdf-outlines/${text.id}`)) files.add(path)
                        const document = renderDocument(text.content)
                        for (const block of document.blocks) if (block.audioId) audio.add(block.audioId)
                        audio.add(articleAudioID(text.id, articleSpeech(document)))
                    }
                    if (data.length < 200) break
                }
            }
            for (let offset = 0; ; offset += 200) {
                const { data } = await database
                    .from('papers')
                    .select('id')
                    .eq('creator', userId)
                    .order('id')
                    .range(offset, offset + 199)
                    .throwOnError()
                papers.push(...data.map((row) => row.id))
                if (data.length < 200) break
            }
            return checkedResponse(deletionManifestSchema, {
                libraries,
                texts,
                papers,
                files: [...files],
                audio: [...audio],
            })
        },
        async files(manifest: DeletionManifest, userId: string) {
            for (const paths of chunks(manifest.files)) {
                const { error } = await database.storage.from('user-files').remove(paths)
                if (error) throw error
            }
            const { error } = await database.storage.from('avatars').remove([userId])
            if (error) throw error
        },
        async records(manifest: DeletionManifest, userId: string) {
            await database.from('browser_domain_rules').delete().eq('user_id', userId).throwOnError()
            await database.from('bookmarks').delete().eq('uid', userId).throwOnError()
            await database.from('reads').delete().eq('uid', userId).throwOnError()
            await database.from('pdf_page_notes').delete().eq('user_id', userId).throwOnError()
            await database.from('flashbacks').delete().eq('user', userId).throwOnError()
            await database.from('subs').delete().eq('uid', userId).throwOnError()
            await database.from('notes').delete().eq('creator', userId).throwOnError()
            await database.from('submissions').delete().eq('user', userId).throwOnError()
            for (const ids of chunks(manifest.papers)) {
                await database.from('notes').update({ related_paper: null }).in('related_paper', ids).throwOnError()
                await database.from('submissions').delete().in('paper', ids).throwOnError()
                await database.from('dictations').delete().in('paper', ids).throwOnError()
                await database.from('papers').delete().in('id', ids).eq('creator', userId).throwOnError()
            }
            for (const ids of chunks(manifest.texts)) {
                await database.from('bookmarks').delete().in('text', ids).throwOnError()
                await database.from('reads').delete().in('text', ids).throwOnError()
                await database.from('pdf_page_notes').delete().in('text_id', ids).throwOnError()
                await database.from('texts').delete().in('id', ids).throwOnError()
            }
            for (const ids of chunks(manifest.libraries)) {
                await database.from('browser_domain_rules').delete().in('library_id', ids).throwOnError()
                await database.from('lexicon').delete().in('lib', ids).throwOnError()
                await database.from('libraries').delete().in('id', ids).eq('owner', userId).throwOnError()
            }
            while (true) {
                const { data } = await database
                    .from('libraries')
                    .select('id,starred_by')
                    .contains('starred_by', [userId])
                    .limit(100)
                    .throwOnError()
                if (!data.length) break
                for (const row of data) {
                    const previous = checkedResponse(z.array(z.uuid()), row.starred_by)
                    await database
                        .from('libraries')
                        .update({ starred_by: previous.filter((id) => id !== userId) })
                        .eq('id', row.id)
                        .filter('starred_by', 'eq', `{${previous.join(',')}}`)
                        .throwOnError()
                }
            }
            // Keep transaction-chain facts for duplicate-delivery protection; they can no longer grant this user access.
            await database.from('apple_subscriptions').update({ user_id: null }).eq('user_id', userId).throwOnError()
            await database.from('users').delete().eq('id', userId).throwOnError()
        },
        async audio(manifest: DeletionManifest) {
            for (const id of manifest.audio) {
                const { data } = await database
                    .from('texts')
                    .select('id')
                    .like('content', `%:::${id}%`)
                    .limit(1)
                    .throwOnError()
                if (!data.length) {
                    const { error } = await database.storage.from('user-files').remove([`audio/${id}.mp3`])
                    if (error) throw error
                }
            }
        },
        async auth(userId: string) {
            const { error } = await database.auth.admin.deleteUser(userId)
            if (error && error.status !== 404 && error.code !== 'user_not_found') throw error
        },
    }
}
