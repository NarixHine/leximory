import 'server-only'
import { generateObject } from 'ai'
import { IMPORT_PROMPT } from './prompts/import'
import { nanoid } from 'nanoid'
import { z } from '@repo/schema'
import { GeneratableDataSchema } from './prompts/sections'
import { FILE_AI } from './config'

export async function aiSmartImport(file: File) {
    const { object: items } = await generateObject({
        messages: [{
            role: 'system',
            content: IMPORT_PROMPT
        }, {
            role: 'user',
            content: [{
                type: 'text',
                text: '以下是你需要导入的文件。',
            }, {
                type: 'file',
                data: await file.arrayBuffer(),
                mediaType: file.type,
            }],
        }],
        schema: z.array(GeneratableDataSchema).min(1),
        ...FILE_AI
    })
    // reassign ID to items
    const itemsWithId = items.map(item => ({ ...item, id: nanoid(5) }))
    return itemsWithId
}
