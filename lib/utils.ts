import { Readable } from 'stream'
import { ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function stringToColor(input: string): 'primary' | 'warning' | 'danger' {
    let hash = 0
    for (let i = 0; i < input.length; i++) {
        const char = input.charCodeAt(i)
        hash = (hash << 5) - hash + char
        hash = hash & hash
    }
    return ['secondary', 'warning', 'danger'][Math.abs(hash % 3)] as any
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

export function getSelectedText(selection: Selection) {
    const start = Math.min(selection.anchorOffset, selection.focusOffset)
    const end = Math.max(selection.anchorOffset, selection.focusOffset)
    const text = `${selection.anchorNode?.textContent?.substring(0, start)}[[${selection.toString()}]]${selection.anchorNode?.textContent?.substring(end)}`
    return text
}

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}
