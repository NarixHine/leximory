import assert from 'node:assert/strict'
import { test } from 'node:test'
import { spawn } from 'node:child_process'
import { mkdtemp, mkdir, readFile, writeFile, symlink, rm } from 'node:fs/promises'
import { createServer } from 'node:net'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'
import { startBackendFixture } from './helpers/backend-fixture'

const require = createRequire(import.meta.url)

test(
    'built Next.js invokes authenticated handlers and the production import pipeline',
    { timeout: 180000 },
    async () => {
        const root = await mkdtemp(join(tmpdir(), 'leximory-next-boundary-'))
        const reservation = createServer()
        await new Promise<void>((resolve) => reservation.listen(0, '127.0.0.1', resolve))
        const address = reservation.address()
        if (!address || typeof address === 'string') throw new Error('No local test port')
        const port = address.port
        await new Promise<void>((resolve, reject) => reservation.close((error) => (error ? reject(error) : resolve())))
        let output = ''
        let server: ReturnType<typeof spawn> | undefined
        const backend = await startBackendFixture()
        try {
            await symlink(fileURLToPath(new URL('../node_modules', import.meta.url)), join(root, 'node_modules'))
            await writeFile(
                join(root, 'package.json'),
                JSON.stringify({ name: 'mobile-boundary-runtime-test', private: true }),
            )
            await writeFile(join(root, 'next.config.mjs'), 'export default { cacheComponents: true }\n')
            await writeFile(
                join(root, 'tsconfig.json'),
                JSON.stringify({
                    compilerOptions: {
                        target: 'ES2022',
                        moduleResolution: 'bundler',
                        allowImportingTsExtensions: true,
                        strictNullChecks: true,
                        baseUrl: fileURLToPath(new URL('../', import.meta.url)),
                        paths: { '@/*': ['./*'] },
                    },
                }),
            )
            const importDirectory = join(root, 'app/api/mobile/v1/libraries/[libraryId]/articles')
            await mkdir(importDirectory, { recursive: true })
            await writeFile(
                join(importDirectory, 'route.ts'),
                await readFile(
                    new URL('../app/api/mobile/v1/libraries/[libraryId]/articles/route.ts', import.meta.url),
                    'utf8',
                ),
            )
            const foldersDirectory = join(root, 'app/api/mobile/v1/libraries')
            await mkdir(foldersDirectory, { recursive: true })
            await writeFile(
                join(foldersDirectory, 'route.ts'),
                await readFile(new URL('../app/api/mobile/v1/libraries/route.ts', import.meta.url), 'utf8'),
            )
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
            const archiveDirectory = join(root, 'app/api/mobile/v1/libraries/[libraryId]/archive')
            await mkdir(archiveDirectory, { recursive: true })
            await writeFile(
                join(archiveDirectory, 'route.ts'),
                await readFile(
                    new URL('../app/api/mobile/v1/libraries/[libraryId]/archive/route.ts', import.meta.url),
                    'utf8',
                ),
            )
            const runNext = (args: string[]) => {
                const child = spawn(process.execPath, [require.resolve('next/dist/bin/next'), ...args], {
                    cwd: root,
                    env: { ...process.env, ...backend.env, NEXT_TELEMETRY_DISABLED: '1' },
                    stdio: ['ignore', 'pipe', 'pipe'],
                })
                child.stdout?.on('data', (data) => {
                    output += String(data)
                })
                child.stderr?.on('data', (data) => {
                    output += String(data)
                })
                return child
            }
            server = runNext(['build', root, '--webpack'])
            const build = server
            const stopBuild = setTimeout(() => build.kill('SIGTERM'), 90000)
            try {
                const code = await new Promise<number | null>((resolve, reject) => {
                    build.once('error', reject)
                    build.once('exit', resolve)
                })
                assert.equal(code, 0, 'Production route build failed:\n' + output)
            } finally {
                clearTimeout(stopBuild)
            }
            server = runNext(['start', root, '--hostname', '127.0.0.1', '--port', String(port)])
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
            const folderInput = { name: 'Reading', language: 'en', requestId: 'fresh-account-folder' }
            const createFolder = () =>
                fetch(origin + '/api/mobile/v1/libraries', {
                    method: 'POST',
                    headers: { authorization: 'Bearer fixture-token', 'content-type': 'application/json' },
                    body: JSON.stringify(folderInput),
                })
            const created = await createFolder()
            assert.equal(created.status, 200, output + '\n' + (await created.clone().text()))
            const folder = await created.json()
            assert.equal(folder.name, 'Reading')
            assert.equal(folder.owned, true)
            assert.equal(backend.balance(), 20)
            assert.equal(backend.words.size, 1)
            backend.setBalance(73)
            const folderReplay = await createFolder()
            assert.equal(folderReplay.status, 200)
            assert.deepEqual(await folderReplay.json(), folder)
            assert.equal(backend.folders.size, 1)
            assert.equal(backend.words.size, 1)
            assert.equal(backend.balance(), 73, 'account bootstrap must preserve an existing balance')
            const archiveURL = origin + '/api/mobile/v1/libraries/' + folder.id + '/archive'

            for (const archived of [true, true, false]) {
                const response = await fetch(archiveURL, {
                    method: 'POST',
                    headers: { authorization: 'Bearer fixture-token', 'content-type': 'application/json' },
                    body: JSON.stringify({ archived }),
                })
                assert.equal(response.status, 200, output + '\n' + (await response.clone().text()))
                assert.deepEqual(await response.json(), { archived })
                assert.equal(response.headers.get('cache-control'), 'private, no-store')
                assert.deepEqual(backend.archived(), archived ? [folder.id] : [])
            }
            const denied = await fetch(origin + '/api/static')
            assert.equal(denied.status, 401)
            assert.equal((await denied.json()).error.code, 'unauthenticated')
            const importURL = origin + '/api/mobile/v1/libraries/' + folder.id + '/articles'
            const article = {
                requestId: 'production-import',
                title: 'River',
                content: 'Along the river bank.',
                annotate: true,
                onlyComments: false,
                generateTitle: false,
            }
            const importRequest = (body: unknown) =>
                fetch(importURL, {
                    method: 'POST',
                    headers: { authorization: 'Bearer fixture-token', 'content-type': 'application/json' },
                    body: JSON.stringify(body),
                })
            const imported = await importRequest(article)
            assert.equal(
                imported.status,
                200,
                output + '\n' + (await imported.clone().text()) + '\n' + backend.requests.join('\n'),
            )
            const saved = await imported.json()
            assert.equal(imported.headers.get('x-leximory-revision'), 'a'.repeat(40))
            const replay = await importRequest(article)
            assert.equal(replay.status, 200, await replay.clone().text())
            assert.deepEqual(await replay.json(), saved)
            assert.equal(backend.texts.size, 1)
            assert.equal(new Set(backend.events.map((event) => event.id)).size, 1)
            assert.equal(backend.events[0]?.name, 'app/article.imported')
            assert.equal(backend.events[0]?.environment, 'fixture-preview')
            backend.rejectQueue({ status: 401, error: 'Event key not found' })
            const rejected = await importRequest({ ...article, requestId: 'rejected-import' })
            assert.equal(rejected.status, 503)
            assert.equal(
                (await rejected.json()).error.retryable,
                false,
                'a rejected queue credential must not be treated as a transient retry',
            )
            const acceptedCount = backend.events.length
            const textCount = backend.texts.size
            backend.rejectProfile(true)
            const unavailableProfile = await importRequest({ ...article, requestId: 'unavailable-profile' })
            assert.equal(unavailableProfile.status, 503)
            assert.equal(backend.events.length, acceptedCount)
            assert.equal(backend.texts.size, textCount, 'failed account initialization must stop downstream writes')
            backend.rejectProfile(false)
            await delay(1000)
            assert.match(
                output,
                /QUEUE_AUTHENTICATION_REJECTED/,
                'the production rejection must retain its safe provider code',
            )
            assert.match(output, /upstreamStatus: 401/, 'the production rejection must retain the provider status')
            assert.doesNotMatch(
                output,
                /fixture-event-key|fixture-service-key/,
                'request diagnostics must not expose service credentials',
            )
            assert.doesNotMatch(output, /mobile\.mutation\.effect_failed/, output)
        } finally {
            if (server && server.exitCode === null) {
                const child = server
                const stopped = new Promise<void>((resolve) => child.once('exit', () => resolve()))
                child.kill('SIGTERM')
                await stopped
            }
            await rm(root, { recursive: true, force: true })
            await backend.close()
        }
    },
)
