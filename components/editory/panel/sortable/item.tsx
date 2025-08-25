import React from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button } from '@heroui/react'
import { PiXCircleDuotone } from 'react-icons/pi'

export default function SortableItem(props: {
    id: string
    index: number
    name: string
    onDelete: () => void
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
    } = useSortable({ id: props.id })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    }

    return (
        <li ref={setNodeRef} style={style} {...attributes} {...listeners} className={'p-2 font-semibold flex justify-center items-center w-full gap-0.5'}>
            <span>{`${props.index + 1}. ${props.name}`}</span> <Button size='sm' className='rounded-full' color='danger' variant='light' onPress={props.onDelete} isIconOnly><PiXCircleDuotone /></Button>
        </li>
    )
}
