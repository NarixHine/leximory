import { ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { z } from '@repo/schema'
import { customAlphabet } from 'nanoid'

// Helper function to convert Base64 VAPID key to Uint8Array (for Safari)
export function urlB64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4)
    const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/')

    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i)
    }
    return outputArray
}

/** Returns the display emoji: DB emoji, or 📖 for ebooks, 📰 for articles. */
export function resolveEmoji(emoji: string | null, hasEbook: boolean): string {
    if (emoji) return emoji
    return hasEbook ? '📖' : '📰'
}

/** Checks whether a string is a single emoji grapheme. */
const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' })
export function isValidEmoji(value: string): boolean {
    if (!value) return false
    const segments = [...segmenter.segment(value)]
    if (segments.length !== 1) return false
    return /\p{Emoji_Presentation}|\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20E3/u.test(value)
}

/**
 * Generates a random ID using NanoID.
 * 
 * @returns A random ID.
 */
export const nanoid = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', 12)

/**
 * Merges class names using Tailwind Merge.
 * 
 * @param inputs - The class values to merge.
 * @returns The merged class names as a string.
 */
export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

/**
 * Parses the body of a request and validates it against a Zod schema.
 * 
 * @param request - The request object.
 * @param schema - The Zod schema to validate against.
 * @returns The parsed and validated data.
 */
export async function parseBody<T>(request: Request, schema: z.ZodSchema<T>) {
    const body = await request.json()
    const { success, data } = schema.safeParse(body)
    if (!success) { throw new Error('Invalid request body') }
    return data
}
