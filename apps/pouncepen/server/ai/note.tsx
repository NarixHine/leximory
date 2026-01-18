import 'server-only'
import { smoothStream, streamText } from 'ai'
import { FLASH_AI } from './config'
import { NOTE_SYSTEM_PROMPT } from './prompts/note'

export type StreamNoteParams = {
    llmReadyText: { paper: string, key: string }
    assignmentId: string
    sectionId: string
}

export async function streamNote({ llmReadyText }: StreamNoteParams & { teamId: string }) {
    const { textStream } = streamText({
        prompt: `${llmReadyText.paper}\n\n${llmReadyText.key}`,
        system: NOTE_SYSTEM_PROMPT,
        maxOutputTokens: 5000,
        experimental_transform: smoothStream(),
        ...FLASH_AI,
    })
    return textStream
}
