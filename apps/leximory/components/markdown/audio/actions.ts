'use server'

import * as audioService from '@/service/audio'

/** @deprecated Use `retrieve` from `@/service/audio` directly. */
export async function retrieve(id: string) {
    return audioService.retrieve(id)
}

/** @deprecated Use `generateAudio` from `@/service/audio` directly. */
export async function generate(id: string, lib: string, text: string) {
    return audioService.generateAudio(id, lib, text)
}
