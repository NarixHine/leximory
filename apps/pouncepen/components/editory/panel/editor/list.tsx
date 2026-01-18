import { Chip } from '@heroui/chip'
import { Button, Input } from '@heroui/react'
import { useState } from 'react'
import { PlusCircleIcon } from '@phosphor-icons/react'

export default function List({ items, placeholder, add, remove }: { items: string[], placeholder?: string, add?: (item: string) => void, remove?: (item: string) => void }) {
    const [input, setInput] = useState('')
    return <div className='flex flex-col gap-2'>
        <div className='flex gap-2'>
            <Input type='text' placeholder={placeholder} color='secondary' value={input} onValueChange={setInput} variant='underlined' />
            <Button startContent={<PlusCircleIcon />} variant='flat' color='secondary' isDisabled={!input.trim()} onPress={add && (() => {
                add(input)
                setInput('')
            })}>添加</Button>
        </div>
        <div className={'overflow-x-auto flex gap-2 flex-wrap'}>
            {items.map(item => <Chip as={'div'} key={item} variant='flat' classNames={{
                base: 'opacity-70'
            }} onClose={remove && (() => {
                remove(item)
            })} color={'secondary'}>{item.length > 60 ? item.slice(0, 60) + ' ...' : item}</Chip>)}
        </div>
    </div>
}
