import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { renderDocument, resolveOccurrence, OccurrenceError } from '../server/mobile/render-document'
import { occurrenceSchema } from '@repo/schema/mobile'

const source = readFileSync(new URL('../../../docs/native-ios/fixtures/reader.md', import.meta.url), 'utf8')

test('render document preserves full source, stable revision, first/final sections, and supported spans', () => {
    const doc = renderDocument(source)
    assert.deepEqual(doc, renderDocument(source))
    assert.equal(doc.source, source)
    assert.equal(doc.blocks[0]?.displayText, 'The art of noticing')
    assert.equal(doc.blocks.at(-1)?.displayText, 'The last sentence matters just as much as the first.')
    const kinds = new Set(doc.blocks.flatMap(block => block.spans.map(span => span.kind)))
    assert.deepEqual(kinds, new Set(['definition', 'strong', 'emphasis', 'smallcaps', 'ruby', 'link', 'image']))
    assert.ok(doc.blocks.some(block => block.kind === 'quote'))
    assert.ok(doc.blocks.some(block => block.kind === 'listItem'))
    assert.ok(doc.blocks.some(block => block.kind === 'fallback' && block.displayText === 'E = mc^2'))
    assert.ok(doc.blocks.some(block => block.notice?.startsWith('Malformed')))
    for (const block of doc.blocks) {
        assert.ok(block.sourceRange.location + block.sourceRange.length <= source.length)
        assert.doesNotMatch(block.displayText, /\|\||\{\{|:::|secret metadata/)
        for (const span of block.spans) assert.ok(span.range.location + span.range.length <= block.displayText.length)
    }
})

test('audio sections keep bodies, order, final text and opaque recording IDs', () => {
    const doc = renderDocument(source)
    assert.deepEqual([...new Set(doc.blocks.map(block => block.audioId).filter(Boolean))], ['fixture_recording', 'missing_recording'])
    assert.ok(doc.blocks.some(block => block.audioId === 'fixture_recording' && block.displayText.includes('leaves')))
    assert.ok(doc.blocks.some(block => block.audioId === 'missing_recording' && block.displayText.includes('all of its text')))
    assert.equal(doc.blocks.at(-1)?.audioId, null)
})

test('second repeated occurrence uses its own UTF-16 position and context', () => {
    const doc = renderDocument('🙂 bank then {{bank||bank||finance}}.')
    const block = doc.blocks[0]
    assert.ok(block)
    const span = block.spans[0]
    assert.ok(span)
    assert.deepEqual(span.range, { location: 13, length: 4 })
    const result = resolveOccurrence(doc, { textId: 'nanoid-text', revision: doc.revision, blockId: block.id, range: span.range })
    assert.equal(result.context, '🙂 bank then [[bank]].')
})

for (const [text, range] of [
    ['🙂 café 東京', { location: 1, length: 1 }],
    ['🙂 café 東京', { location: 3, length: 4 }],
    ['🇯🇵 flag', { location: 0, length: 2 }],
    ['word', { location: 0, length: 5 }],
] satisfies [string, { location: number; length: number }][]) {
    test(`rejects split grapheme or invalid bounds ${text} ${JSON.stringify(range)}`, () => {
        const doc = renderDocument(text)
        assert.throws(() => resolveOccurrence(doc, { textId: 'opaque', revision: doc.revision, blockId: doc.blocks[0]?.id, range }), OccurrenceError)
    })
}

test('ruby pronunciation does not shift baseline offsets', () => {
    const doc = renderDocument('<ruby>東京<rt>とうきょう</rt></ruby> bank')
    const block = doc.blocks[0]
    assert.ok(block)
    assert.equal(block.displayText, '東京 bank')
    assert.deepEqual(block.spans[0]?.range, { location: 0, length: 2 })
    assert.equal(resolveOccurrence(doc, { textId: 'opaque', revision: doc.revision, blockId: block.id, range: { location: 3, length: 4 } }).selectedText, 'bank')
})

test('stale content, forged extra fields and fractional offsets are rejected', () => {
    const doc = renderDocument('word')
    const input = { textId: 'opaque', revision: doc.revision, blockId: doc.blocks[0]?.id, range: { location: 0, length: 4 } }
    assert.throws(() => resolveOccurrence(renderDocument('changed'), input), { code: 'stale_revision' })
    assert.equal(occurrenceSchema.safeParse({ ...input, userId: 'forged' }).success, false)
    assert.equal(occurrenceSchema.safeParse({ ...input, range: { location: 0.5, length: 1 } }).success, false)
})

test('unsafe HTML and URL schemes cannot become reader actions', () => {
    const doc = renderDocument('Before <script>alert("secret")</script> after.\n\n[bad](javascript:alert) ![hidden](file:///private/data)')
    assert.doesNotMatch(doc.blocks.map(block => block.displayText).join('\n'), /alert|secret/)
    assert.equal(doc.blocks.flatMap(block => block.spans).length, 0)
})

test('code examples do not create playback descriptors', () => {
    const doc = renderDocument('```\n:::not_audio\ncode text\n:::\n```\n\nFinal.')
    assert.equal(doc.blocks.some(block => block.audioId), false)
    assert.equal(doc.blocks.at(-1)?.displayText, 'Final.')
})

test('HTML entities, multiline ruby, and article wrappers preserve canonical prose', () => {
    const doc = renderDocument('<article>\n# Beginning\n\nA &amp; B {{word||word||A &amp; B}}.\n\n<ruby>東\n京<rt>とうきょう</rt></ruby>\n\nFinal.\n</article>')
    assert.equal(doc.blocks[0]?.displayText, 'Beginning')
    assert.equal(doc.blocks.at(-1)?.displayText, 'Final.')
    assert.equal(doc.blocks[1]?.displayText, 'A & B word.')
    const definition = doc.blocks[1]?.spans[0]
    assert.ok(definition?.kind === 'definition')
    assert.equal(definition.definition, 'A & B')
    assert.equal(doc.blocks[2]?.displayText, '東\n京')
})


test('ruby inside embedded definitions stays Markdown, never transport tokens', () => {
    const definition = '**［名］（<ruby>かいしょ<rt>楷書</rt></ruby>／楷书）** 漢字の書体の一種。'
    const doc = renderDocument(`{{楷書||楷書||${definition}||漢語}}では「糸」。`)
    assert.equal(doc.blocks[0]?.displayText, '楷書では「糸」。')
    const span = doc.blocks[0]?.spans[0]
    assert.ok(span?.kind === 'definition')
    assert.equal(span.definition, definition)
    assert.equal(span.etymology, '漢語')
    assert.doesNotMatch(JSON.stringify(doc.blocks), /[\uE000-\uF8FF]/)
    const mixed = renderDocument(`<ruby>東京<rt>とうきょう</rt></ruby> {{楷書||楷書||${definition}}}`)
    assert.deepEqual(mixed.blocks[0]?.spans.map(span => span.kind), ['ruby', 'definition'])
})
