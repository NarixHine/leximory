import 'server-only'
import { streamText } from 'ai'
import { mobileEndpoint } from '../http'
import { verify } from './verify'
import { catalogStore } from '../store'
import { browserStore } from '../browser-store'
import { definitionServices } from '../definition-services'
import { createElaborationOperations, elaborationInstructions } from '../elaboration'

const operations = createElaborationOperations({
    definitions: definitionServices,
    browser: browserStore,
    catalog: catalogStore,
    async *generate({ context, language, definition, signal }) {
        const result = streamText({
            model: 'deepseek/deepseek-v4.1-flash-1017',
            reasoning: 'low',
            abortSignal: signal,
            maxOutputTokens: 4096,
            instructions: elaborationInstructions,
            prompt: JSON.stringify({ language, context, annotation: definition }),
        })
        for await (const text of result.textStream) yield text
    },
})

export const elaborateDefinition = mobileEndpoint(verify, operations.elaborateDefinition, 60000)
