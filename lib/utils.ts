import { Readable } from 'stream'
import { ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { MouseEvent } from 'react'

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

export function getClickedChunk(event: MouseEvent<HTMLButtonElement>): string {
    const clickedElement = event.target as HTMLElement
    if (!clickedElement || !clickedElement.textContent) return ''

    const range = document.caretRangeFromPoint(event.clientX, event.clientY)
    if (!range) return ''

    const clickedText = range.startContainer.textContent || ''
    const clickedIndex = range.startOffset

    // Get some context before and after the clicked word
    const contextBefore = clickedText.substring(Math.max(0, clickedIndex - 50), clickedIndex)
    const contextAfter = clickedText.substring(clickedIndex, clickedIndex + 50)

    // Find the word boundary
    const wordStart = contextBefore.match(/\S+$/)
    const wordEnd = contextAfter.match(/^\S+/)

    const clickedWord = (wordStart ? wordStart[0] : '') + (wordEnd ? wordEnd[0] : '')

    return `${contextBefore}[[${clickedWord}]]${contextAfter}`
}

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}
