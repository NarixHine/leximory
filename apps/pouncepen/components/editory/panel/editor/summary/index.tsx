'use client'

import { Button, Checkbox, Divider, Input } from '@heroui/react'
import Tiptap from '../../tiptap'
import { SummaryData } from '@repo/schema/paper'
import { PlusCircleIcon, TrashIcon } from '@phosphor-icons/react'
import { useState } from 'react'

export default function SummaryEditor({
    data,
    setData,
}: {
    data: SummaryData
    setData: (data: SummaryData) => void
    id?: string
}) {
    const [newItem, setNewItem] = useState('')

    const removeEssentialItem = (index: number) => {
        setData({ ...data, essentialItems: data.essentialItems.filter((_, i) => i !== index) })
    }
    const removeExtraItem = (index: number) => {
        setData({ ...data, extraItems: data.extraItems.filter((_, i) => i !== index) })
    }
    const updateEssentialItem = (index: number, value: string) => {
        const items = [...data.essentialItems]
        items[index] = value
        setData({ ...data, essentialItems: items })
    }
    const updateExtraItem = (index: number, value: string) => {
        const items = [...data.extraItems]
        items[index] = value
        setData({ ...data, extraItems: items })
    }
    const toggleItem = (item: string, fromEssential: boolean) => {
        if (fromEssential) {
            setData({
                ...data,
                essentialItems: data.essentialItems.filter(i => i !== item),
                extraItems: [...data.extraItems, item],
            })
        } else {
            setData({
                ...data,
                extraItems: data.extraItems.filter(i => i !== item),
                essentialItems: [...data.essentialItems, item],
            })
        }
    }

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
        <div className='flex flex-col gap-1'>
            {data.essentialItems.map((item, index) => (
                <div key={`essential-${index}`} className='flex items-center gap-2'>
                    <Checkbox
                        isSelected={true}
                        onValueChange={() => toggleItem(item, true)}
                        size='sm'
                        color='secondary'
                    >
                        <span className='text-xs text-default-400'>基本</span>
                    </Checkbox>
                    <Input
                        value={item}
                        onValueChange={(v) => updateEssentialItem(index, v)}
                        variant='underlined'
                        size='sm'
                        className='flex-1'
                    />
                    <Button size='sm' isIconOnly variant='light' color='danger' onPress={() => removeEssentialItem(index)}>
                        <TrashIcon size={14} />
                    </Button>
                </div>
            ))}
            {data.extraItems.map((item, index) => (
                <div key={`extra-${index}`} className='flex items-center gap-2'>
                    <Checkbox
                        isSelected={false}
                        onValueChange={() => toggleItem(item, false)}
                        size='sm'
                        color='secondary'
                    >
                        <span className='text-xs text-default-400'>附加</span>
                    </Checkbox>
                    <Input
                        value={item}
                        onValueChange={(v) => updateExtraItem(index, v)}
                        variant='underlined'
                        size='sm'
                        className='flex-1'
                    />
                    <Button size='sm' isIconOnly variant='light' color='danger' onPress={() => removeExtraItem(index)}>
                        <TrashIcon size={14} />
                    </Button>
                </div>
            ))}
            <div className='flex gap-2 mt-1'>
                <Input
                    placeholder='添加要点'
                    value={newItem}
                    onValueChange={setNewItem}
                    variant='underlined'
                    size='sm'
                    color='secondary'
                    className='flex-1'
                />
                <Button
                    startContent={<PlusCircleIcon size={14} />}
                    variant='flat'
                    color='secondary'
                    size='sm'
                    isDisabled={!newItem.trim()}
                    onPress={() => {
                        setData({ ...data, essentialItems: [...data.essentialItems, newItem.trim()] })
                        setNewItem('')
                    }}
                >
                    基本
                </Button>
                <Button
                    startContent={<PlusCircleIcon size={14} />}
                    variant='flat'
                    color='default'
                    size='sm'
                    isDisabled={!newItem.trim()}
                    onPress={() => {
                        setData({ ...data, extraItems: [...data.extraItems, newItem.trim()] })
                        setNewItem('')
                    }}
                >
                    附加
                </Button>
            </div>
        </div>
        <Divider />
        <div className='before:content-["参考概要："] before:text-default-600/70'>
            <Tiptap
                key={`${data.id}-ref`}
                content={data.referenceSummary}
                onUpdate={({ editor }) => {
                    setData({ ...data, referenceSummary: editor.getHTML() })
                }}
                unblankable
            />
        </div>
    </div>
}
