import 'server-only'
import { Lang, langMap, libAccessStatusMap, welcomeMap } from '@/lib/config'
import { randomID } from '@/lib/utils'
import { getXataClient } from '@/server/client/xata'
import { revalidateTag } from 'next/cache'
import { unstable_cacheTag as cacheTag } from 'next/cache'
import { pick } from 'remeda'

const xata = getXataClient()

export async function getShadowLib({ owner, lang }: { owner: string, lang: Lang }) {
    const rec = await xata.db.libraries.filter({ owner, shadow: true, lang }).getFirst()
    if (rec) {
        cacheTag(`lib:${rec.id}`)
        return rec
    }
    const lib = await xata.db.libraries.create({
        owner,
        shadow: true,
        name: `🗃️ ${langMap[lang]}词汇仓库`,
        lang,
    })
    revalidateTag(`lib:${lib.id}`)
    return lib
}

export async function starLib({ lib, userId }: { lib: string, userId: string }) {
    revalidateTag('libraries')
    const { starredBy } = await xata.db.libraries.select(['starredBy']).filter({ id: lib }).getFirstOrThrow()
    const newStarredBy = starredBy?.includes(userId!)
        ? (starredBy ?? []).filter(x => x !== userId!)
        : [...(starredBy ?? []), userId!]
    await xata.db.libraries.update(lib, { starredBy: newStarredBy })
    return newStarredBy.includes(userId!)
}

export async function updateLib({ id, access, name, org, price }: { id: string, access: typeof libAccessStatusMap.public | typeof libAccessStatusMap.private, name: string, org: string | null, price: number }) {
    await xata.db.libraries.update(id, {
        org: org === 'none' ? null : org,
        name,
        access,
        price,
    })
    revalidateTag('libraries')
    revalidateTag(`lib:${id}`)
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
    revalidateTag('libraries')
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
    revalidateTag('libraries')
}

export async function summarizeLibsWithWords({ filter }: { filter: Record<string, string | undefined | object> }) {
    'use cache'
    cacheTag('libraries')
    const data = await xata.db.lexicon.filter(filter).summarize({
        columns: ['lib'],
        summaries: {
            count: { count: '*' },
        },
    })
    return data.summaries.map(({ lib, count }) => ({
        lib: pick(lib!, ['id', 'name', 'lang', 'owner', 'price', 'shadow', 'access', 'org']),
        count
    }))
}

export async function countPublicLibs() {
    'use cache'
    cacheTag('libraries')
    const data = await xata.db.libraries.filter({ access: libAccessStatusMap.public }).summarize({
        columns: [],
        summaries: {
            count: { count: '*' },
        },
    })
    return data.summaries[0].count
}

export async function getPaginatedPublicLibs({ page, size }: { page: number, size: number }) {
    'use cache'
    cacheTag('libraries')
    const { records } = await xata.db.libraries
        .filter({ access: libAccessStatusMap.public })
        .sort('xata.createdAt', 'desc')
        .select(['id', 'name', 'lang', 'owner', 'starredBy', 'price'])
        .getPaginated({
            pagination: { size, offset: (page - 1) * size }
        })
    return records.map(({ id, name, lang, owner, starredBy, price }) => ({ id, name, lang: lang as Lang, owner, starredBy, price }))
}

export async function getLib({ id }: { id: string }) {
    return xata.db.libraries.select(['name', 'lang', 'org', 'access', 'owner']).filter({ id }).getFirstOrThrow()
}

export async function listShortcutLibs({ owner }: { owner: string }) {
    'use cache'
    cacheTag('libraries')
    const libs = await xata.db.libraries.filter({ owner }).getMany()
    return libs.map(({ id, name }) => ({ id, name }))
}

export async function listLibs({ owner }: { owner: string }) {
    'use cache'
    cacheTag('libraries')
    const libs = await xata.db.libraries.select([]).filter({ owner }).getMany()
    return libs.map(({ id }) => id)
}

export async function getArchivedLibs({ userId }: { userId: string }) {
    'use cache'
    cacheTag('libraries')
    const archive = await xata.db.users.select(['archived_libs']).filter({ id: userId }).getFirst()
    if (!archive) {
        return []
    }
    return archive.archived_libs ?? []
}

export async function addToArchive({ userId, libId }: { userId: string, libId: string }) {
    revalidateTag('libraries')
    const archive = await getArchivedLibs({ userId })
    await xata.db.users.update({ id: userId, archived_libs: [...archive, libId] })
}

export async function removeFromArchive({ userId, libId }: { userId: string, libId: string }) {
    revalidateTag('libraries')
    const archive = await getArchivedLibs({ userId })
    await xata.db.users.update({ id: userId, archived_libs: archive.filter((id) => id !== libId) })
}
