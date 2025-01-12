'use client'

import { Breadcrumbs, BreadcrumbItem } from '@nextui-org/breadcrumbs'
import { Button } from '@nextui-org/button'
import { PiBookBookmarkDuotone, PiFileTextDuotone, PiBooksDuotone, PiUserCircleDuotone } from 'react-icons/pi'
import Link from 'next/link'
import { useTransitionRouter as useRouter } from 'next-view-transitions'
import { useAtomValue } from 'jotai'
import { isReaderModeAtom } from '@/app/atoms'
import { NavProps } from '.'

export default function NavBreadcrumbs({ lib, text, tenant, isAtCorpus }: NavProps & { tenant: string }) {
    const isReaderMode = useAtomValue(isReaderModeAtom)
    const router = useRouter()
    return !isReaderMode && (
        <div className='sticky flex justify-center mb-6 -mt-6 top-4 z-30 left-0 w-full space-x-1'>
            <Breadcrumbs variant='solid' radius='lg' className='overflow-x-hidden max-w-[90%]' classNames={{
                list: 'flex-nowrap',
            }}>
                <BreadcrumbItem className='max-w-full' startContent={<PiUserCircleDuotone />} onPress={() => {
                    router.push(`/library`)
                }}>
                    <span className='inline-block text-ellipsis overflow-hidden whitespace-nowrap max-w-[20vw] align-middle'>
                        {tenant}
                    </span>
                </BreadcrumbItem>
                {lib && <BreadcrumbItem className='max-w-full' startContent={<PiBooksDuotone />} onPress={() => {
                    router.push(`/library/${lib.id}`)
                }}>
                    <span className='inline-block text-ellipsis overflow-hidden whitespace-nowrap max-w-[30vw] align-middle'>
                        {lib.name}
                    </span>
                </BreadcrumbItem>}
                {isAtCorpus && <BreadcrumbItem className='max-w-full' startContent={<PiBookBookmarkDuotone />}>语料本</BreadcrumbItem>}
                {text && lib && <BreadcrumbItem className='max-w-full' startContent={<PiFileTextDuotone />} onPress={() => {
                    router.push(`/library/${lib.id}/${text.id}`)
                }}>
                    <span className='inline-block text-ellipsis overflow-hidden whitespace-nowrap max-w-[40vw] align-middle'>
                        {text.name}
                    </span>
                </BreadcrumbItem>}
            </Breadcrumbs>
            {lib && <Button size='sm' variant='flat' href={`/library/${lib.id}/corpus`} as={Link} radius='lg' isIconOnly startContent={<PiBookBookmarkDuotone />}></Button>}
        </div>
    )
}
