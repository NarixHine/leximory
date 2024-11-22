import { Readable } from 'stream'
import { ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { z } from 'zod'

export function stringToColor(input: string) {
    const colors = ['secondary', 'warning', 'danger', 'primary'] as const
    let hash = 0
    for (let i = 0; i < input.length; i++) {
        const char = input.charCodeAt(i)
        hash = (hash << 5) - hash + char
        hash = hash & hash
    }
    return colors[Math.abs(hash % 4)]
}

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
    const text = `${selection.anchorNode?.textContent?.substring(0, start)}[[${selection.toString()}]]${selection.anchorNode?.textContent?.substring(end)}`
    return text
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
