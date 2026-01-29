'use client'

import { SentenceChoiceData } from '@repo/schema/paper'
import Tiptap from '../../tiptap'
import { without } from 'es-toolkit'
import List from '../list'
import RevisePaper from '../revise-paper'

export default function SentenceChoiceEditor({
    data,
    setData,
}: {
    data: SentenceChoiceData
    setData: (data: SentenceChoiceData) => void
    id?: string
}) {
    return <div className='flex flex-col gap-2 before:content-["Sentence_Choice"] before:text-secondary-300 before:font-bold before:-mb-4 my-5'>
        <RevisePaper data={data} />
        <List
            items={data.distractors}
            placeholder='干扰项'
            add={(item) => {
                setData({
                    ...data,
                    distractors: [...data.distractors, item]
                })
            }}
            remove={(item) => {
                setData({
                    ...data,
                    distractors: without(data.distractors, item)
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
        />
    </div>
}
