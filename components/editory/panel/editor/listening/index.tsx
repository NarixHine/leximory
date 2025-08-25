'use client'

import { ListeningData } from '@/components/editory/generators/types'
import QnA from '../qna'

export default function ListeningEditor({
    data,
    setData,
}: {
    data: ListeningData
    setData: (data: ListeningData) => void
    id?: string
}) {
    return <div className='flex flex-col gap-2 before:content-["Listening"] before:text-primary-300 before:font-bold before:-mb-1 my-5'>
        <QnA
            hasTranscript
            questions={data.questions}
            setQuestions={(questions) => {
                setData({
                    ...data,
                    questions
                })
            }}
        />
    </div>
}
