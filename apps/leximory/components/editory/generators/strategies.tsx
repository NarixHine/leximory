import fastShuffle from 'fast-shuffle'
import parse, { DOMNode } from 'html-react-parser'
import { cn } from '@/lib/utils'
import Blank from '../blank'
import { createQuestionStrategy, extractCodeContent, getSeed, toTableRows } from './utils'
import { ALPHABET_SET } from './config'
import QuizData, { GrammarData, ReadingData, ListeningData, ClozeData, FishingData, SentenceChoiceData, CustomData, QuestionStrategy } from './types'
import Choice from '../choice'

const listeningStrategy = createQuestionStrategy<ListeningData>({
    keyPerLine: 5,
    getQuestionCount: (data) => data.questions.length,
    getCorrectAnswers: (data) => data.questions.map(q => q.a[q.correct]),
    renderPaper: ({ data, config }) => (
        <section>
            {data.questions.map((q, index) => (
                <div key={index} className='flex gap-x-2 listening-item'>
                    <div>{`${(config.start ?? 1) + index}.`}</div>
                    <table className='my-0 not-prose'><tbody>{toTableRows((q.a || []).map((option, i) => <td key={i}>{`${ALPHABET_SET[i]}. ${option}`}</td>), 1)}</tbody></table>
                </div>
            ))}
        </section>
    ),
    renderKey: ({ data, config }) => (
        <>
            {data.questions.map((q, index) => <td key={index} className='px-2'>{`${(config.start ?? 1) + index}. ${ALPHABET_SET[q.correct]}`}</td>)}
        </>
    ),
})

const grammarStrategy = createQuestionStrategy<GrammarData>({
    keyPerLine: 5,
    renderPaper: ({ data, config }) => {
        let i = 0
        const parsedContent = parse(data.text, {
            replace: (node: DOMNode) => {
                if ('name' in node && node.name === 'code' && 'children' in node && node.children[0]?.type === 'text') {
                    i++
                    const content = node.children[0].data
                    const hint = data.hints[content]
                    const questionNumber = (config.start ?? 1) + i - 1
                    if (!hint) {
                        return <Blank number={questionNumber} groupId={data.id} />
                    }
                    return <span className='paper-hint'><Blank number={questionNumber} groupId={data.id} />{` (${hint})`}</span>
                }
            }
        })
        return <section>{parsedContent}</section>
    },
    renderKey: ({ config, correctAnswers }) => (
        <>
            {correctAnswers.map((answer, index) => (
                <td key={index} className='px-2'>{`${(config.start ?? 1) + index}. ${answer}`}</td>
            ))}
        </>
    ),
})

const fishingStrategy = createQuestionStrategy<FishingData>({
    keyPerLine: 5,
    getOptions: (data) => {
        const correct = extractCodeContent(data.text)
        const allOptions = [...correct, ...data.distractors]
        return fastShuffle(getSeed(allOptions.join('')), allOptions)
    },
    renderPaper: ({ data, config, options }) => {
        let i = 0
        const parsedContent = parse(data.text, {
            replace: (node: DOMNode) => {
                if ('name' in node && node.name === 'code') {
                    i++
                    return <Blank number={(config.start ?? 1) + i - 1} options={options} groupId={data.id} />
                }
            }
        })
        return (
            <>
                <section className='my-2'>
                    <table className='border border-default-900 flex flex-wrap p-2'>
                        <tbody>{toTableRows(options.map((opt: string, idx: number) => <td key={opt} className='px-2 whitespace-nowrap'>{`${ALPHABET_SET[idx]}. ${opt}`}</td>), 11)}</tbody>
                    </table>
                </section>
                <section>{parsedContent}</section>
            </>
        )
    },
    renderKey: ({ config, answers, options, correctAnswers }) => (
        <>
            {correctAnswers.map((answer, index) => {
                const number = (config.start ?? 1) + index
                const userAnswer = answers[number]
                return <td key={index} className={cn('px-2', userAnswer && (answer === userAnswer ? 'text-success' : 'text-danger'))}>{`${number}. ${ALPHABET_SET[options.indexOf(answer)]}`}</td>
            })}
        </>
    ),
})

const clozeStrategy = createQuestionStrategy<ClozeData>({
    keyPerLine: 5,
    getQuestionCount: (data) => data.questions.length,
    getOptions: (data) => {
        // create a map of original words to shuffled distractors
        return data.questions.reduce((acc, q) => {
            const choices = [q.original, ...q.distractors]
            acc[q.original] = fastShuffle(getSeed(choices.join('')), choices)
            return acc
        }, {} as { [key: string]: string[] })
    },
    getCorrectAnswers: (data) => data.questions.map(q => q.original),
    renderPaper: ({ data, config, options: shuffledOptionsMap }) => {
        let i = 0
        const parsedContent = parse(data.text, {
            replace: (node: DOMNode) => {
                if ('name' in node && node.name === 'code' && 'children' in node && 'data' in node.children[0]) {
                    const originalWord = node.children[0].data
                    i++
                    return <Blank number={(config.start ?? 1) + i - 1} options={shuffledOptionsMap[originalWord]} groupId={data.id} />
                }
            }
        })
        return <section>{parsedContent}</section>
    },
    renderKey: ({ data, config, answers, options: shuffledOptionsMap }) => (
        <>
            {data.questions.map((question, index) => {
                const number = (config.start ?? 1) + index
                const userAnswer = answers[number]
                const correctIndex = shuffledOptionsMap[question.original].indexOf(question.original)
                return (
                    <td key={index} className={cn('px-2', userAnswer && (question.original === userAnswer ? 'text-success' : 'text-danger'))}>
                        {`${number}. ${ALPHABET_SET[correctIndex]}`}
                    </td>
                )
            })}
        </>
    ),
})

const readingStrategy = createQuestionStrategy<ReadingData>({
    keyPerLine: 5,
    getQuestionCount: (data) => data.questions.length,
    getCorrectAnswers: (data) => data.questions.map(q => q.a[q.correct]),
    renderPaper: ({ data, config }) => (
        <>
            <section>{'text' in data ? parse(data.text) : null}</section>
            <section className='my-2 flex flex-col gap-y-2'>
                {data.questions.map((q, index) => (
                    <div key={index} className='flex gap-2 flex-col'>
                        <p>{`${(config.start ?? 1) + index}. ${q.q}`}</p>
                        <Choice number={(config.start ?? 1) + index} options={q.a} groupId={data.id} />
                    </div>
                ))}
            </section>
        </>
    ),
    renderKey: ({ data, config, answers }) => (
        <>
            {data.questions.map((q, index) => {
                const number = (config.start ?? 1) + index
                const userAnswer = answers[number]
                return <td key={index} className={cn('px-2', userAnswer && (q.correct === ALPHABET_SET.indexOf(userAnswer) ? 'text-success' : 'text-danger'))}>{`${number}. ${ALPHABET_SET[q.correct]}`}</td>
            })}
        </>
    ),
})

const sentenceChoiceStrategy = createQuestionStrategy<SentenceChoiceData>({
    keyPerLine: 4,
    getOptions: (data) => {
        const correct = extractCodeContent(data.text)
        const allOptions = [...correct, ...data.distractors]
        return fastShuffle(getSeed(allOptions.join('')), allOptions)
    },
    renderPaper: ({ data, config, options }) => {
        let i = 0
        const parsedContent = parse(data.text, {
            replace: (node: DOMNode) => {
                if ('name' in node && node.name === 'code') {
                    i++
                    return <Blank groupId={data.id} number={(config.start ?? 1) + i - 1} />
                }
            }
        })
        return (
            <>
                <section className='my-2'>
                    <table className='border border-default-900'><tbody>{toTableRows(options.map((opt: string, idx: number) => <td key={opt} className='px-4'>{`${ALPHABET_SET[idx]}. ${opt}`}</td>), 1)}</tbody></table>
                </section>
                <section>{parsedContent}</section>
            </>
        )
    },
    renderKey: ({ config, options, correctAnswers }) => (
        <>
            {correctAnswers.map((answer, index) => (
                <td key={index} className='px-2'>{`${(config.start ?? 1) + index}. ${ALPHABET_SET[options.indexOf(answer)]}`}</td>
            ))}
        </>
    ),
})

const customStrategy = createQuestionStrategy<CustomData>({
    keyPerLine: 0,
    getQuestionCount: () => 0,
    getCorrectAnswers: () => [],
    renderPaper: ({ data }) => <>{parse(data.paper)}</>,
    renderKey: ({ data }) => <tr><td>{parse(data.key)}</td></tr>,
})

export const questionStrategies: {
    [K in QuizData['type']]: QuestionStrategy<Extract<QuizData, { type: K }>>
} = {
    fishing: fishingStrategy,
    cloze: clozeStrategy,
    grammar: grammarStrategy,
    '4/6': sentenceChoiceStrategy,
    reading: readingStrategy,
    listening: listeningStrategy,
    custom: customStrategy,
}
