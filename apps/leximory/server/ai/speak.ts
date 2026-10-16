import { Lang } from '@repo/env/config'
import { generateSpeech } from 'ai'
import { gateway } from '@ai-sdk/gateway'

export async function speak({
    text,
    lang,
    userId,
    signal,
}: {
    text: string
    lang: Lang
    userId: string
    signal?: AbortSignal
}) {
    const { audio } = await generateSpeech({
        model: gateway.speechModel('fish-audio/drama-3'),
        text,
        abortSignal: signal,
        voice: '933563129e564b19a115bedd57b7406a',
        outputFormat: 'mp3',
    })
    return audio
}
