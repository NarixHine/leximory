import { Readable } from 'stream'
import { ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { z } from 'zod'

export const randomID = () => crypto.getRandomValues(new Uint32Array(1))[0].toString(16)

export async function convertReadableToBinaryFile(readable: Readable) {
    let dataBuffer = Buffer.alloc(0)
    readable.on('data', (chunk) => {
        dataBuffer = Buffer.concat([dataBuffer, chunk])
    })
    await new Promise((resolve, reject) => {
        readable.on('end', resolve)
        readable.on('error', reject)
    })
    return dataBuffer
}

export function getSelectedChunk(selection: Selection) {
    const start = Math.min(selection.anchorOffset, selection.focusOffset)
    const end = Math.max(selection.anchorOffset, selection.focusOffset)
    return selection.anchorNode!.textContent!.substring(start, end)
}

export function getBracketedSelection(selection: Selection) {
    const text = getSelectedChunk(selection)!
    const start = Math.min(selection.anchorOffset, selection.focusOffset)
    const end = Math.max(selection.anchorOffset, selection.focusOffset)
    return `${selection.anchorNode?.textContent?.substring(0, start)}[[${text}]]${selection.anchorNode?.textContent?.substring(end)}`
}

export function getClickedChunk(element: HTMLElement): string {
    if (!element || !element.textContent) return ''

    const parentElement = element.parentElement
    if (!parentElement || !parentElement.textContent) return ''

    const clickedText = element.textContent
    const parentText = parentElement.textContent

    const startIndex = parentText.indexOf(clickedText)
    if (startIndex === -1) return ''

    const endIndex = startIndex + clickedText.length

    return `${parentText.substring(0, startIndex)}[[${clickedText}]]${parentText.substring(endIndex)}`
}

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export async function parseBody<T>(request: Request, schema: z.ZodSchema<T>) {
    const body = await request.json()
    const { success, data } = schema.safeParse(body)
    if (!success) { throw new Error('Invalid request body') }
    return data
}

// Tremor Raw focusInput [v0.0.1]
export const focusInput = [
    // base
    "focus:ring-2",
    // ring color
    "focus:ring-blue-200 focus:dark:ring-blue-700/30",
    // border color
    "focus:border-blue-500 focus:dark:border-blue-700",
]

// Tremor Raw focusRing [v0.0.1]
export const focusRing = [
    // base
    "outline outline-offset-2 outline-0 focus-visible:outline-2",
    // outline color
    "outline-blue-500 dark:outline-blue-500",
]

// Tremor Raw hasErrorInput [v0.0.1]
export const hasErrorInput = [
    // base
    "ring-2",
    // border color
    "border-red-500 dark:border-red-700",
    // ring color
    "ring-red-200 dark:ring-red-700/30",
]
