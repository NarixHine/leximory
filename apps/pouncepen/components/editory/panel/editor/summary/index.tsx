'use client'

import { Divider, Input } from '@heroui/react'
import Tiptap from '../../tiptap'
import { SummaryData } from '@repo/schema/paper'
import List from '../list'

export default function SummaryEditor({
    data,
    setData,
}: {
    data: SummaryData
    setData: (data: SummaryData) => void
    id?: string
}) {
    return <div className='flex flex-col gap-2 before:content-["Summary"] before:text-secondary-300 before:font-bold before:-mb-2 my-5'>
        <div className='before:content-["原文："] before:text-default-600/70'>
            <Tiptap
                key={data.id}
                content={data.text}
                onUpdate={({ editor }) => {
                    setData({ ...data, text: editor.getHTML() })
                }}
                unblankable
            />
        </div>
        <Divider />
        <div className='flex flex-col gap-3'>
            <p className='text-sm text-default-600'>核心要点</p>
            <List
                items={data.essentialItems}
                placeholder='添加核心要点'
                add={(item) => setData({ ...data, essentialItems: [...data.essentialItems, item] })}
                remove={(item) => setData({ ...data, essentialItems: data.essentialItems.filter(i => i !== item) })}
            />
            <p className='text-sm text-default-600'>补充细节</p>
            <List
                items={data.extraItems}
                placeholder='添加补充细节'
                add={(item) => setData({ ...data, extraItems: [...data.extraItems, item] })}
                remove={(item) => setData({ ...data, extraItems: data.extraItems.filter(i => i !== item) })}
            />
        </div>
        <Divider />
        <Input
            label='参考概要'
            value={data.referenceSummary}
            onValueChange={(referenceSummary) => setData({ ...data, referenceSummary })}
            variant='underlined'
        />
    </div>
}
