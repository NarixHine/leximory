'use client'

import H from '@/components/ui/h'
import { useAtom, useAtomValue } from 'jotai'
import { isEditingAtom, titleAtom } from '../atoms'
import { Input } from "@heroui/input"
import { CHINESE } from '@/lib/fonts'
import { ENGLISH_SERIF } from '@/lib/fonts'
import { langAtom } from '../../atoms'

export default function EditableH() {
    const [title, setTitle] = useAtom(titleAtom)
    const lang = useAtomValue(langAtom)
    const isEditing = useAtomValue(isEditingAtom)
    return isEditing ? <div className='flex justify-center'><Input value={title} onValueChange={setTitle} style={{ fontFamily: `${ENGLISH_SERIF.style.fontFamily}, ${CHINESE.style.fontFamily}` }} size='lg' classNames={{ input: 'text-center text-3xl' }} ></Input></div> : <H usePlayfair={lang === 'zh' || lang === 'en'} useNoto={lang === 'ja'} className={'sm:text-4xl mb-2 text-3xl print:text-3xl print:leading-none'}>{title}</H>
}
