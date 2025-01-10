'use server'

import { authReadToLib, authWriteToLib } from '@/lib/auth'
import { loadWords, drawWords, saveWord } from '@/server/word'
import { revalidatePath } from 'next/cache'

export default async function load(lib: string, cursor?: string) {
    await authReadToLib(lib)
    return await loadWords({ lib, cursor })
}

export const save = async (lib: string, word: string) => {
    await authWriteToLib(lib)
    await saveWord({ lib, word })
    revalidatePath(`/library/${lib}/corpus`)
}

export async function draw(lib: string, start: Date, end: Date) {
    return await drawWords({ lib, start, end, size: 5 })
}
