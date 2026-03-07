'use client'

import Tiptap from '../../tiptap'
import { WritingData } from '@repo/schema/paper'

export default function WritingEditor({
    data,
    setData,
}: {
    data: WritingData
    setData: (data: WritingData) => void
    id?: string
}) {
    return <div className='flex flex-col gap-2 before:content-["Guided_Writing"] before:text-secondary-300 before:font-bold before:-mb-2 my-5'>
        <div className='before:content-["作文要求："] before:text-default-600/70'>
            <Tiptap
                key={data.id}
                content={data.guidance}
                onUpdate={({ editor }) => {
                    setData({ ...data, guidance: editor.getHTML() })
                }}
                unblankable
            />
        </div>
    </div>
}
