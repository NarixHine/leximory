'use server'

import { authWriteToLib, getAuthOrThrow } from '@/server/auth/role'
import { elevenLabsVoice } from '@/lib/config'
import { incrAudioQuota } from '@/server/auth/quota'
import { maxAudioQuota } from '@/server/auth/quota'
import { retrieveAudioUrl, uploadAudio } from '@/server/db/audio'
import { getAccentPreference } from '@/server/db/preference'
import { speak } from 'orate'
import { ElevenLabs } from 'orate/elevenlabs'

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
    const accent = await getAccentPreference({ userId })

    const audio = await speak({
        model: new ElevenLabs().tts('eleven_multilingual_v2', elevenLabsVoice[accent]),
        prompt: text,
    })

    return uploadAudio({ id, lib, audio })
}
