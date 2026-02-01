/**
 * Reads from a streamable value and yields items of type T.
 * Supports strings, objects, async iterables, and ReadableStreams.
 *
 * @template T - The type of value yielded by the stream (defaults to string).
 * @param streamable - The streamable value to read from.
 * @yields Values of type T read from the streamable.
 */
export async function* readStreamableValue<T = string>(
  streamable:
    | string
    | AsyncIterable<T>
    | ReadableStream<T>
    | { body?: ReadableStream<T> }
    | { toString(): string }
    | null
    | undefined
): AsyncGenerator<T, void, unknown> {
  if (streamable == null) return

  const decoder = new TextDecoder()

  // Helper to handle chunks: strings, binary (decode), or objects (yield as-is)
  const processChunk = (chunk: unknown): T => {
    if (typeof chunk === 'string') {
      return chunk as T
    }
    // Check for binary data (ArrayBuffer or TypedArray) to decode
    if (chunk instanceof ArrayBuffer || ArrayBuffer.isView(chunk)) {
      return decoder.decode(chunk as BufferSource) as T
    }
    // Fallback: yield the object directly (e.g. PartialObject<...>)
    return chunk as T
  }

  // 1. Plain string
  if (typeof streamable === 'string') {
    yield streamable as T
    return
  }

  // 2. Async Iterable (e.g. AsyncIterableStream, Arrays, Vercel AI SDK streams)
  // We check for Symbol.asyncIterator to cover AsyncIterableStream<T>
  if (typeof streamable === 'object' && Symbol.asyncIterator in streamable) {
    const asyncIter = streamable as AsyncIterable<unknown>
    for await (const chunk of asyncIter) {
      if (chunk == null) continue
      yield processChunk(chunk)
    }
    return
  }

  // 3. ReadableStream (WHATWG) or something exposing getReader()
  const streamWithReader = streamable as { getReader?: () => ReadableStreamDefaultReader }
  const reader =
    streamWithReader.getReader?.() ??
    (streamable as { body?: { getReader?: () => ReadableStreamDefaultReader } }).body?.getReader?.()

  if (reader) {
    try {
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        if (value == null) continue
        yield processChunk(value)
      }
    } finally {
      // Close the reader if possible
      try {
        reader.releaseLock?.()
      } catch {}
    }
    return
  }

  // 4. Fallback: if it's an object with toString (and wasn't caught by the iterators above)
  if (typeof streamable === 'object' && 'toString' in streamable) {
    yield String(streamable) as T
    return
  }

  throw new Error('Unsupported stream type in readStreamableValue')
}
