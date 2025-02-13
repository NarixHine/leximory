'use client'

import { Card, CardBody, CardFooter } from "@heroui/card"
import { Chip } from "@heroui/chip"
import { useRouter } from 'next/navigation'
import { postFontFamily } from '@/lib/fonts'
import { add } from './actions'
import { motion } from 'framer-motion'
import { PiFilePlusDuotone } from 'react-icons/pi'
import { useTransitionRouter } from 'next-view-transitions'
import { useTransition } from 'react'
import { CircularProgress } from "@heroui/progress"
import { useAtomValue } from 'jotai'
import { libAtom } from '../../atoms'

function Text({ id, title, topics, hasEbook }: {
    id: string,
    title: string,
    topics: string[],
    hasEbook: boolean
}) {
    const lib = useAtomValue(libAtom)
    const router = useRouter()
    return (<div className='w-full h-full relative'>
        <Card shadow='sm' fullWidth className='h-full' isPressable onPress={() => {
            router.push(`/library/${lib}/${id}`)
        }}>
            <CardBody className='p-7'>
                <a className='text-2xl text-balance' style={{
                    fontFamily: postFontFamily
                }}>{title}</a>
            </CardBody>
            <CardFooter className='p-7'>
                <div className='gap-2 flex flex-wrap align-middle items-center'>
                    {topics.map(topic => <Chip key={topic} variant='flat' color={'primary'}>{topic}</Chip>)}
                    {hasEbook && <Chip variant='flat' color={'secondary'}>电子书</Chip>}
                </div>
            </CardFooter>
        </Card>
    </div>)
}

export function AddTextButton() {
    const lib = useAtomValue(libAtom)
    const router = useTransitionRouter()
    const [isLoading, startTransition] = useTransition()
    return <Card className='w-full opacity-60 bg-transparent' isPressable shadow='sm' onPress={() => {
        startTransition(async () => {
            const id = await add(lib)
            router.push(`/library/${lib}/${id}`)
        })
    }}>
        <CardBody className='px-6 pt-5 flex items-center justify-center overflow-hidden'>
            <motion.div
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.3 }}
                whileHover={{ scale: 1.1, rotate: 10 }}
                className='text-7xl h-20 text-slate-700 dark:text-slate-200 rounded-lg flex items-center justify-center'>{isLoading ? <CircularProgress size='lg' /> : <PiFilePlusDuotone />}</motion.div>
        </CardBody>
    </Card>
}

export default Text
