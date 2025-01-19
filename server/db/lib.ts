import 'server-only'
import { Lang, libAccessStatusMap, welcomeMap } from '@/lib/config'
import { randomID } from '@/lib/utils'
import { getXataClient } from '@/server/client/xata'
import { revalidatePath } from 'next/cache'

const xata = getXataClient()

export async function getShadowLib({ owner }: { owner: string }) {
    const rec = await xata.db.libraries.filter({ owner, shadow: true }).getFirst()
    if (rec) {
        return rec
    }
    return await xata.db.libraries.create({
        owner,
        shadow: true,
        name: '🗃️ 词汇仓库',
        lang: 'nl',
    })
}

export async function starLib({ lib, userId }: { lib: string, userId: string }) {
    const { starredBy } = await xata.db.libraries.select(['starredBy']).filter({ id: lib }).getFirstOrThrow()
    const newStarredBy = starredBy?.includes(userId!)
        ? (starredBy ?? []).filter(x => x !== userId!)
        : [...(starredBy ?? []), userId!]
    await xata.db.libraries.update(lib, { starredBy: newStarredBy })
    revalidatePath(`/library/${lib}`)
    revalidatePath(`/marketplace/[page]`)
    return newStarredBy.includes(userId!)
}

export async function updateLib({ id, access, name, org, shortcut }: { id: string, access: typeof libAccessStatusMap.public | typeof libAccessStatusMap.private, name: string, org: string | null, shortcut: boolean }) {
    await xata.db.libraries.update(id, typeof org === 'string'
        ? {
            org: org === 'none' ? null : org,
            shortcut,
            name,
            access,
        } : {
            name,
            access,
        })
    revalidatePath(`/library/${id}`)
    revalidatePath(`/library`)
}

export async function createLib({ name, lang, org, owner }: { name: string, lang: Lang, org: string | null, owner: string }) {
    const id = randomID()
    await xata.transactions.run([
        {
            insert: {
                table: 'libraries',
                record: {
                    id,
                    owner,
                    name,
                    lang,
                    access: libAccessStatusMap.private,
                    org
                }
            }
        },
        {
            insert: {
                table: 'lexicon',
                record: {
                    lib: id,
                    word: welcomeMap[lang],
                }
            }
        }
    ])
    revalidatePath(`/library`)
    return id
}

export async function deleteLib({ id }: { id: string }) {
    const [texts, words, audios] = await Promise.all([
        xata.db.texts.filter({ lib: id }).getAll(),
        xata.db.lexicon.filter({ lib: id }).getAll(),
        xata.db.audio.filter({ lib: id }).getAll(),
    ])
    await xata.transactions.run([
        { delete: { id, table: 'libraries' } },
        ...texts.map(({ id }) => ({
            delete: {
                id,
                table: 'texts' as const
            }
        })),
        ...words.map(({ id }) => ({
            delete: {
                id,
                table: 'lexicon' as const
            }
        })),
        ...audios.map(({ id }) => ({
            delete: {
                id,
                table: 'audio' as const
            }
        })),
    ])
    revalidatePath(`/library`)
}

export async function summarizeLibsWithWords({ filter }: { filter: Record<string, string | undefined | object> }) {
    const data = await xata.db.lexicon.filter(filter).summarize({
        columns: ['lib'],
        summaries: {
            count: { count: '*' },
        },
    })
    return data.summaries
}

export async function countPublicLibs() {
    const data = await xata.db.libraries.filter({ access: libAccessStatusMap.public }).summarize({
        columns: ['id'],
        summaries: {
            count: { count: '*' },
        },
    })
    return data.summaries[0].count
}

export async function getPaginatedPublicLibs({ page, size }: { page: number, size: number }) {
    const { records } = await xata.db.libraries
        .filter({ access: libAccessStatusMap.public })
        .sort('xata.createdAt', 'desc')
        .select(['id', 'name', 'lang', 'owner', 'starredBy'])
        .getPaginated({
            pagination: { size, offset: (page - 1) * size }
        })
    return records.map(({ id, name, lang, owner, starredBy }) => ({ id, name, lang: lang as Lang, owner, starredBy }))
}

export async function getLib({ id }: { id: string }) {
    return xata.db.libraries.select(['name', 'lang', 'org', 'access']).filter({ id }).getFirstOrThrow()
}

export async function listShortcutLibs({ owner }: { owner: string }) {
    const libs = await xata.db.libraries.filter({ owner, shortcut: true }).getMany()
    return libs.map(({ id, name }) => ({ id, name }))
}

export async function listLibs({ owner }: { owner: string }) {
    const libs = await xata.db.libraries.select([]).filter({ owner }).getMany()
    return libs.map(({ id }) => id)
}
