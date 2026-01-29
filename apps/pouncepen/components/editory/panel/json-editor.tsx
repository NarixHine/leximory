'use client'

import { Textarea } from '@heroui/react'
import { ChangeEvent, useEffect, useState } from 'react'
import { toast } from 'sonner'

import { useAtom } from 'jotai'
import { editoryItemsAtom } from '@repo/ui/paper/atoms'

export function JsonEditor() {
    const [items, setItems] = useAtom(editoryItemsAtom)
    const [json, setJson] = useState('')

    useEffect(() => {
        setJson(JSON.stringify(items, null, 4))
    }, [items])

    const handleJsonChange = (e: ChangeEvent<HTMLInputElement>) => {
        const newJson = e.target.value
        setJson(newJson)
        try {
            const parsed = JSON.parse(newJson)
            setItems(parsed)
        } catch {
            toast.error('Invalid JSON')
        }
    }

    return (
        <section className='w-full'>
            <h2 className='font-bold text-4xl pt-6 pb-3'>Raw Data</h2>
            <Textarea
                color='primary'
                value={json}
                onChange={handleJsonChange}
                maxRows={20}
                minRows={2}
                className='font-mono text-sm'
                variant='flat'
                description='仅供复制粘贴使用，编辑请使用 Pen 界面。'
                classNames={{
                    description: 'font-ui'
                }}
            />
        </section>
    )
}
