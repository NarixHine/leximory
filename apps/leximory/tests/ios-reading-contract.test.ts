import assert from 'node:assert/strict'
import { test } from 'node:test'
import { commentSyntaxRegex, extractSaveForm, parseWord, validateOrThrow } from '@repo/utils/comment'
import { markdownToHtml } from '../app/library/[lib]/[text]/components/editor/serialization'

test('embedded definitions keep the visible inflection separate from the saved lemma', () => {
    const annotation = '{{studied||study||**v. 学习**||study + -ed||student}}'
    const portions = parseWord(validateOrThrow(annotation))

    assert.deepEqual(portions, ['studied', 'study', '**v. 学习**', 'study + -ed', 'student'])
    assert.deepEqual(extractSaveForm(portions), ['study', 'study', '**v. 学习**', 'study + -ed', 'student'])
})

for (const fixture of [
    { marker: '{{腕組||腕組||抱着胳膊}}', expected: ['腕組', '腕組', '抱着胳膊'] },
    { marker: '{{se rendre compte||se rendre compte||意识到}}', expected: ['se rendre compte', 'se rendre compte', '意识到'] },
    { marker: '{{欢迎！||欢迎||Welcome!}}', expected: ['欢迎！', '欢迎', 'Welcome!'] },
    { marker: '{{word}}', expected: ['word'] },
]) {
    test(`existing annotation syntax accepts ${fixture.marker}`, () => {
        assert.deepEqual(parseWord(validateOrThrow(fixture.marker)), fixture.expected)
    })
}

for (const invalid of ['ordinary text', '{{}}', '{{word||}}', '{{unclosed']) {
    test(`existing validator rejects malformed marker ${invalid}`, () => {
        assert.throws(() => validateOrThrow(invalid), { message: 'Invalid word', cause: invalid })
    })
}

test('two identical annotated words remain two source occurrences', () => {
    const source = '🙂 {{bank||bank||river edge}} then {{bank||bank||financial institution}}.'
    const occurrences = [...source.matchAll(new RegExp(commentSyntaxRegex.source, commentSyntaxRegex.flags))]

    assert.equal(occurrences.length, 2)
    assert.deepEqual(occurrences.map(match => match[1]), ['bank', 'bank'])
    assert.deepEqual(occurrences.map(match => match[3]), ['river edge', 'financial institution'])
    assert.deepEqual(occurrences.map(match => match.index), [3, 35])
    assert.equal(source.slice(occurrences[1]?.index), '{{bank||bank||financial institution}}.')
})

test('saving a phrase preserves the canonical phrase and its definition', () => {
    assert.deepEqual(extractSaveForm(parseWord('{{studied up on||study up on||learn intensively about}}')), [
        'study up on', 'study up on', 'learn intensively about',
    ])
})

test('displaying annotation surfaces preserves surrounding source and the final section', () => {
    const source = '# First section\n\n🙂 {{studied||study||**v. 学习**}} in 東京.\n\n## Final section\n\n{{unclosed'
    const visible = source.replace(new RegExp(commentSyntaxRegex.source, commentSyntaxRegex.flags), (_, surface: string) => surface)

    assert.equal(visible, '# First section\n\n🙂 studied in 東京.\n\n## Final section\n\n{{unclosed')
})

test('existing audio serialization preserves section order, annotation data, and final content', () => {
    const source = '# Beginning\n\n:::audio_1\nFirst {{studied||study||学习}} section.\n:::\n\nBetween sections.\n\n:::audio-2\nSecond section in 東京.\n:::\n\n## Final section\n\nLast sentence.'
    const html = markdownToHtml(source)

    assert.deepEqual([...html.matchAll(/<lexi-audio data-id="([^"]*)">/g)].map(match => match[1]), ['audio_1', 'audio-2'])
    assert.match(html, /<lexi-audio data-id="audio_1">[\s\S]*First [\s\S]*studied[\s\S]*section\.[\s\S]*<\/lexi-audio>/)
    assert.match(html, /<lexi-audio data-id="audio-2">[\s\S]*Second section in 東京\.[\s\S]*<\/lexi-audio>/)
    assert.match(html, /Between sections\./)
    assert.match(html, /Final section[\s\S]*Last sentence\./)
    assert.ok(html.indexOf('Beginning') < html.indexOf('audio_1'))
    assert.ok(html.indexOf('audio-2') < html.indexOf('Final section'))
    const encodedDefinition = html.match(/data-portions="([^"]*)"/)?.[1]
    assert.ok(encodedDefinition)
    assert.deepEqual(JSON.parse(decodeURIComponent(encodedDefinition)), ['studied', 'study', '学习'])
})
