'use server'

import { authWriteToLib, getAuthOrThrow } from '@/lib/auth'
import { elevenLabsVoice } from '@/lib/config'
import { incrAudioQuota } from '@/lib/quota'
import { maxAudioQuota } from '@/lib/quota'
import { retrieveAudioUrl, uploadAudio } from '@/server/db/audio'
import { getAccentPreference } from '@/server/db/preference'
import { ElevenLabsClient } from 'elevenlabs'

export async function retrieve(id: string) {
    const url = await retrieveAudioUrl({ id })
    return url
}

export async function generate(id: string, lib: string, text: string) {
    await authWriteToLib(lib)
    if (text.length > 5000) {
        return { error: '文本长度超过 5000 字符。' }
    }
    if (await incrAudioQuota()) {
        return { error: `你已用完本月的 ${await maxAudioQuota()} 次 AI 音频生成额度。` }
    }

    const { userId } = await getAuthOrThrow()
    const lab = new ElevenLabsClient()
    const accent = await getAccentPreference({ userId })
    const audio = await lab.generate({
        voice: elevenLabsVoice[accent],
        text,
        model_id: 'eleven_multilingual_v2'
    })

    return uploadAudio({ id, lib, audio })
}
