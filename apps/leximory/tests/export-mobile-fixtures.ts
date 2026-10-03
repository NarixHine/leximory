import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { renderDocument } from '../server/mobile/render-document'

const root = new URL('../../../', import.meta.url)
const source = readFileSync(new URL('docs/native-ios/fixtures/reader.md', root), 'utf8')
const long = '# A longer walk\n\n' + Array.from({ length: 800 }, (_, i) =>
    `## Passage ${i + 1}\n\n🙂 café café 東京. The {{bank||bank||The land beside a river.}} and the {{bank||bank||A financial institution.}}. Read slowly, notice the punctuation, and keep every sentence.\n\n`).join('') + '## Final section\n\nThe final sentence of the long fixture.'
const browsingFixtures = ['forest', 'garden', 'voyage', 'between'].map(name =>
    [name, readFileSync(new URL(`docs/native-ios/fixtures/${name}.md`, root), 'utf8')])
for (const [name, text] of [['reader', source], ['long-reader', long], ...browsingFixtures]) {
    const bytes = JSON.stringify(renderDocument(text), null, 2) + '\n'
    for (const target of ['apps/leximory-ios/App/Resources/', 'apps/leximory-ios/Core/Tests/LeximoryCoreTests/Fixtures/']) {
        mkdirSync(new URL(target, root), { recursive: true })
        writeFileSync(new URL(`${target}${name}.json`, root), bytes)
    }
}
