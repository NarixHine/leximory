'use client'

import { FishingData } from '@/components/editory/generators/types'
import Tiptap from '../../tiptap'
import { without } from 'es-toolkit'
import List from '../list'

export default function FishingEditor({
    data,
    setData,
}: {
    data: FishingData
    setData: (data: FishingData) => void
    id?: string
}) {
    return <div className='flex flex-col gap-2 before:content-["Vocabulary"] before:text-primary-300 before:font-bold before:-mb-2 my-5'>
        <List
            items={data.distractors}
            placeholder='Add distractor(s) ...'
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
            ai={{
                setData,
                data
            }}
        />
    </div>
}
