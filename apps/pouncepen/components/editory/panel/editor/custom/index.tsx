'use client'

import { Divider } from '@heroui/react'
import Tiptap from '../../tiptap'
import { CustomData } from '@repo/schema/paper'

export default function CustomTextEditor({
    data,
    setData,
}: {
    data: CustomData
    setData: (data: CustomData) => void
    id?: string
}) {
    return <div className='flex flex-col gap-2 before:content-["Custom_Text"] before:text-secondary-300 before:font-bold before:-mb-2 my-5'>
        <div className='before:content-["Displayed_in_the_paper:"] before:text-default-600/70'>
            <Tiptap
                key={data.id}
                content={data.paper}
                onUpdate={({ editor }) => {
                    setData({
                        ...data,
                        paper: editor.getHTML()
                    })
                }}
                unblankable
            />
        </div>
        <Divider />
        <div className='before:content-["Displayed_in_the_key:"] before:text-default-600/70'>
            <Tiptap
                key={data.id}
                content={data.key}
                onUpdate={({ editor }) => {
                    setData({
                        ...data,
                        key: editor.getHTML()
                    })
                }}
                unblankable
            />
        </div>
    </div>
}
