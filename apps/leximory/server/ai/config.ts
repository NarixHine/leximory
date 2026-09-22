import { GoogleLanguageModelOptions } from '@ai-sdk/google'

export const nanoAI = {
    model: 'google/gemini-3.8-flash',
    providerOptions: {
        google: {
            thinkingConfig: {
                thinkingLevel: 'low',
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
            ],
        } satisfies GoogleLanguageModelOptions,
    },
} as const

export const miniAI = {
    model: 'google/gemini-3.8-flash',
    providerOptions: {
        google: {
            thinkingConfig: {
                thinkingLevel: 'medium',
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
            ],
        } satisfies GoogleLanguageModelOptions,
    },
} as const

/**
 * Fast path for the location resolver. It only has to fill a small structured
 * extraction (the gate and the kind already come from Jev), so a lite model
 * with no thinking budget beats the annotation model on latency.
 */
export const locationAI = {
    model: 'google/gemini-3.5-flash-lite',
    providerOptions: {
        google: {
            safetySettings: [...nanoAI.providerOptions.google.safetySettings],
        } satisfies GoogleLanguageModelOptions,
    },
} as const

export const thinkAI = {
    model: 'google/gemini-3.7-flash',
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
            ],
        } satisfies GoogleLanguageModelOptions,
    },
} as const
