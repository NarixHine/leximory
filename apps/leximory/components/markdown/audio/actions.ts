'use server'

import { authWriteToLib } from '@/server/auth/role'
import { incrAudioQuota } from '@repo/user/quota'
import { maxAudioQuota } from '@repo/user/quota'
import { retrieveAudioUrl, uploadAudio } from '@/server/db/audio'
import { generateText } from 'ai'
import { getUserOrThrow } from '@repo/user'
import { MAX_TTS_LENGTH } from '@repo/env/config'
import { speak } from '@/server/ai/speak'
import { nanoAI } from '@/server/ai/configs'

export async function retrieve(id: string) {
    const url = await retrieveAudioUrl({ id })
    return url
}

export async function generate(id: string, lib: string, text: string) {
    const { userId } = await getUserOrThrow()
    const { lang } = await authWriteToLib(lib)

    if (text.length > MAX_TTS_LENGTH) {
        return { error: `文本长度超过 ${MAX_TTS_LENGTH} 字符。` }
    }
    if (await incrAudioQuota()) {
        return { error: `你已用完本月的 ${await maxAudioQuota()} 语点（AI 音频生成）。` }
    }

    const prompt = lang === 'ja' ? await japaneseToKana(text) : text

    const audio = await speak({
        text: prompt,
        lang,
        userId
    })

    return uploadAudio({ id, audio })
}

async function japaneseToKana(text: string) {
    const result = await generateText({
        prompt: `将以下日文文章全部用片假名改写输出：\n\n${text}`,
        temperature: 0,
        ...nanoAI
    })
    return result.text
}
