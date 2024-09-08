'use server'

import { authWriteToLib } from '@/lib/auth'
import { incrAudioQuota } from '@/lib/quota'
import { maxAudioQuota } from '@/lib/quota'
import { convertReadableToBinaryFile } from '@/lib/utils'
import { getXataClient } from '@/lib/xata'
import { ElevenLabsClient } from 'elevenlabs'

const xata = getXataClient()

export async function retrieveAudioUrl(id: string) {
    const audio = await xata.db.audio.select(['gen']).filter({ id }).getFirst()
    return audio?.gen?.url
}

export async function generateAudio(id: string, lib: string, text: string) {
    await authWriteToLib(lib)
    if (text.length > 5000) {
        return { error: '文本长度超过 5000 字符。' }
    }
    if (await incrAudioQuota()) {
        return { error: `你已用完本月的 ${maxAudioQuota()} 次 AI 音频生成额度。` }
    }

    const lab = new ElevenLabsClient()
    const audio = await lab.generate({
        voice: 'npp2mvZp4jbUrUkhYg8e',
        text,
        model_id: 'eleven_multilingual_v2'
    })

    await xata.db.audio.create({
        id,
        lib,
        gen: {
            enablePublicUrl: true,
        }
    })
    await xata.files.upload({ table: 'audio', column: 'gen', record: id }, await convertReadableToBinaryFile(audio), {
        mediaType: 'audio/mpeg',
    })

    const url = await retrieveAudioUrl(id) as string
    return { url }
}
