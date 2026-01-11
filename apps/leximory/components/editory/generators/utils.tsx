import { JSX } from 'react'
import QuizData from './types'
import { QuestionStrategy } from './types'
import fastShuffle from 'fast-shuffle'
import { questionStrategies } from './strategies'

/**
 * A reusable helper to extract the content from all <code> tags in a string.
 */
export const extractCodeContent = (text: string): string[] => {
    return text.match(/<code>(.*?)<\/code>/g)?.map(c => c.replace(/<\/?code>/g, '')) ?? []
}

/**
 * Creates a consistent numerical seed from a string for predictable shuffling.
 */
export const getSeed = (content: string): number => {
    return content.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
}

export { fastShuffle }

/**
 * The Strategy Factory: Creates a question strategy with type safety and defaults.
 */
export function createQuestionStrategy<T extends QuizData>(
    config: Partial<QuestionStrategy<T>> & { keyPerLine: number } // Ensure keyPerLine is always provided
): QuestionStrategy<T> {
    const defaults: Omit<QuestionStrategy<T>, 'keyPerLine'> = {
        getQuestionCount: (data) => ('text' in data ? extractCodeContent(data.text).length : 0),
        getOptions: () => undefined,
        getCorrectAnswers: (data) => ('text' in data ? extractCodeContent(data.text) : []),
        renderPaper: () => null,
        renderKey: () => null,
    }

    return { ...defaults, ...config }
}

/**
 * Converts an array of JSX elements into table rows with a specified number of cells per row.
 * Pads the last row with empty cells if necessary.
 *
 * @param cells - The array of JSX elements to convert into table rows.
 * @param perLine - The number of cells to include in each row.
 * @returns An array of JSX elements representing the table rows.
 */
export const toTableRows = (cells: JSX.Element[], perLine: number): JSX.Element[] => {
    if (!cells || cells.length === 0) return []
    const paddedCells = [...cells]
    while (paddedCells.length % perLine !== 0) {
        paddedCells.push(<td key={`pad-${paddedCells.length}`} />)
    }

    const rows: JSX.Element[] = []
    for (let i = 0; i < paddedCells.length; i += perLine) {
        const rowCells = paddedCells.slice(i, i + perLine)
        rows.push(<tr key={`row-${i / perLine}`} className='flex flex-wrap'>{rowCells}</tr>)
    }
    return rows
}

/**
 * The callback type for the dispatcher function.
 * It takes a QuestionStrategy and the corresponding QuizData,
 * and returns a value of type T.
 */
type StrategyCallback<T> = <K extends QuizData['type']>(
    strategy: QuestionStrategy<Extract<QuizData, { type: K }>>,
    data: Extract<QuizData, { type: K }>,
) => T

/**
 * The generic dispatcher function. It takes a QuizData object and a callback.
 * It safely narrows the types and invokes the callback with the correct
 * strategy and data pair.
 *
 * @param data The quiz data object (e.g., FishingData, ClozeData)
 * @param callback The function to execute with the narrowed types.
 * @returns The result of the callback function.
 */
export function applyStrategy<T>(data: QuizData, callback: StrategyCallback<T>): T {
    const strategy = questionStrategies[data.type]
    return callback(strategy as any, data as any)
}
