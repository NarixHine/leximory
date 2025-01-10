'use client'

import H from '@/components/ui/h'
import { useAtom, useAtomValue } from 'jotai'
import { isEditingAtom, titleAtom } from '../atoms'
import { Input } from '@nextui-org/input'
import { CHINESE } from '@/lib/fonts'
import { ENGLISH_SERIF } from '@/lib/fonts'

export default function EditableH() {
    const [title, setTitle] = useAtom(titleAtom)
    const isEditing = useAtomValue(isEditingAtom)
    return isEditing ? <div className='flex justify-center'><Input value={title} onValueChange={setTitle} style={{ fontFamily: `${ENGLISH_SERIF.style.fontFamily}, ${CHINESE.style.fontFamily}` }} color='primary' size='lg' classNames={{ input: 'text-center text-3xl' }} ></Input></div> : <H useNoto className={'sm:text-4xl mb-2 text-3xl'}>{title}</H>
}
