import 'server-only'
import { setTimeout as pause } from 'node:timers/promises'
import { after } from 'next/server'
import { revalidateTag } from 'next/cache'
import { z } from 'zod'

type MutationEffect = {
    name: 'cache.invalidate' | 'article.receipt' | 'annotation.progress'
    run(): void | Promise<void>
}

// Only optional bookkeeping belongs here. Persistence, quota checks and job acceptance must still reject on failure.
export function createMutationEffects(dependencies: {
    defer(work: () => Promise<void>): void
    report(name: MutationEffect['name'], error: unknown): void
    pause(): Promise<void>
}) {
    return {
        async read<T>(effect: { name: 'article.receipt'; run(): Promise<T> }): Promise<T | null> {
            try {
                return await effect.run()
            } catch (error) {
                dependencies.report(effect.name, error)
                return null
            }
        },
        async run(effect: MutationEffect): Promise<void> {
            try {
                await effect.run()
            } catch (error) {
                dependencies.report(effect.name, error)
            }
        },
        schedule(effect: MutationEffect): void {
            try {
                dependencies.defer(async () => {
                    for (let attempt = 0; attempt < 3; attempt++) {
                        try {
                            await effect.run()
                            return
                        } catch (error) {
                            if (attempt === 2) {
                                dependencies.report(effect.name, error)
                                return
                            }
                            await dependencies.pause()
                        }
                    }
                })
            } catch (error) {
                dependencies.report(effect.name, error)
            }
        },
    }
}
export type MutationEffects = ReturnType<typeof createMutationEffects>

const failure = z.object({
    code: z
        .string()
        .regex(/^[A-Z0-9_]{1,32}$/)
        .optional(),
})
export const mutationEffects = createMutationEffects({
    defer: after,
    pause: () => pause(300),
    report: (effect, error) => {
        const upstream = failure.safeParse(error)
        console.error('mobile.mutation.effect_failed', { effect, ...(upstream.success ? upstream.data : {}) })
    },
})

export function invalidateMutationCaches(...tags: string[]): void {
    mutationEffects.schedule({
        name: 'cache.invalidate',
        run: () => {
            for (const tag of tags) revalidateTag(tag, { expire: 0 })
        },
    })
}
