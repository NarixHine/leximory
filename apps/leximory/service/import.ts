'use server'

import { isIP } from 'node:net'
import { defuddleUrl, extractArticleFromUrl } from '@repo/scrape'
import { SIGN_IN_URL } from '@repo/env/config'
import { Kilpi } from '@repo/service/kilpi'
import { redirect } from 'next/navigation'
import { getUserOrThrow } from '@repo/user'
import { getArchivedLibs, getLib, listLibsWithFullInfo } from '@/server/db/lib'
import { getLanguageStrategy } from '@/lib/languages'
import { articleGate, GATE_FAILURE_MESSAGES } from '@/server/ai/import-gate'
import { libraryChoice, type ImportLibraryCandidate } from '@/server/ai/predict-library'
import { getImportPrefetch, setImportPrefetch } from '@/server/db/import-cache'
import { evaluateWithQuota } from './evaluate'
import { addAndGenerateText } from './text'

const PRIVATE_IPV4 = [
    /^0\./,
    /^10\./,
    /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,
    /^127\./,
    /^169\.254\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^192\.168\./,
]

function assertPublicHttpUrl(url: string) {
    const { protocol, hostname } = new URL(url)
    if (protocol !== 'http:' && protocol !== 'https:') {
        throw new Error('Unsupported protocol')
    }

    const host = hostname.replace(/^\[|\]$/g, '').toLowerCase()
    if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) {
        throw new Error('Blocked host')
    }

    if (isIP(host) === 4 && PRIVATE_IPV4.some(pattern => pattern.test(host))) {
        throw new Error('Blocked host')
    }
    if (isIP(host) === 6 && (host === '::1' || /^f[cd]/.test(host) || /^fe[89ab]/.test(host))) {
        throw new Error('Blocked host')
    }
}

async function requireUser() {
    const { granted } = await Kilpi.authed().authorize()
    if (!granted) redirect(SIGN_IN_URL)
}

async function getImportCandidates({
    userId,
}: {
    userId: string
}): Promise<ImportLibraryCandidate[]> {
    const [libs, archived] = await Promise.all([
        listLibsWithFullInfo({
            or: { filters: `owner.eq.${userId}`, options: { referencedTable: 'libraries' } },
            userId,
        }),
        getArchivedLibs({ userId }),
    ])

    return libs
        .map(({ lib }) => lib)
        .filter(lib => lib.owner === userId && !archived.includes(lib.id))
        .map(lib => ({
            id: lib.id,
            name: lib.name,
            langName: getLanguageStrategy(lib.lang).name,
            shadow: lib.shadow,
        }))
}

/** Predicts which of the user's libraries a URL should be imported into. */
export async function prefetchLibrary(url: string): Promise<{ lib: string } | null> {
    const { userId } = await getUserOrThrow()

    const cached = await getImportPrefetch({ userId, url })
    if (cached) return cached

    let article: { title: string; content: string }
    try {
        assertPublicHttpUrl(url)
        article = await defuddleUrl(url)
    } catch {
        return null
    }
    const { title, content } = article

    const candidates = await getImportCandidates({ userId })
    if (candidates.length === 0) return null
    if (candidates.length === 1) return { lib: candidates[0].id }

    const result = await evaluateWithQuota(
        libraryChoice({ title, url, content, candidates }),
    )
    if ('error' in result) return null

    const lib = result.answers.lib.choice
    if (!candidates.some(candidate => candidate.id === lib)) return null

    await setImportPrefetch({ userId, url, lib })
    return { lib }
}

/** Crawls a URL and gates the result before it is imported. */
export async function readArticle(
    url: string,
): Promise<{ title: string; content: string } | { error: string }> {
    await requireUser()

    const { title, content } = await extractArticleFromUrl(url)

    const result = await evaluateWithQuota(articleGate({ title, url, content }))
    if ('error' in result) return { error: result.error }

    const status = result.answers.status.choice
    if (status !== 'ok') return { error: GATE_FAILURE_MESSAGES[status] }

    return { title, content }
}

/** Crawls, gates, and imports a URL into a library, then starts annotation. */
export async function importArticle({
    url,
    lib,
}: {
    url: string
    lib: string
}): Promise<{ textId: string } | { error: string }> {
    const article = await readArticle(url)
    if ('error' in article) return article

    const libData = await getLib({ id: lib })
    if (article.content.length > getLanguageStrategy(libData.lang).maxArticleLength) {
        return { error: '内容过长，请手动录入。' }
    }

    return await addAndGenerateText({
        title: article.title,
        content: article.content,
        lib,
    })
}