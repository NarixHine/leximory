import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { BearerVerifier } from '../../server/mobile/auth'
import { mobileEndpoint, type MobileOperation } from '../../server/mobile/http'

const root = fileURLToPath(new URL('../../app/api/mobile/v1/', import.meta.url))
async function readRoutes(
    directory: string,
    segments: string[] = [],
): Promise<{ segments: string[]; operations: Record<string, string> }[]> {
    const entries = await readdir(directory, { withFileTypes: true })
    return (
        await Promise.all(
            entries.map(async (entry) => {
                if (entry.isDirectory()) return readRoutes(join(directory, entry.name), [...segments, entry.name])
                if (entry.name !== 'route.ts') return []
                const source = await readFile(join(directory, entry.name), 'utf8')
                const operations = Object.fromEntries(
                    [...source.matchAll(/export \{ (\w+) as (GET|POST) \} from/g)].map((match) => [match[2], match[1]]),
                )
                return [{ segments, operations }]
            }),
        )
    ).flat()
}
const routes = readRoutes(root)

// Tests exercise the same endpoint wrapper with external services injected.
// Read the real route exports so tests cannot silently use a separate route table.
export function testMobileHandler(operations: Record<string, MobileOperation>, verify: BearerVerifier) {
    return async (request: Request): Promise<Response> => {
        const url = new URL(request.url)
        if (!url.pathname.startsWith('/api/mobile/v1/')) return new Response(null, { status: 404 })
        const segments = url.pathname.slice('/api/mobile/v1/'.length).split('/')
        for (const route of await routes) {
            if (segments.length !== route.segments.length) continue
            const params: Record<string, string> = {}
            let matches = true
            for (const [index, segment] of route.segments.entries()) {
                const actual = segments[index]!
                if (segment.startsWith('[')) params[segment.slice(1, -1)] = decodeURIComponent(actual)
                else if (segment !== actual) {
                    matches = false
                    break
                }
            }
            if (!matches) continue
            const id = route.operations[request.method]
            if (!id) return new Response(null, { status: 405 })
            const operation = operations[id]
            if (!operation) return new Response(null, { status: 404 })
            const context = { params: Object.keys(params).length ? Promise.resolve(params) : undefined }
            // Next's runtime passes undefined static params despite its generated handler type.
            const response: unknown = await Reflect.apply(mobileEndpoint(verify, operation, 60000), undefined, [
                request,
                context,
            ])
            if (!(response instanceof Response)) throw new Error('The mobile endpoint did not return an HTTP response')
            return response
        }
        return new Response(null, { status: 404 })
    }
}
