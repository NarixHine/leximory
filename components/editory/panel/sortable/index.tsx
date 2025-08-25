'use client'

import { Dispatch, SetStateAction } from 'react'
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from '@dnd-kit/core'
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { Button, Dropdown, DropdownMenu, DropdownItem, DropdownTrigger } from '@heroui/react'
import { PiPlusCircleDuotone } from 'react-icons/pi'
import SortableItem from './item'
import QuizData, { QuizDataType } from '../../generators/types'
import { NAME_MAP, ICON_MAP, genDefaultValue } from '../../generators/config'

export default function Sortable({ items, setItems }: {
    items: QuizData[]
    setItems: Dispatch<SetStateAction<QuizData[]>>
}) {
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    )

    return (
        <div className='flex gap-4'>
            <div className='flex flex-col gap-4 place-self-end'>
                <Dropdown>
                    <DropdownTrigger>
                        <Button color='primary' variant='flat' size='lg' startContent={<PiPlusCircleDuotone />} isIconOnly></Button>
                    </DropdownTrigger>
                    <DropdownMenu>
                        {(Object.keys(NAME_MAP) as QuizDataType[]).map((key) => (
                            <DropdownItem startContent={ICON_MAP[key]} key={key} onPress={() => {
                                setItems((items) => [...items, genDefaultValue(key)])
                            }}>
                                {NAME_MAP[key]}
                            </DropdownItem>
                        ))}
                    </DropdownMenu>
                </Dropdown>
            </div>
            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
            >
                <SortableContext
                    items={items}
                    strategy={verticalListSortingStrategy}
                >
                    <div className='border-1 border-default-800/20 pl-4 py-2 pr-1 min-w-60 flex flex-col justify-center items-center'>
                        {items.map((item, index) => <SortableItem key={item.id} id={item.id} index={index} name={NAME_MAP[item.type]} onDelete={() => {
                            setItems((items) => items.filter((_, i) => i !== index))
                        }} />)}
                    </div>
                </SortableContext>
            </DndContext>
            <div className='text-2xl font-bold text-default-800/30 h-full'>
                Drag
                <br />
                To reorder
            </div>
        </div>
    )

    function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event

        if (over && active.id !== over.id) {
            setItems((items) => {
                const oldIndex = items.findIndex(item => item.id === active.id)
                const newIndex = items.findIndex(item => item.id === over.id)

                return arrayMove(items, oldIndex, newIndex)
            })
        }
    }
}