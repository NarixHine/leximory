'use client'

import { Button } from '@nextui-org/button'
import { Card, CardBody, CardFooter } from '@nextui-org/card'
import { Chip } from '@nextui-org/chip'
import { Spacer } from '@nextui-org/spacer'
import { PiAppleLogoDuotone, PiBookBookmarkDuotone, PiClockCounterClockwiseDuotone, PiUsersDuotone, PiUserDuotone, PiFadersDuotone, PiShareDuotone, PiFolderPlusDuotone, PiTranslateDuotone, PiBinocularsDuotone, PiTrashDuotone, PiHourglassMediumDuotone } from 'react-icons/pi'
import { langMap, colorMap, libAccessStatusMap, Lang } from '@/lib/config'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { postFontFamily } from '@/lib/fonts'
import { atomWithStorage } from 'jotai/utils'
import { useAtomValue } from 'jotai'
import { Skeleton } from '@nextui-org/skeleton'
import Form from '../../../../components/form'
import { Input } from '@nextui-org/input'
import { Checkbox } from '@nextui-org/checkbox'
import { Select, SelectItem } from '@nextui-org/select'
import { create, remove, save } from './actions'
import { useForm } from 'react-hook-form'
import { useDisclosure } from '@nextui-org/react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'

export function LibrarySkeleton() {
    return (
        <Card className='w-full opacity-60' shadow='sm'>
            <CardBody className='px-6 pt-5'>
                <Skeleton className='w-48 h-10 rounded-lg' />
                <Spacer y={8} />
                <div className='flex space-x-2'>
                    <Skeleton className='w-16 h-6 rounded-lg' />
                    <Skeleton className='w-16 h-6 rounded-lg' />
                </div>
            </CardBody>
            <CardFooter className='px-4 pb-4 flex gap-4'>
                <Skeleton className='w-24 h-9 rounded-lg' />
                <div className='flex flex-col gap-1'>
                    <Skeleton className='w-16 h-3 rounded-lg' />
                    <Skeleton className='w-12 h-5 rounded-lg' />
                </div>
            </CardFooter>
        </Card>
    )
}

export const recentAccessAtom = atomWithStorage<Record<string, { id: string; title: string }>>('recent-access', {}, {
    getItem: (key, initialValue) => {
        const storedValue = localStorage.getItem(key)
        return storedValue ? JSON.parse(storedValue) : initialValue
    },
    setItem: (key, value) => {
        localStorage.setItem(key, JSON.stringify(value))
    },
    removeItem: (key) => {
        localStorage.removeItem(key)
    }
})

function Library({ id, name, lexicon, lang, isOwner, access, orgId, orgs, shortcut }: {
    id: string,
    name: string,
    access: number,
    lexicon: {
        count: number,
    },
    lang: string,
    isOwner: boolean,
    orgId: string | null | undefined,
    shortcut: boolean,
    orgs: { label: string, name: string }[]
}) {
    const router = useRouter()
    const topics = ([] as string[])
        .concat(access === libAccessStatusMap.public ? ['共享'] : [])
        .concat(shortcut ? ['快捷保存'] : [])
    const recentAccess = useAtomValue(recentAccessAtom)
    const recentAccessItem = recentAccess[id]

    const { register, handleSubmit, formState } = useForm<{
        id: string,
        name: string,
        access: boolean,
        shortcut: boolean,
        org: string,
    }>({
        defaultValues: {
            id,
            name,
            access: access === libAccessStatusMap.public,
            shortcut,
            org: orgId ?? 'none',
        }
    })

    const { isOpen, onOpen, onOpenChange } = useDisclosure()
    return (<div className='w-full relative'>
        {isOwner && <Button isIconOnly color='secondary' variant='light' startContent={<PiFadersDuotone />} className='absolute top-2 right-2 z-10' onPress={onOpen}></Button>}
        <Card fullWidth shadow='sm' isPressable onPress={() => {
            router.push(`/library/${id}`)
        }}>
            <CardBody className='px-6 pt-5'>
                <a className='text-4xl' style={{
                    fontFamily: postFontFamily
                }}>{name}</a>
                <Spacer y={5}></Spacer>
                <div className='flex space-x-2'>
                    {[langMap[lang as Lang]].concat(topics).map(tag => <Chip key={tag} variant='flat' color={colorMap[tag]}>{tag}</Chip>)}
                </div>
            </CardBody>
            <CardFooter className='px-4 pb-4 flex gap-4'>
                <Button as={Link} href={`/library/${id}/corpus`} startContent={<PiBookBookmarkDuotone />} color='secondary' variant='flat'>语料本</Button>
                <div className='flex flex-col items-start'>
                    <p className='text-xs opacity-80'>积累词汇</p>
                    <Chip color='warning' variant='dot' className='border-none'>{lexicon.count}</Chip>
                </div>
                <div className='flex-1'></div>
                {recentAccessItem && <Button color={'primary'} radius='full' startContent={<PiClockCounterClockwiseDuotone />} variant='light' as={Link} href={`/library/${id}/${recentAccessItem.id}`}>
                    <span className='inline-block text-ellipsis overflow-hidden whitespace-nowrap max-w-[20vw]'>{recentAccessItem.title}</span>
                </Button>}
            </CardFooter>
        </Card>

        <Form
            actionButton={<Button isIconOnly color='danger' variant='flat' startContent={<PiTrashDuotone />} onPress={() => {
                const timer = setTimeout(() => {
                    remove({ id })
                    toast.success('删除成功')
                }, 3000)
                toast('三秒后删除……', {
                    duration: 3000,
                    icon: <PiHourglassMediumDuotone />,
                    cancel: {
                        label: '撤销',
                        onClick: () => {
                            clearTimeout(timer)
                            toast.dismiss()
                        },
                    },
                })
            }}></Button>}
            isOpen={isOpen}
            onOpenChange={onOpenChange}
            isLoading={formState.isSubmitting}
            onSubmit={handleSubmit(save)}
            title='编辑文库'
        >
            <input type='hidden' {...register('id')} />
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-4 mx-auto'>
                <Input isRequired label='文库名' {...register('name')} />
                <Select isRequired label='文库所属小组' {...register('org')} >
                    <SelectItem startContent={<PiUserDuotone />} key='none' value='none'>无</SelectItem>
                    {orgs.map(org => <SelectItem startContent={<PiUsersDuotone />} key={org.name} value={org.name}>{org.label}</SelectItem>) as any}
                </Select>
                <Checkbox color='secondary' {...register('access')} icon={<PiShareDuotone />}>
                    公开并上架集市
                </Checkbox>
                <Checkbox color='secondary' {...register('shortcut')} icon={<PiAppleLogoDuotone />}>
                    显示于 iOS 快捷保存选项
                </Checkbox>
            </div>
        </Form>
    </div>)
}

export function LibraryAddButton() {
    const { register, handleSubmit, formState } = useForm<{
        name: string,
        lang: Lang,
    }>({
        defaultValues: {
            name: '新文库',
            lang: 'en',
        }
    })
    const { isOpen, onOpen, onOpenChange } = useDisclosure()
    return <>
        <Card className='w-full opacity-60 bg-transparent' isPressable shadow='sm' onPress={onOpen}>
            <CardBody className='px-6 pt-5 overflow-hidden'>
                <motion.div
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.3 }}
                    whileHover={{ scale: 1.1, rotate: 10 }}
                    className='text-7xl h-20 text-slate-700 dark:text-slate-200 flex items-center justify-center rounded-lg'><PiFolderPlusDuotone /></motion.div>
            </CardBody>
        </Card>
        <Form
            isOpen={isOpen}
            onOpenChange={onOpenChange}
            isLoading={formState.isSubmitting}
            onSubmit={handleSubmit(create)}
            title='创建文库'
        >
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-4 mx-auto'>
                <Input isRequired startContent={<PiBinocularsDuotone />} label='文库名' {...register('name')} />
                <Select isRequired startContent={<PiTranslateDuotone />} label='语言' {...register('lang')} validate={value => {
                    if (!value) return '请选择语言'
                    return true
                }}>
                    {Object.entries(langMap).map(([key, value]) => <SelectItem key={key} value={key}>{value}</SelectItem>)}
                </Select>
            </div>
        </Form>
    </>
}

export default Library
