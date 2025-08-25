import { Chip } from '@heroui/chip'
import { Button, Input } from '@heroui/react'
import { useState } from 'react'
import { PiPlusDuotone } from 'react-icons/pi'

export default function List({ items, placeholder, add, remove }: { items: string[], placeholder?: string, add?: (item: string) => void, remove?: (item: string) => void }) {
    const [input, setInput] = useState('')
    return <div className='flex flex-col gap-2'>
        <div className='flex gap-2'>
            <Input type='text' placeholder={placeholder} color='primary' value={input} onValueChange={setInput} variant='underlined' />
            <Button startContent={<PiPlusDuotone />} variant='flat' color='primary' onPress={add && (() => {
                add(input)
                setInput('')
            })}>Add</Button>
        </div>
        <div className={'overflow-x-auto flex gap-2 max-w-full flex-wrap'}>
            {items.map(item => <Chip key={item} variant='flat' className='opacity-70' onClose={remove && (() => {
                remove(item)
            })} color={'primary'}>{item}</Chip>)}
        </div>
    </div>
}
