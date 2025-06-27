import React, { JSX, useMemo, useRef } from 'react'
import parse, { DOMNode } from 'html-react-parser'
import fastShuffle from 'fast-shuffle'
import { NAME_MAP, ALPHABET_SET } from './config'
import QuizData, { Config, FishingData, ClozeData, GrammarData, SentenceChoiceData, ReadingData, ListeningData, CustomData, QuizDataType } from './types'
import { Popover, PopoverTrigger, PopoverContent } from '@heroui/popover'

// ==================================================================================
// 1. Helper Components & Utilities
// ==================================================================================

const getSeed = (content: string | number): number => {
    return content.toString().split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
}

const Blank = ({ number, spaceCount = 3, options }: { number: number, spaceCount?: number, options?: string[] }) => {
    const spaces = '\u00A0'.repeat(spaceCount)
    const ShownBlank = <u>{`${spaces}${number}${spaces}`}</u>
    if (options && options.length > 0) {
        return (
            <Popover>
                <PopoverTrigger>
                    {ShownBlank}
                </PopoverTrigger>
                <PopoverContent>
                    <div className="flex flex-col gap-y-2 p-2 font-mono">
                        {options.map((option, index) => (
                            <span key={index} className="text-sm">{`${ALPHABET_SET[index]}. ${option}`}</span>
                        ))}
                    </div>
                </PopoverContent>
            </Popover>
        )
    }
    return ShownBlank
}

const toTableRows = (cells: JSX.Element[], perLine: number): JSX.Element[] => {
    if (!cells || cells.length === 0) return []
    const paddedCells = [...cells]
    while (paddedCells.length % perLine !== 0) {
        paddedCells.push(<td key={`pad-${paddedCells.length}`} />)
    }

    const rows: JSX.Element[] = []
    for (let i = 0; i < paddedCells.length; i += perLine) {
        const rowCells = paddedCells.slice(i, i + perLine)
        rows.push(<tr key={`row-${i / perLine}`} className="flex flex-wrap">{rowCells}</tr>)
    }
    return rows
}

const QuestionSection = ({ title, children, showTitle = true }: { title?: string, children: React.ReactNode, showTitle?: boolean }) => (
    <article className="flex flex-col my-4">
        {showTitle && title && <h2 className="text-2xl font-bold section-name-title">{title}</h2>}
        {children}
    </article>
)


// ==================================================================================
// 2. Components for Each Question Type
// ==================================================================================

// --- Fishing Question ---
const FishingQuestion = ({ data, config }: { data: FishingData, config: Config }) => {
    const questionCounter = useRef(0)

    const { options, correctAnswers } = useMemo(() => {
        const correct = data.text.match(/<code>(.*?)<\/code>/g)?.map(c => c.replace(/<\/?code>/g, '')) ?? []
        const allOptions = [...correct, ...data.distractors]
        const seed = getSeed(allOptions.join('&'))
        const shuffled = fastShuffle(seed, allOptions)
        return { options: shuffled, correctAnswers: correct }
    }, [data])

    const replacer = (node: DOMNode): JSX.Element | undefined => {
        if ('name' in node && node.name === 'code') {
            questionCounter.current++
            return <Blank number={(config.start ?? 1) + questionCounter.current - 1} options={options} />
        }
    }

    const parsedContent = useMemo(() => parse(data.text, { replace: replacer }), [data.text, config.start])

    const paper = (
        <QuestionSection title={NAME_MAP[data.type]}>
            <section className="paper-options my-2">
                <table className="border border-default-900 flex flex-wrap p-2">
                    <tbody>
                        {toTableRows(options.map((option, index) => (
                            <td key={option} className="px-2 whitespace-nowrap">{`${ALPHABET_SET[index]}. ${option}`}</td>
                        )), 11)}
                    </tbody>
                </table>
            </section>
            <section className="paper-content">{parsedContent}</section>
        </QuestionSection>
    )

    const key = (
        <>
            {correctAnswers.map((answer, index) => (
                <td key={index} className="key-item px-2">{`${(config.start ?? 1) + index}. ${ALPHABET_SET[options.indexOf(answer)]}`}</td>
            ))}
        </>
    )

    return { paper, key, count: questionCounter.current }
}

// --- Cloze Question ---
const ClozeQuestion = ({ data, config }: { data: ClozeData, config: Config }) => {
    const questionCounter = useRef(0)

    const shuffledOptions = useMemo(() => {
        const optionsMap: { [key: string]: string[] } = {}
        data.questions.forEach(q => {
            const choices = [q.original, ...q.distractors]
            const seed = getSeed(choices.join('&'))
            optionsMap[q.original] = fastShuffle(seed, choices)
        })
        return optionsMap
    }, [data.questions])

    const replacer = (node: DOMNode): JSX.Element | undefined => {
        if ('name' in node && node.name === 'code') {
            questionCounter.current++
            const number = (config.start ?? 1) + questionCounter.current - 1
            if ('children' in node && 'data' in node.children[0])
                return <Blank number={number} options={shuffledOptions[node.children[0].data]} />
        }
    }

    const parsedContent = useMemo(() => parse(data.text, { replace: replacer }), [data.text, config.start])

    const paper = (
        <QuestionSection title={NAME_MAP[data.type]}>
            <section className="paper-content">{parsedContent}</section>
        </QuestionSection>
    )

    const key = (
        <>
            {data.questions.map((question, index) => {
                const correctIndex = shuffledOptions[question.original].indexOf(question.original)
                return (
                    <td key={index} className="key-item px-2">{`${(config.start ?? 1) + index}. ${ALPHABET_SET[correctIndex]}`}</td>
                )
            })}
        </>
    )

    return { paper, key, count: data.questions.length }
}

// --- Grammar Question ---
const GrammarQuestion = ({ data, config }: { data: GrammarData, config: Config }) => {
    const questionCounter = useRef(0)
    const keyContents = useRef<string[]>([])

    const replacer = (node: DOMNode): JSX.Element | undefined => {
        if ('name' in node && 'children' in node && node.name === 'code' && node.children[0]?.type === 'text') {
            questionCounter.current++
            const content = node.children[0].data
            const hint = data.hints[content]
            keyContents.current.push(content)
            const questionNumber = (config.start ?? 1) + questionCounter.current - 1

            if (!hint) {
                const words = content.split(' ')
                return (
                    <span>
                        {words.map((_, i) => (
                            <React.Fragment key={i}>
                                <Blank number={questionNumber} />
                                {i < words.length - 1 && ' '}
                            </React.Fragment>
                        ))}
                    </span>
                )
            } else {
                return <span className="paper-hint"><Blank number={questionNumber} />{` (${hint})`}</span>
            }
        }
    }

    const parsedContent = useMemo(() => {
        keyContents.current = [] // Reset before parsing
        return parse(data.text, { replace: replacer })
    }, [data.text, config.start])

    const paper = <QuestionSection title={NAME_MAP[data.type]}><section className="paper-content">{parsedContent}</section></QuestionSection>

    const key = <>{keyContents.current.map((content, index) => <td key={index} className="key-item px-2">{`${(config.start ?? 1) + index}. ${content}`}</td>)}</>

    return { paper, key, count: questionCounter.current }
}

// --- Sentence Choice Question ---
const SentenceChoiceQuestion = ({ data, config }: { data: SentenceChoiceData, config: Config }) => {
    const questionCounter = useRef(0)

    const { options, correctAnswers } = useMemo(() => {
        const correct = data.text.match(/<code>(.*?)<\/code>/g)?.map(c => c.replace(/<\/?code>/g, '')) ?? []
        const allOptions = [...correct, ...data.distractors]
        const seed = getSeed(allOptions.join('&'))
        const shuffled = fastShuffle(seed, allOptions)
        return { options: shuffled, correctAnswers: correct }
    }, [data])

    const replacer = (node: DOMNode): JSX.Element | undefined => {
        if ('name' in node && node.name === 'code') {
            questionCounter.current++
            return <Blank number={(config.start ?? 1) + questionCounter.current - 1} spaceCount={8} />
        }
    }

    const parsedContent = useMemo(() => parse(data.text, { replace: replacer }), [data.text, config.start])

    const paper = (
        <QuestionSection title={NAME_MAP[data.type]}>
            <section className="paper-options my-2">
                <table className="border border-default-900"><tbody>{toTableRows(options.map((option, index) => (
                    <td key={option} className="px-4">{`${ALPHABET_SET[index]}. ${option}`}</td>
                )), 1)}</tbody></table>
            </section>
            <section className="paper-content">{parsedContent}</section>
        </QuestionSection>
    )

    const key = (
        <>
            {correctAnswers.map((answer, index) => (
                <td key={index} className="key-item px-2">{`${(config.start ?? 1) + index}. ${ALPHABET_SET[options.indexOf(answer)]}`}</td>
            ))}
        </>
    )

    return { paper, key, count: questionCounter.current }
}

// --- Reading Question ---
const ReadingQuestion = ({ data, config }: { data: ReadingData, config: Config }) => {
    const parsedContent = useMemo(() => data.text ? parse(data.text) : null, [data.text])

    const paper = (
        <QuestionSection title={NAME_MAP[data.type]}>
            <section className="paper-content">{parsedContent}</section>
            <section className="paper-options my-2 flex flex-col gap-y-2">
                {data.questions.map((q, index) => (
                    <div key={index}>
                        <p>{`${(config.start ?? 1) + index}. ${q.q}`}</p>
                        <table className="not-prose"><tbody>{toTableRows((q.a || []).map((option, i) => (
                            <td key={i}>{`${ALPHABET_SET[i]}. ${option}`}</td>
                        )), 1)}</tbody></table>
                    </div>
                ))}
            </section>
        </QuestionSection>
    )

    const key = (
        <>
            {data.questions.map((q, index) => <td key={index} className="key-item px-2">{`${(config.start ?? 1) + index}. ${ALPHABET_SET[q.correct]}`}</td>)}
        </>
    )

    return { paper, key, count: data.questions.length }
}

// --- Listening Question ---
const ListeningQuestion = ({ data, config }: { data: ListeningData, config: Config }) => {
    const paper = (
        <QuestionSection title={NAME_MAP[data.type]}>
            <section>
                {data.questions.map((q, index) => (
                    <div key={index} className="flex gap-x-2 listening-item">
                        <div>{`${(config.start ?? 1) + index}.`}</div>
                        <table className="my-0 not-prose"><tbody>{toTableRows((q.a || []).map((option, i) => (
                            <td key={i}>{`${ALPHABET_SET[i]}. ${option}`}</td>
                        )), 1)}</tbody></table>
                    </div>
                ))}
            </section>
        </QuestionSection>
    )

    const key = <>{data.questions.map((q, index) => <td key={index} className="key-item px-2">{`${(config.start ?? 1) + index}. ${ALPHABET_SET[q.correct]}`}</td>)}</>

    return { paper, key, count: data.questions.length }
}

// --- Custom Question ---
const CustomQuestion = ({ data }: { data: CustomData, config: Config }) => {
    const paper = <QuestionSection showTitle={false}>{parse(data.paper)}</QuestionSection>
    const key = <tr><td>{parse(data.key)}</td></tr>
    return { paper, key, count: 0 }
}

// ==================================================================================
// 3. Main Components to Generate Paper and Key
// ==================================================================================

// Type for the return value of each question component
type QuestionComponentResult = {
    paper: JSX.Element
    key: JSX.Element
    count: number
}

// A map to retrieve the correct component for a given quiz data type.
const questionComponentMap: { [T in QuizDataType]: (props: { data: Extract<QuizData, { type: T }>, config: Config }) => QuestionComponentResult } = {
    'fishing': FishingQuestion,
    'cloze': ClozeQuestion,
    'grammar': GrammarQuestion,
    '4/6': SentenceChoiceQuestion,
    'reading': ReadingQuestion,
    'listening': ListeningQuestion,
    'custom': CustomQuestion,
}

/**
 * Renders the complete quiz paper by assembling the output of all question components.
 * @param {object} props - Component props.
 * @param {QuizData[]} props.quizData - An array of quiz data objects.
 */
export const QuizPaper = ({ quizData }: { quizData: QuizData[] }) => {
    let questionStart = 1

    return (
        <div>
            {quizData.map((data, index) => {
                const Component = questionComponentMap[data.type]
                if (!Component) return null

                const result = Component({ data, config: { start: questionStart } } as any)
                questionStart += result.count

                return <React.Fragment key={data.id || index}>{result.paper}</React.Fragment>
            })}
        </div>
    )
}

/**
 * Renders the complete answer key by assembling and formatting keys from all components.
 * @param {object} props - Component props.
 * @param {QuizData[]} props.quizData - An array of quiz data objects.
 */
export const QuizKey = ({ quizData }: { quizData: QuizData[] }) => {
    let questionStart = 1

    const keyPerLineMap: { [key in QuizDataType]?: number } = {
        fishing: 5, cloze: 5, grammar: 2, '4/6': 4, reading: 4, listening: 5, custom: 0
    }

    const allKeyRows = quizData.flatMap((data, index) => {
        const Component = questionComponentMap[data.type]
        if (!Component) return []

        const result = Component({ data, config: { start: questionStart } } as any)
        questionStart += result.count

        const perLine = keyPerLineMap[data.type]
        if (perLine === 0) {
            return [<React.Fragment key={data.id || index}>{result.key}</React.Fragment>]
        }

        const cells = React.Children.toArray(result.key.props.children) as JSX.Element[]
        return toTableRows(cells, perLine || 5)
    })

    return (
        <table className="my-2">
            <tbody>{allKeyRows}</tbody>
        </table>
    )
}