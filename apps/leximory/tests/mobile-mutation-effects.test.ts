import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mobileSubjectSchema } from '@repo/schema/mobile'
import { createMutationEffects } from '../server/mobile/mutation-effects'
import { mobileEndpoint } from '../server/mobile/http'
import { MobileError, mobileDependency } from '../server/mobile/errors'

const subject = mobileSubjectSchema.parse({ userId: 'reader' })
const verify = async () => ({ kind: 'authenticated' as const, subject })
function request() {
    return new Request('https://leximory.test/api/mobile/v1/example', {
        method: 'POST',
        headers: { authorization: 'Bearer verified' },
    })
}

test('a committed mutation responds before failed cache work and retries it without replaying the write', async () => {
    const work: (() => Promise<void>)[] = []
    const failures: string[] = []
    let writes = 0
    let invalidations = 0
    const effects = createMutationEffects({
        defer: (task) => {
            work.push(task)
        },
        pause: async () => {},
        report: (name) => {
            failures.push(name)
        },
    })
    const endpoint = mobileEndpoint(verify, async () => {
        writes++
        effects.schedule({
            name: 'cache.invalidate',
            run: () => {
                invalidations++
                if (invalidations < 3) throw Error('cache unavailable')
            },
        })
        return { saved: true }
    })
    const response = await endpoint(request())
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { saved: true })
    assert.equal(invalidations, 0)
    for (const task of work) await task()
    assert.equal(invalidations, 3)
    assert.equal(writes, 1)
    assert.deepEqual(failures, [])
})

test('permanently failing bookkeeping is bounded and never changes the committed result', async () => {
    const work: (() => Promise<void>)[] = []
    const failures: string[] = []
    let attempts = 0
    const effects = createMutationEffects({
        defer: (task) => {
            work.push(task)
        },
        pause: async () => {},
        report: (name) => {
            failures.push(name)
        },
    })
    effects.schedule({
        name: 'article.receipt',
        run: () => {
            attempts++
            throw Error('receipt unavailable')
        },
    })
    for (const task of work) await task()
    assert.equal(attempts, 3)
    assert.deepEqual(failures, ['article.receipt'])
})

test('failed scheduling cannot reject a committed response', async () => {
    const failures: string[] = []
    const effects = createMutationEffects({
        defer: () => {
            throw Error('request context unavailable')
        },
        pause: async () => {},
        report: (name) => {
            failures.push(name)
        },
    })
    const endpoint = mobileEndpoint(verify, async () => {
        effects.schedule({ name: 'cache.invalidate', run: () => assert.fail('not scheduled') })
        return { saved: true }
    })
    assert.equal((await endpoint(request())).status, 200)
    assert.deepEqual(failures, ['cache.invalidate'])
})

test('optional progress failures leave job acceptance available', async () => {
    const failures: string[] = []
    const effects = createMutationEffects({
        defer: () => {},
        pause: async () => {},
        report: (name) => {
            failures.push(name)
        },
    })
    await effects.run({
        name: 'annotation.progress',
        run: () => {
            throw Error('progress unavailable')
        },
    })
    assert.deepEqual(failures, ['annotation.progress'])
})

test('required quota and persistence failures still reject the mutation with their domain status', async () => {
    let writes = 0
    const endpoint = mobileEndpoint(verify, async () => {
        await mobileDependency('annotation.quota', async () => {
            throw new MobileError('quota_exceeded')
        })
        writes++
        return { saved: true }
    })
    const response = await endpoint(request())
    assert.equal(response.status, 429)
    assert.equal(writes, 0)
})

test('failed required dependencies retain their step and cause for request diagnostics', async () => {
    const cause = { code: '23505', message: 'private database details' }
    await assert.rejects(
        mobileDependency('article.persist', async () => {
            throw cause
        }),
        (error) =>
            error instanceof MobileError &&
            error.code === 'service_unavailable' &&
            error.cause === cause &&
            'step' in error &&
            error.step === 'article.persist',
    )
})

test('dependency failures log their request and failing step without exposing provider details', async (t) => {
    const logs: unknown[][] = []
    t.mock.method(console, 'error', (...values: unknown[]) => {
        logs.push(values)
    })
    const endpoint = mobileEndpoint(verify, async function importArticle() {
        return mobileDependency('article.persist', async () => {
            throw { code: '23505', message: 'private SQL and content', details: 'private data' }
        })
    })
    const response = await endpoint(
        new Request('https://leximory.test/api/mobile/v1/libraries/library/articles', {
            method: 'POST',
            headers: { authorization: 'Bearer verified', 'X-Leximory-Request-ID': 'failed-import' },
        }),
    )
    assert.equal(response.status, 503)
    assert.equal(response.headers.get('X-Leximory-Request-ID'), 'failed-import')
    assert.deepEqual(logs, [
        [
            'mobile.request.failed',
            {
                traceId: 'failed-import',
                operation: 'importArticle',
                method: 'POST',
                status: 503,
                step: 'article.persist',
                upstreamCode: '23505',
                errorType: undefined,
            },
        ],
    ])
    assert.doesNotMatch(JSON.stringify(logs), /private|SQL|verified/)
})
