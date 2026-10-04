import { OpenAPIGenerator } from '@orpc/openapi'
import { ZodToJsonSchemaConverter } from '@orpc/zod/zod4'
import { writeFile } from 'node:fs/promises'
import { mobileContract, mobileErrorSchema, definitionFrameSchema } from './index'
const generator = new OpenAPIGenerator({ schemaConverters: [new ZodToJsonSchemaConverter()] })
const specification = await generator.generate(mobileContract, {
    info: { title: 'Leximory Mobile', version: '1.0.0' },
    servers: [{ url: '/api/mobile/v1' }],
    commonSchemas: { MobileError: { schema: mobileErrorSchema }, DefinitionFrame: { schema: definitionFrameSchema } },
    security: [{ bearerAuth: [] }],
    components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer' } } },
})
specification.paths ??= {}
specification.paths['/libraries/{libraryId}/ebooks'] = { post: {
    operationId: 'uploadEbook',
    parameters: [
        { name: 'libraryId', in: 'path', required: true, schema: { type: 'string' } },
        { name: 'title', in: 'query', required: true, schema: { type: 'string', maxLength: 512 } },
        { name: 'filename', in: 'query', required: true, schema: { type: 'string', maxLength: 512 } },
    ],
    requestBody: { required: true, content: { 'application/octet-stream': { schema: { type: 'string', format: 'binary' } } } },
    responses: { '200': { description: 'Uploaded ebook', content: { 'application/json': { schema: specification.paths['/libraries/{libraryId}/articles']!.post!.responses!['200']!.content!['application/json']!.schema } } } },
    security: [{ bearerAuth: [] }],
} }
for (const path of Object.values(specification.paths ?? {})) {
    for (const method of ['get', 'post'] as const) {
        const operation = path?.[method]
        if (!operation) continue
        for (const status of ['400', '401', '404', '409', '422', '429', '503']) {
            operation.responses ??= {}
            operation.responses[status] = {
                description: 'Typed mobile failure',
                content: { 'application/json': { schema: { $ref: '#/components/schemas/MobileError' } } },
            }
        }
    }
}
// Apple interprets nullable type arrays, while a standalone null anyOf branch
// is unsupported. Preserve semantics while normalizing Zod's representation.
function normalize(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(normalize)
    if (typeof value !== 'object' || value === null) return value
    const record = Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalize(item)]))
    if ('const' in record && ['string', 'number', 'boolean'].includes(typeof record.const)) {
        const { const: literal, ...rest } = record
        return { ...rest, enum: [literal], type: typeof literal === 'number' ? 'integer' : typeof literal }
    }
    const branches = record.anyOf
    if (Array.isArray(branches) && branches.length === 2) {
        const nullable = branches.some(branch => typeof branch === 'object' && branch !== null && 'type' in branch && branch.type === 'null')
        const concrete = branches.find(branch => typeof branch === 'object' && branch !== null && 'type' in branch && typeof branch.type === 'string' && branch.type !== 'null')
        if (nullable && typeof concrete === 'object' && concrete !== null && 'type' in concrete) {
            const { anyOf: _, ...rest } = record
            return { ...rest, ...concrete, type: [concrete.type, 'null'] }
        }
    }
    return record
}
await writeFile(new URL('../../../apps/leximory-ios/Core/Sources/LeximoryCore/openapi.json', import.meta.url), JSON.stringify(normalize(specification), null, 2) + '\n')
