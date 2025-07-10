'use client'

import { useState, useTransition } from 'react'
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
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { reorderTexts } from '../actions'
import Text from '../../components/text'
import { PiArrowsOutCardinalBold } from 'react-icons/pi'

type TextItem = Awaited<ReturnType<typeof import('@/server/db/text').getTexts>>[number]

function SortableItem({ item }: { item: TextItem }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
    } = useSortable({ id: item.id })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    }

    return (
        <div ref={setNodeRef} style={style} {...attributes} className='relative my-2'>
            <div {...listeners} className='absolute top-1/2 -translate-y-1/2 right-2 z-10 cursor-grab p-2 bg-default-100/50 rounded-full'>
                <PiArrowsOutCardinalBold />
            </div>
            <Text
                id={item.id}
                title={item.title}
                topics={item.topics ?? []}
                hasEbook={item.hasEbook}
                createdAt={item.createdAt}
                disableNavigation
            />
        </div>
    )
}

export default function ReorderList({ texts, lib }: { texts: TextItem[], lib: string }) {
    const [items, setItems] = useState(texts)
    const [isPending, startTransition] = useTransition()

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    )

    function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event

        if (over && active.id !== over.id) {
            const previousItems = items
            const oldIndex = previousItems.findIndex((item) => item.id === active.id)
            const newIndex = previousItems.findIndex((item) => item.id === over.id)
            const newItems = arrayMove(previousItems, oldIndex, newIndex)

            setItems(newItems)

            startTransition(async () => {
                try {
                    await reorderTexts({ lib, ids: newItems.map(i => i.id) })
                } catch (error) {
                    setItems(previousItems)
                    // Optional: Add a toast notification to inform the user of the failure.
                    console.error('Failed to reorder texts:', error)
                }
            })
        }
    }

    return (
        <div className={`max-w-md mx-auto ${isPending ? 'opacity-50' : ''}`}>
            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
            >
                <SortableContext
                    items={items.map(i => i.id)}
                    strategy={verticalListSortingStrategy}
                >
                    {items.map(item => <SortableItem key={item.id} item={item} />)}
                </SortableContext>
            </DndContext>
        </div>
    )
}
