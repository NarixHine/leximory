import { GoogleLanguageModelOptions } from '@ai-sdk/google'

export const nanoAI = {
    model: 'google/gemini-3.5-flash-lite',
    providerOptions: {
        google: {
            thinkingConfig: {
                thinkingLevel: 'minimal',
                includeThoughts: true,
            },
            safetySettings: [
                {
                    category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
                    threshold: 'BLOCK_NONE',
                },
                {
                    category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
                    threshold: 'BLOCK_NONE',
                },
                {
                    category: 'HARM_CATEGORY_HATE_SPEECH',
                    threshold: 'BLOCK_NONE',
                },
                {
                    category: 'HARM_CATEGORY_HARASSMENT',
                    threshold: 'BLOCK_NONE',
                },
                {
                    category: 'HARM_CATEGORY_CIVIC_INTEGRITY',
                    threshold: 'BLOCK_NONE',
                },
                {
                    category: 'HARM_CATEGORY_UNSPECIFIED',
                    threshold: 'BLOCK_NONE',
                },
            ],
        } satisfies GoogleLanguageModelOptions,
    },
} as const

export const miniAI = {
    model: 'google/gemini-3.6-flash',
    providerOptions: {
        google: {
            thinkingConfig: {
                thinkingLevel: 'minimal',
                includeThoughts: true,
            },
            safetySettings: [
                {
                    category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
                    threshold: 'BLOCK_NONE',
                },
                {
                    category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
                    threshold: 'BLOCK_NONE',
                },
                {
                    category: 'HARM_CATEGORY_HATE_SPEECH',
                    threshold: 'BLOCK_NONE',
                },
                {
                    category: 'HARM_CATEGORY_HARASSMENT',
                    threshold: 'BLOCK_NONE',
                },
                {
                    category: 'HARM_CATEGORY_CIVIC_INTEGRITY',
                    threshold: 'BLOCK_NONE',
                },
                {
                    category: 'HARM_CATEGORY_UNSPECIFIED',
                    threshold: 'BLOCK_NONE',
                },
            ],
        } satisfies GoogleLanguageModelOptions,
    },
} as const

export const thinkAI = {
    model: 'google/gemini-3.6-flash',
    providerOptions: {
        google: {
            safetySettings: [
                {
                    category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
                    threshold: 'BLOCK_NONE',
                },
                {
                    category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
                    threshold: 'BLOCK_NONE',
                },
                {
                    category: 'HARM_CATEGORY_HATE_SPEECH',
                    threshold: 'BLOCK_NONE',
                },
                {
                    category: 'HARM_CATEGORY_HARASSMENT',
                    threshold: 'BLOCK_NONE',
                },
                {
                    category: 'HARM_CATEGORY_CIVIC_INTEGRITY',
                    threshold: 'BLOCK_NONE',
                },
                {
                    category: 'HARM_CATEGORY_UNSPECIFIED',
                    threshold: 'BLOCK_NONE',
                },
            ],
        } satisfies GoogleLanguageModelOptions,
    },
} as const
