import { readFileSync } from 'node:fs'

// Gate 1 premise under test: full-document TextKit 1 layout can provide bounded
// accessibility snapshots regardless of document length and definition density.
for (const name of ['reader', 'long-reader']) {
    const document = JSON.parse(readFileSync(new URL(`../../leximory-ios/App/Resources/${name}.json`, import.meta.url), 'utf8'))
    const blocks: { displayText: string; spans: { kind: string }[] }[] = document.blocks
    process.stdout.write(JSON.stringify({
        fixture: name, blocks: blocks.length,
        displayUTF16: blocks.reduce((sum, block) => sum + block.displayText.length, 0),
        definitions: blocks.flatMap(block => block.spans).filter(span => span.kind === 'definition').length,
        links: blocks.flatMap(block => block.spans).filter(span => span.kind === 'link').length,
        ruby: blocks.flatMap(block => block.spans).filter(span => span.kind === 'ruby').length,
    }) + '\n')
}
