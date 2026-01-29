'use client'

import { ReadingData } from '@repo/schema/paper'
import Tiptap from '../../tiptap'
import QnA from '../qna'
import RevisePaper from '../revise-paper'

export default function ReadingEditor({
    data,
    setData,
}: {
    data: ReadingData
    setData: (data: ReadingData) => void
    id?: string
}) {
    return <div className='flex flex-col gap-2 before:content-["Reading"] before:text-secondary-300 before:font-bold before:-mb-4 my-5'>
        <RevisePaper data={data} />
        <QnA
            questions={data.questions}
            setQuestions={(questions) => {
                setData({
                    ...data,
                    questions
                })
            }}
        />
        <Tiptap
            key={data.id}
            content={data.text}
            onUpdate={({ editor }) => {
                setData({
                    ...data,
                    text: editor.getHTML()
                })
            }}
            ai={{
                data,
                setData
            }}
            unblankable
        />
    </div>
}
