/**
 * Returns the clicked text from an element.
 * 
 * @param element - The HTMLElement to get the clicked text from.
 * @returns The clicked text as a string.
 */
export function getClickedChunk(element: HTMLElement): string {
    if (!element || !element.textContent) return ''

    const parentElement = element.parentElement
    if (!parentElement || !parentElement.textContent) return ''

    const clickedText = element.textContent
    const parentText = parentElement.textContent

    const startIndex = parentText.indexOf(clickedText)
    if (startIndex === -1) return ''

    const endIndex = startIndex + clickedText.length

    return `${parentText.substring(0, startIndex)}[[${clickedText}]]${parentText.substring(endIndex)}`
}

/**
 * Reads from a streamable value and yields strings.
 * Supports strings, async iterables, and ReadableStreams.
 * 
 * @param streamable - The streamable value to read from.
 * @yields Strings read from the streamable.
 */
export async function* readStreamableValue(streamable: any) {
    if (streamable == null) return

    const decoder = new TextDecoder()

    // plain string
    if (typeof streamable === 'string') {
        yield streamable
        return
    }

    // If it's an async iterable (most browsers / Chrome do this)
    const asyncIter = streamable[Symbol.asyncIterator]
    if (typeof asyncIter === 'function') {
        for await (const chunk of streamable) {
            if (chunk == null) continue
            yield typeof chunk === 'string' ? chunk : decoder.decode(chunk)
        }
        return
    }

    // If it's a WHATWG ReadableStream, or something exposing getReader()
    const reader = streamable.getReader?.() ?? streamable.body?.getReader?.()
    if (reader) {
        try {
            while (true) {
                const { value, done } = await reader.read()
                if (done) break
                if (value == null) continue
                yield typeof value === 'string' ? value : decoder.decode(value)
            }
        } finally {
            // close the reader if possible
            try { reader.releaseLock?.() } catch { }
        }
        return
    }

    // Fallback: if it's an object with toString
    if (streamable.toString) {
        yield String(streamable)
        return
    }

    throw new Error('Unsupported stream type in readStreamableValue')
}
