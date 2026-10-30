import { randomUUID } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
import { z } from 'zod'
import { accountSchema, librariesSchema, textsSchema, textSchema, documentSchema, resourceID } from '@repo/api'

export const releaseConfigSchema = z.object({
    origin: z.url().refine((value) => new URL(value).protocol === 'https:', 'HTTPS is required'),
    supabaseURL: z.url().refine((value) => new URL(value).protocol === 'https:', 'HTTPS is required'),
    anonKey: z.string().min(1),
    email: z.email(),
    password: z.string().min(1),
    userId: z.uuid(),
    libraryId: resourceID,
    allowWrites: z.literal('true'),
    expectedRevision: z.string().regex(/^[a-f0-9]{40}$/i),
})
export class ReleaseVerificationError extends Error {
    constructor(
        readonly phase: string,
        message: string,
        readonly traceId?: string,
    ) {
        super(message)
    }
}

export async function verifyMobileRelease(input: {
    config: z.infer<typeof releaseConfigSchema>
    accessToken: string
    fetcher?: typeof fetch
    pause?: () => Promise<void>
    timeoutMs?: number
    progress?: (phase: string) => void
}) {
    const { config } = input
    const fetcher = input.fetcher ?? fetch
    const pause = input.pause ?? (() => delay(1000))
    const progress = input.progress ?? (() => {})
    const checks: string[] = []
    let phase = 'deployment-revision'
    function passed(check: string) {
        checks.push(check)
        progress(check)
    }
    async function request(path: string, body?: unknown): Promise<unknown> {
        const response = await fetcher(new URL('/api/mobile/v1/' + path, config.origin), {
            method: body === undefined ? 'GET' : 'POST',
            cache: 'no-store',
            signal: AbortSignal.timeout(60000),
            headers: {
                authorization: 'Bearer ' + input.accessToken,
                ...(body === undefined ? {} : { 'content-type': 'application/json' }),
            },
            ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        })
        if (response.headers.get('x-leximory-revision') !== config.expectedRevision)
            throw new ReleaseVerificationError(
                'deployment-revision',
                'The API is not serving the expected revision; verification refused',
            )
        if (!response.ok)
            throw new ReleaseVerificationError(
                phase,
                `HTTP ${response.status} for ${path}`,
                response.headers.get('x-leximory-request-id') ?? undefined,
            )
        return response.json()
    }
    async function libraries() {
        const items: z.infer<typeof librariesSchema>['items'] = []
        let cursor: string | null = null
        for (let page = 0; page < 100; page++) {
            const result = librariesSchema.parse(
                await request('libraries' + (cursor ? '?cursor=' + encodeURIComponent(cursor) : '')),
            )
            items.push(...result.items)
            if (!result.nextCursor) return items
            cursor = result.nextCursor
        }
        throw new ReleaseVerificationError(phase, 'Library pagination did not finish')
    }
    async function texts() {
        const items: z.infer<typeof textsSchema>['items'] = []
        let cursor: string | null = null
        for (let page = 0; page < 100; page++) {
            const result = textsSchema.parse(
                await request(
                    `libraries/${config.libraryId}/texts` + (cursor ? '?cursor=' + encodeURIComponent(cursor) : ''),
                ),
            )
            items.push(...result.items)
            if (!result.nextCursor) return items
            cursor = result.nextCursor
        }
        throw new ReleaseVerificationError(phase, 'Text pagination did not finish')
    }
    const before = accountSchema.parse(await request('me'))
    passed('deployment-revision')
    phase = 'account-isolation'
    if (before.userId !== config.userId)
        throw new ReleaseVerificationError(phase, 'Authenticated account does not match the isolated fixture')
    const library = (await libraries()).find((item) => item.id === config.libraryId)
    if (
        !library ||
        !library.owned ||
        library.shadow ||
        library.language !== 'en' ||
        !library.name.startsWith('__leximory_e2e__')
    )
        throw new ReleaseVerificationError(phase, 'Refusing mutations outside a dedicated English verification folder')
    if (before.definitions.limit - before.definitions.used < 1)
        throw new ReleaseVerificationError(phase, 'The isolated verification account has no annotation quota')
    const fixtureLibrary = library
    passed('account-isolation')

    const marker = '__leximory_e2e__' + randomUUID()
    const ids = new Set<string>()
    let importAttempted = false
    let archiveAttempted = false
    const article = {
        requestId: 'release-' + randomUUID(),
        title: marker,
        content:
            'At dawn, we walked along the [[river bank]]. The current was [[relentless]], yet the old bridge remained [[resilient]]. We paused to consider how the landscape had changed. A farmer described the careful balance between preserving the river and supporting the nearby village. Her explanation gave us a fresh perspective on a familiar place.',
        annotate: true,
        onlyComments: false,
        generateTitle: false,
    }
    async function run() {
        phase = 'import-acceptance'
        importAttempted = true
        const first = textSchema.parse(await request(`libraries/${config.libraryId}/articles`, article))
        ids.add(first.id)
        if (first.libraryId !== config.libraryId || first.format !== 'article' || first.title !== marker)
            throw new ReleaseVerificationError(phase, 'The import did not return its saved article')
        passed('import-acceptance')
        phase = 'idempotent-replay'
        const replay = textSchema.parse(await request(`libraries/${config.libraryId}/articles`, article))
        ids.add(replay.id)
        if (replay.id !== first.id)
            throw new ReleaseVerificationError(phase, 'Replaying an import created another article')
        passed('idempotent-replay')
        phase = 'annotation-completion'
        const deadline = Date.now() + (input.timeoutMs ?? 240000)
        let complete = false
        while (Date.now() < deadline) {
            const document = documentSchema.parse(await request('texts/' + first.id))
            if (document.text.id !== first.id || document.library.id !== config.libraryId)
                throw new ReleaseVerificationError(phase, 'The generated document belongs to a different resource')
            if (document.annotationProgress === 'completed') {
                if (!document.document?.blocks.some((block) => block.spans.some((span) => span.kind === 'definition')))
                    throw new ReleaseVerificationError(
                        phase,
                        'The worker reported completion without generated definitions',
                    )
                if (!document.text.topics.some((topic) => topic.trim()) || !document.text.emoji?.trim())
                    throw new ReleaseVerificationError(phase, 'The completed import is missing generated metadata')
                complete = true
                break
            }
            await pause()
        }
        if (!complete)
            throw new ReleaseVerificationError(
                phase,
                'The deployed worker never completed the accepted import before the deadline',
            )
        passed('annotation-completion')
        const after = accountSchema.parse(await request('me'))
        if (Math.abs(after.definitions.used - before.definitions.used - 1) > 0.000001)
            throw new ReleaseVerificationError(
                'quota',
                'The import and its replay did not charge exactly one annotation quota point',
            )
        passed('quota-charged-once')
        phase = 'archive-round-trip'
        archiveAttempted = true
        await request(`libraries/${config.libraryId}/archive`, { archived: !fixtureLibrary.archived })
        if ((await libraries()).find((item) => item.id === config.libraryId)?.archived !== !fixtureLibrary.archived)
            throw new ReleaseVerificationError(phase, 'The archive mutation was not reflected by the catalog')
        passed('archive-round-trip')
    }
    type Outcome = { kind: 'success' } | { kind: 'failure'; error: unknown }
    const outcome: Outcome = await run().then(
        (): Outcome => ({ kind: 'success' }),
        (error: unknown): Outcome => ({ kind: 'failure', error }),
    )
    phase = 'fixture-cleanup'
    const cleanupFailures: string[] = []
    if (importAttempted) {
        try {
            for (const text of await texts()) if (text.title === marker) ids.add(text.id)
        } catch {
            cleanupFailures.push('discover unconfirmed fixture articles')
        }
        for (const id of ids) {
            try {
                await request(`texts/${id}/remove`, { libraryId: config.libraryId })
            } catch {
                cleanupFailures.push('remove fixture article')
            }
        }
        try {
            if ((await texts()).some((text) => ids.has(text.id) || text.title === marker))
                cleanupFailures.push('confirm article removal')
        } catch {
            cleanupFailures.push('confirm article removal')
        }
    }
    if (archiveAttempted) {
        try {
            await request(`libraries/${config.libraryId}/archive`, { archived: fixtureLibrary.archived })
            if ((await libraries()).find((item) => item.id === config.libraryId)?.archived !== fixtureLibrary.archived)
                cleanupFailures.push('restore folder archive state')
        } catch {
            cleanupFailures.push('restore folder archive state')
        }
    }
    if (cleanupFailures.length)
        throw new ReleaseVerificationError(phase, 'Cleanup not confirmed: ' + cleanupFailures.join(', '))
    if (outcome.kind === 'failure') throw outcome.error
    passed('fixture-cleanup')
    return { status: 'verified', origin: new URL(config.origin).origin, revision: config.expectedRevision, checks }
}
