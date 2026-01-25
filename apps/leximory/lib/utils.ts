import { ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { z } from '@repo/schema'
import { customAlphabet } from 'nanoid'

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
