import { Client } from '@upstash/qstash'
import { z } from 'zod'

// Use the target deployment's environment. No remote changes unless --apply is explicit.
const args = process.argv.slice(2)
if (args.some((arg) => arg !== '--apply'))
    throw new Error('Use no arguments to inspect, or --apply to upsert the schedule')
const settings = z
    .object({
        NEXT_PUBLIC_LEXIMORY_URL: z.url().refine((value) => new URL(value).protocol === 'https:'),
        QSTASH_URL: z.url(),
        QSTASH_TOKEN: z.string().min(1),
    })
    .parse(process.env)
const schedule = {
    scheduleId: `leximory-apple-recovery-${new URL(settings.NEXT_PUBLIC_LEXIMORY_URL).hostname}`,
    destination: new URL('/api/workflows/ios/apple-recovery', settings.NEXT_PUBLIC_LEXIMORY_URL).href,
    cron: '17 * * * *',
    body: '{}',
    retries: 5,
    headers: { 'Content-Type': 'application/json' },
}
console.log(JSON.stringify({ action: args.includes('--apply') ? 'upsert' : 'plan', ...schedule }, null, 2))
if (args.includes('--apply')) {
    await new Client({ token: settings.QSTASH_TOKEN, baseUrl: settings.QSTASH_URL }).schedules.create(schedule)
}
