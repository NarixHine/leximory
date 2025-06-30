import React, { JSX, useMemo } from 'react'
import { useAtomValue } from 'jotai'
import { answerAtomFamily } from '../atoms'
import QuizData, { Config, QuestionStrategy } from './types'
import { NAME_MAP } from './config'
import { applyStrategy, toTableRows } from './utils'

/**
 * Generators are implemented as a set of strategies,
 * leveraging the philosophy of Composition Over Inheritance.
 */

const QuestionSection = ({ title, children, showTitle = true }: {
    title: string
    children: React.ReactNode
    showTitle?: boolean
}) => {
    return (
        <section className='question-section my-4'>
            {showTitle && <h2>{title}</h2>}
            {children}
        </section>
    )
}


const QuestionProcessor = ({ data, config, variant }: { data: QuizData; config: Config; variant: 'paper' | 'key' }) => {
    const { answers } = useAtomValue(answerAtomFamily(data.id))
    return applyStrategy(data, (strategy, specificData) => <Question answers={answers} strategy={strategy} specificData={specificData} variant={variant} config={config} />)
}

const Question = <K extends QuizData['type']>({ strategy, specificData, variant, config, answers }: {
    strategy: QuestionStrategy<Extract<QuizData, { type: K }>>,
    specificData: Extract<QuizData, { type: K }>,
    variant: 'paper' | 'key'
    config: Config
    answers: Record<number, string | null>
}) => {
    const options = useMemo(() => strategy.getOptions?.(specificData), [specificData, strategy])
    const correctAnswers = useMemo(() => strategy.getCorrectAnswers(specificData, options), [specificData, strategy, options])

    const renderProps = { data: specificData, config, answers, options, correctAnswers }

    if (variant === 'paper') {
        return (
            <QuestionSection title={NAME_MAP[specificData.type]} showTitle={specificData.type !== 'custom'}>
                {strategy.renderPaper(renderProps)}
            </QuestionSection>
        )
    }

    if (variant === 'key') {
        const keyElements = strategy.renderKey(renderProps)
        if (!keyElements) return null
        if (strategy.keyPerLine === 0) return <>{keyElements}</>

        const cells = React.Children.toArray(keyElements.props.children) as JSX.Element[]
        return <>{toTableRows(cells, strategy.keyPerLine)}</>
    }

    return null
}

// A helper to calculate starting numbers for each section
const useQuestionStarts = (quizData: QuizData[]) => {
    return useMemo(() => {
        const starts: number[] = []
        let currentStart = 1
        for (const data of quizData) {
            starts.push(currentStart)

            currentStart += applyStrategy(data, (strategy, specificData) =>
                strategy.getQuestionCount(specificData)
            )
        }
        return starts
    }, [quizData])
}

export const QuizPaper = ({ quizData }: { quizData: QuizData[] }) => {
    const questionStarts = useQuestionStarts(quizData)
    return (
        <div>
            {quizData.map((data, index) => (
                <QuestionProcessor key={data.id || index} data={data} config={{ start: questionStarts[index] }} variant='paper' />
            ))}
        </div>
    )
}

export const QuizKey = ({ quizData }: { quizData: QuizData[] }) => {
    const questionStarts = useQuestionStarts(quizData)
    return (
        <table className='my-2'>
            <tbody>
                {quizData.map((data, index) => (
                    <QuestionProcessor key={data.id || index} data={data} config={{ start: questionStarts[index] }} variant='key' />
                ))}
            </tbody>
        </table>
    )
}
