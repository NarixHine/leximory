import React, { JSX, useMemo } from 'react'
import { QuizData, QuestionStrategy, SectionAnswers } from '@repo/schema/paper'
import { toTableRows } from './utils'

export const QuestionSection = ({ children, title }: {
    children: React.ReactNode
    title?: string
}) => {
    return (
        <section className='question-section my-4'>
            {title && <h2>{title}</h2>}
            {children}
        </section>
    )
}

export const Question = <K extends QuizData['type']>({ strategy, specificData, variant, config, answers }: {
    strategy: QuestionStrategy<Extract<QuizData, { type: K }>>,
    specificData: Extract<QuizData, { type: K }>,
    variant: 'paper' | 'key'
    config: any
    answers?: SectionAnswers
}) => {
    const options = useMemo(() => strategy.getOptions?.(specificData), [specificData, strategy])
    const correctAnswers = useMemo(() => strategy.getCorrectAnswers(specificData, options), [specificData, strategy, options])
    const { isCorrect } = strategy
    const renderProps = { data: specificData, config, answers: answers || {}, options, correctAnswers, isCorrect }

    if (variant === 'paper') {
        return (
            <QuestionSection>
                {strategy.renderRubric()}
                {strategy.renderPaper(renderProps)}
            </QuestionSection>
        )
    }

    return null
}
