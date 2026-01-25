'use client'

import { useAtomValue } from 'jotai'
import { QuizData, Config } from '@repo/schema/paper'
import { applyStrategy } from './utils'
import { Question } from './ui'
import { getQuestionStarts } from './utils'
import { answersAtom } from '../atoms'

const QuestionProcessor = ({ data, config, variant }: { data: QuizData; config: Config; variant: 'paper' | 'key' }) => {
    const answers = useAtomValue(answersAtom)
    return applyStrategy(data, (strategy, specificData) => <Question answers={answers} strategy={strategy} specificData={specificData} variant={variant} config={config} />)
}

export const QuizKey = ({ quizData }: { quizData: QuizData[] }) => {
    const questionStarts = getQuestionStarts(quizData)
    return (
        <div>
            {quizData.map((data, index) => (
                <QuestionProcessor key={data.id || index} data={data} config={{ start: questionStarts[index] }} variant='key' />
            ))}
        </div>
    )
}
