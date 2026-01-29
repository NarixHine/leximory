import { z } from '@repo/schema/v3'

// AI generated list of extension maps, customize for your purpose.
export const inferMediaTypeFromUrl = (url: string): string | null => {
    try {
        if (url.startsWith("data:")) {
            const match = url.match(/^data:([^;,]+)/)
            return match ? match[1] : null
        }

        let pathname = ""
        try {
            pathname = new URL(url).pathname.toLowerCase()
        } catch {
            pathname = url.toLowerCase()
        }
        const ext = pathname.split(".").pop() || ""

        const map: Record<string, string> = {
            pdf: "application/pdf",
            txt: "text/plain",
            md: "text/markdown",
            html: "text/html",
            css: "text/css",
            js: "text/javascript",
            ts: "text/typescript",
            json: "application/json",
            xml: "application/xml",
            csv: "text/csv",
            jpg: "image/jpeg",
            jpeg: "image/jpeg",
            png: "image/png",
            gif: "image/gif",
            svg: "image/svg+xml",
            webp: "image/webp",
            ico: "image/x-icon",
            mp3: "audio/mpeg",
            wav: "audio/wav",
            mp4: "video/mp4",
            webm: "video/webm",
            zip: "application/zip",
            gz: "application/gzip",
        }

        return map[ext] ?? null
    } catch {
        return null
    }
}

/**
 *
 * BASE SCHEMA
 *
 *
 */

/**
A JSON value can be a string, number, boolean, object, array, or null.
JSON values can be serialized and deserialized by the JSON.stringify and JSON.parse methods.
 */
type JSONValue =
    | null
    | string
    | number
    | boolean
    | {
        [value: string]: JSONValue
    }
    | Array<JSONValue>

// Base schemas
const JSONValueSchema: z.ZodType<JSONValue> = z.lazy(() =>
    z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(JSONValueSchema), z.record(JSONValueSchema)])
)

const ProviderMetadataSchema = z.record(z.record(JSONValueSchema))

/**
 *
 * PARTS SCHEMA
 *
 *
 */

// SourceUIPart
const V4SourceUIPartSchema = z.object({
    type: z.literal("source"),
    source: z.object({
        sourceType: z.literal("url"),
        id: z.string(),
        url: z.string(),
        title: z.string().optional(),
        providerMetadata: ProviderMetadataSchema.optional(),
    }),
})

// skips source-document, since all v4 sourceUIPart were of source type url
const V4ToV5SourceUIPartTransform = V4SourceUIPartSchema.transform((v4) => ({
    type: "source-url",
    sourceId: v4.source.id,
    url: v4.source.url,
    title: v4.source.title,
    providerMetadata: v4.source.providerMetadata,
}))

// TextUIPart
const V4TextUIPartSchema = z.object({
    type: z.literal("text"),
    text: z.string(),
})

const V4ToV5TextUIPartTransform = V4TextUIPartSchema.transform((v4) => ({
    type: "text",
    text: v4.text,
    // Did not add state - v4 didn't have it
    // Did not add providerMetadata - v4 didn't have it
}))

// ReasoningUIPart
const V4ReasoningUIPartSchema = z.object({
    type: z.literal("reasoning"),
    reasoning: z.string(),
    details: z.array(
        z.union([
            z.object({
                type: z.literal("text"),
                text: z.string(),
                signature: z.string().optional(),
            }),
            z.object({
                type: z.literal("redacted"),
                data: z.string(),
            }),
        ])
    ),
})

const V4ToV5ReasoningUIPartTransform = V4ReasoningUIPartSchema.transform((v4) => ({
    type: "reasoning",
    text: v4.reasoning,
    // Did not add state - v4 didn't have it
    // Did not add providerMetadata - v4 didn't have it
}))

// FileUIPart
const V4FileUIPartSchema = z.object({
    type: z.literal("file"),
    mimeType: z.string(),
    data: z.string(),
})
const V4ToV5FileUIPartTransform = V4FileUIPartSchema.transform((v4) => ({
    type: "file",
    mediaType: v4.mimeType,
    url: v4.data, // data url from v4
    // Did not add filename - v4 didn't have it
    // Did not add providerMetadata - v4 didn't have it
}))

// Step start
const V4StepStartUIPartSchema = z.object({
    type: z.literal("step-start"),
})

const V4ToV5StepStartUIPartTransform = V4StepStartUIPartSchema.transform(() => ({
    type: "step-start",
}))

// Attachment -> File part
const V4AttachmentSchema = z.object({
    name: z.string().optional(),
    contentType: z.string().optional(),
    url: z.string(),
})

// there is some issues here. V5 requires mediaType but V4's version of it is contentType.
const AttachmentToV5FileTransform = V4AttachmentSchema.transform((v4) => {
    // application/octet-stream is a generic mediaType for unknown file
    const mediaType = v4.contentType?.trim() || inferMediaTypeFromUrl(v4.url) || "application/octet-stream"
    return {
        type: "file",
        mediaType,
        filename: v4.name,
        url: v4.url,
        // providerMetadata will be undefined since attachments don't have it
    }
})

// ToolInvocation schemas
const V4ToolInvocationUnionSchema = z.union([
    z.object({
        state: z.literal("partial-call"),
        step: z.number().optional(),
        toolCallId: z.string(),
        toolName: z.string(),
        args: JSONValueSchema,
    }),
    z.object({
        state: z.literal("call"),
        step: z.number().optional(),
        toolCallId: z.string(),
        toolName: z.string(),
        args: JSONValueSchema,
    }),
    z.object({
        state: z.literal("result"),
        step: z.number().optional(),
        toolCallId: z.string(),
        toolName: z.string(),
        args: JSONValueSchema,
        result: JSONValueSchema,
    }),
])

const V4ToolInvocationSchema = z.object({
    type: z.literal("tool-invocation"),
    toolInvocation: V4ToolInvocationUnionSchema,
})

const V4ToV5ToolUIPartTransform = V4ToolInvocationSchema.transform((v4) => {
    const tool = v4.toolInvocation
    if (tool.state === "result") {
        return {
            type: `tool-${tool.toolName}`,
            toolCallId: tool.toolCallId,
            state: "output-available",
            input: tool.args,
            output: tool.result,
            // skipped providerExecuted, v4 didn't have it
            // skipped callProviderMetadata, v4 didn't have it
            // skipped errorText
            // skipped
        }
    }
    if (tool.state === "call") {
        return {
            type: `tool-${tool.toolName}`,
            toolCallId: tool.toolCallId,
            state: "input-available",
            input: tool.args,
        }
    }
    // skipped output-error, v4 toolInovcation didn't have it
    // partial-call
    return {
        type: `tool-${tool.toolName}`,
        toolCallId: tool.toolCallId,
        state: "input-streaming",
        input: tool.args,
    }
})

const V4PartsSchema = z.discriminatedUnion("type", [
    V4SourceUIPartSchema,
    V4TextUIPartSchema,
    V4ReasoningUIPartSchema,
    V4FileUIPartSchema,
    V4StepStartUIPartSchema,
    V4ToolInvocationSchema,
])

const V4UIMessageSchema = z.object({
    id: z.string(),
    createdAt: z.date().optional(),
    content: z.string(),
    reasoning: z.string().optional(), //deprecated
    experimental_attachments: z.array(V4AttachmentSchema).optional(),
    role: z.enum(["system", "user", "assistant", "data"]),
    data: JSONValueSchema.optional(), ////deprecated
    annotations: z.array(JSONValueSchema).optional(),
    toolInvocations: z.array(V4ToolInvocationUnionSchema).optional(),
    parts: z.array(V4PartsSchema).optional(),
})

/**
 * UNIVERSAL PART CONVERTER
 */

// Helper function to convert a single V4 part to V5
const convertV4PartToV5Part = (part?: any): any => {
    if (!part) return null
    const transforms = {
        text: V4ToV5TextUIPartTransform,
        reasoning: V4ToV5ReasoningUIPartTransform,
        "tool-invocation": V4ToV5ToolUIPartTransform,
        source: V4ToV5SourceUIPartTransform,
        file: V4ToV5FileUIPartTransform,
        "step-start": V4ToV5StepStartUIPartTransform,
    }

    type TransformKey = keyof typeof transforms
    const key = (part as { type?: unknown })?.type
    const isTransformKey = (val: unknown): val is TransformKey => typeof val === "string" && val in transforms

    if (isTransformKey(key)) {
        const result = transforms[key].safeParse(part)
        if (result.success) {
            return result.data
        }
    }

    return null
}

/**
 * MESSAGE CONVERTER
 */

const V4ToV5UIMessageTransform = V4UIMessageSchema.transform((v4) => {
    const convertedParts = []

    if (v4.role === "data") {
        // didn't have time to look further where this maps to in v5.
        // return null and skips it.
        return null
    }

    // Convert content to text part if it exists

    if (v4.content) {
        // not needed in my use case but please change this if this applies to you
    }

    // Convert parts array if it exists
    if (v4.parts) {
        const partResults = v4.parts
            .map(convertV4PartToV5Part)
            .filter((part): part is NonNullable<typeof part> => part !== null)

        convertedParts.push(...partResults)
    }

    // Convert attachments to file parts if they exist
    if (v4.experimental_attachments) {
        const attachmentResults = v4.experimental_attachments
            .map((attachment) => {
                const result = AttachmentToV5FileTransform.safeParse(attachment)
                return result.success ? result.data : null
            })
            .filter((part) => part !== null)

        convertedParts.push(...attachmentResults)
    }

    // Convert toolInvocations to tool parts if they exist
    // if (v4.toolInvocations) {
    //     const toolResults = v4.toolInvocations
    //         .map((toolInvocation) => {
    //             const result = V4ToV5ToolUIPartTransform.safeParse({
    //                 type: "tool-invocation",
    //                 toolInvocation,
    //             });
    //             return result.success ? result.data : null;
    //         })
    //         .filter((part): part is V5_ToolUIPart => part !== null);

    //     convertedParts.push(...toolResults);
    // }

    return {
        id: v4.id,
        role: v4.role,
        parts: convertedParts,
        // edit for your use case
    }
})

/**
 * MAIN CONVERSION FUNCTIONS
 */

export function convertV4MessageToV5(v4Message: unknown) {
    const result = V4ToV5UIMessageTransform.safeParse(v4Message)
    return result.success ? result.data : null
}

/**
 *
 * V5 Schema
 *
 */

const V5TextUIPartSchema = z.object({
    type: z.literal("text"),
    text: z.string(),
    state: z.enum(["streaming", "done"]).optional(),
    providerMetadata: ProviderMetadataSchema.optional(),
})

const V5ReasoningUIPartSchema = z.object({
    type: z.literal("reasoning"),
    text: z.string(),
    state: z.enum(["streaming", "done"]).optional(),
    providerMetadata: ProviderMetadataSchema.optional(),
})

const V5SourceURLUIPartSchema = z.object({
    type: z.literal("source-url"),
    sourceId: z.string(),
    url: z.string(),
    title: z.string().optional(),
    providerMetadata: ProviderMetadataSchema.optional(),
})

const V5SourceDocumentUIPartSchema = z.object({
    type: z.literal("source-document"),
    sourceId: z.string(),
    mediaType: z.string(),
    title: z.string(),
    filename: z.string().optional(),
    providerMetadata: ProviderMetadataSchema.optional(),
})

const V5ToolTypeSchema: z.ZodType<`tool-${string}`> = z.custom(
    (val) => typeof val === "string" && val.startsWith("tool-")
)
const V5BaseToolSchema = z.object({
    type: V5ToolTypeSchema,
    toolCallId: z.string(),
    providerExecuted: z.boolean().optional(),
})
const V5ToolUIPartSchema = z.discriminatedUnion("state", [
    V5BaseToolSchema.extend({
        state: z.literal("input-streaming"),
        input: JSONValueSchema, // required, may be undefined
    }),
    V5BaseToolSchema.extend({
        state: z.literal("input-available"),
        input: JSONValueSchema,
        callProviderMetadata: ProviderMetadataSchema.optional(),
    }),
    V5BaseToolSchema.extend({
        state: z.literal("output-available"),
        input: JSONValueSchema,
        output: JSONValueSchema,
        callProviderMetadata: ProviderMetadataSchema.optional(),
        preliminary: z.boolean().optional(),
    }),
    V5BaseToolSchema.extend({
        state: z.literal("output-error"),
        input: JSONValueSchema,
        rawInput: JSONValueSchema.optional(),
        callProviderMetadata: ProviderMetadataSchema.optional(),
        errorText: z.string(),
    }),
])

const V5DynamicToolSchema = z.object({
    type: z.literal("dynamic-tool"),
    toolName: z.string(),
    toolCallId: z.string(),
})

// zod issue, if you don't use `as type`, zod will complain that input: z.unknown() = unknown | undefined, instead of just unknown.
const V5DynamicToolUIPartSchema = z.discriminatedUnion("state", [
    V5DynamicToolSchema.extend({
        state: z.literal("input-streaming"),
        input: z.unknown(),
    }),
    V5DynamicToolSchema.extend({
        state: z.literal("input-available"),
        input: z.unknown(),
        callProviderMetadata: ProviderMetadataSchema.optional(),
    }),
    V5DynamicToolSchema.extend({
        state: z.literal("output-available"),
        input: z.unknown(),
        output: z.unknown(),
        callProviderMetadata: ProviderMetadataSchema.optional(),
        preliminary: z.boolean().optional(),
    }),
    V5DynamicToolSchema.extend({
        state: z.literal("output-error"),
        input: z.unknown(),
        callProviderMetadata: ProviderMetadataSchema.optional(),
        errorText: z.string(),
    }),
])

const V5FileUIPartSchema = z.object({
    type: z.literal("file"),
    mediaType: z.string(),
    filename: z.string().optional(),
    url: z.string(),
    providerMetadata: ProviderMetadataSchema.optional(),
})

const V5StepStartUIPartSchema = z.object({
    type: z.literal("step-start"),
})

const V5DataTypeSchema: z.ZodType<`data-${string}`> = z.custom(
    (val) => typeof val === "string" && val.startsWith("data-")
)
const V5DataUIPartSchema = z.object({
    type: V5DataTypeSchema,
    id: z.string().optional(),
    data: JSONValueSchema,
})

const V5UIPartSchema = z.union([
    V5TextUIPartSchema,
    V5ReasoningUIPartSchema,
    V5SourceURLUIPartSchema,
    V5SourceDocumentUIPartSchema,
    V5ToolUIPartSchema,
    V5DynamicToolUIPartSchema,
    V5FileUIPartSchema,
    V5StepStartUIPartSchema,
    V5DataUIPartSchema,
])

const V5UIMessageSchema = z.object({
    id: z.string(),
    role: z.enum(["system", "user", "assistant"]),
    parts: z.array(V5UIPartSchema),
    metadata: JSONValueSchema.optional(),
})

export { convertV4PartToV5Part, V4ToV5UIMessageTransform, V5UIMessageSchema }
