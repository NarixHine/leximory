import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { z } from 'zod'
import { MockLanguageModelV4, MockProviderV4 } from 'ai/test'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@repo/supabase/types'
import { mobileSubjectSchema } from '@repo/schema/mobile'
import { commentSyntaxRegex, parseWord } from '@repo/utils/comment'
import type { CatalogStore } from '../server/mobile/catalog'
import { parseGeneratedDefinition, type DefinitionServices } from '../server/mobile/definitions'
import { createEbookAnnotationStore } from '../server/mobile/ebook-annotation-store'
import {
    createEbookAnnotationOperations,
    resolveEbookAnnotation,
    type EbookAnnotationGenerator,
    type GeneratedEbookAnnotation,
} from '../server/mobile/ebook-annotations'
import { testMobileHandler } from './helpers/mobile'
import { streamEbookAnnotations, type EbookAnnotationDebugEvent } from '../server/mobile/ebook-annotation-generation'
import { annotationPrompt } from '../server/ai/annotation-prompt'

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
            generate: async function* (..._input: Parameters<EbookAnnotationGenerator['generate']>) {
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

test('refreshing annotations from the previous prompt reuses its durable quota receipt', async () => {
    const f = fixture()
    const legacyID = createHash('sha256')
        .update(JSON.stringify(['ebook-annotations-v1', 'reader', 'book', input, 'en', '']))
        .digest('hex')
    f.receipts.add(legacyID)
    const result = await frames(await f.handler(f.request()))
    assert.equal(result.at(-1).kind, 'complete')
    assert.notEqual(result[0].unitId, legacyID)
    assert.equal(f.generations(), 1)
    assert.equal(f.usage(), 0)
    await frames(await f.handler(f.request()))
    assert.equal(f.generations(), 1)
    assert.equal(f.usage(), 0)
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

test('the real text-stream SDK rejects an unfinished annotation instead of completing an empty passage', async () => {
    const model = new MockLanguageModelV4({
        doStream: async () => ({
            stream: new ReadableStream({
                start(controller) {
                    controller.enqueue({ type: 'stream-start', warnings: [] })
                    controller.enqueue({ type: 'text-start', id: 'text' })
                    controller.enqueue({ type: 'text-delta', id: 'text', delta: '{{bank||bank||river edge' })
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
            debug: () => {},
        })
    const result = await frames(await f.handler(f.request()))
    assert.equal(result.at(-1).kind, 'failed')
    assert.equal([...f.rows.values()][0]?.complete, false)
})

test(
    'DeepSeek page streaming preserves web formatting and persists before later tokens arrive',
    { timeout: 5000 },
    async (t) => {
        let proceed = () => {}
        const waiting = new Promise<void>((resolve) => {
            proceed = resolve
        })
        const model = new MockLanguageModelV4({
            doStream: async () => ({
                stream: new ReadableStream({
                    async start(controller) {
                        controller.enqueue({ type: 'stream-start', warnings: [] })
                        controller.enqueue({ type: 'text-start', id: 'text' })
                        controller.enqueue({
                            type: 'text-delta',
                            id: 'text',
                            delta: 'The bank is closed. We walked along the {{ba',
                        })
                        controller.enqueue({
                            type: 'text-delta',
                            id: 'text',
                            delta: 'nk||bank||**n. 河岸** `bæŋk` river edge||语源||***bank*** → em**bank**}}',
                        })
                        await waiting
                        controller.enqueue({
                            type: 'text-delta',
                            id: 'text',
                            delta: ' and the {{shore||shore||**n. 岸** `ʃɔːr` land along water}} with {{reeds||reed||**n. 芦苇** `riːd` a tall grass}}.',
                        })
                        controller.enqueue({ type: 'text-end', id: 'text' })
                        controller.enqueue({
                            type: 'finish',
                            finishReason: { unified: 'stop', raw: 'stop' },
                            usage: {
                                inputTokens: {
                                    total: 10,
                                    noCache: undefined,
                                    cacheRead: undefined,
                                    cacheWrite: undefined,
                                },
                                outputTokens: { total: 10, text: undefined, reasoning: undefined },
                            },
                        })
                        controller.close()
                    },
                }),
            }),
        })
        const previousProvider = globalThis.AI_SDK_DEFAULT_PROVIDER
        globalThis.AI_SDK_DEFAULT_PROVIDER = new MockProviderV4({
            languageModels: { 'deepseek/deepseek-v4.1-flash-1017': model },
        })
        t.after(() => {
            globalThis.AI_SDK_DEFAULT_PROVIDER = previousProvider
        })
        const f = fixture()
        const debug: EbookAnnotationDebugEvent[] = []
        f.dependencies.generator.generate = (text, language, accent, signal) =>
            streamEbookAnnotations({
                text,
                language,
                accent,
                signal,
                requestId: 'stream-test',
                debug: (event) => {
                    debug.push(event)
                },
            })
        const handler = testMobileHandler(createEbookAnnotationOperations(f.dependencies), async () => ({
            kind: 'authenticated',
            subject,
        }))
        const response = await handler(
            f.request({ ...input, text: input.text.slice(0, -1) + ' and the shore with reeds.' }),
        )
        const reader = response.body!.getReader()
        try {
            const first = await reader.read()
            const frame = JSON.parse(new TextDecoder().decode(first.value).trim())
            assert.equal(frame.annotation.start, 40)
            assert.deepEqual(frame.annotation.definition, {
                lemma: 'bank',
                definition: '**n. 河岸** `bæŋk` river edge',
                etymology: '语源',
                cognates: '***bank*** → em**bank**',
            })
            assert.equal(z.array(z.unknown()).parse(f.rows.get(frame.unitId)?.annotations).length, 1)
            assert.equal(f.rows.get(frame.unitId)?.complete, false)
        } finally {
            proceed()
        }
        let remaining = ''
        while (true) {
            const chunk = await reader.read()
            if (chunk.done) break
            remaining += new TextDecoder().decode(chunk.value)
        }
        const rest = remaining
            .trim()
            .split('\n')
            .map((line) => JSON.parse(line))
        assert.deepEqual(
            rest.filter((frame) => frame.kind === 'annotation').map((frame) => frame.annotation.quote),
            ['shore', 'reeds'],
        )
        assert.equal(rest.at(-1).kind, 'complete')
        assert.equal(model.doStreamCalls[0]?.reasoning, 'low')
        assert.equal(model.doStreamCalls[0]?.providerOptions?.google, undefined)
        const system = model.doStreamCalls[0]?.prompt.find((message) => message.role === 'system')
        assert.ok(system?.content.includes('{{原文形式||原形||原形释义||'))
        assert.ok(system?.content.includes('逐字保留原文、空白与标点'))
        assert.ok(system?.content.includes('输入：It transpires that the apparent error was deliberate.'))
        assert.ok(system?.content.includes('输出：It {{transpires||transpire||'))
        assert.ok(system?.content.includes('to {{bridge the gap||bridge the gap||'))
        assert.ok(!system?.content.includes('Birding Quiz lets you practice'))
        assert.deepEqual(
            debug.map((event) => [event.kind, event.requestId]),
            [
                ['prompt', 'stream-test'],
                ['generation', 'stream-test'],
            ],
        )
        const generated = debug.find((event) => event.kind === 'generation')
        assert.equal(generated?.status, 'complete')
        assert.ok(generated?.output.includes('**n. 河岸** `bæŋk`'))
        assert.equal(generated?.usage?.outputTokens, 10)
        assert.ok(generated?.firstAnnotationMs != null)
    },
)

for (const lang of ['en', 'fr', 'ja', 'zh', 'nl'] as const) {
    test(`compact ${lang} ebook prompt keeps field rules and contextual examples without full sample articles`, () => {
        const full = annotationPrompt({ lang, input: 'passage', autoTrim: false })
        const compact = annotationPrompt({ lang, input: 'passage', autoTrim: false, compact: true })
        assert.ok(compact.instructions.includes('{{原文形式||'))
        assert.ok(compact.instructions.includes('释义'))
        assert.ok(!/示例(?:输入|文本)/.test(compact.instructions))
        const count = { en: 4, fr: 2, ja: 3, zh: 2, nl: 3 }[lang]
        assert.equal(compact.instructions.match(/^输入：/gm)?.length, count)
        assert.equal(compact.instructions.match(/^输出：/gm)?.length, count)
        assert.ok(!/只输出一行|不输出原句|任何注解外文字/.test(compact.instructions))
        for (const pair of compact.instructions.matchAll(/^输入：([^\n]*)\n输出：([^\n]*)/gm)) {
            const output = pair[2] ?? ''
            const annotations = [...output.matchAll(commentSyntaxRegex)]
            assert.ok(annotations.length > 0)
            for (const annotation of annotations) parseGeneratedDefinition(annotation[0])
            assert.equal(
                output.replace(commentSyntaxRegex, (annotation) => parseWord(annotation)[0] ?? ''),
                pair[1],
            )
        }
        assert.ok(compact.instructions.length < full.instructions.length * 0.8)
        assert.equal(compact.prompt, 'passage')
    })
}
