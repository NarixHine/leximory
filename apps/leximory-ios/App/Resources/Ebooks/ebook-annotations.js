/* Source ranges remain in the publisher DOM; only non-interactive strokes are added. */
;(() => {
    let marks = []
    let entering = new Set()
    let lastActivation = { id: null, time: 0 }
    function openAnnotation(mark, rect, frame) {
        lastActivation = { id: mark.id, time: performance.now() }
        send('annotationTapped', { id: mark.id, rect: { x: rect.left + frame.left, y: rect.top + frame.top, width: rect.width, height: rect.height } })
        return true
    }
    const layers = new WeakMap()
    const surface = document.createElement('div')
    surface.style.cssText = 'position:fixed;inset:0;pointer-events:none;overflow:hidden;z-index:2;'
    document.body.appendChild(surface)
    window.readerAnnotationTheme = theme => {
        surface.style.setProperty('--annotation-underline', theme.annotationUnderline)
        surface.style.setProperty('--annotation-press', theme.annotationPress)
    }
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
            const frame = view.iframe.getBoundingClientRect()
            const visible = []
            for (const node of textNodes(doc)) {
                const style = contents.window.getComputedStyle(node.parentElement)
                if (style.visibility === 'hidden' || style.display === 'none') continue
                for (const [start, end] of visibleRanges(doc, node, viewport, frame))
                    visible.push({ node, start, end })
            }
            if (!visible.length) continue
            const range = doc.createRange()
            range.setStart(visible[0].node, visible[0].start)
            range.setEnd(visible.at(-1).node, visible.at(-1).end)
            const mapped = mapRange(contents, range)
            const boundaries = [...new Intl.Segmenter(undefined, {granularity:'grapheme'}).segment(mapped.text)].map(part => part.index)
            boundaries.push(mapped.text.length)
            let start = 0
            while (start < mapped.text.length) {
                const end = boundaries.findLast(offset => offset > start && offset <= start + 1600) ?? boundaries.find(offset => offset > start)
                if (end === undefined) break
                const text = mapped.text.slice(start, end)
                const passage = sourceRange(doc, mapped.runs, start, end - start)
                if (passage && text.trim()) result.push({ location: contents.cfiFromRange(passage, bookmarkIgnoreClass), text })
                start = end
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
            state = { layer, hits: [], strokes: new Map() }
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
                    if (hit) {
                        state.pressed = { hit, x: event.clientX, y: event.clientY, time: performance.now() }
                        const feedback = document.createElement('div')
                        const currentFrame = view.iframe.getBoundingClientRect()
                        feedback.dataset.leximoryPress = 'true'
                        feedback.style.cssText = `position:absolute;pointer-events:none;border-radius:4px;left:${hit.rect.left + currentFrame.left}px;top:${hit.rect.top + currentFrame.top}px;width:${hit.rect.width}px;height:${hit.rect.height}px;background:var(--annotation-press)`
                        state.feedback = feedback
                        state.layer.appendChild(feedback)
                    }
                },
                { passive: true },
            )
            const release = () => {
                state.feedback?.remove(); state.feedback = null; state.pressed = null
            }
            doc.addEventListener('pointermove', event => {
                if (state.pressed && Math.hypot(event.clientX - state.pressed.x, event.clientY - state.pressed.y) > 8) release()
            }, { passive: true })
            doc.addEventListener('pointerup', event => {
                const pressed = state.pressed
                release()
                if (pressed && performance.now() - pressed.time < 350 && contents.window.getSelection()?.isCollapsed !== false)
                    openAnnotation(pressed.hit.mark, pressed.hit.rect, view.iframe.getBoundingClientRect())
            }, { passive: true })
            doc.addEventListener('pointercancel', release, { passive: true })
        }
        surface.appendChild(state.layer)
        const previous = state.strokes
        state.strokes = new Map()
        for (const button of state.layer.querySelectorAll('button')) button.remove()
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
            for (const [index, rect] of rectangles.entries()) {
                const key = `${mark.id}:${index}`
                const stroke = previous.get(key) ?? document.createElement('div')
                stroke.setAttribute('aria-hidden', 'true')
                stroke.style.cssText = 'position:absolute;pointer-events:none;border-radius:999px;background:var(--annotation-underline);'
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
                state.strokes.set(key, stroke)
                if (!previous.has(key) && entering.has(mark.id) && !matchMedia('(prefers-reduced-motion: reduce)').matches)
                    stroke.animate([{opacity:0.35},{opacity:1}], {duration:160,easing:'cubic-bezier(0.23,1,0.32,1)'})
                state.hits.push({ rect, mark, stroke })
            }
            const anchor = rectangles[0]
            if (anchor) {
                const action = document.createElement('button')
                action.type = 'button'
                action.setAttribute('aria-label', `${mark.quote}，查看释义`)
                action.style.cssText = `appearance:none;position:absolute;left:${anchor.left + frame.left}px;top:${anchor.top + frame.top}px;width:${anchor.width}px;height:${anchor.height}px;border:0;padding:0;margin:0;background:transparent;pointer-events:none;`
                action.addEventListener('click', () => openAnnotation(mark, anchor, frame))
                state.layer.appendChild(action)
            }
        }
        for (const [key, stroke] of previous) if (!state.strokes.has(key)) stroke.remove()
    }
    window.readerAnnotationMarks = (values) => {
        const known = new Set(marks.map(mark => mark.id))
        entering = new Set(values.filter(mark => !known.has(mark.id)).map(mark => mark.id))
        marks = values
        const active = new Set()
        if (rendition) for (const contents of rendition.getContents()) {
            draw(contents)
            const layer = layers.get(contents.document)?.layer
            if (layer) active.add(layer)
        }
        for (const layer of [...surface.children]) if (!active.has(layer)) layer.remove()
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
            if (lastActivation.id === hit.mark.id && performance.now() - lastActivation.time < 500) return true
            openAnnotation(hit.mark, hit.rect, frame)
            return true
        }
        return false
    }
})()
