import { test } from 'node:test'
import assert from 'node:assert/strict'
import { z } from 'zod'
import { MockLanguageModelV4 } from 'ai/test'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@repo/supabase/types'
import { mobileSubjectSchema } from '@repo/schema/mobile'
import type { CatalogStore } from '../server/mobile/catalog'
import type { DefinitionServices } from '../server/mobile/definitions'
import { createEbookAnnotationStore } from '../server/mobile/ebook-annotation-store'
import {
    createEbookAnnotationOperations,
    resolveEbookAnnotation,
    type GeneratedEbookAnnotation,
} from '../server/mobile/ebook-annotations'
import { testMobileHandler } from './helpers/mobile'
import { streamEbookAnnotations } from '../server/mobile/ebook-annotation-generation'

const subject = mobileSubjectSchema.parse({ userId: 'reader' })
const definition = { lemma: 'bank', definition: 'n. 河岸', etymology: null, cognates: null }
const output: GeneratedEbookAnnotation = { quote: 'bank', occurrence: 2, definition }
const input = { sourceVersion: 'v1', location: 'pdf:1:0', text: 'The bank is closed. We walked along the bank.' }
const catalog: CatalogStore = {
    library: async () => ({
        id: 'folder',
        name: 'Books',
        lang: 'en',
        owner: 'reader',
        access: 0,
        starred_by: null,
        shadow: false,
    }),
    text: async () => ({
        id: 'book',
        lib: 'folder',
        title: 'Book',
        content: '',
        no: null,
        created_at: null,
        updated_at: null,
        topics: [],
        emoji: null,
        has_ebook: true,
    }),
    libraries: async () => [],
    texts: async () => [],
    archived: async () => [],
    audio: async () => null,
}
function fixture() {
    type Row = Database['public']['Tables']['ebook_preannotations']['Row']
    const rows = new Map<string, Row>()
    let rejectWrites = false,
        generated = 0,
        used = 0,
        allowed = true
    const receipts = new Set<string>(),
        locks = new Set<string>()
    const saved: unknown[] = []
    const database = createClient<Database>('https://database.example', 'test-key', {
        auth: { persistSession: false, autoRefreshToken: false },
        global: {
            fetch: async (resource, init) => {
                const url = new URL(String(resource)),
                    id = url.searchParams.get('id')?.slice(3)
                if (init?.method === 'POST') {
                    const row: Row = JSON.parse(String(init.body))
                    rows.set(row.id, { ...row, annotations: [], complete: false, created_at: '', updated_at: '' })
                    return new Response(null, { status: 201 })
                }
                const row = id ? rows.get(id) : undefined
                const matches =
                    row &&
                    url.searchParams.get('user_id') === `eq.${row.user_id}` &&
                    url.searchParams.get('text_id') === `eq.${row.text_id}`
                if (init?.method === 'PATCH') {
                    if (rejectWrites)
                        return Response.json({ message: 'write rejected', code: 'XX000' }, { status: 503 })
                    if (row && matches) Object.assign(row, JSON.parse(String(init.body)))
                }
                const value = matches ? row : null
                return Response.json(
                    new Headers(init?.headers).get('accept') === 'application/vnd.pgrst.object+json'
                        ? value
                        : value
                          ? [value]
                          : [],
                )
            },
        },
    })
    const definitions: DefinitionServices = {
        preferences: async () => ({ accent: '', limit: 20 }),
        cached: async () => null,
        cache: async () => {},
        charge: async () => true,
        generate: async function* () {},
        complete: async () => {},
        receipt: async () => null,
        save: async (...args) => {
            saved.push(args)
            return { id: 'word', libraryId: 'folder' }
        },
    }
    const dependencies = {
        catalog,
        ebooks: {
            asset: async () => ({ url: 'https://asset.example/book.pdf', format: 'pdf' as const, sourceVersion: 'v1' }),
            location: async () => null,
            bookmarks: async () => [],
            savePosition: async () => {},
            saveBookmark: async () => {
                throw new Error('unused')
            },
            removeBookmark: async () => {},
        },
        definitions,
        store: createEbookAnnotationStore(database),
        generator: {
            lock: async (id: string) => {
                if (locks.has(id)) return null
                locks.add(id)
                return async () => {
                    locks.delete(id)
                }
            },
            charge: async (_user: string, _limit: number, id: string, cost: number) => {
                if (receipts.has(id)) return true
                if (!allowed) return false
                used += cost
                receipts.add(id)
                return true
            },
            generate: async function* () {
                generated++
                yield output
            },
        },
    }
    const handler = testMobileHandler(createEbookAnnotationOperations(dependencies), async () => ({
        kind: 'authenticated',
        subject,
    }))
    const request = (body: unknown = input, path = 'ebook-annotations') =>
        new Request(`https://example.com/api/mobile/v1/texts/book/${path}`, {
            method: 'POST',
            headers: { authorization: 'Bearer test' },
            body: JSON.stringify(body),
        })
    return {
        dependencies,
        handler,
        request,
        rows,
        receipts,
        saved,
        setReject: (value: boolean) => {
            rejectWrites = value
        },
        setAllowed: (value: boolean) => {
            allowed = value
        },
        usage: () => used,
        generations: () => generated,
    }
}
const frames = async (response: Response) =>
    (await response.text())
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line))

test('ebook annotation stream saves the exact second occurrence and replays without charging or generating again', async () => {
    const f = fixture()
    const result = await frames(await f.handler(f.request()))
    assert.equal(result[0].annotation.start, 40)
    assert.equal(result[0].annotation.quote, 'bank')
    assert.equal(result.at(-1).kind, 'complete')
    assert.equal(f.rows.get(result[0].unitId)?.complete, true)
    assert.equal(f.usage(), 0.01125)
    assert.deepEqual(await frames(await f.handler(f.request())), result)
    assert.equal(f.usage(), 0.01125)
    assert.equal(f.generations(), 1)
    const saved = await f.handler(
        f.request(
            { unitId: result[0].unitId, annotationId: result[0].annotation.id, requestId: 'save-1' },
            'ebook-annotation-vocabulary',
        ),
    )
    assert.equal(saved.status, 200)
    assert.equal(f.saved.length, 1)
    assert.equal(
        (
            await f.handler(
                f.request(
                    { unitId: result[0].unitId, annotationId: 'forged', requestId: 'save-2' },
                    'ebook-annotation-vocabulary',
                ),
            )
        ).status,
        404,
    )
})

test('a database failure never publishes an unsaved annotation; recovery uses the same charge identity', async () => {
    const f = fixture()
    f.setReject(true)
    const failure = await frames(await f.handler(f.request()))
    assert.deepEqual(
        failure.map((item) => item.kind),
        ['failed'],
    )
    assert.equal(f.usage(), 0.01125)
    f.setReject(false)
    assert.deepEqual(
        (await frames(await f.handler(f.request()))).map((item) => item.kind),
        ['annotation', 'complete'],
    )
    assert.equal(f.usage(), 0.01125)
})

test('streamed annotations persist before the following generation element is available', async () => {
    const f = fixture()
    let proceed: (() => void) | undefined
    const waiting = new Promise<void>((resolve) => {
        proceed = resolve
    })
    f.dependencies.generator.generate = async function* () {
        yield output
        await waiting
        yield { ...output, quote: 'closed', occurrence: 1 }
    }
    const handler = testMobileHandler(createEbookAnnotationOperations(f.dependencies), async () => ({
        kind: 'authenticated',
        subject,
    }))
    const response = await handler(f.request()),
        reader = response.body!.getReader()
    const first = await reader.read()
    const frame = JSON.parse(new TextDecoder().decode(first.value).trim())
    assert.equal(frame.kind, 'annotation')
    assert.equal(f.rows.get(frame.unitId)?.complete, false)
    assert.equal(z.array(z.unknown()).parse(f.rows.get(frame.unitId)?.annotations).length, 1)
    proceed?.()
    while (!(await reader.read()).done) {}
    assert.equal(f.rows.get(frame.unitId)?.complete, true)
})

test('quota, source revision and ownership failures stop generation and protect private data', async () => {
    const f = fixture()
    f.setAllowed(false)
    assert.equal((await frames(await f.handler(f.request())))[0].error.code, 'quota_exceeded')
    assert.equal(f.generations(), 0)
    assert.equal(f.usage(), 0)
    assert.equal((await f.handler(f.request({ ...input, sourceVersion: 'v2' }))).status, 409)
    const denied = testMobileHandler(
        createEbookAnnotationOperations({ ...f.dependencies, catalog: { ...catalog, library: async () => null } }),
        async () => ({ kind: 'authenticated', subject }),
    )
    assert.equal((await denied(f.request())).status, 404)
    assert.equal((await f.handler(f.request({ ...input, userId: 'victim' }))).status, 400)
})

test('unmatched quotes and split graphemes cannot create marks', () => {
    assert.equal(resolveEbookAnnotation('river', output, 'unit'), null)
    assert.equal(resolveEbookAnnotation('e\u0301', { ...output, quote: 'e', occurrence: 1 }, 'unit'), null)
})

test('an oversized provider definition cannot persist an annotation the reader cannot receive', async () => {
    const f = fixture()
    f.dependencies.generator.generate = async function* () {
        yield {
            ...output,
            definition: { ...definition, definition: '字'.repeat(16000), etymology: '字'.repeat(16000) },
        }
    }
    const result = await frames(await f.handler(f.request()))
    assert.deepEqual(
        result.map((frame) => frame.kind),
        ['failed'],
    )
    assert.deepEqual([...f.rows.values()][0]?.annotations, [])
    assert.equal([...f.rows.values()][0]?.complete, false)
})

test('resuming a passage cannot persist more annotations than the reader can decode', async () => {
    const f = fixture(),
        text = Array.from({ length: 50 }, (_, index) => `word${String(index).padStart(2, '0')}`).join(' ')
    const request = { ...input, text }
    await frames(await f.handler(f.request(request)))
    const row = [...f.rows.values()][0]!
    row.complete = false
    row.annotations = Array.from(
        { length: 47 },
        (_, index) =>
            resolveEbookAnnotation(
                text,
                { ...output, quote: `word${String(index).padStart(2, '0')}`, occurrence: 1 },
                row.id,
            )!,
    )
    f.dependencies.generator.generate = async function* () {
        yield { ...output, quote: 'word47', occurrence: 1 }
        yield { ...output, quote: 'word48', occurrence: 1 }
    }
    assert.equal((await frames(await f.handler(f.request(request)))).at(-1).kind, 'complete')
    assert.equal(z.array(z.unknown()).parse(row.annotations).length, 48)
    assert.equal((await frames(await f.handler(f.request(request)))).at(-1).kind, 'complete')
})

test('the real structured-output SDK rejects malformed final output instead of completing an empty passage', async () => {
    const model = new MockLanguageModelV4({
        doStream: async () => ({
            stream: new ReadableStream({
                start(controller) {
                    controller.enqueue({ type: 'stream-start', warnings: [] })
                    controller.enqueue({ type: 'text-start', id: 'text' })
                    controller.enqueue({ type: 'text-delta', id: 'text', delta: '{{bank||bank||river edge}}' })
                    controller.enqueue({ type: 'text-end', id: 'text' })
                    controller.enqueue({
                        type: 'finish',
                        finishReason: { unified: 'stop', raw: 'stop' },
                        usage: {
                            inputTokens: { total: 10, noCache: undefined, cacheRead: undefined, cacheWrite: undefined },
                            outputTokens: { total: 10, text: undefined, reasoning: undefined },
                        },
                    })
                    controller.close()
                },
            }),
        }),
    })
    const f = fixture()
    f.dependencies.generator.generate = () =>
        streamEbookAnnotations({
            model,
            text: input.text,
            language: 'en',
            accent: '',
            signal: new AbortController().signal,
        })
    const result = await frames(await f.handler(f.request()))
    assert.equal(result.at(-1).kind, 'failed')
    assert.equal([...f.rows.values()][0]?.complete, false)
})
