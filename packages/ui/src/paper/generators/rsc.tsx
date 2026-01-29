import { QuizData, Config } from '@repo/schema/paper'
import { applyStrategy } from './utils'
import { Question } from './ui'
import { getQuestionStarts } from './utils'

const QuestionProcessor = ({ data, config, variant }: { data: QuizData; config: Config; variant: 'paper' | 'key' }) => {
    return applyStrategy(data, (strategy, specificData) => <Question strategy={strategy} specificData={specificData} variant={variant} config={config} />)
}

// A separate RSC for the quiz paper.
// Must be SSRed to avoid client-side exposure of answers.
export const QuizPaperRSC = ({ quizData }: { quizData: QuizData[] }) => {
    const questionStarts = getQuestionStarts(quizData)
    return (
        <div className='w-full print:w-dvw print:absolute print:left-0 print:top-0 print:bg-white print:light z-1000000'>
            {quizData.map((data, index) => (
                <QuestionProcessor key={data.id || index} data={data} config={{ start: questionStarts[index] }} variant='paper' />
            ))}
        </div>
    )
}
