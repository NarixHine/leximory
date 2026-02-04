import { JSX } from 'react'
import fastShuffle from 'fast-shuffle'
import { questionStrategies } from './strategies'
import Rand from 'rand-seed'
import parse, { DOMNode } from 'html-react-parser'
import { ReactNode } from 'react'
import { merge } from 'es-toolkit'
import { ALPHABET_SET } from './config'
import { z } from '@repo/schema'
import { QuizData, QuestionStrategy, ClozeData, SectionAnswers } from '@repo/schema/paper'

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
    return new Rand(content).next()
}

export { fastShuffle }

/**
 * The Strategy Factory: Creates a question strategy with type safety and defaults.
 */
export function createQuestionStrategy<T extends QuizData, O = unknown>(
    config: Partial<QuestionStrategy<T, O>> & { keyPerLine: number } // Ensure keyPerLine is always provided
): QuestionStrategy<T, O> {
    const defaults: Omit<QuestionStrategy<T, O>, 'keyPerLine'> = {
        getQuestionCount: (data) => ('text' in data ? extractCodeContent(data.text).length : 0),
        getOptions: () => undefined as O,
        getCorrectAnswers: (data) => ('text' in data ? extractCodeContent(data.text) : []),
        isCorrect: (userAnswer, correctAnswer) => userAnswer === correctAnswer,
        renderPaper: () => null,
        getDefaultValue: () => {
            throw new Error('getDefaultValue must be implemented for each strategy')
        },
        renderRubric: () => (<></>),
        scorePerQuestion: 1,
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
export const toTableRows = (cells: JSX.Element[], perLine: number, lineNo?: number): JSX.Element[] => {
    if (!cells || cells.length === 0) return []
    const paddedCells = [...cells]
    while (paddedCells.length % perLine !== 0) {
        paddedCells.push(<td key={`pad-${paddedCells.length}`} />)
    }

    const rows: JSX.Element[] = []
    for (let i = 0; i < paddedCells.length; i += perLine) {
        const rowCells = paddedCells.slice(i, i + perLine)
        rows.push(<tr key={`row-${i / perLine}`} className='flex flex-wrap first:mt-1 last:mb-1'>{lineNo && <td className='mr-2 font-bold'>{lineNo}</td>}{rowCells}</tr>)
    }
    return rows
}

/**
 * The callback type for the dispatcher function.
 * It takes a QuestionStrategy and the corresponding QuizData,
 * and returns a value of type T.
 */
type StrategyCallback<T> = <K extends QuizData['type']>(
    strategy: QuestionStrategy<Extract<QuizData, { type: K }>, any>,
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


/**
 * Parses HTML text, finds all `<code>` tags, and replaces them with a specified React node.
 * This is the core logic for rendering fill-in-the-blank and multiple-choice questions.
 *
 * @param text The HTML string to parse.
 * @param start The starting global question number (for display).
 * @param replacer A function that receives both the display number and local number (1-based index within section),
 * along with the original content of the `<code>` tag, and returns the React node to insert.
 * @returns A ReactNode with the `<code>` tags replaced.
 */
export const replaceBlanks = (
    text: string,
    start: number,
    replacer: (displayNo: number, localNo: number, originalContent: string) => ReactNode
): ReactNode => {
    let i = 0
    return parse(text, {
        replace: (node: DOMNode) => {
            if ('name' in node && node.name === 'code' && 'children' in node) {
                let child = node.children[0]
                if (!child) return
                if (child.type === 'tag') {
                    const textNode = child.children.find(c => c.type === 'text')
                    if (textNode) {
                        child = textNode
                    }
                }
                if (child.type !== 'text') return
                i++
                const displayNo = start + i - 1
                const localNo = i // 1-based index within section
                const originalContent = child.data
                return replacer(displayNo, localNo, originalContent) as JSX.Element
            }
        }
    })
}

/**
 * Parses HTML text and extracts all nodes intended to be replaced as blanks.
 * This is used for answer sheet views where questions are listed vertically.
 *
 * @param text The HTML string to parse.
 * @param start The starting global question number (for display).
 * @param replacer A function that receives both the display number and local number (1-based index within section),
 * along with the original content of the `<code>` tag, and returns the React node for that blank.
 * @returns An array of ReactNodes, one for each blank found.
 */
export const extractBlanks = (
    text: string,
    start: number,
    replacer: (displayNo: number, localNo: number, originalContent: string) => ReactNode
): ReactNode[] => {
    const blanks: ReactNode[] = []
    let i = 0
    parse(text, {
        replace: (node: DOMNode) => {
            if ('name' in node && node.name === 'code' && 'children' in node && node.children[0]?.type === 'text') {
                i++
                const displayNo = start + i - 1
                const localNo = i // 1-based index within section
                const originalContent = node.children[0].data
                blanks.push(replacer(displayNo, localNo, originalContent))
            }
        }
    })
    return blanks
}

/**
 * Calculates the starting question number for each section in a quiz.
 * This is a server-side utility function.
 * @param quizData - An array of quiz data sections.
 * @returns An array of numbers, where each number is the starting question index for the corresponding section.
 */
export const getQuestionStarts = (quizData: QuizData[]): number[] => {
    let totalQuestions = 0
    return quizData.map(data => {
        const start = totalQuestions + 1
        totalQuestions += applyStrategy(data, (strategy, specificData) => {
            return strategy.getQuestionCount(specificData)
        })
        return start
    })
}

/**
 * Checks user answers against the correct answers for a quiz.
 * Uses section-based answer structure: { sectionId: { localNo: answerText } }
 * @param quizData - An array of quiz data sections.
 * @param userAnswers - Section-based answers mapping section IDs to local question numbers to answers.
 * @returns A section-based record mapping section IDs to local question numbers to correctness.
 */
export const checkAnswers = (quizData: QuizData[], userAnswers: SectionAnswers): Record<string, Record<number, boolean>> => {
    const results: Record<string, Record<number, boolean>> = {}
    
    // Pre-compute section keys to avoid repeated linear searches
    const sectionKeyMap = getSectionBasedKey(quizData)

    for (const data of quizData) {
        const sectionId = data.id
        const sectionAnswers = userAnswers[sectionId] || {}
        const sectionKey = sectionKeyMap[sectionId]
        results[sectionId] = {}

        for (const localNoStr in sectionAnswers) {
            const localNo = Number(localNoStr)
            const userAns = sectionAnswers[localNo]
            const correctAns = sectionKey?.[localNo]

            if (userAns === null || userAns === undefined || correctAns === undefined || correctAns === null) {
                results[sectionId][localNo] = false
                continue
            }

            results[sectionId][localNo] = applyStrategy(data, (strategy) => {
                return strategy.isCorrect(userAns, correctAns)
            })
        }
    }

    return results
}

/**
 * Gets the answer key for a specific section.
 * Returns a record mapping local question numbers (1-based) to correct answer text.
 * @param quizData - An array of quiz data sections.
 * @param sectionId - The section ID to get the key for.
 * @returns A record mapping local question numbers to correct answer text, or null if section not found.
 */
export const getSectionKey = (quizData: QuizData[], sectionId: string): Record<number, string> | null => {
    const data = quizData.find((item) => item.id === sectionId)
    if (!data) return null

    return applyStrategy(data, (strategy, specificData) => {
        const options = strategy.getOptions?.(specificData)
        const correctAnswers = strategy.getCorrectAnswers(specificData, options)
        // Use local question numbers starting from 1
        return correctAnswers.reduce((acc, answer, index) => {
            acc[index + 1] = answer
            return acc
        }, {} as Record<number, string>)
    })
}

/**
 * Generates a section-based answer key for all sections of a quiz.
 * Structure: { sectionId: { localNo: correctAnswerText } }
 * @param quizData - An array of quiz data sections.
 * @returns Section-based key with correct answer text (not markers).
 */
export const getSectionBasedKey = (quizData: QuizData[]): SectionAnswers => {
    return quizData.reduce((acc, data) => {
        const sectionKey = getSectionKey(quizData, data.id)
        if (sectionKey) {
            acc[data.id] = sectionKey
        }
        return acc
    }, {} as SectionAnswers)
}

/**
 * Retrieves an option by its marker (e.g., 'A', 'B') for a given question group.
 * If the strategy has a getOptions method, it will use it to find the option.
 * @param questionGroup The QuizData object representing the question group.
 * @param marker The marker (e.g., 'A', 'B', 'C') of the option to retrieve.
 * @returns The option string corresponding to the marker, or undefined if not found.
 */
export const getOptionByMarker = (questionGroup: QuizData, marker: string, recordKey?: string): string | null => {
    return applyStrategy(questionGroup, (strategy, specificData) => {
        if (strategy.getOptions) {
            const options = strategy.getOptions(specificData)
            if (options) {
                const MarkerSchema = z.enum(ALPHABET_SET)
                const { data: parsedMarker, success: markerParseSuccess } = MarkerSchema.safeParse(marker)
                if (markerParseSuccess) {
                    const index = ALPHABET_SET.indexOf(parsedMarker)
                    const optionsSchema = z.union([z.array(z.string()), z.record(z.string(), z.array(z.string()))])
                    const { data: parsedOptions, success: optionsParseSuccess } = optionsSchema.safeParse(options)
                    if (optionsParseSuccess) {
                        if (Array.isArray(parsedOptions)) {
                            return parsedOptions[index]
                        }
                        else {
                            return recordKey && parsedOptions[recordKey] ? parsedOptions[recordKey][index] : null
                        }
                    }
                }
            }
        }
    }) || null
}

/**
 * Retrieves the original word for a specific cloze question.
 * It uses the replaceBlanks utility to iterate through the <code> tags
 * and find the content corresponding to the given question number.
 * @param clozeQuestionGroup The ClozeData object representing the cloze question group.
 * @param no The 1-based local question number for which to retrieve the original word.
 * @returns The original word for the specified question number, or undefined if not found.
 */
export const getClozeOriginalWord = (clozeQuestionGroup: ClozeData, no: number): string | undefined => {
    let originalWord: string | undefined

    // Use replaceBlanks to iterate through the <code> tags in the text.
    // The replacer function captures the original content if the local question number matches.
    replaceBlanks(clozeQuestionGroup.text, 1, (displayNo, localNo, originalContent) => {
        if (localNo === no) {
            originalWord = originalContent
        }
        // Return an empty fragment as replaceBlanks expects a ReactNode,
        // but we are only interested in the side effect of capturing the word.
        return <></>
    })

    return originalWord
}

/**
 * Calculates the perfect score for a given quiz.
 * @param quizData - An array of quiz data sections.
 * @returns The total perfect score for the quiz.
 */
export const computePerfectScore = (quizData: QuizData[]): number => {
    return quizData.reduce((acc, data) => {
        return acc + applyStrategy(data, (strategy, specificData) => {
            const questionCount = strategy.getQuestionCount(specificData)
            return questionCount * (strategy.scorePerQuestion ?? 1)
        })
    }, 0)
}

/**
 * Computes the total score for a student's answers.
 * Uses section-based answer structure: { sectionId: { localNo: answerText } }
 * @param quizData - An array of quiz data sections.
 * @param userAnswers - Section-based answers mapping section IDs to local question numbers to answers.
 * @returns The total score obtained by the student.
 */
export const computeTotalScore = (quizData: QuizData[], userAnswers: SectionAnswers): number => {
    const results = checkAnswers(quizData, userAnswers)
    let totalScore = 0

    for (const data of quizData) {
        const sectionId = data.id
        const sectionResults = results[sectionId] || {}

        for (const localNoStr in sectionResults) {
            if (sectionResults[Number(localNoStr)]) {
                totalScore += applyStrategy(data, (strategy) => {
                    return strategy.scorePerQuestion ?? 1
                })
            }
        }
    }
    return totalScore
}
