/**
 * One-time migration for ebook bookmarks that were stored inside a text's
 * `content` field as Markdown blockquotes.
 *
 * Behaviour:
 * - Dry run by default. Nothing is written unless `--apply` is passed.
 * - Only "pure" content is migrated: every non-blank line must belong to an
 *   attributed bookmark block. Mixed or prose content is left completely
 *   untouched so nothing authored can be lost.
 * - Migrated bookmarks are written to the library owner's private `bookmarks`
 *   rows, then `content` is cleared. A second run finds nothing to do.
 *
 * Usage:
 *   node --env-file=.env --import tsx scripts/migrate-ebook-bookmarks.ts
 *   node --env-file=.env --import tsx scripts/migrate-ebook-bookmarks.ts --apply
 */
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@repo/supabase/types'
import { analyzeBookmarks } from '../lib/bookmarks'

const APPLY = process.argv.includes('--apply')

const url = process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceRoleKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set')
}

const supabase = createClient<Database>(url, serviceRoleKey)

async function main() {
    const { data: texts } = await supabase
        .from('texts')
        .select('id, content, lib')
        .eq('has_ebook', true)
        .throwOnError()

    const libIds = [
        ...new Set(
            (texts ?? [])
                .map(text => text.lib)
                .filter((id): id is string => typeof id === 'string'),
        ),
    ]

    const { data: libraries } = await supabase
        .from('libraries')
        .select('id, owner')
        .in('id', libIds)
        .throwOnError()

    const ownerByLib = new Map((libraries ?? []).map(lib => [lib.id, lib.owner]))

    let migrated = 0
    let inserted = 0
    let skipped = 0

    for (const text of texts ?? []) {
        const owner = text.lib ? ownerByLib.get(text.lib) : undefined
        if (!owner) continue

        const { bookmarks, isPureBookmarks } = analyzeBookmarks(text.content ?? '')

        if (!isPureBookmarks) {
            if (bookmarks.length > 0) {
                console.log(`skip    ${text.id}  content holds more than bookmarks`)
                skipped++
            }
            continue
        }

        const { count } = await supabase
            .from('bookmarks')
            .select('id', { count: 'exact', head: true })
            .eq('text', text.id)
            .eq('uid', owner)

        if ((count ?? 0) > 0) {
            console.log(`skip    ${text.id}  already migrated`)
            continue
        }

        console.log(`migrate ${text.id}  ${bookmarks.length} bookmark(s) -> owner ${owner}`)
        migrated++
        inserted += bookmarks.length

        if (!APPLY) continue

        try {
            const { error: insertError } = await supabase.from('bookmarks').insert(
                bookmarks.map(bookmark => ({
                    uid: owner,
                    text: text.id,
                    quote: bookmark.text,
                    chapter: bookmark.chapter,
                    location: null,
                    created_at: new Date().toISOString(),
                })),
            )
            if (insertError) throw insertError

            const { error: clearError } = await supabase
                .from('texts')
                .update({ content: '' })
                .eq('id', text.id)
            if (clearError) throw clearError
        } catch (error) {
            console.error(`failed  ${text.id}`, error)
            process.exitCode = 1
        }
    }

    console.log(
        `\n${APPLY ? 'Applied' : 'Dry run'}: ${migrated} text(s), ${inserted} bookmark(s)` +
            (skipped ? `, ${skipped} skipped` : ''),
    )
    if (!APPLY) console.log('Re-run with --apply to write the changes.')
}

main().catch(error => {
    console.error(error)
    process.exitCode = 1
})
