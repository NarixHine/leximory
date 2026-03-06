'use client'

import { Button, Divider, Input } from '@heroui/react'
import { TranslationData, TranslationItem } from '@repo/schema/paper'
import { PlusCircleIcon, TrashIcon } from '@phosphor-icons/react'
import List from '../list'

export default function TranslationEditor({
    data,
    setData,
}: {
    data: TranslationData
    setData: (data: TranslationData) => void
    id?: string
}) {
    const updateItem = (index: number, patch: Partial<TranslationItem>) => {
        const items = data.items.map((item, i) => i === index ? { ...item, ...patch } : item)
        setData({ ...data, items })
    }

    const addItem = () => {
        setData({
            ...data,
            items: [...data.items, { chinese: '', keyword: '', references: [], score: 4 }]
        })
    }

    const removeItem = (index: number) => {
        setData({ ...data, items: data.items.filter((_, i) => i !== index) })
    }

    return <div className='flex flex-col gap-4 before:content-["Translation"] before:text-secondary-300 before:font-bold before:-mb-2 my-5'>
        {data.items.map((item, index) => (
            <div key={index} className='flex flex-col gap-2 border border-default-200 rounded-medium p-3'>
                <div className='flex items-center justify-between'>
                    <span className='text-sm font-bold text-default-600'>#{index + 1}（{item.score} 分）</span>
                    <Button size='sm' isIconOnly variant='light' color='danger' onPress={() => removeItem(index)}>
                        <TrashIcon />
                    </Button>
                </div>
                <Input
                    label='中文原句'
                    value={item.chinese}
                    onValueChange={(chinese) => updateItem(index, { chinese })}
                    variant='underlined'
                />
                <div className='flex gap-2'>
                    <Input
                        label='关键词'
                        value={item.keyword}
                        onValueChange={(keyword) => updateItem(index, { keyword })}
                        variant='underlined'
                        className='flex-1'
                    />
                    <Input
                        label='分值'
                        type='number'
                        value={String(item.score)}
                        onValueChange={(v) => updateItem(index, { score: Number(v) || 0 })}
                        variant='underlined'
                        className='w-20'
                    />
                </div>
                <List
                    items={item.references}
                    placeholder='添加参考译文'
                    add={(ref) => updateItem(index, { references: [...item.references, ref] })}
                    remove={(ref) => updateItem(index, { references: item.references.filter(r => r !== ref) })}
                />
            </div>
        ))}
        <Button
            startContent={<PlusCircleIcon />}
            variant='flat'
            color='secondary'
            onPress={addItem}
        >
            添加翻译题
        </Button>
    </div>
}
