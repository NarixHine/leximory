import 'server-only'
import { generateObject } from 'ai'
import { IMPORT_PROMPT } from './prompts/import'
import { nanoid } from 'nanoid'
import { SECTIONS } from './prompts/sections'
import z from 'zod'
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
        schema: z.array(z.union(Object.values(SECTIONS).map(s => s.schema))),
        ...FILE_AI
    })
    // reassign ID to items
    const itemsWithId = items.map(item => ({ ...item, id: nanoid(5) }))
    return itemsWithId
}
