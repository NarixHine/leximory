import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mobileSubjectSchema } from '@repo/schema/mobile'
import { maxArticleLength } from '@repo/env/content'
import type { Lang } from '@repo/schema/library'
import { createArticleAudioOperations } from '../server/mobile/article-audio'
import { articleAudioID, articleSpeech } from '../server/mobile/article-speech'
import { createCatalog, type CatalogStore, type LibraryRow, type TextRow } from '../server/mobile/catalog'
import { renderDocument } from '../server/mobile/render-document'
import { testMobileHandler } from './helpers/mobile'

const subject = mobileSubjectSchema.parse({ userId: 'reader' })
const library: LibraryRow = {
    id: 'library',
    name: 'Reading',
    lang: 'en',
    owner: 'reader',
    access: 0,
    starred_by: null,
    shadow: false,
}
const text: TextRow = {
    id: 'article',
    lib: 'library',
    title: 'Article',
    content: 'Hello.',
    has_ebook: false,
    topics: null,
    emoji: null,
    no: null,
    created_at: null,
    updated_at: null,
}
function harness(content = text.content, overrides: Partial<CatalogStore> = {}) {
    const stored = { ...text, content }
    const calls: { id: string; text: string; lang: Lang; userId: string }[] = []
    const catalog: CatalogStore = {
        library: async () => library,
        text: async () => stored,
        libraries: async () => [],
        texts: async () => [],
        archived: async () => [],
        audio: async () => null,
        ...overrides,
    }
    const handler = testMobileHandler(
        createArticleAudioOperations({
            catalog,
            audio: {
                generate: async (input) => {
                    calls.push(input)
                },
            },
        }),
        async () => ({ kind: 'authenticated', subject }),
    )
    const request = (body: unknown = { revision: renderDocument(content).revision }) =>
        handler(
            new Request('https://example.com/api/mobile/v1/texts/article/article-audio', {
                method: 'POST',
                headers: { authorization: 'Bearer test' },
                body: JSON.stringify(body),
            }),
        )
    return { request, calls, catalog }
}

test('full article speech contains visible words, without Leximory metadata, Markdown links, ruby readings, or executable HTML', () => {
    const source = `<article>\n# A **heading**\n\n{{banks||bank||河岸||Old English||embankment}} and [trees](https://example.com).\n\n:::old_recording\n<ruby>漢字<rp>(</rp><rt>かんじ</rt><rp>)</rp></ruby> &&small caps&&.\n:::\n\n> Last *paragraph*.\n\n- One\n- Two\n\n---\n\n<script>steal()</script>\n</article>`
    assert.equal(
        articleSpeech(renderDocument(source)),
        'A heading\n\nbanks and trees.\n\n漢字 small caps.\n\nLast paragraph.\n\nOne\n\nTwo',
    )
})
test('audio identity survives annotation changes, but changes with prose or resource identity', () => {
    const original = articleSpeech(renderDocument('A bank.'))
    const annotated = articleSpeech(renderDocument('A {{bank||bank||河岸}}.'))
    assert.equal(articleAudioID('article', original), articleAudioID('article', annotated))
    assert.notEqual(articleAudioID('article', original), articleAudioID('other', original))
    assert.notEqual(articleAudioID('article', original), articleAudioID('article', 'Another bank.'))
})
test('real POST route derives the full speech and account from the authorized article', async () => {
    const { request, calls } = harness('First {{banks||bank||河岸}}.\n\n:::old\nFinal passage.\n:::')
    const response = await request()
    assert.equal(response.status, 200)
    const { audioId } = await response.json()
    assert.equal(audioId, articleAudioID('article', 'First banks.\n\nFinal passage.'))
    assert.equal(calls.length, 1)
    assert.equal(calls[0]?.text, 'First banks.\n\nFinal passage.')
    assert.equal(calls[0]?.userId, 'reader')
    assert.equal((await request({ revision: renderDocument('changed').revision })).status, 409)
    assert.equal((await request({ revision: renderDocument('changed').revision, text: 'injected' })).status, 400)
    assert.equal(calls.length, 1)
})
for (const lang of ['en', 'fr', 'ja', 'zh', 'nl'] satisfies Lang[]) {
    test(`${lang} speech uses the import limit, counting spoken text rather than annotation markup`, async () => {
        const limit = maxArticleLength(lang)
        const catalog = { library: async () => ({ ...library, lang }) }
        const within = harness(`{{${'a'.repeat(limit)}||lemma||${'释义'.repeat(1000)}}}`, catalog)
        assert.equal((await within.request()).status, 200)
        assert.equal(within.calls[0]?.text.length, limit)
        const over = harness('a'.repeat(limit + 1), catalog)
        assert.equal((await over.request()).status, 400)
        assert.equal(over.calls.length, 0)
    })
}
for (const [label, overrides] of [
    [
        'shared read-only library',
        { library: async () => ({ ...library, owner: 'other', access: 1, starred_by: ['reader'] }) },
    ],
    ['shadow library', { library: async () => ({ ...library, shadow: true }) }],
    ['ebook', { text: async () => ({ ...text, has_ebook: true }) }],
    ['link bookmark', { text: async () => ({ ...text, bookmark_url: 'https://example.com' }) }],
] satisfies [string, Partial<CatalogStore>][]) {
    test(`generation rejects ${label} before charging or calling speech`, async () => {
        const { request, calls } = harness('Hello.', overrides)
        assert.equal((await request()).status, 404)
        assert.equal(calls.length, 0)
    })
}
test('empty spoken content is rejected before generation', async () => {
    const { request, calls } = harness('---\n\n<script>hidden</script>')
    assert.equal((await request()).status, 400)
    assert.equal(calls.length, 0)
})
test('catalog discovers full recordings and signs only the current article identity', async () => {
    const id = articleAudioID('article', 'Hello.')
    const { catalog } = harness('Hello.', {
        audio: async (requested) => (requested === id ? 'https://example.com/audio.mp3' : null),
    })
    const reader = createCatalog(catalog)
    const signal = new AbortController().signal
    assert.equal((await reader.document(subject, 'article', signal)).fullArticleAudioId, id)
    assert.equal((await reader.audio(subject, 'article', id, signal)).url, 'https://example.com/audio.mp3')
    await assert.rejects(reader.audio(subject, 'article', articleAudioID('article', 'Old text.'), signal), {
        code: 'inaccessible',
    })
    assert.equal((await createCatalog(harness().catalog).document(subject, 'article', signal)).fullArticleAudioId, null)
})
test('section recordings remain separate from complete article recordings', async () => {
    const section = harness('Opening.\n\n:::section\nA recorded paragraph.\n:::', {
        audio: async () => 'https://example.com/audio.mp3',
    })
    const sectionDocument = await createCatalog(section.catalog).document(
        subject,
        'article',
        new AbortController().signal,
    )
    // Only the newly generated whole-article identity can represent full text here.
    assert.notEqual(sectionDocument.fullArticleAudioId, 'section')
    assert.equal((await section.request()).status, 200)
    assert.equal(section.calls.length, 1)
    const complete = harness(':::complete\nThe complete article.\n:::', {
        audio: async () => 'https://example.com/audio.mp3',
    })
    assert.equal(
        (await createCatalog(complete.catalog).document(subject, 'article', new AbortController().signal))
            .fullArticleAudioId,
        'complete',
    )
    assert.deepEqual(await (await complete.request()).json(), { audioId: 'complete' })
    assert.equal(complete.calls.length, 0)
})

test('speech reads table cells and task labels without Markdown delimiters', () => {
    assert.equal(
        articleSpeech(renderDocument('| Name | Count |\n| --- | ---: |\n| Trees | 2 |\n\n- [x] Read')),
        'Name, Count\nTrees, 2\n\nRead',
    )
})
