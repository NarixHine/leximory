import { Lang } from '@repo/env/config'
import { elevenLabsVoiceConfig } from '@/server/ai/configs'
import { elevenlabs } from '@ai-sdk/elevenlabs'
import { getAccentPreference } from '../db/preference'
import { experimental_generateSpeech as generateSpeech } from 'ai'

export async function speak({ text, lang, userId }: {
    text: string,
    lang: Lang,
    userId: string,
}) {
    const { voice, options } = lang === 'en' ? elevenLabsVoiceConfig[await getAccentPreference({ userId })] : elevenLabsVoiceConfig[lang]
    const { audio } = await generateSpeech({
        model: elevenlabs.speech('eleven_flash_v2_5'),
        text,
        voice,
        ...options
    })
    return audio
}
