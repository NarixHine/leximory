'use server'

import { Kilpi } from '@repo/service/kilpi'
import { incrAudioQuota, maxAudioQuota } from '@repo/user/quota'
import { retrieveAudioUrl, uploadAudio } from '@/server/db/audio'
import { getUserOrThrow } from '@repo/user'
import { MAX_TTS_LENGTH } from '@repo/env/config'
import { speak } from '@/server/ai/speak'
import { getLib } from '@/server/db/lib'

/** Retrieves a signed audio URL for the given audio id (NO authorization). */
export async function retrieve(id: string) {
    const url = await retrieveAudioUrl({ id })
    return url
}

/** Generates TTS audio for a text, checking quota and library write access via Kilpi. */
export async function generateAudio(id: string, lib: string, text: string) {
    const { userId } = await getUserOrThrow()
    const libData = await getLib({ id: lib })
    await Kilpi.libraries.write(libData).authorize().assert()
    const lang = libData.lang

    if (text.length > MAX_TTS_LENGTH) {
        return { error: `文本长度超过 ${MAX_TTS_LENGTH} 字符。` }
    }
    if (await incrAudioQuota()) {
        return { error: `你已用完本月的 ${await maxAudioQuota()} 语点（AI 音频生成）。` }
    }

    const audio = await speak({
        text,
        lang,
        userId,
    })

    return uploadAudio({ id, audio })
}
