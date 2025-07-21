'use client'

import H from '@/components/ui/h'
import { useAtom, useAtomValue } from 'jotai'
import { isEditingAtom, titleAtom } from '../atoms'
import { Input } from "@heroui/input"

export default function EditableH() {
    const [title, setTitle] = useAtom(titleAtom)
    const isEditing = useAtomValue(isEditingAtom)
    return isEditing ? <div className='flex justify-center'><Input value={title} onValueChange={setTitle} size='lg' classNames={{ input: 'text-center text-3xl' }} ></Input></div> : <H fancy className={'sm:text-4xl mb-2 text-3xl print:text-5xl print:leading-none print:tracking-tighter'}>{title}</H>
}
