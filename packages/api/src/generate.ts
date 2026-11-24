import { OpenAPIGenerator } from '@orpc/openapi'
import { ZodToJsonSchemaConverter } from '@orpc/zod/zod4'
import { readFile, writeFile } from 'node:fs/promises'
import {
    mobileContract,
    mobileErrorSchema,
    definitionFrameSchema,
    ebookHighlightColorSchema,
    ebookUploadQuerySchema,
    ebookReplaceQuerySchema,
} from './index'
import { z } from 'zod'
const generator = new OpenAPIGenerator({ schemaConverters: [new ZodToJsonSchemaConverter()] })
const specification = await generator.generate(mobileContract, {
    info: { title: 'Leximory Mobile', version: '1.0.0' },
    servers: [{ url: '/api/mobile/v1' }],
    commonSchemas: {
        MobileError: { schema: mobileErrorSchema },
        DefinitionFrame: { schema: definitionFrameSchema },
        EbookHighlightColor: { schema: ebookHighlightColorSchema },
    },
    security: [{ bearerAuth: [] }],
    components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer' } } },
})
specification.paths ??= {}
specification.paths['/libraries/{libraryId}/ebooks'] = {
    post: {
        operationId: 'uploadEbook',
        parameters: [
            { name: 'libraryId', in: 'path', required: true, schema: { type: 'string' } },
            ...Object.entries(ebookUploadQuerySchema.shape).map(([name, schema]) => ({
                name,
                in: 'query' as const,
                required: !schema.isOptional(),
                schema: z.toJSONSchema(schema, { target: 'openapi-3.0' }),
            })),
        ],
        requestBody: {
            required: false,
            description: 'Required when uploadId is absent. Omit the body when finalizing a staged upload.',
            content: { 'application/octet-stream': { schema: { type: 'string', format: 'binary' } } },
        },
        responses: {
            '200': {
                description: 'Uploaded ebook',
                content: {
                    'application/json': {
                        schema: specification.paths['/libraries/{libraryId}/articles']!.post!.responses!['200']!
                            .content!['application/json']!.schema,
                    },
                },
            },
        },
        security: [{ bearerAuth: [] }],
    },
}
specification.paths['/texts/{textId}/ebook-replace'] = {
    post: {
        operationId: 'replaceEbook',
        parameters: [
            { name: 'textId', in: 'path', required: true, schema: { type: 'string' } },
            ...Object.entries(ebookReplaceQuerySchema.shape).map(([name, schema]) => ({
                name,
                in: 'query' as const,
                required: !schema.isOptional(),
                schema: z.toJSONSchema(schema, { target: 'openapi-3.0' }),
            })),
        ],
        requestBody: {
            required: false,
            description: 'Required when uploadId is absent. Omit the body when finalizing a staged upload.',
            content: { 'application/octet-stream': { schema: { type: 'string', format: 'binary' } } },
        },
        responses: {
            '200': {
                description: 'Replaced ebook',
                content: {
                    'application/json': {
                        schema: specification.paths['/libraries/{libraryId}/articles']!.post!.responses!['200']!
                            .content!['application/json']!.schema,
                    },
                },
            },
        },
        security: [{ bearerAuth: [] }],
    },
}
for (const path of Object.values(specification.paths ?? {})) {
    for (const method of ['get', 'post'] as const) {
        const operation = path?.[method]
        if (!operation) continue
        const fileErrors = ['prepareEbookUpload', 'uploadEbook', 'replaceEbook'].includes(operation.operationId ?? '')
            ? ['403', '413']
            : []
        for (const status of [...fileErrors, '400', '401', '404', '409', '422', '429', '503']) {
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
        const nullable = branches.some(
            (branch) => typeof branch === 'object' && branch !== null && 'type' in branch && branch.type === 'null',
        )
        const concrete = branches.find(
            (branch) =>
                typeof branch === 'object' &&
                branch !== null &&
                'type' in branch &&
                typeof branch.type === 'string' &&
                branch.type !== 'null',
        )
        if (nullable && typeof concrete === 'object' && concrete !== null && 'type' in concrete) {
            const { anyOf: _, ...rest } = record
            return { ...rest, ...concrete, type: [concrete.type, 'null'] }
        }
    }
    return record
}
const target = new URL('../../../apps/leximory-ios/Core/Sources/LeximoryCore/openapi.json', import.meta.url)
const output = JSON.stringify(normalize(specification), null, 2) + '\n'
if (process.argv.includes('--check')) {
    if ((await readFile(target, 'utf8')) !== output)
        throw new Error('Generated mobile OpenAPI is stale. Run pnpm --dir packages/api run generate.')
    console.info('Mobile OpenAPI matches its source contract.')
} else await writeFile(target, output)
