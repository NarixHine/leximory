/* Source ranges remain in the publisher DOM; only non-interactive strokes are added. */
;(() => {
    let marks = []
    const layers = new WeakMap()
    const surface = document.createElement('div')
    surface.style.cssText = 'position:fixed;inset:0;pointer-events:none;overflow:hidden;z-index:2;'
    document.body.appendChild(surface)
    const excluded = 'rt,rp,script,style,svg,nav,[data-leximory-annotation-layer]'
    function textNodes(doc) {
        const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT)
        const nodes = []
        let node
        while ((node = walker.nextNode())) {
            if (node.data.length && !node.parentElement?.closest(excluded)) nodes.push(node)
        }
        return nodes
    }
    function mapRange(contents, range) {
        let text = ''
        const runs = []
        for (const node of textNodes(contents.document)) {
            if (!range.intersectsNode(node)) continue
            const start = node === range.startContainer ? range.startOffset : 0
            const end = node === range.endContainer ? range.endOffset : node.length
            if (range.comparePoint(node, end) < 0 || range.comparePoint(node, start) > 0 || end <= start) continue
            runs.push({ node, start, end, offset: text.length })
            text += node.data.slice(start, end)
        }
        return { text, runs }
    }
    function sourceRange(doc, runs, start, length) {
        const first = runs.find((run) => start >= run.offset && start < run.offset + run.end - run.start)
        const last = runs.find(
            (run) => start + length > run.offset && start + length <= run.offset + run.end - run.start,
        )
        if (!first || !last) return null
        const range = doc.createRange()
        range.setStart(first.node, first.start + start - first.offset)
        range.setEnd(last.node, last.start + start + length - last.offset)
        return range
    }
    const intersects = (rect, viewport, frame) =>
        rect.width > 0 &&
        rect.height > 0 &&
        rect.right + frame.left > viewport.left + 1 &&
        rect.left + frame.left < viewport.right - 1 &&
        rect.bottom + frame.top > viewport.top + 1 &&
        rect.top + frame.top < viewport.bottom - 1

    function visibleRanges(doc, node, viewport, frame) {
        const boundaries = [
            0,
            ...Array.from(
                new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(node.data),
                (part) => part.index,
            ).filter((index) => index > 0),
            node.length,
        ]
        const spans = []
        function inspect(first, last) {
            const range = doc.createRange()
            range.setStart(node, boundaries[first])
            range.setEnd(node, boundaries[last])
            const rects = [...range.getClientRects()].filter((rect) => rect.width > 0 && rect.height > 0)
            if (!rects.some((rect) => intersects(rect, viewport, frame))) return
            const contained = rects.every(
                (rect) =>
                    rect.left + frame.left >= viewport.left - 0.5 &&
                    rect.right + frame.left <= viewport.right + 0.5 &&
                    rect.top + frame.top >= viewport.top - 0.5 &&
                    rect.bottom + frame.top <= viewport.bottom + 0.5,
            )
            if (contained || last - first === 1) {
                if (
                    contained ||
                    rects.some((rect) => {
                        const x = rect.left + rect.width / 2 + frame.left,
                            y = rect.top + rect.height / 2 + frame.top
                        return x >= viewport.left && x < viewport.right && y >= viewport.top && y < viewport.bottom
                    })
                )
                    spans.push([boundaries[first], boundaries[last]])
                return
            }
            const middle = Math.floor((first + last) / 2)
            inspect(first, middle)
            inspect(middle, last)
        }
        inspect(0, boundaries.length - 1)
        return spans
    }

    window.readerAnnotationViewport = () => {
        if (!ready || pageTurn || reflowing || !rendition) return []
        const viewport = rendition.manager.container.getBoundingClientRect()
        const result = []
        for (const view of rendition.manager.visible()) {
            const contents = view.contents,
                doc = contents?.document
            if (!doc?.body) continue
            const frame = view.iframe.getBoundingClientRect(),
                groups = []
            let previousBlock
            for (const node of textNodes(doc)) {
                const block =
                    node.parentElement.closest('p,li,dd,dt,blockquote,h1,h2,h3,h4,h5,h6') ||
                    node.parentElement.closest('div') ||
                    doc.body
                if (
                    contents.window.getComputedStyle(block).visibility === 'hidden' ||
                    contents.window.getComputedStyle(block).display === 'none'
                )
                    continue
                if (block !== previousBlock) {
                    groups.push({ text: '', runs: [] })
                    previousBlock = block
                }
                const group = groups[groups.length - 1]
                group.runs.push({ node, start: 0, end: node.length, offset: group.text.length })
                group.text += node.data
            }
            for (const group of groups) {
                const spans = []
                for (const run of group.runs) {
                    for (const [start, end] of visibleRanges(doc, run.node, viewport, frame)) {
                        const first = run.offset + start,
                            last = run.offset + end
                        if (spans.length && spans[spans.length - 1][1] === first) spans[spans.length - 1][1] = last
                        else spans.push([first, last])
                    }
                }
                for (const [first, last] of spans) {
                    let start = first
                    while (start < last) {
                        let end = Math.min(last, start + 1600)
                        if (end < last && /^[\uDC00-\uDFFF]$/.test(group.text[end])) end--
                        const text = group.text.slice(start, end),
                            range = sourceRange(doc, group.runs, start, end - start)
                        if (range && text.trim())
                            result.push({ location: contents.cfiFromRange(range, bookmarkIgnoreClass), text })
                        start = end
                    }
                }
            }
        }
        return result
    }

    function draw(contents) {
        const doc = contents.document
        const view = rendition.manager.views.all().find((view) => view.contents === contents)
        if (!view) return
        const frame = view.iframe.getBoundingClientRect()
        let state = layers.get(doc)
        if (!state) {
            const layer = document.createElement('div')
            layer.dataset.leximoryAnnotationLayer = 'true'
            layer.style.cssText =
                'position:absolute;left:0;top:0;width:0;height:0;pointer-events:none;overflow:visible;z-index:10;writing-mode:horizontal-tb;direction:ltr;'
            state = { layer, hits: [] }
            layers.set(doc, state)
            doc.addEventListener(
                'pointerdown',
                (event) => {
                    const hit = state.hits.find(
                        (hit) =>
                            event.clientX >= hit.rect.left &&
                            event.clientX <= hit.rect.right &&
                            event.clientY >= hit.rect.top &&
                            event.clientY <= hit.rect.bottom,
                    )
                    if (hit) hit.stroke.style.filter = 'brightness(.55)'
                },
                { passive: true },
            )
            const release = () => {
                for (const hit of state.hits) hit.stroke.style.filter = ''
            }
            doc.addEventListener('pointerup', release, { passive: true })
            doc.addEventListener('pointercancel', release, { passive: true })
        }
        surface.appendChild(state.layer)
        state.layer.replaceChildren()
        state.hits = []
        const vertical = currentTheme?.writing === 'vertical-rl'
        const passages = new Map()
        for (const mark of marks) {
            let mapped
            try {
                if (book.spine.get(mark.location)?.index !== contents.sectionIndex) continue
                mapped = passages.get(mark.location)
                if (!mapped) {
                    mapped = mapRange(contents, contents.range(mark.location, bookmarkIgnoreClass))
                    passages.set(mark.location, mapped)
                }
                if (mapped.text.slice(mark.start, mark.start + mark.length) !== mark.quote) continue
            } catch (_) {
                continue
            }
            // Measure only base-text runs, so ruby pronunciation receives no underline.
            const rectangles = []
            for (const run of mapped.runs) {
                const start = Math.max(mark.start, run.offset)
                const end = Math.min(mark.start + mark.length, run.offset + run.end - run.start)
                if (end <= start) continue
                const part = doc.createRange()
                part.setStart(run.node, run.start + start - run.offset)
                part.setEnd(run.node, run.start + end - run.offset)
                for (const rect of part.getClientRects()) if (rect.width > 0 && rect.height > 0) rectangles.push(rect)
            }
            for (const rect of rectangles) {
                const stroke = document.createElement('div')
                stroke.setAttribute('aria-hidden', 'true')
                stroke.style.cssText = `position:absolute;pointer-events:none;border-radius:999px;background:${isDarkTheme(currentTheme) ? 'rgba(174,198,160,.32)' : 'rgba(90,121,79,.25)'};`
                const x = rect.left + frame.left,
                    y = rect.top + frame.top
                Object.assign(
                    stroke.style,
                    vertical
                        ? {
                              left: `${x - 2}px`,
                              top: `${y + 1}px`,
                              width: '2px',
                              height: `${Math.max(1, rect.height - 2)}px`,
                          }
                        : {
                              left: `${x + 1}px`,
                              top: `${y + rect.height - 1}px`,
                              width: `${Math.max(1, rect.width - 2)}px`,
                              height: '2px',
                          },
                )
                state.layer.appendChild(stroke)
                state.hits.push({ rect, mark, stroke })
            }
            const anchor = rectangles[0]
            if (anchor) {
                const action = document.createElement('button')
                action.type = 'button'
                action.setAttribute('aria-label', `${mark.quote}，查看释义`)
                action.style.cssText = `appearance:none;position:absolute;left:${anchor.left + frame.left}px;top:${anchor.top + frame.top}px;width:${anchor.width}px;height:${anchor.height}px;border:0;padding:0;margin:0;background:transparent;pointer-events:none;`
                action.addEventListener('click', () =>
                    send('annotationTapped', {
                        id: mark.id,
                        rect: {
                            x: anchor.left + frame.left,
                            y: anchor.top + frame.top,
                            width: anchor.width,
                            height: anchor.height,
                        },
                    }),
                )
                state.layer.appendChild(action)
            }
        }
    }
    window.readerAnnotationMarks = (values) => {
        marks = values
        surface.replaceChildren()
        if (rendition) for (const contents of rendition.getContents()) draw(contents)
    }
    window.readerTapAnnotation = (fractionX, fractionY) => {
        if (!ready || pageTurn || reflowing) return false
        if (fractionX < 0 || fractionX > 1 || fractionY < 0 || fractionY > 1) return false
        const x = fractionX * innerWidth,
            y = fractionY * innerHeight
        for (const view of rendition.manager.visible()) {
            const frame = view.iframe.getBoundingClientRect(),
                state = layers.get(view.contents.document)
            const hit = state?.hits.find(
                (hit) =>
                    x >= hit.rect.left + frame.left &&
                    x <= hit.rect.right + frame.left &&
                    y >= hit.rect.top + frame.top &&
                    y <= hit.rect.bottom + frame.top,
            )
            if (!hit) continue
            send('annotationTapped', {
                id: hit.mark.id,
                rect: {
                    x: hit.rect.left + frame.left,
                    y: hit.rect.top + frame.top,
                    width: hit.rect.width,
                    height: hit.rect.height,
                },
            })
            return true
        }
        return false
    }
})()
