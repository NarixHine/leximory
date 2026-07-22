import { Lang } from '@repo/env/config'
import { experimental_generateSpeech as generateSpeech } from 'ai'
import { gateway } from '@ai-sdk/gateway'

export async function speak({ text, lang, userId }: { text: string; lang: Lang; userId: string }) {
    const { audio } = await generateSpeech({
        model: gateway.speechModel!('xai/grok-tts'),
        text,
        voice: 'eve',
    })
    return audio
}
