'use client'

import { Breadcrumbs, BreadcrumbItem } from "@heroui/breadcrumbs"
import { Button } from "@heroui/button"
import { PiBookBookmarkDuotone, PiFileTextDuotone, PiBooksDuotone, PiUserCircleDuotone, PiSkipBackCircleDuotone } from 'react-icons/pi'
import Link from 'next/link'
import { NavProps } from '.'
import { useRouter } from 'next/navigation'

export default function NavBreadcrumbs({ lib, text, tenant, isAtCorpus }: NavProps & { tenant: string }) {
    const router = useRouter()
    return <>
        <Breadcrumbs underline='hover' variant='solid' radius='lg' className='overflow-x-hidden max-w-[95vw]' classNames={{
            list: 'flex-nowrap bg-[#ece1d9]/70 dark:bg-default-200/70 backdrop-blur-sm',
        }}>
            <BreadcrumbItem className='max-w-full' startContent={<PiUserCircleDuotone className='text-[#67595e] dark:text-default-500' />} onPress={() => {
                router.push(`/library`)
            }}>
                <span className='inline-block text-ellipsis overflow-hidden whitespace-nowrap max-w-[20vw] md:max-w-[25vw] align-middle text-[#67595e] dark:text-default-500'>
                    {tenant}
                </span>
            </BreadcrumbItem>
            {lib && <BreadcrumbItem className='max-w-full' startContent={<PiBooksDuotone className='text-[#67595e] dark:text-default-500' />} onPress={() => {
                router.push(`/library/${lib.id}`)
            }}>
                <span className='inline-block text-ellipsis overflow-hidden whitespace-nowrap max-w-[20vw] md:max-w-[25vw] align-middle text-[#67595e] dark:text-default-500'>
                    {lib.name}
                </span>
            </BreadcrumbItem>}
            {isAtCorpus && <BreadcrumbItem className='max-w-full text-[#67595e] dark:text-default-500' startContent={<PiBookBookmarkDuotone className='text-[#67595e] dark:text-default-500' />}>语料本</BreadcrumbItem>}
            {text && lib && <BreadcrumbItem className='max-w-full' startContent={<PiFileTextDuotone className='text-[#67595e] dark:text-default-500' />} onPress={() => {
                router.push(`/library/${lib.id}/${text.id}`)
            }}>
                <span className='inline-block text-ellipsis overflow-hidden whitespace-nowrap max-w-[20vw] md:max-w-[30vw] lg:max-w-[40vw] align-middle text-[#67595e] dark:text-default-500'>
                    {text.name}
                </span>
            </BreadcrumbItem>}
        </Breadcrumbs>
        {
            lib &&
            (
                isAtCorpus
                    ? <Button
                        size='sm'
                        variant='flat'
                        onPress={() => {
                            router.back()
                        }}
                        radius='lg'
                        isIconOnly
                        className='bg-[#e4d4c8]/50 dark:bg-default-200/50 backdrop-blur-sm print:hidden'
                        startContent={<PiSkipBackCircleDuotone className='text-[#67595e] dark:text-default-500 text-lg' />}
                    />
                    : <Button
                        size='sm'
                        variant='flat'
                        href={`/library/${lib.id}/corpus`}
                        as={Link}
                        radius='lg'
                        isIconOnly
                        className='bg-[#e4d4c8]/50 dark:bg-default-200/50 backdrop-blur-sm print:hidden'
                        startContent={<PiBookBookmarkDuotone className='text-[#67595e] dark:text-default-500 text-medium' />}
                    />
            )
        }
    </>
}
