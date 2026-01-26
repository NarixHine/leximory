'use client'

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
import { PlusCircleIcon } from '@phosphor-icons/react'
import SortableItem from './item'
import { QuizDataType } from '@repo/schema/paper'
import { editoryItemsAtom } from '@repo/ui/paper/atoms'
import { questionStrategies } from '@repo/ui/paper/strategies'
import { ICON_MAP } from '@repo/ui/paper/utils'
import { SECTION_NAME_MAP as NAME_MAP } from '@repo/env/config'
import { useAtom } from 'jotai'

export default function Sortable() {
    const [items, setItems] = useAtom(editoryItemsAtom)
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    )

    return (
        <div className='flex gap-4 lg:ml-5'>
            <div className='flex flex-col gap-1 place-self-end'>
                <Dropdown>
                    <DropdownTrigger>
                        <Button color='secondary' size='lg' startContent={<PlusCircleIcon />} isIconOnly></Button>
                    </DropdownTrigger>
                    <DropdownMenu color='secondary' variant='flat'>
                        {(Object.keys(NAME_MAP) as QuizDataType[]).map((key) => (
                            <DropdownItem startContent={ICON_MAP[key]} key={key} onPress={() => {
                                setItems((items) => [...items, questionStrategies[key].getDefaultValue()])
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
                    <div className='border-1 border-default-800/20 rounded-medium pl-4 py-4 gap-2 pr-1 min-w-60 flex flex-col justify-center items-center'>
                        {items?.map((item, index) => <SortableItem key={item.id} id={item.id} index={index} name={NAME_MAP[item.type]} onDelete={() => {
                            setItems((items) => items.filter((_, i) => i !== index))
                        }} />)}
                    </div>
                </SortableContext>
            </DndContext>
            <div className='text-2xl font-bold text-secondary-100 h-full'>
                Drag
                <br />
                To Reorder
            </div>
        </div>
    )

    function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event

        if (over && active.id !== over.id) {
            setItems((items) => {
                const oldIndex = items.findIndex((item) => item.id === active.id)
                const newIndex = items.findIndex((item) => item.id === over.id)

                return arrayMove(items, oldIndex, newIndex)
            })
        }
    }
}