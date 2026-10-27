import { PDFDocument, PDFName, PDFNumber, PDFHexString, PDFDict, type PDFRef } from 'pdf-lib'
import type { OutlineResult } from './pdf-outline'
import { validatePDFOutline } from './pdf-outline'
import { MobileError } from './errors'

// Edit only the outline dictionary. Drawing pages into a new PDF would discard interactive content.
export async function embedPDFOutline(bytes: Uint8Array, entries: OutlineResult['entries']): Promise<Uint8Array> {
    const document = await PDFDocument.load(bytes, { updateMetadata: false })
    const pages = document.getPages()
    validatePDFOutline({ entries }, pages.length)
    const context = document.context
    const root = context.obj({ Type: 'Outlines' })
    const rootRef = context.register(root)
    const nodes = entries.map((entry) => {
        const page = pages[entry.page - 1]
        if (!page) throw new MobileError('service_unavailable')
        const node = context.obj({
            Title: PDFHexString.fromText(entry.title),
            Dest: [page.ref, 'XYZ', null, page.getHeight(), null],
        })
        return { node, ref: context.register(node), children: new Array<PDFRef>() }
    })
    const parents = [{ node: root, ref: rootRef, children: new Array<PDFRef>() }]
    for (const [index, entry] of entries.entries()) {
        const current = nodes[index],
            parent = parents[entry.depth]
        if (!current || !parent) throw new MobileError('service_unavailable')
        current.node.set(PDFName.of('Parent'), parent.ref)
        const previous = parent.children.at(-1)
        if (previous) {
            current.node.set(PDFName.of('Prev'), previous)
            const previousNode = context.lookup(previous, PDFDict)
            previousNode.set(PDFName.of('Next'), current.ref)
        }
        parent.children.push(current.ref)
        parents.splice(entry.depth + 1, parents.length, current)
    }
    for (const parent of [...nodes].reverse().concat(parents[0] ? [parents[0]] : [])) {
        if (!parent) continue
        const first = parent.children[0],
            last = parent.children.at(-1)
        if (first && last) {
            parent.node.set(PDFName.of('First'), first)
            parent.node.set(PDFName.of('Last'), last)
            parent.node.set(
                PDFName.of('Count'),
                PDFNumber.of(
                    parent.children.reduce((count, ref) => {
                        const child = context.lookup(ref, PDFDict)
                        return (
                            count +
                            1 +
                            (child.has(PDFName.of('Count'))
                                ? child.lookup(PDFName.of('Count'), PDFNumber).asNumber()
                                : 0)
                        )
                    }, 0),
                ),
            )
        }
    }
    document.catalog.set(PDFName.of('Outlines'), rootRef)
    const output = await document.save({ useObjectStreams: false })
    const verified = await PDFDocument.load(output, { updateMetadata: false })
    if (verified.getPageCount() !== pages.length || !verified.catalog.has(PDFName.of('Outlines')))
        throw new MobileError('service_unavailable')
    return output
}
