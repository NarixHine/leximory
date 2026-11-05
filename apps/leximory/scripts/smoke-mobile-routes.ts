import { readFile } from 'node:fs/promises'
import { z } from 'zod'

async function main() {
    const origin = process.argv[2] ?? 'http://localhost:3101'
    const url = new URL(origin)
    if (!['localhost', '127.0.0.1'].includes(url.hostname))
        throw new Error('This smoke check only targets a local server.')
    const spec = z
        .object({ paths: z.record(z.string(), z.record(z.string(), z.unknown())) })
        .parse(
            JSON.parse(
                await readFile(
                    new URL('../../leximory-ios/Core/Sources/LeximoryCore/openapi.json', import.meta.url),
                    'utf8',
                ),
            ),
        )
    let count = 0
    for (const [path, methods] of Object.entries(spec.paths)) {
        for (const method of Object.keys(methods)) {
            if (!['get', 'post'].includes(method)) continue
            const route = path.replaceAll(/\{\w+\}/g, 'sample')
            const response = await fetch(new URL('/api/mobile/v1' + route, origin), {
                method: method.toUpperCase(),
                signal: AbortSignal.timeout(90000),
                ...(method === 'post' ? { body: '{}', headers: { 'Content-Type': 'application/json' } } : {}),
            })
            if (response.status !== 401)
                throw new Error(`${method.toUpperCase()} ${path} returned ${response.status}, expected 401`)
            const payload = z
                .object({ error: z.object({ code: z.literal('unauthenticated') }) })
                .parse(await response.json())
            if (
                response.headers.get('cache-control') !== 'private, no-store' ||
                response.headers.get('www-authenticate') !== 'Bearer'
            )
                throw new Error(`Missing private authentication headers for ${path}`)
            console.info(`${method.toUpperCase()} ${path}: ${response.status} ${payload.error.code}`)
            count++
        }
    }
    console.info(`Verified ${count} real Next.js endpoints without an account or database mutation.`)
}
main().catch((error) => {
    console.error(error)
    process.exitCode = 1
})
