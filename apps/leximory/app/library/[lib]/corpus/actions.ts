'use server'

import * as corpusService from '@/service/corpus'

/** @deprecated Use `load` from `@/service/corpus` directly. */
export default async function load(lib: string, cursor?: string) {
    return corpusService.load(lib, cursor)
}

/** @deprecated Use `draw` from `@/service/corpus` directly. */
export async function draw(args: Parameters<typeof corpusService.draw>[0]) {
    return corpusService.draw(args)
}

/** @deprecated Use `getWithin` from `@/service/corpus` directly. */
export async function getWithin(args: Parameters<typeof corpusService.getWithin>[0]) {
    return corpusService.getWithin(args)
}

/** @deprecated Use `generateCorpusStory` from `@/service/corpus` directly. */
export async function generateStory(args: Parameters<typeof corpusService.generateCorpusStory>[0]) {
    return corpusService.generateCorpusStory(args)
}
