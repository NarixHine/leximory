'use server'

import { authWriteToLib, getAuthOrThrow } from '@/server/auth/role'
import { elevenLabsVoiceConfig } from '@/lib/config'
import { incrAudioQuota } from '@/server/auth/quota'
import { maxAudioQuota } from '@/server/auth/quota'
import { retrieveAudioUrl, uploadAudio } from '@/server/db/audio'
import { getAccentPreference } from '@/server/db/preference'
import { speak } from 'orate'
import { ElevenLabs } from 'orate/elevenlabs'
import { MAX_TTS_LENGTH } from '@/lib/config'

export async function retrieve(id: string) {
    const url = await retrieveAudioUrl({ id })
    return url
}

export async function generate(id: string, lib: string, text: string) {
    const { userId } = await getAuthOrThrow()
    const { lang } = await authWriteToLib(lib)

    if (text.length > MAX_TTS_LENGTH) {
        return { error: `文本长度超过 ${MAX_TTS_LENGTH} 字符。` }
    }
    if (await incrAudioQuota()) {
        return { error: `你已用完本月的 ${await maxAudioQuota()} 次 AI 音频生成额度。` }
    }

    const { voice, options } = lang === 'en' ? elevenLabsVoiceConfig[await getAccentPreference({ userId })] : elevenLabsVoiceConfig[lang]

    const audio = await speak({
        model: new ElevenLabs().tts('eleven_turbo_v2_5', voice, options),
        prompt: text,
    })

    return uploadAudio({ id, lib, audio })
}
