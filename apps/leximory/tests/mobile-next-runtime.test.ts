import assert from 'node:assert/strict'
import { test } from 'node:test'
import { spawn } from 'node:child_process'
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises'
import { createServer } from 'node:net'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'

const require = createRequire(import.meta.url)

test('real Next.js invokes authenticated static and dynamic mobile handlers', { timeout: 120000 }, async () => {
    const root = await mkdtemp(join(tmpdir(), 'leximory-next-boundary-'))
    const reservation = createServer()
    await new Promise<void>((resolve) => reservation.listen(0, '127.0.0.1', resolve))
    const address = reservation.address()
    if (!address || typeof address === 'string') throw new Error('No local test port')
    const port = address.port
    await new Promise<void>((resolve, reject) => reservation.close((error) => (error ? reject(error) : resolve())))
    let output = ''
    let server: ReturnType<typeof spawn> | undefined
    try {
        await symlink(fileURLToPath(new URL('../node_modules', import.meta.url)), join(root, 'node_modules'))
        await writeFile(
            join(root, 'package.json'),
            JSON.stringify({ name: 'mobile-boundary-runtime-test', private: true }),
        )
        await writeFile(join(root, 'next.config.mjs'), 'export default { cacheComponents: true }\n')
        const handler = `
            import { mobileEndpoint } from ${JSON.stringify(fileURLToPath(new URL('../server/mobile/http.ts', import.meta.url)))}
            import { mobileSubjectSchema } from '@repo/schema/mobile'
            const subject = mobileSubjectSchema.parse({ userId: 'runtime-reader' })
            const endpoint = mobileEndpoint(async token => token === 'runtime-test'
                ? { kind: 'authenticated', subject } : { kind: 'unauthenticated' },
                async ({ params, subject }) => ({ params, userId: subject.userId }))
            export const GET = endpoint
            export const POST = endpoint
        `
        for (const route of ['static', 'dynamic/[libraryId]']) {
            const directory = join(root, 'app/api', route)
            await mkdir(directory, { recursive: true })
            await writeFile(join(directory, 'route.ts'), handler)
        }
        const archiveDirectory = join(root, 'app/api/libraries/[libraryId]/archive')
        await mkdir(archiveDirectory, { recursive: true })
        await writeFile(
            join(archiveDirectory, 'route.ts'),
            `
            import { invalidateMutationCaches } from ${JSON.stringify(fileURLToPath(new URL('../server/mobile/mutation-effects.ts', import.meta.url)))}
            import { createClient } from '@supabase/supabase-js'
            import { mobileEndpoint } from ${JSON.stringify(fileURLToPath(new URL('../server/mobile/http.ts', import.meta.url)))}
            import { createLibraryArchiveOperations } from ${JSON.stringify(fileURLToPath(new URL('../server/mobile/library-preferences.ts', import.meta.url)))}
            import { createLibraryPreferenceStore } from ${JSON.stringify(fileURLToPath(new URL('../server/mobile/library-preference-store.ts', import.meta.url)))}
            const subject = { userId: 'runtime-reader' }
            const verify = async token => token === 'runtime-test'
                ? { kind: 'authenticated', subject } : { kind: 'unauthenticated' }
            let profile = null
            const database = createClient('https://database.fixture.invalid', 'fixture', {
                auth: { persistSession: false, autoRefreshToken: false },
                global: { fetch: async (input, init) => {
                    const url = new URL(String(input))
                    if (url.pathname !== '/rest/v1/users') throw Error('unexpected service')
                    if (init.method === 'POST') {
                        profile ??= { archived_libs: null }
                        return new Response(null, { status: 201 })
                    }
                    if (url.searchParams.get('id') !== 'eq.runtime-reader') throw Error('wrong account')
                    if (init.method === 'PATCH') {
                        profile = JSON.parse(init.body)
                        return Response.json([{ id: subject.userId }])
                    }
                    return Response.json(profile)
                } },
            })
            const preferences = createLibraryPreferenceStore(database)
            const operations = createLibraryArchiveOperations({
                catalog: { library: async id => ({ id, name: 'Books', lang: 'en', owner: subject.userId,
                    access: 0, starred_by: null, shadow: false }) },
                setArchived: async (...input) => {
                    await preferences.setArchived(...input)
                    invalidateMutationCaches('libraries')
                },
            })
            export const POST = mobileEndpoint(verify, operations.libraryArchive)
            export const GET = mobileEndpoint(verify, async ({ signal }) => ({
                archived: await preferences.archived(subject.userId, signal),
            }))
        `,
        )
        server = spawn(
            process.execPath,
            [
                require.resolve('next/dist/bin/next'),
                'dev',
                root,
                '--webpack',
                '--hostname',
                '127.0.0.1',
                '--port',
                String(port),
            ],
            {
                cwd: root,
                env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' },
                stdio: ['ignore', 'pipe', 'pipe'],
            },
        )
        server.stdout?.on('data', (data) => {
            output += String(data)
        })
        server.stderr?.on('data', (data) => {
            output += String(data)
        })
        const origin = `http://127.0.0.1:${port}`
        const deadline = Date.now() + 90000
        while (true) {
            if (server.exitCode !== null) throw new Error(`Next exited early:\n${output}`)
            try {
                await fetch(origin + '/api/static', { signal: AbortSignal.timeout(1000) })
                break
            } catch {
                if (Date.now() > deadline) throw new Error(`Next did not start:\n${output}`)
                await delay(100)
            }
        }
        const headers = { authorization: 'Bearer runtime-test' }
        for (const method of ['GET', 'POST']) {
            const response = await fetch(origin + '/api/static', { method, headers })
            assert.equal(response.status, 200, output + '\n' + (await response.clone().text()))
            assert.deepEqual(await response.json(), { params: {}, userId: 'runtime-reader' })
            assert.equal(response.headers.get('cache-control'), 'private, no-store')
        }
        const dynamic = await fetch(origin + '/api/dynamic/library-123', { headers })
        assert.equal(dynamic.status, 200, output)
        assert.deepEqual(await dynamic.json(), { params: { libraryId: 'library-123' }, userId: 'runtime-reader' })
        const archiveURL = origin + '/api/libraries/folder/archive'
        for (const archived of [true, true, false]) {
            const response = await fetch(archiveURL, {
                method: 'POST',
                headers: { ...headers, 'content-type': 'application/json' },
                body: JSON.stringify({ archived }),
            })
            assert.equal(response.status, 200, output + '\n' + (await response.clone().text()))
            assert.deepEqual(await response.json(), { archived })
            assert.equal(response.headers.get('cache-control'), 'private, no-store')
            const saved = await fetch(archiveURL, { headers })
            assert.deepEqual(await saved.json(), { archived: archived ? ['folder'] : [] })
        }
        const denied = await fetch(origin + '/api/static')
        assert.equal(denied.status, 401)
        assert.equal((await denied.json()).error.code, 'unauthenticated')
        await delay(1000)
        assert.doesNotMatch(output, /mobile\.mutation\.effect_failed/, output)
    } finally {
        if (server && server.exitCode === null) {
            const child = server
            const stopped = new Promise<void>((resolve) => child.once('exit', () => resolve()))
            child.kill('SIGTERM')
            await stopped
        }
        await rm(root, { recursive: true, force: true })
    }
})
